//! A layer from any GeoJSON FeatureCollection, set up in the config file — the way to add a
//! dataset without writing a provider. Points mark the building they fall on (or the nearest
//! within 25 m); polygons mark every building whose centroid is inside.
//!
//! ```json
//! { "type": "geojson", "city": "sf", "path": "layers/sf/murals.geojson",
//!   "layer": { "id": "murals", "name": "Murals", "licence": "CC0", "publishable": true },
//!   "category": { "property": "style", "default": "other", "colors": { "mission": "#e4572e" } },
//!   "properties": { "name": "title", "from": "year", "to": null, "url": "link", "note": "artist", "tags": "tags", "role": null } }
//! ```

use super::{Category, Item, LayerDef, LayerProvider, LayerSet, ProviderInfo};
use crate::city::City;
use anyhow::{bail, Context, Result};
use serde::Deserialize;
use serde_json::Value;
use std::collections::BTreeMap;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;

const PALETTE: [&str; 10] = ["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#bab0ac"];

#[derive(Clone, Deserialize)]
pub struct LayerConf {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub licence: String,
    #[serde(default = "yes")]
    pub publishable: bool,
}
fn yes() -> bool {
    true
}

#[derive(Clone, Default, Deserialize)]
pub struct CategoryConf {
    /// feature property holding the category; absent = one category for the whole layer
    pub property: Option<String>,
    #[serde(default)]
    pub default: Option<String>,
    #[serde(default)]
    pub colors: BTreeMap<String, String>,
    /// parent category id for every category of this layer (e.g. an existing `software`)
    #[serde(default)]
    pub parent: Option<String>,
}

#[derive(Clone, Deserialize)]
pub struct PropConf {
    #[serde(default = "name")]
    pub name: Option<String>,
    pub from: Option<String>,
    pub to: Option<String>,
    pub url: Option<String>,
    pub note: Option<String>,
    pub tags: Option<String>,
    pub role: Option<String>,
    pub wikidata: Option<String>,
}
fn name() -> Option<String> {
    Some("name".into())
}
impl Default for PropConf {
    fn default() -> Self {
        PropConf { name: name(), from: None, to: None, url: None, note: None, tags: None, role: None, wikidata: None }
    }
}

#[derive(Clone, Deserialize)]
pub struct GeoJsonConf {
    pub id: String,
    pub city: String,
    pub path: PathBuf,
    pub layer: LayerConf,
    #[serde(default)]
    pub category: CategoryConf,
    #[serde(default)]
    pub properties: PropConf,
    /// a fixed role for every item (overrides `properties.role`)
    #[serde(default)]
    pub role: Option<String>,
}

pub struct GeoJson {
    pub conf: GeoJsonConf,
    id: &'static str,
}

impl GeoJson {
    pub fn new(conf: GeoJsonConf) -> GeoJson {
        // provider ids live as long as the server
        let id: &'static str = Box::leak(conf.id.clone().into_boxed_str());
        GeoJson { conf, id }
    }
}

fn prop_str(p: &Value, key: &Option<String>) -> Option<String> {
    let v = &p[key.as_deref()?];
    match v {
        Value::String(s) if !s.trim().is_empty() => Some(s.trim().to_string()),
        Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}
fn prop_year(p: &Value, key: &Option<String>) -> Option<i32> {
    let v = &p[key.as_deref()?];
    let y = v.as_i64().or_else(|| v.as_str().and_then(|s| s.get(..4)).and_then(|s| s.parse().ok()))?;
    (1000..=2200).contains(&y).then_some(y as i32)
}
fn slug(s: &str) -> String {
    let v: String = s.to_lowercase().chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '-' }).collect();
    v.trim_matches('-').to_string()
}

/// Even-odd point in polygon over all rings, in lon/lat.
fn in_rings(rings: &[Vec<[f64; 2]>], x: f64, y: f64) -> bool {
    let mut inside = false;
    for r in rings {
        let n = r.len();
        if n < 3 {
            continue;
        }
        let mut j = n - 1;
        for i in 0..n {
            let (xi, yi, xj, yj) = (r[i][0], r[i][1], r[j][0], r[j][1]);
            if (yi > y) != (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi {
                inside = !inside;
            }
            j = i;
        }
    }
    inside
}

fn rings_of(v: &Value) -> Vec<Vec<[f64; 2]>> {
    v.as_array()
        .map(|rs| {
            rs.iter()
                .map(|r| r.as_array().map(|pts| pts.iter().filter_map(|p| Some([p[0].as_f64()?, p[1].as_f64()?])).collect()).unwrap_or_default())
                .collect()
        })
        .unwrap_or_default()
}

impl LayerProvider for GeoJson {
    fn info(&self) -> ProviderInfo {
        ProviderInfo { id: self.id, name: "GeoJSON layer", description: "A layer configured from a GeoJSON file (api.json).", writable: false }
    }

    fn version(&self, _city: &City) -> u64 {
        std::fs::metadata(&self.conf.path)
            .and_then(|m| m.modified())
            .map(|t| t.duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0))
            .unwrap_or(0)
    }

    fn load(&self, city: &City) -> Result<LayerSet> {
        if city.id != self.conf.city {
            return Ok(LayerSet::default());
        }
        let c = &self.conf;
        let doc: Value = serde_json::from_slice(&std::fs::read(&c.path).with_context(|| format!("{}", c.path.display()))?)?;
        let Some(features) = doc["features"].as_array() else { bail!("{}: not a FeatureCollection", c.path.display()) };
        let ix = city.index()?;
        let mut cats: Vec<Category> = Vec::new();
        let mut items = Vec::new();
        let (mut unresolved, mut skipped) = (0usize, 0usize);
        for (k, f) in features.iter().enumerate() {
            let p = &f["properties"];
            let Some(name) = prop_str(p, &c.properties.name) else { skipped += 1; continue };
            let cat_name = c.category.property.as_ref().and_then(|k| prop_str(p, &Some(k.clone()))).or(c.category.default.clone()).unwrap_or_else(|| c.layer.name.clone());
            let cat_id = slug(&cat_name);
            let g = &f["geometry"];
            let mut gids: Vec<u32> = Vec::new();
            let mut lonlat = None;
            match g["type"].as_str() {
                Some("Point") => {
                    if let (Some(lon), Some(lat)) = (g["coordinates"][0].as_f64(), g["coordinates"][1].as_f64()) {
                        lonlat = Some([lon, lat]);
                        gids.extend(city.building_at(lon, lat)?);
                    }
                }
                Some(t @ ("Polygon" | "MultiPolygon")) => {
                    let polys: Vec<Vec<Vec<[f64; 2]>>> = if t == "Polygon" {
                        vec![rings_of(&g["coordinates"])]
                    } else {
                        g["coordinates"].as_array().map(|a| a.iter().map(rings_of).collect()).unwrap_or_default()
                    };
                    for rings in &polys {
                        let pts = rings.iter().flatten();
                        let (mut x0, mut y0, mut x1, mut y1) = (f64::MAX, f64::MAX, f64::MIN, f64::MIN);
                        for q in pts {
                            x0 = x0.min(q[0]); x1 = x1.max(q[0]); y0 = y0.min(q[1]); y1 = y1.max(q[1]);
                        }
                        let (ax, az) = city.to_xz(x0, y1);
                        let (bx, bz) = city.to_xz(x1, y0);
                        for b in ix.in_box(ax as f32, az as f32, bx as f32, bz as f32) {
                            let (lon, lat) = city.to_lonlat(ix.cx[b as usize] as f64, ix.cz[b as usize] as f64);
                            if in_rings(rings, lon, lat) {
                                gids.push(b);
                            }
                        }
                    }
                }
                _ => {}
            }
            if gids.is_empty() {
                unresolved += 1;
                continue;
            }
            gids.sort_unstable();
            gids.dedup();
            // categories only for items that landed on a building
            if !cats.iter().any(|x| x.id == cat_id) {
                let color = c.category.colors.get(&cat_name).or(c.category.colors.get(&cat_id)).cloned().unwrap_or_else(|| PALETTE[cats.len() % PALETTE.len()].into());
                cats.push(Category { id: cat_id.clone(), name: cat_name, color, parent: c.category.parent.clone(), bit: None, off: false });
            }
            let tags = match &p[c.properties.tags.as_deref().unwrap_or("\u{0}")] {
                Value::Array(a) => a.iter().filter_map(|t| t.as_str().map(str::to_string)).collect(),
                Value::String(s) => s.split(',').map(|t| t.trim().to_string()).filter(|t| !t.is_empty()).collect(),
                _ => vec![],
            };
            items.push(Item {
                id: format!("{}:{k}", c.id),
                layer: c.layer.id.clone(),
                category: cat_id,
                name,
                role: c.role.clone().or_else(|| prop_str(p, &c.properties.role)),
                from: prop_year(p, &c.properties.from),
                to: prop_year(p, &c.properties.to),
                url: prop_str(p, &c.properties.url),
                note: prop_str(p, &c.properties.note),
                wikidata: prop_str(p, &c.properties.wikidata),
                source: c.id.clone(),
                tags,
                gids,
                lonlat,
                author: None,
            });
        }
        if unresolved + skipped > 0 {
            eprintln!("provider {}: {} items, {unresolved} not on a building, {skipped} without a name", c.id, items.len());
        }
        let layer = LayerDef {
            id: c.layer.id.clone(),
            name: c.layer.name.clone(),
            description: c.layer.description.clone(),
            licence: c.layer.licence.clone(),
            publishable: c.layer.publishable,
            categories: cats,
        };
        Ok(LayerSet { layers: vec![layer], items })
    }
}
