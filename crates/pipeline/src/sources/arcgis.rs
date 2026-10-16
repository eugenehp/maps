//! ArcGIS FeatureServer layers as cached GeoJSON pages, and GeoJSON helpers.

use super::http::get_cached;
use crate::model::Parts;
use anyhow::{Context, Result};
use rayon::prelude::*;
use serde_json::Value;
use std::path::Path;

/// Page through `layer` (…/FeatureServer/N or MapServer/N) into
/// `dir/page_NNN.geojson`. Resumable: existing pages are reused.
pub fn fetch_layer(agent: &ureq::Agent, layer: &str, fields: &str, dir: &Path, page: usize) -> Result<usize> {
    fetch_layer_where(agent, layer, "where=1%3D1", fields, dir, page)
}

/// Same with a custom (URL-encoded) filter, e.g. "where=FIPS%3D%2706001%27"
/// or a "geometry=...&geometryType=esriGeometryEnvelope&inSR=4326&where=1%3D1" envelope.
pub fn fetch_layer_where(agent: &ureq::Agent, layer: &str, filter: &str, fields: &str, dir: &Path, page: usize) -> Result<usize> {
    std::fs::create_dir_all(dir)?;
    let mut total = 0;
    for i in 0.. {
        let url = format!(
            "{layer}/query?{filter}&outFields={fields}&outSR=4326&f=geojson&orderByFields=OBJECTID\
             &resultOffset={}&resultRecordCount={page}",
            i * page
        );
        let path = dir.join(format!("page_{i:03}.geojson"));
        let body = get_cached(agent, &url, &path)?;
        let v: Value = serde_json::from_str(&body).with_context(|| format!("parse {}", path.display()))?;
        let Some(feats) = v["features"].as_array() else {
            std::fs::remove_file(&path)?; // error response: don't cache it
            anyhow::bail!("{layer}: no features in page {i}: {}", &body[..body.len().min(300)]);
        };
        total += feats.len();
        let more = v["exceededTransferLimit"].as_bool().unwrap_or(false) || v["properties"]["exceededTransferLimit"].as_bool().unwrap_or(false);
        if feats.is_empty() || (feats.len() < page && !more) {
            break;
        }
    }
    println!("  {}: {total} features", dir.display());
    Ok(total)
}

/// All features of a cached ArcGIS layer or Socrata geo pages: (properties, parts). Features without
/// usable polygon geometry are skipped.
pub fn read_layer(dir: &Path) -> Result<Vec<(Value, Parts)>> {
    let mut files: Vec<_> = std::fs::read_dir(dir)
        .with_context(|| format!("{} (run fetch first)", dir.display()))?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.extension().is_some_and(|e| e == "geojson" || e == "json"))
        .collect();
    files.sort();
    let pages: Vec<Vec<(Value, Parts)>> = files
        .par_iter()
        .map(|f| {
            let mut v: Value = serde_json::from_slice(&std::fs::read(f)?)?;
            if let Some(rows) = v.as_array_mut() {
                // Socrata page: rows with a `the_geom` column.
                return Ok(std::mem::take(rows)
                    .into_iter()
                    .filter_map(|mut r| {
                        let parts = parts_of(&r["the_geom"])?;
                        r["the_geom"].take();
                        Some((r, parts))
                    })
                    .collect());
            }
            let feats = v["features"].as_array_mut().map(std::mem::take).unwrap_or_default();
            Ok(feats
                .into_iter()
                .filter_map(|mut ft| {
                    let parts = parts_of(&ft["geometry"])?;
                    Some((ft["properties"].take(), parts))
                })
                .collect())
        })
        .collect::<Result<_>>()?;
    Ok(pages.into_iter().flatten().collect())
}

/// Properties of every feature of a cached layer or table (no geometry needed).
pub fn read_table(dir: &Path) -> Result<Vec<Value>> {
    let mut files: Vec<_> = std::fs::read_dir(dir)
        .with_context(|| format!("{} (run fetch first)", dir.display()))?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.extension().is_some_and(|e| e == "geojson" || e == "json"))
        .collect();
    files.sort();
    let pages: Vec<Vec<Value>> = files
        .par_iter()
        .map(|f| {
            let mut v: Value = serde_json::from_slice(&std::fs::read(f)?)?;
            Ok(match v.get_mut("features") {
                Some(fs) => fs.as_array_mut().map(std::mem::take).unwrap_or_default().into_iter().map(|mut f| f["properties"].take()).collect(),
                None => v.as_array_mut().map(std::mem::take).unwrap_or_default(), // Socrata page
            })
        })
        .collect::<Result<_>>()?;
    Ok(pages.into_iter().flatten().collect())
}

/// GeoJSON Polygon / MultiPolygon -> Parts (parts with a valid outer ring).
pub fn parts_of(g: &Value) -> Option<Parts> {
    let ring = |r: &Value| -> Option<Vec<[f64; 2]>> {
        r.as_array()?.iter().map(|c| Some([c[0].as_f64()?, c[1].as_f64()?])).collect()
    };
    let poly = |p: &Value| -> Option<Vec<Vec<[f64; 2]>>> { p.as_array()?.iter().map(ring).collect() };
    let c = &g["coordinates"];
    let parts: Parts = match g["type"].as_str()? {
        "Polygon" => vec![poly(c)?],
        "MultiPolygon" => c.as_array()?.iter().map(poly).collect::<Option<_>>()?,
        _ => return None,
    };
    let parts: Parts = parts.into_iter().filter(|p| p.first().is_some_and(|r| r.len() >= 4)).collect();
    (!parts.is_empty()).then_some(parts)
}

/// String or number property as f64.
pub fn num(v: &Value, k: &str) -> Option<f64> {
    match &v[k] {
        Value::String(s) => s.trim().parse().ok(),
        Value::Number(n) => n.as_f64(),
        _ => None,
    }
    .filter(|x: &f64| x.is_finite())
}

pub fn text<'a>(v: &'a Value, k: &str) -> &'a str {
    v[k].as_str().map(str::trim).unwrap_or("")
}
