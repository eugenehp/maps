//! Landmark models: hand-built 3D models (glTF binary) that the map draws in place of a
//! building's extruded parts, e.g. MIT's Great Dome. See `landmarks/README.md`.
//!
//! `landmarks/<city>/<id>.json` names the model file next to it, the point it stands on (its
//! origin), its rotation and which of the building's parts it replaces: OSM building parts whose
//! centre is within `replace.radius` m of the point and whose bottom is at least
//! `replace.minHeight` m up. The model is drawn with the building it stands in (same id, colour,
//! card and timeline); the building's footprint parts are kept.
//!
//! `tiles` copies the models to `web/data/<city>/models/` and lists them in index.json `models`.

use crate::city::Ctx;
use anyhow::{Context, Result};
use serde::Deserialize;
use std::path::PathBuf;

#[derive(Deserialize)]
struct Replace {
    radius: f64,
    #[serde(rename = "minHeight", default)]
    min_height: f32,
}

#[derive(Deserialize)]
struct Spec {
    id: String,
    name: String,
    model: String,
    lonlat: [f64; 2],
    #[serde(default)]
    rotation: f64,
    replace: Option<Replace>,
    licence: String,
    #[serde(default = "yes")]
    publishable: bool,
}
fn yes() -> bool {
    true
}

pub struct Landmark {
    pub id: String,
    pub name: String,
    pub model: PathBuf,
    pub lonlat: [f64; 2],
    pub rotation: f64,
    pub radius: f64,
    pub min_height: f32,
    pub licence: String,
    pub publishable: bool,
}

pub fn load(ctx: &Ctx) -> Result<Vec<Landmark>> {
    let dir = ctx.root_cache().parent().unwrap().join("landmarks").join(ctx.city.id);
    let Ok(rd) = std::fs::read_dir(&dir) else { return Ok(vec![]) };
    let mut out = Vec::new();
    for e in rd {
        let p = e?.path();
        if p.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let s: Spec = serde_json::from_slice(&std::fs::read(&p)?).with_context(|| format!("{}", p.display()))?;
        let model = dir.join(&s.model);
        anyhow::ensure!(model.exists(), "{}: no model file {}", p.display(), model.display());
        let (radius, min_height) = s.replace.map_or((0.0, 0.0), |r| (r.radius, r.min_height));
        out.push(Landmark {
            id: s.id, name: s.name, model, lonlat: s.lonlat, rotation: s.rotation, radius, min_height,
            licence: s.licence, publishable: s.publishable,
        });
    }
    out.sort_by(|a, b| a.id.cmp(&b.id));
    if !out.is_empty() {
        println!("landmark models: {}", out.iter().map(|l| l.id.as_str()).collect::<Vec<_>>().join(", "));
    }
    Ok(out)
}
