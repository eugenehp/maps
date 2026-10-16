//! Generic attachment of secondary sources to buildings:
//! - `Points`: point layers (NSI) -> every point inside a footprint;
//! - `Polys<T>`: footprint layers (FEMA, Santa Clara, Cupertino) matched by
//!   mutual centroid containment (the source polygon contains the
//!   building's centroid and vice versa), else a source polygon of
//!   comparable area (1:4) containing the building's centroid, else — since
//!   independently digitised footprints are often shifted by metres — the
//!   nearest source centroid within min(MATCH_M, half the building's size)
//!   with an area ratio within 1:2. A cheap stand-in for IoU;
//! - `Parcels<T>`: parcel layers -> every parcel containing the building's
//!   centroid (stacked condo parcels all match).

use super::arcgis::{num, read_layer, text};
use super::pq::{f64s, i64s, strs};
use crate::city::Ctx;
use crate::geom::{centroid, in_part};
use crate::model::*;
use anyhow::Result;
use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;
use rstar::{
    primitives::{GeomWithData, Rectangle},
    RTree, AABB,
};
use serde_json::Value;
use std::path::Path;

pub fn bbox_of(parts: &Parts) -> ([f64; 2], [f64; 2]) {
    let (mut lo, mut hi) = ([f64::MAX; 2], [f64::MIN; 2]);
    for p in parts.iter().flatten().flatten() {
        lo = [lo[0].min(p[0]), lo[1].min(p[1])];
        hi = [hi[0].max(p[0]), hi[1].max(p[1])];
    }
    (lo, hi)
}

fn inside(p: [f64; 2], parts: &Parts) -> bool {
    parts.iter().any(|part| in_part(p, part))
}

const MATCH_M: f64 = 6.0;

/// Footprint area (m², outer rings) from lon/lat.
pub fn area_m2(parts: &Parts) -> f64 {
    let lat = parts.first().and_then(|p| p.first()).and_then(|r| r.first()).map_or(0.0, |p| p[1]);
    let (kx, ky) = (111_320.0 * lat.to_radians().cos(), 110_574.0);
    parts
        .iter()
        .filter_map(|p| p.first())
        .map(|r| {
            let n = r.len();
            (0..n).map(|i| r[i][0] * kx * r[(i + 1) % n][1] * ky - r[(i + 1) % n][0] * kx * r[i][1] * ky).sum::<f64>().abs() / 2.0
        })
        .sum()
}

/// Polygons with a payload, looked up by point or by footprint.
pub struct Polys<T> {
    /// (payload, parts, centroid, area m²)
    pub items: Vec<(T, Parts, [f64; 2], f64)>,
    tree: RTree<GeomWithData<Rectangle<[f64; 2]>, u32>>,
}

impl<T: Sync> Polys<T> {
    pub fn new(items: Vec<(T, Parts)>) -> Self {
        let items: Vec<(T, Parts, [f64; 2], f64)> = items
            .into_iter()
            .map(|(t, p)| {
                let (c, a) = (centroid(&p), area_m2(&p));
                (t, p, c, a)
            })
            .collect();
        let tree = RTree::bulk_load(
            items.iter().enumerate().map(|(i, (_, p, _, _))| {
                let (lo, hi) = bbox_of(p);
                GeomWithData::new(Rectangle::from_corners(lo, hi), i as u32)
            }).collect(),
        );
        Polys { items, tree }
    }
    pub fn len(&self) -> usize {
        self.items.len()
    }
    /// All polygons containing `p`.
    pub fn at(&self, p: [f64; 2]) -> impl Iterator<Item = u32> + '_ {
        self.tree.locate_all_at_point(p).filter(move |g| inside(p, &self.items[g.data as usize].1)).map(|g| g.data)
    }
    /// The polygon matching a footprint (see module docs).
    pub fn matching(&self, parts: &Parts) -> Option<&T> {
        let c = centroid(parts);
        if let Some(i) = self.at(c).find(|&i| inside(self.items[i as usize].2, parts)) {
            return Some(&self.items[i as usize].0);
        }
        let a = area_m2(parts);
        // A source polygon of comparable size containing our centroid
        // (block-level footprints covering a few row houses still count).
        if let Some(i) = self.at(c).find(|&i| (0.25 * a..=4.0 * a).contains(&self.items[i as usize].3)) {
            return Some(&self.items[i as usize].0);
        }
        let max_d = MATCH_M.min(0.5 * a.sqrt());
        let (kx, ky) = (111_320.0 * c[1].to_radians().cos(), 110_574.0);
        let (dx, dy) = (max_d / kx, max_d / ky);
        self.tree
            .locate_in_envelope_intersecting(AABB::from_corners([c[0] - dx, c[1] - dy], [c[0] + dx, c[1] + dy]))
            .filter_map(|g| {
                let (_, _, sc, sa) = &self.items[g.data as usize];
                let d = (((sc[0] - c[0]) * kx).powi(2) + ((sc[1] - c[1]) * ky).powi(2)).sqrt();
                (d <= max_d && *sa >= 0.5 * a && *sa <= 2.0 * a).then_some((d, g.data))
            })
            .min_by(|x, y| x.0.partial_cmp(&y.0).unwrap())
            .map(|(_, i)| &self.items[i as usize].0)
    }
    pub fn get(&self, i: u32) -> &T {
        &self.items[i as usize].0
    }
}

/// NSI structure point.
pub struct NsiPt {
    floors: Option<f32>,
    med_year: Option<i16>,
}

pub struct Points {
    pts: Vec<NsiPt>,
    tree: RTree<GeomWithData<[f64; 2], u32>>,
}

impl Points {
    pub fn load_nsi(path: &Path) -> Result<Option<Self>> {
        if !path.exists() {
            return Ok(None);
        }
        let reader = ParquetRecordBatchReaderBuilder::try_new(std::fs::File::open(path)?)?.with_batch_size(200_000).build()?;
        let (mut pts, mut geo) = (Vec::new(), Vec::new());
        for batch in reader {
            let batch = batch?;
            let col = |n: &str| batch.column_by_name(n).ok_or_else(|| anyhow::anyhow!("nsi column {n}"));
            let (x, y) = (f64s(col("x")?)?, f64s(col("y")?)?);
            let (st, yr) = (f64s(col("num_story")?)?, i64s(col("med_yr_blt")?)?);
            let _occ = strs(col("occtype")?)?;
            for i in 0..batch.num_rows() {
                let (Some(x), Some(y)) = (x[i], y[i]) else { continue };
                geo.push(GeomWithData::new([x, y], pts.len() as u32));
                pts.push(NsiPt {
                    floors: st[i].filter(|&s| s > 0.0).map(|s| s as f32),
                    med_year: yr[i].filter(|&y| y > 0 && y < 3000).map(|y| y as i16),
                });
            }
        }
        println!("nsi: {} points", pts.len());
        Ok(Some(Points { pts, tree: RTree::bulk_load(geo) }))
    }

    /// NSI floors (max) and census-area median year (median) of the
    /// points inside the footprint.
    pub fn apply(&self, b: &mut Building) {
        let (lo, hi) = bbox_of(&b.parts);
        let mut fl: Option<f32> = None;
        let mut ys: Vec<i16> = Vec::new();
        for g in self.tree.locate_in_envelope(AABB::from_corners(lo, hi)) {
            if inside(*g.geom(), &b.parts) {
                let p = &self.pts[g.data as usize];
                fl = match (fl, p.floors) {
                    (Some(a), Some(c)) => Some(a.max(c)),
                    (a, c) => a.or(c),
                };
                ys.extend(p.med_year);
            }
        }
        b.floors(S_NSI, fl);
        if !ys.is_empty() {
            ys.sort_unstable();
            let y = ys[ys.len() / 2];
            b.year(S_NSI, [y], true, false);
        }
    }
}

/// FEMA USA Structures record.
pub struct Fema {
    pub height: Option<f32>,
    pub occ: String,
    pub outbuilding: bool,
}

pub fn load_fema(dir: &Path) -> Result<Option<Polys<Fema>>> {
    if !dir.exists() {
        return Ok(None);
    }
    let items: Vec<(Fema, Parts)> = read_layer(dir)?
        .into_iter()
        .map(|(p, parts)| {
            (
                Fema {
                    height: num(&p, "HEIGHT").filter(|&h| h > 0.0).map(|h| h as f32),
                    occ: text(&p, "OCC_CLS").to_string(),
                    outbuilding: matches!(text(&p, "OUTBLDG"), "Y" | "1" | "Yes" | "YES"),
                },
                parts,
            )
        })
        .collect();
    println!("fema: {} structures", items.len());
    Ok(Some(Polys::new(items)))
}

impl Polys<Fema> {
    pub fn apply(&self, b: &mut Building) {
        if let Some(f) = self.matching(&b.parts) {
            b.height(S_FEMA, f.height);
            if b.use_class == USE_OTHER && !f.outbuilding {
                b.use_class = match f.occ.as_str() {
                    "Residential" => USE_RESIDENTIAL,
                    "Commercial" => USE_COMMERCIAL,
                    "Industrial" => USE_INDUSTRIAL,
                    "Government" | "Education" | "Assembly" => USE_CIVIC,
                    _ => USE_OTHER,
                };
            }
        }
    }
}

/// NSI + FEMA for a city, whichever were fetched.
pub struct Enricher {
    nsi: Option<Points>,
    fema: Option<Polys<Fema>>,
}

impl Enricher {
    pub fn load(ctx: &Ctx) -> Result<Self> {
        Ok(Enricher { nsi: Points::load_nsi(&ctx.cache.join("nsi.parquet"))?, fema: load_fema(&ctx.cache.join("fema"))? })
    }
    pub fn apply(&self, b: &mut Building) {
        if let Some(n) = &self.nsi {
            n.apply(b);
        }
        if let Some(f) = &self.fema {
            f.apply(b);
        }
    }
}

/// Assessor-style attributes of a parcel / tax lot.
#[derive(Default, Clone)]
pub struct Lot {
    pub years: Vec<i16>,
    pub floors: Option<f32>,
    pub units: u32,
    pub addr: String,
    pub use_def: String,
    pub use_class: Option<u8>,
}

impl Lot {
    /// Merge another record of the same lot (condo units, stacked parcels).
    pub fn merge(&mut self, o: &Lot) {
        self.years.extend(&o.years);
        self.years.sort_unstable();
        self.years.dedup();
        self.floors = match (self.floors, o.floors) {
            (Some(a), Some(b)) => Some(a.max(b)),
            (a, b) => a.or(b),
        };
        self.units += o.units;
        if self.addr.is_empty() {
            self.addr = o.addr.clone();
        }
        if self.use_def.is_empty() {
            self.use_def = o.use_def.clone();
            self.use_class = o.use_class;
        }
    }
}

/// Parcel polygons keyed to lots: buildings take the lot(s) of every
/// parcel containing their centroid (stacked condo parcels merge; parcels
/// without a lot are ignored, so unassessed residual polygons don't win).
pub struct ParcelSource {
    pub src: u8,
    pub polys: Polys<String>,
    pub lots: std::collections::HashMap<String, Lot>,
    first: std::collections::HashMap<String, u32>,
}

impl ParcelSource {
    pub fn new(src: u8, items: Vec<(String, Parts)>, lots: std::collections::HashMap<String, Lot>) -> Self {
        let mut first = std::collections::HashMap::new();
        for (i, (id, _)) in items.iter().enumerate() {
            first.entry(id.clone()).or_insert(i as u32);
        }
        ParcelSource { src, polys: Polys::new(items), lots, first }
    }
    /// Parcel keys (indices) with a lot containing `c`, smallest first.
    pub fn lookup(&self, c: [f64; 2]) -> Vec<u32> {
        let mut v: Vec<(f64, u32)> = self
            .polys
            .at(c)
            .filter(|&i| self.lots.contains_key(self.polys.get(i)))
            .map(|i| {
                let (lo, hi) = bbox_of(&self.polys.items[i as usize].1);
                ((hi[0] - lo[0]) * (hi[1] - lo[1]), i)
            })
            .collect();
        v.sort_by(|a, b| a.partial_cmp(b).unwrap());
        v.into_iter().map(|x| x.1).collect()
    }
    /// Add this source's candidates; returns the parcel used (for sharing).
    pub fn apply(&self, b: &mut Building) -> Option<u32> {
        let hits = self.lookup(centroid(&b.parts));
        let first = *hits.first()?;
        let mut lot = Lot::default();
        let mut seen = std::collections::HashSet::new();
        for &i in &hits {
            let id = self.polys.get(i);
            if seen.insert(id) {
                lot.merge(&self.lots[id]);
            }
        }
        self.apply_lot(b, lot);
        Some(first)
    }

    /// Same, by lot id (e.g. an APN carried by the footprint).
    pub fn apply_id(&self, b: &mut Building, id: &str) -> Option<u32> {
        let lot = self.lots.get(id)?.clone();
        let key = *self.first.get(id)?;
        self.apply_lot(b, lot);
        Some(key)
    }

    fn apply_lot(&self, b: &mut Building, lot: Lot) {
        b.year(self.src, lot.years.iter().copied(), false, false);
        b.floors(self.src, lot.floors);
        if b.addr.is_empty() {
            b.addr = lot.addr;
        }
        if b.units == 0 {
            b.units = lot.units;
        }
        if !lot.use_def.is_empty() && (b.use_def.is_empty() || b.use_class == USE_OTHER) {
            b.use_def = lot.use_def.clone();
        }
        if b.use_class == USE_OTHER {
            b.use_class = lot.use_class.unwrap_or_else(|| use_from_text(&lot.use_def));
        }
    }
}

/// Mark year candidates whose parcel is used by more than one building.
/// `used[i]` lists (source, parcel) pairs building `i` drew years from.
pub fn mark_shared(bs: &mut [Building], used: &[Vec<(u8, u32)>]) -> usize {
    let mut n: std::collections::HashMap<(u8, u32), u32> = std::collections::HashMap::new();
    for u in used.iter().flatten() {
        *n.entry(*u).or_default() += 1;
    }
    let mut shared = 0;
    for (b, u) in bs.iter_mut().zip(used) {
        let mut any = false;
        for &(src, p) in u {
            if n[&(src, p)] > 1 {
                for yc in b.year_c.iter_mut().filter(|c| c.src == src) {
                    yc.shared = true;
                    any = true;
                }
            }
        }
        shared += any as usize;
    }
    shared
}

/// Load a parcel layer whose polygons carry the lot attributes themselves.
pub fn parcels_inline(src: u8, dir: &Path, id_field: &str, parse: impl Fn(&Value) -> Lot + Sync) -> Result<ParcelSource> {
    let feats = read_layer(dir)?;
    let mut lots: std::collections::HashMap<String, Lot> = std::collections::HashMap::new();
    let mut items = Vec::with_capacity(feats.len());
    for (k, (p, parts)) in feats.into_iter().enumerate() {
        let mut id = text(&p, id_field).to_string();
        if id.is_empty() {
            id = format!("#{k}");
        }
        let lot = parse(&p);
        lots.entry(id.clone()).and_modify(|l| l.merge(&lot)).or_insert(lot);
        items.push((id, parts));
    }
    println!("  {} parcels: {} polygons, {} lots ({} with a year)", SOURCES[src as usize].id, items.len(), lots.len(), lots.values().filter(|l| !l.years.is_empty()).count());
    Ok(ParcelSource::new(src, items, lots))
}
