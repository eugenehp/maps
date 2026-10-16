//! New York City: OTI building footprints (height, ground, construction
//! year per BIN) + DCP PLUTO by tax lot (use, floors, units, address) +
//! LPC landmarks database by BIN (curated years, landmark flag).
//!
//! Footprint years are heavily rounded (multiples of 5/10); the spike
//! detector flags those approximate but they are never re-estimated
//! (`nyc_footprints` dataset policy). Feet are converted to metres.

use super::arcgis::{num, parts_of, text};
use super::attach::Enricher;
use super::http::{agent, fetch_paged};
use crate::city::Ctx;
use crate::model::*;
use crate::store::Writer;
use anyhow::{Context, Result};
use rayon::prelude::*;
use serde_json::Value;
use std::collections::HashMap;
use std::path::Path;

const HOST: &str = "https://data.cityofnewyork.us/resource";
const PAGE: usize = 50_000;
const FT: f32 = 0.3048;
/// height_roof has absurd outliers (max ~2.1M ft); the tallest building is ~1,800 ft.
const MAX_HEIGHT_FT: f64 = 1800.0;

pub fn fetch(ctx: &Ctx) -> Result<()> {
    let a = agent();
    let get = |id: &str, select: &str, dir: &str| -> Result<()> {
        let n = fetch_paged(&a, &ctx.cache.join(dir), &format!("{HOST}/{id}.json?$select={select}&$order=:id"), PAGE)?;
        println!("{dir}: {n} rows");
        Ok(())
    };
    get("5zhs-2jue", "bin,doitt_id,mappluto_bbl,construction_year,height_roof,ground_elevation,feature_code,last_status_type,the_geom", "footprints")?;
    get("ipkp-snf6", "bin,base_bbl,construction_year,demolition_year,height_roof,ground_elevation,last_status_type,the_geom", "historic")?;
    get("64uk-42ks", "bbl,address,bldgclass,numfloors,unitstotal,histdist,landmark", "pluto")?;
    get("gpmc-yuvp", "bin,date_low,date_high,circa,des_addres,build_nme", "lpc")?;
    get(
        "5zyy-y8am",
        "report_year,nyc_building_identification,year_built,site_eui_kbtu_ft,energy_star_score,\
         total_location_based_ghg,largest_property_use_type,property_gfa_self_reported",
        "ll84",
    )?;
    super::nsi::fetch(ctx, "36")?;
    Ok(())
}

struct Lot {
    addr: String,
    class: String,
    floors: Option<f32>,
    units: u32,
}

struct Lpc {
    year: Option<(i16, bool)>,
    addr: String,
}

pub fn join(ctx: &Ctx) -> Result<()> {
    let mut lots: HashMap<String, Lot> = HashMap::new();
    for_each_page(&ctx.cache.join("pluto"), |rows| {
        for v in rows {
            lots.insert(
                bbl10(text(&v, "bbl")),
                Lot {
                    addr: title_case(text(&v, "address")),
                    class: text(&v, "bldgclass").into(),
                    floors: num(&v, "numfloors").filter(|&f| f > 0.0).map(|f| f as f32),
                    units: num(&v, "unitstotal").filter(|&u| u > 0.0).map_or(0, |u| u as u32),
                },
            );
        }
        Ok(())
    })?;
    let mut lpc: HashMap<String, Lpc> = HashMap::new();
    for_each_page(&ctx.cache.join("lpc"), |rows| {
        for v in rows {
            let (lo, hi) = (num(&v, "date_low").unwrap_or(0.0) as i16, num(&v, "date_high").unwrap_or(0.0) as i16);
            // Completion year; a range or "circa" makes it approximate.
            let year = match (lo, hi) {
                (_, h) if h > 0 => Some((h, text(&v, "circa") == "1" || (lo > 0 && lo != h))),
                (l, _) if l > 0 => Some((l, text(&v, "circa") == "1")),
                _ => None,
            };
            lpc.insert(text(&v, "bin").into(), Lpc { year, addr: text(&v, "des_addres").into() });
        }
        Ok(())
    })?;
    // LL84 benchmarking: latest report per BIN (multi-building properties
    // list several BINs separated by ';' or ',').
    let mut ll84: HashMap<String, (i64, Option<i16>, String)> = HashMap::new();
    for_each_page(&ctx.cache.join("ll84"), |rows| {
        for v in rows {
            let ry = num(&v, "report_year").unwrap_or(0.0) as i64;
            let extra = serde_json::json!({ "ll84": {
                "reportYear": ry,
                "yearBuilt": num(&v, "year_built"),
                "siteEUI_kBtu_ft2": num(&v, "site_eui_kbtu_ft"),
                "energyStar": num(&v, "energy_star_score"),
                "ghg_tCO2e": num(&v, "total_location_based_ghg"),
                "use": text(&v, "largest_property_use_type"),
                "gfa_ft2": num(&v, "property_gfa_self_reported"),
            }})
            .to_string();
            let year = num(&v, "year_built").filter(|&y| y > 0.0).map(|y| y as i16);
            for bin in text(&v, "nyc_building_identification").split([';', ',', ' ']).map(str::trim).filter(|b| b.len() == 7) {
                let e = ll84.entry(bin.to_string()).or_insert((-1, None, String::new()));
                if ry > e.0 {
                    *e = (ry, year, extra.clone());
                }
            }
        }
        Ok(())
    })?;
    println!("pluto lots {}, LPC records {}, LL84 BINs {}", lots.len(), lpc.len(), ll84.len());
    let enrich = Enricher::load(ctx)?;

    let mut w = Writer::create(&ctx.joined())?;
    let (mut rows, mut demolished, mut no_geom, mut lot_hit, mut lpc_hit, mut lpc_year, mut tall) = (0, 0, 0, 0, 0, 0, 0);
    for_each_page(&ctx.cache.join("footprints"), |page| {
        rows += page.len();
        let out: Vec<Result<(Building, bool, bool, bool), u8>> = page
            .into_par_iter()
            .map(|v| {
                let status = text(&v, "last_status_type");
                if status == "Demolition" || status == "Marked for Demolition" {
                    return Err(0);
                }
                let parts = parts_of(&v["the_geom"]).ok_or(1u8)?;
                let bin = text(&v, "bin");
                let h_ft = num(&v, "height_roof").filter(|&h| h > 0.0);
                let feature = text(&v, "feature_code");
                let lot = lots.get(&bbl10(text(&v, "mappluto_bbl")));
                let lm = lpc.get(bin);
                let outbuilding = feature == "5110";
                let mut b = Building {
                    dataset: S_NYC_FP,
                    src_id: format!("{bin}:{}", text(&v, "doitt_id")),
                    parts,
                    footprint_src: S_NYC_FP,
                    height_default: if outbuilding { 3.0 } else { 6.0 },
                    ground_m: num(&v, "ground_elevation").map(|g| g as f32 * FT),
                    landmark: lm.is_some(),
                    area: borough(bin).into(),
                    ..Default::default()
                };
                b.height(S_NYC_FP, h_ft.filter(|&h| h <= MAX_HEIGHT_FT).map(|h| h as f32 * FT));
                b.year(S_NYC_FP, num(&v, "construction_year").map(|y| y as i16), false, false);
                if let Some((y, circa)) = lm.and_then(|l| l.year) {
                    b.year(S_NYC_LPC, [y], circa, false);
                }
                if let Some((_, y, extra)) = ll84.get(bin) {
                    b.year(S_NYC_LL84, *y, false, false);
                    b.extra = extra.clone();
                }
                if let Some(l) = lot.filter(|_| !outbuilding) {
                    // The lot's floor count is its main building's.
                    b.floors(S_NYC_PLUTO, l.floors);
                }
                if let Some(l) = lot {
                    b.units = l.units;
                    b.addr = l.addr.clone();
                    b.use_class = use_of_class(&l.class);
                    b.use_def = format!("PLUTO class {}", l.class);
                } else {
                    b.use_class = USE_OTHER;
                }
                if outbuilding {
                    b.use_class = USE_OTHER;
                    b.use_def = "Garage / shed".into();
                }
                enrich.apply(&mut b);
                if let Some(l) = lm.filter(|l| !l.addr.is_empty() && l.addr != "0") {
                    b.addr = l.addr.clone();
                }
                let tall = h_ft.is_some_and(|h| h > MAX_HEIGHT_FT);
                Ok((b, lot.is_some(), lm.is_some(), tall))
            })
            .collect();
        for r in out {
            match r {
                Ok((b, l, m, t)) => {
                    lot_hit += l as usize;
                    lpc_hit += m as usize;
                    lpc_year += b.year_c.iter().any(|c| c.src == S_NYC_LPC) as usize;
                    tall += t as usize;
                    w.push(b)?;
                }
                Err(0) => demolished += 1,
                Err(_) => no_geom += 1,
            }
        }
        Ok(())
    })?;
    let n_standing = w.count_pushed();

    // Demolished buildings (Building Footprints Historic): drawn until the year they came down.
    // They take nothing from the lot's current records but its address.
    let (mut hist, mut hist_kept, mut hist_year) = (0usize, 0usize, 0usize);
    let this_year = crate::model::current_year() as i16;
    if ctx.cache.join("historic").exists() {
        for_each_page(&ctx.cache.join("historic"), |page| {
            hist += page.len();
            for v in page {
                if text(&v, "last_status_type") != "Demolition" {
                    continue; // earlier outlines of buildings still standing
                }
                let Some(gone) = num(&v, "demolition_year").map(|y| y as i16).filter(|y| (1800..=this_year).contains(y)) else { continue };
                let Some(parts) = parts_of(&v["the_geom"]) else { continue };
                let bin = text(&v, "bin");
                let mut b = Building {
                    dataset: S_NYC_HISTORIC,
                    src_id: format!("historic:{bin}:{gone}"),
                    parts,
                    footprint_src: S_NYC_HISTORIC,
                    height_default: 6.0,
                    ground_m: num(&v, "ground_elevation").map(|g| g as f32 * FT),
                    area: borough(bin).into(),
                    use_class: USE_OTHER,
                    use_def: format!("Demolished {gone}"),
                    demolished: gone,
                    ..Default::default()
                };
                let h = num(&v, "height_roof").filter(|&h| h > 0.0 && h <= MAX_HEIGHT_FT);
                b.height(S_NYC_HISTORIC, h.map(|h| h as f32 * FT));
                // a construction year after the demolition is a later building's; one within 3 years
                // of it is, for most records, when the outline was captured, not when it was built
                let built = num(&v, "construction_year").map(|y| y as i16).filter(|&y| y > 1600 && y <= gone - 4);
                hist_year += built.is_some() as usize;
                b.year(S_NYC_HISTORIC, built, false, false);
                if let Some(l) = lots.get(&bbl10(text(&v, "base_bbl"))) {
                    b.addr = l.addr.clone();
                }
                w.push(b)?;
                hist_kept += 1;
            }
            Ok(())
        })?;
    }
    let n = w.finish()?;
    let pct = |x: usize| 100.0 * x as f64 / n.max(1) as f64;
    println!("footprints {rows}: kept {n_standing}, demolished {demolished}, no geometry {no_geom}");
    println!("historic footprints {hist}: {hist_kept} demolished buildings with a demolition year ({hist_year} with a construction year)");
    println!(
        "PLUTO lot match {lot_hit} ({:.1}%), in LPC database {lpc_hit} ({:.1}%, {lpc_year} with a year), height > {MAX_HEIGHT_FT} ft dropped {tall}",
        pct(lot_hit), pct(lpc_hit)
    );
    println!("wrote {n} buildings to {}", ctx.joined().display());
    Ok(())
}

/// "1000277501.00000000" / "1000277501" -> "1000277501".
fn bbl10(s: &str) -> String {
    s.split('.').next().unwrap_or("").trim().to_string()
}

fn borough(bin: &str) -> &'static str {
    match bin.as_bytes().first() {
        Some(b'1') => "Manhattan",
        Some(b'2') => "Bronx",
        Some(b'3') => "Brooklyn",
        Some(b'4') => "Queens",
        Some(b'5') => "Staten Island",
        _ => "unknown",
    }
}

/// PLUTO building class letter -> use class.
fn use_of_class(c: &str) -> u8 {
    match c.as_bytes().first() {
        Some(b'A' | b'B' | b'C' | b'D' | b'R') => USE_RESIDENTIAL,
        Some(b'S') => USE_MIXED, // residence with stores
        Some(b'H' | b'K' | b'O' | b'L' | b'J') => USE_COMMERCIAL,
        Some(b'E' | b'F') => USE_INDUSTRIAL,
        Some(b'I' | b'M' | b'N' | b'P' | b'W' | b'Y' | b'T') => USE_CIVIC,
        _ => USE_OTHER,
    }
}

pub fn title_case(s: &str) -> String {
    s.split_whitespace()
        .map(|w| {
            let mut c = w.chars();
            match c.next() {
                Some(f) => f.to_uppercase().chain(c.flat_map(char::to_lowercase)).collect::<String>(),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Socrata pages one at a time (NYC is too big to hold as JSON values).
fn for_each_page(dir: &Path, mut f: impl FnMut(Vec<Value>) -> Result<()>) -> Result<()> {
    let mut files: Vec<_> = std::fs::read_dir(dir)
        .with_context(|| format!("{} (run fetch first)", dir.display()))?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.extension().is_some_and(|e| e == "json"))
        .collect();
    files.sort();
    for p in files {
        f(serde_json::from_slice(&std::fs::read(&p)?)?)?;
    }
    Ok(())
}
