//! 3D building parts from OpenStreetMap (via Overture `building_part`): the drum, steps and cap
//! of a dome, a tower's setbacks, a spire. Footprint sources give one height per building (often
//! its highest point, so MIT's Building 10 was a 44.7 m box over the whole Maclaurin complex);
//! where mappers modelled the building part by part, the parts are what the map draws.
//!
//! Used by `tiles`, per building:
//! - parts whose centre is inside the footprint, and no larger than 1.2× it, belong to it;
//! - if the parts standing on the ground cover ≥ 60% of the footprint, they replace it;
//! - otherwise only the parts that stand out are added: shaped roofs, and parts taller than
//!   the building.
//!
//! Heights: `height` is the top of the part, `min_height` its bottom, `roof_height` the share of
//! `height` taken by the roof. Domes, onions and pyramids/cones are drawn as such (SFT6 roof
//! shapes); other pitched roofs (gabled, hipped, …) as a flat top halfway up the roof.

use crate::city::Ctx;
use crate::geom::{centroid, in_part};
use crate::model::{Building, Parts};
use crate::sources::attach::area_m2;
use crate::sources::bay::parse_wkb;
use crate::sources::pq::{bins, f64s, i64s, strs};
use anyhow::{bail, Context, Result};
use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;
use std::collections::HashMap;
use std::process::Command;
use tilefmt::{ROOF_DOME, ROOF_FLAT, ROOF_ONION, ROOF_PYRAMID};

const RELEASE: &str = "2026-09-23.1";
const S3: &str = "s3://overturemaps-us-west-2/release";
/// Grid cell for the centre index (degrees, ~200 m).
const CELL: f64 = 0.002;
const COVER_REPLACE: f64 = 0.6;
const MAX_AREA_RATIO: f64 = 1.2;
const STOREY_M: f32 = 3.5;

pub struct Part3d {
    pub rings: Vec<Vec<[f64; 2]>>,
    /// Top above the ground (m); None = unknown.
    pub height: Option<f32>,
    pub min: f32,
    pub shape: u8,
    pub roof_h: f32,
    area: f64,
    /// centre (lon/lat)
    pub c: [f64; 2],
}

pub enum Fit<'a> {
    None,
    /// Draw these instead of the footprint.
    Replace(Vec<&'a Part3d>),
    /// Draw these on top of the footprint.
    Add(Vec<&'a Part3d>),
}

pub struct Index {
    parts: Vec<Part3d>,
    grid: HashMap<(i32, i32), Vec<u32>>,
}

fn cell(p: [f64; 2]) -> (i32, i32) {
    ((p[0] / CELL).floor() as i32, (p[1] / CELL).floor() as i32)
}

fn fetch(ctx: &Ctx, out: &std::path::Path) -> Result<()> {
    let [w, s, e, n] = ctx.city.bbox;
    let tmp = out.with_extension("tmp");
    let sql = format!(
        "INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial;
         SET s3_region='us-west-2'; SET enable_progress_bar=false;
         COPY (SELECT ST_AsWKB(geometry) AS wkb, height, min_height, num_floors, min_floor, roof_shape, roof_height
               FROM read_parquet('{S3}/{RELEASE}/theme=buildings/type=building_part/*.parquet')
               WHERE bbox.xmin >= {w} AND bbox.xmax <= {e} AND bbox.ymin >= {s} AND bbox.ymax <= {n}
                 AND coalesce(is_underground, false) = false
                 AND ST_GeometryType(geometry) IN ('POLYGON', 'MULTIPOLYGON'))
         TO '{}' (FORMAT parquet, COMPRESSION zstd);",
        tmp.display()
    );
    println!("overture {RELEASE}: building parts (duckdb)...");
    if !Command::new("duckdb").arg("-c").arg(&sql).status().context("duckdb CLI not found on PATH")?.success() {
        bail!("duckdb failed");
    }
    std::fs::rename(&tmp, out)?;
    Ok(())
}

fn shape(s: &str) -> u8 {
    match s {
        "dome" | "round" => ROOF_DOME,
        "onion" => ROOF_ONION,
        "pyramidal" | "cone" => ROOF_PYRAMID,
        _ => ROOF_FLAT,
    }
}

impl Index {
    /// The city's parts, fetched into the cache on first use. None when they cannot be had
    /// (no duckdb, offline): the buildings are then drawn from their footprints alone.
    pub fn load(ctx: &Ctx) -> Result<Option<Self>> {
        let path = ctx.cache.join(format!("overture_parts_{RELEASE}.parquet"));
        if !path.exists() {
            if let Err(e) = fetch(ctx, &path) {
                println!("no building parts ({e:#}): footprints only");
                return Ok(None);
            }
        }
        let mut parts = Vec::new();
        for b in ParquetRecordBatchReaderBuilder::try_new(std::fs::File::open(&path)?)?.build()? {
            let b = b?;
            let col = |n: &str| b.column_by_name(n).with_context(|| format!("column {n}"));
            let (wkb, height, min, floors, min_floor, roof, roof_h) = (
                bins(col("wkb")?)?, f64s(col("height")?)?, f64s(col("min_height")?)?, i64s(col("num_floors")?)?,
                i64s(col("min_floor")?)?, strs(col("roof_shape")?)?, f64s(col("roof_height")?)?,
            );
            for i in 0..b.num_rows() {
                let Some(geom) = wkb[i].and_then(parse_wkb) else { continue };
                let height = height[i].map(|h| h as f32).or(floors[i].map(|f| f as f32 * STOREY_M)).filter(|h| *h > 0.5);
                let min = min[i].map(|m| m as f32).or(min_floor[i].map(|f| f as f32 * STOREY_M)).unwrap_or(0.0).max(0.0);
                let raw = roof[i].unwrap_or("");
                let roof_h = roof_h[i].map(|r| r as f32).filter(|r| *r > 0.0);
                for rings in geom {
                    let one: Parts = vec![rings];
                    let (area, c) = (area_m2(&one), centroid(&one));
                    let rings = one.into_iter().next().unwrap();
                    let (mut height, mut s, mut rh) = (height, shape(raw), roof_h.unwrap_or(0.0));
                    let span = height.map_or(0.0, |h| h - min);
                    if s != ROOF_FLAT {
                        // a dome with no stated height rises by its radius
                        let r = (area / std::f64::consts::PI).sqrt() as f32;
                        rh = if roof_h.is_some() { rh } else { r }.min(span);
                        if rh < 0.5 || rings.len() > 1 {
                            s = ROOF_FLAT;
                        }
                    } else if let (Some(h), Some(r)) = (height, roof_h) {
                        // a pitched roof, drawn flat at half its height
                        height = Some((h - r.min(span) / 2.0).max(min + 0.5));
                    }
                    if s == ROOF_FLAT {
                        rh = 0.0;
                    }
                    parts.push(Part3d { rings, height, min, shape: s, roof_h: rh, area, c });
                }
            }
        }
        let mut grid: HashMap<(i32, i32), Vec<u32>> = HashMap::new();
        for (i, p) in parts.iter().enumerate() {
            grid.entry(cell(p.c)).or_default().push(i as u32);
        }
        println!("building parts: {} ({} with a shaped roof)", parts.len(), parts.iter().filter(|p| p.shape != ROOF_FLAT).count());
        Ok(Some(Index { parts, grid }))
    }

    pub fn fit(&self, b: &Building) -> Fit<'_> {
        let (lo, hi) = crate::sources::attach::bbox_of(&b.parts);
        let (c0, c1) = (cell(lo), cell(hi));
        let area = area_m2(&b.parts);
        let mut mine: Vec<&Part3d> = Vec::new();
        for x in c0.0..=c1.0 {
            for z in c0.1..=c1.1 {
                for &i in self.grid.get(&(x, z)).into_iter().flatten() {
                    let p = &self.parts[i as usize];
                    if p.area <= area * MAX_AREA_RATIO && b.parts.iter().any(|bp| in_part(p.c, bp)) {
                        mine.push(p);
                    }
                }
            }
        }
        if mine.is_empty() {
            return Fit::None;
        }
        let ground: f64 = mine.iter().filter(|p| p.min < 0.5).map(|p| p.area).sum();
        if ground >= COVER_REPLACE * area {
            return Fit::Replace(mine);
        }
        let stand_out: Vec<&Part3d> =
            mine.into_iter().filter(|p| p.shape != ROOF_FLAT || p.height.is_some_and(|h| h > b.height + 1.0)).collect();
        if stand_out.is_empty() { Fit::None } else { Fit::Add(stand_out) }
    }
}
