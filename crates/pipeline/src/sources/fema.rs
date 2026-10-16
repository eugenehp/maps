//! FEMA / ORNL USA Structures (CC BY 4.0): footprints with LiDAR- or
//! imagery-derived HEIGHT (m) and occupancy class.

use super::arcgis::fetch_layer_where;
use super::http::agent;
use anyhow::Result;
use std::path::Path;

pub const LAYER: &str = "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/USA_Structures_View/FeatureServer/0";
pub const FIELDS: &str = "OBJECTID,HEIGHT,OCC_CLS,OUTBLDG";

/// All structures in the given county FIPS codes (5-digit).
pub fn fetch_counties(dir: &Path, fips: &[&str]) -> Result<usize> {
    let list = fips.iter().map(|f| format!("%27{f}%27")).collect::<Vec<_>>().join(",");
    fetch_layer_where(&agent(), LAYER, &format!("where=FIPS+IN+({list})"), FIELDS, dir, 2000)
}

/// All structures intersecting a lon/lat envelope.
pub fn fetch_bbox(dir: &Path, bbox: [f64; 4]) -> Result<usize> {
    let [w, s, e, n] = bbox;
    let filter = format!("where=1%3D1&geometry={w},{s},{e},{n}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects");
    fetch_layer_where(&agent(), LAYER, &filter, FIELDS, dir, 2000)
}
