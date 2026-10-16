//! Greater Boston core: Boston, Cambridge, Somerville, Brookline.
//!
//! Footprints: Boston BPDA "Buildings with Roof Breaks" (one polygon per
//! roof part with 2010 LiDAR height/ground in feet, grouped into buildings
//! by parcel + touching); Cambridge GIS basemap buildings (TOP_GL height, BASE_ELEV ground, feet);
//! MassGIS Building Structures for Somerville and Brookline (no heights:
//! FEMA USA Structures / NSI floors fill in).
//!
//! Years: Boston Property Assessment FY2026 via Boston Parcels 2025
//! (MAP_PAR_ID = GIS_ID; condos: the CM main row's year wins, else every
//! row's year is a candidate); Cambridge property database (latest
//! assessment year) via Cambridge parcels (ml = gisid); MassGIS L3
//! assessors' parcels (LOC_ID) everywhere as a fallback — it also covers
//! Boston buildings that sit only in Boston's city-wide residual parcel.

use super::arcgis::{fetch_layer, fetch_layer_where, num, read_layer, read_table, text};
use super::attach::{mark_shared, Enricher, Lot, ParcelSource};
use super::http::{agent, fetch_paged, get_cached};
use super::nyc::title_case;
use crate::city::Ctx;
use crate::geom::{centroid, Proj};
use crate::model::*;
use crate::store::Writer;
use anyhow::{Context, Result};
use rayon::prelude::*;
use serde_json::Value;
use std::collections::HashMap;

const ROOFS: &str = "https://gis.bostonplans.org/hosting/rest/services/Boston_Buildings/FeatureServer/9";
const PARCELS: &str = "https://gisportal.boston.gov/arcgis/rest/services/Parcels/Parcels25/MapServer/0";
const ASSESS: &str = "https://data.boston.gov/api/3/action/datastore_search?resource_id=ee73430d-96c0-423e-ad21-c4cfb54c8961";
const ASSESS_FIELDS: &str = "PID,CM_ID,GIS_ID,ST_NUM,ST_NAME,LU,LU_DESC,YR_BUILT,RES_FLOOR,RES_UNITS,COM_UNITS";
const ASSESS_PAGE: usize = 32_000;
const CAMBRIDGE_FP: &str = "https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Basemap/Buildings/BASEMAP_Buildings.geojson";
const CAMBRIDGE: &str = "https://data.cambridgema.gov/resource";
const MASSGIS: &str = "https://arcgisserver.digital.mass.gov/arcgisserver/rest/services/AGOL/MassachusettsPropertyTaxParcels/FeatureServer";
const STRUCTURES: &str = "https://services1.arcgis.com/hGdibHYSPO59RG1h/arcgis/rest/services/Building_Structures/FeatureServer/0";
/// MassGIS town ids.
const TOWNS: &[(u32, &str)] = &[(35, "Boston"), (49, "Cambridge"), (274, "Somerville"), (46, "Brookline")];
const FT: f32 = 0.3048;
/// Roof parts closer than this (m) belong to the same building.
const TOUCH_M: f64 = 0.5;

pub fn fetch(ctx: &Ctx) -> Result<()> {
    let a = agent();
    let c = &ctx.cache;
    fetch_layer(&a, ROOFS, "OBJECTID,GRND_ELEV_2010,BLDG_HGT_2010,IEL_TYPE,Land_Use", &c.join("roofs"), 2000)?;
    fetch_layer(&a, PARCELS, "OBJECTID,MAP_PAR_ID", &c.join("parcels"), 2000)?;
    let dir = c.join("assessment");
    std::fs::create_dir_all(&dir)?;
    let mut total = 0;
    for i in 0.. {
        let url = format!("{ASSESS}&fields={ASSESS_FIELDS}&limit={ASSESS_PAGE}&offset={}", i * ASSESS_PAGE);
        let v: Value = serde_json::from_str(&get_cached(&a, &url, &dir.join(format!("page_{i:03}.json")))?)?;
        let n = v["result"]["records"].as_array().context("assessment page")?.len();
        total += n;
        if n < ASSESS_PAGE {
            break;
        }
    }
    println!("assessment: {total} rows");

    // Cambridge.
    let d = c.join("cambridge");
    std::fs::create_dir_all(&d)?;
    get_cached(&a, CAMBRIDGE_FP, &d.join("buildings.geojson"))?;
    fetch_paged(&a, &d.join("parcels"), &format!("{CAMBRIDGE}/c392-hjk3.json?$select=ml,the_geom&$order=:id"), 50_000)?;
    fetch_paged(
        &a,
        &d.join("property"),
        &format!(
            "{CAMBRIDGE}/eey2-rv59.json?$select=pid,gisid,address,propertyclass,exterior_numstories,interior_numunits,\
             condition_yearbuilt&$where=yearofassessment=2026&$order=:id"
        ),
        50_000,
    )?;

    // MassGIS L3 parcels + assessor table, and structures for Somerville / Brookline.
    let towns = TOWNS.iter().map(|t| t.0.to_string()).collect::<Vec<_>>().join(",");
    let filter = format!("where=TOWN_ID+IN+({towns})");
    fetch_layer_where(&a, &format!("{MASSGIS}/1"), &filter, "OBJECTID,LOC_ID,TOWN_ID", &c.join("massgis_parcels"), 2000)?;
    fetch_layer_where(
        &a,
        &format!("{MASSGIS}/4"),
        &filter,
        "OBJECTID,LOC_ID,YEAR_BUILT,STORIES,UNITS,SITE_ADDR,USE_CODE,TOWN_ID",
        &c.join("massgis_l3"),
        2000,
    )?;
    fetch_layer_where(&a, STRUCTURES, "where=TOWN_ID+IN+(274,46)", "OBJECTID,STRUCT_ID,TOWN_ID", &c.join("structures"), 2000)?;

    super::fema::fetch_bbox(&c.join("fema"), ctx.city.bbox)?;
    super::nsi::fetch(ctx, "25")?;
    Ok(())
}

/// Boston assessment rows -> lots by GIS_ID.
fn boston_lots(ctx: &Ctx) -> Result<HashMap<String, Lot>> {
    #[derive(Default)]
    struct Acc {
        lot: Lot,
        cm_year: Option<i16>,
        cm: bool,
    }
    let mut acc: HashMap<String, Acc> = HashMap::new();
    let mut files: Vec<_> = std::fs::read_dir(ctx.cache.join("assessment"))?.filter_map(|e| e.ok().map(|e| e.path())).collect();
    files.sort();
    for f in files {
        let v: Value = serde_json::from_slice(&std::fs::read(&f)?)?;
        for r in v["result"]["records"].as_array().into_iter().flatten() {
            let a = acc.entry(text(r, "GIS_ID").into()).or_default();
            let lu = text(r, "LU");
            if let Some(y) = num(r, "YR_BUILT").filter(|&y| y > 0.0 && y < 32767.0).map(|y| y as i16) {
                a.lot.years.push(y);
                if lu == "CM" {
                    a.cm_year = Some(y);
                }
            }
            if let Some(fl) = num(r, "RES_FLOOR").filter(|&f| f > 0.0) {
                a.lot.floors = Some(a.lot.floors.map_or(fl as f32, |x| x.max(fl as f32)));
            }
            let units = |k| num(r, k).filter(|&u| u > 0.0).map_or(0, |u| u as u32);
            a.lot.units += if lu == "CD" { 1 } else { units("RES_UNITS") + units("COM_UNITS") };
            if a.lot.addr.is_empty() || (lu == "CM" && !a.cm) {
                a.lot.addr = title_case(&format!("{} {}", text(r, "ST_NUM"), text(r, "ST_NAME"))).trim().to_string();
                a.lot.use_def = text(r, "LU_DESC").into();
                a.lot.use_class = Some(boston_use(lu, text(r, "LU_DESC")));
                a.cm |= lu == "CM";
            }
        }
    }
    Ok(acc
        .into_iter()
        .map(|(k, mut a)| {
            if let Some(y) = a.cm_year {
                a.lot.years = vec![y];
            }
            a.lot.years.sort_unstable();
            a.lot.years.dedup();
            (k, a.lot)
        })
        .collect())
}

fn parcel_source(src: u8, items: Vec<(String, Parts)>, lots: HashMap<String, Lot>) -> ParcelSource {
    println!(
        "  {}: {} parcels, {} lots ({} with a year)",
        SOURCES[src as usize].id,
        items.len(),
        lots.len(),
        lots.values().filter(|l| !l.years.is_empty()).count()
    );
    ParcelSource::new(src, items, lots)
}

pub fn join(ctx: &Ctx) -> Result<()> {
    let proj = Proj::new(ctx.city.origin);
    let c = &ctx.cache;

    // Boston parcels + assessment. "MASSGIS" is one city-wide residual
    // multipolygon (streets, unparcelled land) without assessment.
    let boston = parcel_source(
        S_BOSTON_ASSESS,
        read_layer(&c.join("parcels"))?
            .into_iter()
            .map(|(p, parts)| (text(&p, "MAP_PAR_ID").to_string(), parts))
            .filter(|(id, _)| id != "MASSGIS")
            .collect(),
        boston_lots(ctx)?,
    );

    // Cambridge parcels + property database (map-lot ids).
    let mut camb_lots: HashMap<String, Lot> = HashMap::new();
    for r in read_table(&c.join("cambridge/property"))? {
        let lot = Lot {
            years: num(&r, "condition_yearbuilt").filter(|&y| y > 0.0).map(|y| vec![y as i16]).unwrap_or_default(),
            floors: num(&r, "exterior_numstories").filter(|&f| f > 0.0).map(|f| f as f32),
            units: num(&r, "interior_numunits").filter(|&u| u > 0.0).map_or(0, |u| u as u32),
            addr: text(&r, "address").into(),
            use_def: text(&r, "propertyclass").into(),
            use_class: None,
        };
        camb_lots.entry(text(&r, "gisid").into()).and_modify(|l| l.merge(&lot)).or_insert(lot);
    }
    let cambridge = parcel_source(
        S_CAMBRIDGE_PROP,
        read_layer(&c.join("cambridge/parcels"))?.into_iter().map(|(p, parts)| (text(&p, "ml").to_string(), parts)).collect(),
        camb_lots,
    );

    // MassGIS L3 (all four towns).
    let mut l3_lots: HashMap<String, Lot> = HashMap::new();
    for r in read_table(&c.join("massgis_l3"))? {
        let code = text(&r, "USE_CODE");
        let lot = Lot {
            years: num(&r, "YEAR_BUILT").filter(|&y| y > 0.0).map(|y| vec![y as i16]).unwrap_or_default(),
            floors: num(&r, "STORIES").filter(|&f| f > 0.0).map(|f| f as f32),
            units: num(&r, "UNITS").filter(|&u| u > 0.0).map_or(0, |u| u as u32),
            addr: title_case(text(&r, "SITE_ADDR")),
            use_def: format!("MA use code {code}"),
            use_class: Some(ma_use(code)),
        };
        l3_lots.entry(text(&r, "LOC_ID").into()).and_modify(|l| l.merge(&lot)).or_insert(lot);
    }
    let l3_items: Vec<(String, Parts)> =
        read_layer(&c.join("massgis_parcels"))?.into_iter().map(|(p, parts)| (text(&p, "LOC_ID").to_string(), parts)).collect();
    let l3 = parcel_source(S_MASSGIS_L3, l3_items, l3_lots);
    let town_name = |id: u32| TOWNS.iter().find(|t| t.0 == id).map_or("Other", |t| t.1);

    let enrich = Enricher::load(ctx)?;
    let mut bs: Vec<Building> = Vec::new();

    // Boston roof parts.
    struct Roof {
        id: u64,
        parts: Parts,
        h: Option<f32>,
        ground: Option<f32>,
        out: bool,
        parcel: Option<u32>,
    }
    let raw = read_layer(&c.join("roofs"))?;
    let total = raw.len();
    let roofs: Vec<Roof> = raw
        .into_par_iter()
        .filter_map(|(p, parts)| {
            let ty = text(&p, "IEL_TYPE").to_ascii_uppercase();
            if matches!(ty.as_str(), "FOUNDATION" | "RUIN" | "OVHD-WALKWAY") {
                return None;
            }
            Some(Roof {
                id: num(&p, "OBJECTID").unwrap_or(0.0) as u64,
                parcel: boston.lookup(centroid(&parts)).first().copied(),
                h: num(&p, "BLDG_HGT_2010").filter(|&h| h > 0.0).map(|h| h as f32 * FT),
                ground: num(&p, "GRND_ELEV_2010").map(|g| g as f32 * FT),
                out: ty == "OUTBLDG",
                parts,
            })
        })
        .collect();
    let groups = group_touching(&roofs.iter().map(|r| (r.parcel, &r.parts)).collect::<Vec<_>>(), &proj);
    for g in &groups {
        let out = g.iter().all(|&i| roofs[i].out);
        let mut b = Building {
            dataset: S_BOSTON_ASSESS,
            src_id: format!("boston:{}", roofs[g[0]].id),
            parts: g.iter().flat_map(|&i| roofs[i].parts.iter().cloned()).collect(),
            part_heights: g.iter().flat_map(|&i| std::iter::repeat(roofs[i].h.unwrap_or(0.0)).take(roofs[i].parts.len())).collect(),
            ground_m: g.iter().filter_map(|&i| roofs[i].ground).reduce(f32::min),
            height_default: if out { 3.0 } else { 6.0 },
            footprint_src: S_BOSTON_ROOFS,
            area: "Boston".into(),
            use_class: USE_OTHER,
            ..Default::default()
        };
        b.height(S_BOSTON_ROOFS, g.iter().filter_map(|&i| roofs[i].h).reduce(f32::max));
        if out {
            b.use_def = "Outbuilding".into();
        }
        bs.push(b);
    }
    println!("boston roof parts {total} (minus foundations/ruins/walkways: {}) -> {} buildings", roofs.len(), groups.len());
    drop(roofs);

    // Cambridge footprints.
    let camb: Value = serde_json::from_slice(&std::fs::read(c.join("cambridge/buildings.geojson"))?)?;
    let n0 = bs.len();
    for f in camb["features"].as_array().into_iter().flatten() {
        let p = &f["properties"];
        let ty = text(p, "TYPE");
        if matches!(ty, "FOUNDATION" | "OVHD-WALKWAY" | "BORDER") {
            continue;
        }
        let Some(parts) = super::arcgis::parts_of(&f["geometry"]) else { continue };
        let mut b = Building {
            dataset: S_CAMBRIDGE_PROP,
            src_id: format!("cambridge:{}", text(p, "BldgID")),
            parts,
            ground_m: num(p, "BASE_ELEV").map(|g| g as f32 * FT),
            height_default: if ty == "OUTBLDG" { 3.0 } else { 6.0 },
            footprint_src: S_CAMBRIDGE_FP,
            area: "Cambridge".into(),
            use_class: USE_OTHER,
            ..Default::default()
        };
        // Feet: BASE_ELEV = ground above sea level, *_GL = above ground
        // (TOP = roof top, ELEV = eave), *_SL = above sea level. > 130 m is an
        // error (tallest building ~100 m).
        let h = num(p, "TOP_GL").map(|t| t as f32 * FT).filter(|h| *h <= 130.0);
        b.height(S_CAMBRIDGE_FP, h);
        if ty == "OUTBLDG" {
            b.use_def = "Outbuilding".into();
        }
        bs.push(b);
    }
    println!("cambridge footprints: {}", bs.len() - n0);

    // Somerville + Brookline structures.
    let n0 = bs.len();
    for (p, parts) in read_layer(&c.join("structures"))? {
        let town = num(&p, "TOWN_ID").unwrap_or(0.0) as u32;
        bs.push(Building {
            dataset: S_MASSGIS_L3,
            src_id: format!("massgis:{}", text(&p, "STRUCT_ID")),
            parts,
            height_default: 6.0,
            footprint_src: S_MASSGIS_STRUCT,
            area: town_name(town).into(),
            use_class: USE_OTHER,
            ..Default::default()
        });
    }
    println!("somerville/brookline structures: {}", bs.len() - n0);

    // Attach lots, FEMA, NSI.
    let used: Vec<Vec<(u8, u32)>> = bs
        .par_iter_mut()
        .map(|b| {
            let mut used = Vec::new();
            let own = match b.area.as_str() {
                "Boston" => Some(&boston),
                "Cambridge" => Some(&cambridge),
                _ => None,
            };
            if let Some(ps) = own {
                if let Some(p) = ps.apply(b) {
                    used.push((ps.src, p));
                }
            }
            if let Some(p) = l3.apply(b) {
                used.push((l3.src, p));
            }
            enrich.apply(b);
            used
        })
        .collect();
    let shared = mark_shared(&mut bs, &used);

    let mut by_area: std::collections::BTreeMap<&str, [usize; 4]> = Default::default();
    for (b, u) in bs.iter().zip(&used) {
        let e = by_area.entry(b.area.as_str()).or_default();
        e[0] += 1;
        e[1] += u.iter().any(|x| x.0 != S_MASSGIS_L3) as usize;
        e[2] += u.iter().any(|x| x.0 == S_MASSGIS_L3) as usize;
        e[3] += b.year_c.iter().any(|c| c.src != S_NSI) as usize;
    }
    for (a, e) in &by_area {
        let p = |x: usize| 100.0 * x as f64 / e[0] as f64;
        println!("  {a:<11} {:>7} buildings: city parcel {:.1}%, MassGIS L3 parcel {:.1}%, any year {:.1}%", e[0], p(e[1]), p(e[2]), p(e[3]));
    }
    println!("buildings with a year from a parcel shared with other buildings: {shared}");

    let mut w = Writer::create(&ctx.joined())?;
    w.extend(bs)?;
    let n = w.finish()?;
    println!("wrote {n} buildings to {}", ctx.joined().display());
    Ok(())
}

/// Union-find of footprints in the same parcel that touch (vertices within
/// TOUCH_M). Footprints without a parcel stay alone. Groups in input order.
fn group_touching(items: &[(Option<u32>, &Parts)], proj: &Proj) -> Vec<Vec<usize>> {
    let mut parent: Vec<usize> = (0..items.len()).collect();
    fn find(p: &mut [usize], mut i: usize) -> usize {
        while p[i] != i {
            p[i] = p[p[i]];
            i = p[i];
        }
        i
    }
    let mut by_parcel: HashMap<u32, Vec<usize>> = HashMap::new();
    for (i, (p, _)) in items.iter().enumerate() {
        if let Some(p) = p {
            by_parcel.entry(*p).or_default().push(i);
        }
    }
    let metric: Vec<Vec<[f64; 2]>> = items.par_iter().map(|(_, parts)| parts.iter().flatten().flatten().map(|&ll| proj.fwd(ll)).collect()).collect();
    let boxes: Vec<[f64; 4]> = metric
        .iter()
        .map(|v| v.iter().fold([f64::MAX, f64::MAX, f64::MIN, f64::MIN], |b, p| [b[0].min(p[0]), b[1].min(p[1]), b[2].max(p[0]), b[3].max(p[1])]))
        .collect();
    let touches = |a: usize, b: usize| {
        let (p, q) = (boxes[a], boxes[b]);
        if p[0] > q[2] + TOUCH_M || q[0] > p[2] + TOUCH_M || p[1] > q[3] + TOUCH_M || q[1] > p[3] + TOUCH_M {
            return false;
        }
        let t2 = TOUCH_M * TOUCH_M;
        metric[a].iter().any(|u| metric[b].iter().any(|v| (u[0] - v[0]).powi(2) + (u[1] - v[1]).powi(2) <= t2))
    };
    for members in by_parcel.values() {
        for (k, &a) in members.iter().enumerate() {
            for &b in &members[k + 1..] {
                if touches(a, b) {
                    let (ra, rb) = (find(&mut parent, a), find(&mut parent, b));
                    if ra != rb {
                        parent[ra.max(rb)] = ra.min(rb);
                    }
                }
            }
        }
    }
    let mut groups: HashMap<usize, Vec<usize>> = HashMap::new();
    for i in 0..items.len() {
        let r = find(&mut parent, i);
        groups.entry(r).or_default().push(i);
    }
    let mut groups: Vec<Vec<usize>> = groups.into_values().collect();
    groups.sort_by_key(|g| g[0]);
    groups
}

/// Boston assessor LU code (falls back to the description).
fn boston_use(lu: &str, desc: &str) -> u8 {
    match lu {
        "R1" | "R2" | "R3" | "R4" | "A" | "CD" | "CM" | "CP" | "RL" => USE_RESIDENTIAL,
        "RC" => USE_MIXED,
        "C" | "CC" => USE_COMMERCIAL,
        "I" => USE_INDUSTRIAL,
        "E" | "EA" => USE_CIVIC,
        _ => use_from_text(desc),
    }
}

/// Massachusetts DOR use code: 1xx residential, 0xx mixed, 3xx commercial,
/// 4xx industrial, 9xx exempt (public / institutional).
fn ma_use(code: &str) -> u8 {
    match code.trim_start_matches('0').as_bytes().first() {
        _ if code.starts_with('0') && code.len() > 1 => USE_MIXED,
        Some(b'1') => USE_RESIDENTIAL,
        Some(b'3') => USE_COMMERCIAL,
        Some(b'4') => USE_INDUSTRIAL,
        Some(b'9') => USE_CIVIC,
        _ => USE_OTHER,
    }
}
