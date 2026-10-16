//! San Francisco: DataSF building footprints (LiDAR heights, ground) joined
//! to the latest closed assessor roll.
//!
//! Join: 1. key match, `mblr` block+lot == roll block+lot. Condo units have
//! their own lots but share the block and the_geom point, so roll rows are
//! grouped into "sites" (block + point) and a key match pulls in the whole
//! site. 2. Spatial fallback: sites whose point falls inside the footprint.
//! Per building: distinct years (cleaned in `years`), max stories, summed
//! units, most common use and address.

use super::arcgis::{num as num_of, parts_of};
use super::attach::Enricher;
use super::http::{agent, fetch_paged, get};
use crate::city::Ctx;
use crate::geom::in_part;
use crate::model::*;
use crate::store::Writer;
use anyhow::{Context, Result};
use rayon::prelude::*;
use rstar::{primitives::GeomWithData, RTree, AABB};
use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

const HOST: &str = "https://data.sf.gov";
const PAGE: usize = 50_000;
const FOOTPRINT_FIELDS: &str = "sf16_bldgid,mblr,hgt_median_m,gnd_min_m,shape";
const ASSESSOR_FIELDS: &str = "closed_roll_year,parcel_number,block,lot,property_location,\
year_property_built,number_of_stories,number_of_units,use_code,use_definition,\
property_class_code_definition,construction_type,the_geom";

pub fn fetch(ctx: &Ctx) -> Result<()> {
    let agent = agent();
    let n = fetch_paged(
        &agent,
        &ctx.cache.join("footprints"),
        &format!("{HOST}/resource/ynuv-fyni.json?$select={FOOTPRINT_FIELDS}&$order=:id"),
        PAGE,
    )?;
    println!("footprints: {n} rows");

    let year = latest_roll_year(&agent, ctx)?;
    let n = fetch_paged(
        &agent,
        &assessor_dir(ctx, year),
        &format!("{HOST}/resource/wv5m-vpq2.json?$select={ASSESSOR_FIELDS}&$where=closed_roll_year={year}&$order=:id"),
        PAGE,
    )?;
    println!("assessor roll {year}: {n} rows");
    super::nsi::fetch(ctx, "06")?;
    Ok(())
}

fn assessor_dir(ctx: &Ctx, year: i32) -> PathBuf {
    ctx.cache.join(format!("assessor_{year}"))
}

/// Latest closed roll year; asked once, then remembered so later steps
/// (and offline reruns) agree on which roll to use.
fn latest_roll_year(agent: &ureq::Agent, ctx: &Ctx) -> Result<i32> {
    let f = ctx.cache.join("assessor_year.txt");
    if let Ok(s) = std::fs::read_to_string(&f) {
        return Ok(s.trim().parse()?);
    }
    let body = get(agent, &format!("{HOST}/resource/wv5m-vpq2.json?$select=max(closed_roll_year)"))?;
    let v: Value = serde_json::from_str(&body)?;
    let y = &v[0]["max_closed_roll_year"];
    let year: i32 = y.as_str().map(str::parse).transpose()?.or(y.as_i64().map(|y| y as i32)).context("no max year")?;
    std::fs::write(f, year.to_string())?;
    Ok(year)
}

struct Row {
    year: Option<i16>,
    stories: Option<f32>,
    units: u32,
    use_code: String,
    use_def: String,
    addr: String,
}

#[derive(Clone, Copy, PartialEq)]
enum Match {
    Key,
    Spatial,
    None,
}

pub fn join(ctx: &Ctx) -> Result<()> {
    let year = std::fs::read_to_string(ctx.cache.join("assessor_year.txt")).context("run fetch first")?;
    let rows_json = read_pages(&assessor_dir(ctx, year.trim().parse()?))?;

    // Roll rows -> sites.
    let mut rows = Vec::with_capacity(rows_json.len());
    let mut site_of_key: HashMap<String, usize> = HashMap::new();
    let mut site_index: HashMap<(String, i64, i64), usize> = HashMap::new();
    let mut sites: Vec<Vec<usize>> = Vec::new();
    let mut site_pt: Vec<Option<[f64; 2]>> = Vec::new();
    for v in &rows_json {
        let block = str_of(v, "block").trim().to_string();
        let key = format!("{block}{}", str_of(v, "lot").trim());
        let pt = point_of(&v["the_geom"]);
        let mut new_site = |pt| {
            sites.push(vec![]);
            site_pt.push(pt);
            sites.len() - 1
        };
        let site = match pt {
            // ~1 cm grid: condo rows carry bit-identical points.
            Some(p) => *site_index
                .entry((block, (p[0] * 1e7).round() as i64, (p[1] * 1e7).round() as i64))
                .or_insert_with(|| new_site(pt)),
            None => new_site(None),
        };
        sites[site].push(rows.len());
        site_of_key.insert(key, site);
        rows.push(Row {
            year: num_of(v, "year_property_built").filter(|&y| y > 0.0 && y < 32767.0).map(|y| y as i16),
            stories: num_of(v, "number_of_stories").filter(|&s| s > 0.0).map(|s| s as f32),
            units: num_of(v, "number_of_units").filter(|&u| u > 0.0).map_or(0, |u| u as u32),
            use_code: str_of(v, "use_code").to_string(),
            use_def: str_of(v, "use_definition").to_string(),
            addr: clean_address(str_of(v, "property_location")),
        });
    }
    drop(rows_json);
    let multi = sites.iter().filter(|s| s.len() > 1).count();
    println!("roll {}: {} rows, {} sites ({multi} multi-row, e.g. condos)", year.trim(), rows.len(), sites.len());

    let tree = RTree::bulk_load(
        site_pt.iter().enumerate().filter_map(|(i, p)| p.map(|p| GeomWithData::new(p, i))).collect::<Vec<_>>(),
    );

    // Footprints.
    let fp_json = read_pages(&ctx.cache.join("footprints"))?;
    let total = fp_json.len();
    let (mut not_sf, mut no_shape) = (0, 0);
    let mut fps = Vec::with_capacity(total);
    for v in &fp_json {
        let mblr = str_of(v, "mblr");
        if mblr.starts_with("SM") {
            not_sf += 1; // San Mateo County, just across the city line
            continue;
        }
        // "CN..." (non-assessed land, e.g. the Presidio) and odd "SF...COM"
        // common-area codes rarely key-match; they rely on the spatial join.
        let key = parse_mblr(mblr).unwrap_or_else(|| mblr.to_string());
        let Some(parts) = parts_of(&v["shape"]) else {
            no_shape += 1;
            continue;
        };
        let hgt = num_of(v, "hgt_median_m").map(|h| h as f32);
        let gnd = num_of(v, "gnd_min_m").map(|h| h as f32);
        fps.push((str_of(v, "sf16_bldgid").to_string(), key, parts, hgt, gnd));
    }
    drop(fp_json);
    println!("footprints: {total} rows, {not_sf} in San Mateo County ('SM' mblr, dropped), {no_shape} without shape");

    let enrich = Enricher::load(ctx)?;
    let mut joined: Vec<(Building, Match, Vec<usize>, Vec<i16>)> = fps
        .into_par_iter()
        .map(|(id, key, parts, hgt, gnd)| {
            let (m, site_ids) = if let Some(&s) = site_of_key.get(&key) {
                (Match::Key, vec![s])
            } else {
                let hits = sites_inside(&tree, &parts);
                (if hits.is_empty() { Match::None } else { Match::Spatial }, hits)
            };
            let mut b = Building {
                dataset: S_SF_ASSESSOR,
                src_id: id,
                parts,
                footprint_src: S_SF_FOOTPRINTS,
                // A low LiDAR reading still says "small"; a missing one says nothing.
                height_default: if hgt.is_some_and(|h| h > 0.0) { 3.0 } else { 6.0 },
                ground_m: gnd,
                area: "San Francisco".into(),
                ..Default::default()
            };
            b.height(S_SF_FOOTPRINTS, hgt);
            let years = aggregate(&mut b, site_ids.iter().flat_map(|&s| sites[s].iter().map(|&i| &rows[i])));
            enrich.apply(&mut b);
            (b, m, site_ids, years)
        })
        .collect();

    // Footprints drawing on the same roll site(s) share one year.
    let mut per_site: HashMap<&[usize], usize> = HashMap::new();
    for (_, _, s, _) in &joined {
        if !s.is_empty() {
            *per_site.entry(s.as_slice()).or_default() += 1;
        }
    }
    let shared: Vec<bool> = joined.iter().map(|(_, _, s, _)| per_site.get(s.as_slice()).is_some_and(|&n| n > 1)).collect();
    drop(per_site);
    let mut n_shared = 0;
    for ((b, _, _, years), sh) in joined.iter_mut().zip(shared) {
        n_shared += sh as usize;
        b.year(S_SF_ASSESSOR, std::mem::take(years), false, sh);
    }

    let n = joined.len() as f64;
    let count = |m: Match| joined.iter().filter(|j| j.1 == m).count();
    let (k, s, u) = (count(Match::Key), count(Match::Spatial), count(Match::None));
    let pct = |x: usize| 100.0 * x as f64 / n;
    println!("match: key {k} ({:.1}%), spatial {s} ({:.1}%), unmatched {u} ({:.1}%)", pct(k), pct(s), pct(u));
    println!("footprints sharing a roll site with others: {n_shared} ({:.1}%)", pct(n_shared));
    let gnd: Vec<f32> = joined.iter().filter_map(|j| j.0.ground_m).collect();
    let (glo, ghi) = gnd.iter().fold((f32::MAX, f32::MIN), |(a, b), &g| (a.min(g), b.max(g)));
    println!("ground (gnd_min_m, NAVD88 m): {} of {} present, range {glo:.1}..{ghi:.1}", gnd.len(), joined.len());

    let mut w = Writer::create(&ctx.joined())?;
    w.extend(joined.into_iter().map(|j| j.0))?;
    println!("wrote {} buildings to {}", w.finish()?, ctx.joined().display());
    Ok(())
}

/// Fills use/units/address/floors; returns the rows' years.
fn aggregate<'a>(b: &mut Building, rows: impl Iterator<Item = &'a Row> + Clone) -> Vec<i16> {
    let years: Vec<i16> = rows.clone().filter_map(|r| r.year).collect();
    b.floors(S_SF_ASSESSOR, rows.clone().filter_map(|r| r.stories).reduce(f32::max));
    b.units = rows.clone().map(|r| r.units).sum();
    b.use_class = use_class(&mode(rows.clone().map(|r| r.use_code.as_str())));
    b.use_def = mode(rows.clone().map(|r| r.use_def.as_str()));
    b.addr = mode(rows.map(|r| r.addr.as_str()));
    years
}

/// Assessor use_code -> USE_CLASSES index.
fn use_class(code: &str) -> u8 {
    match code {
        "SRES" | "MRES" => USE_RESIDENTIAL,
        "COMR" | "COMO" | "COMH" | "COMM" => USE_COMMERCIAL,
        "IND" => USE_INDUSTRIAL,
        "GOVT" => USE_CIVIC,
        "MISC" => USE_MIXED,
        _ => USE_OTHER,
    }
}

/// Most common non-empty string; ties broken lexicographically for stable output.
fn mode<'a>(it: impl Iterator<Item = &'a str>) -> String {
    let mut c: HashMap<&str, usize> = HashMap::new();
    for s in it.filter(|s| !s.is_empty()) {
        *c.entry(s).or_default() += 1;
    }
    c.into_iter()
        .max_by(|a, b| a.1.cmp(&b.1).then(b.0.cmp(a.0)))
        .map_or(String::new(), |(s, _)| s.to_string())
}

fn sites_inside(tree: &RTree<GeomWithData<[f64; 2], usize>>, parts: &Parts) -> Vec<usize> {
    let (mut lo, mut hi) = ([f64::MAX; 2], [f64::MIN; 2]);
    for p in parts.iter().flatten().flatten() {
        lo = [lo[0].min(p[0]), lo[1].min(p[1])];
        hi = [hi[0].max(p[0]), hi[1].max(p[1])];
    }
    let mut v: Vec<usize> = tree
        .locate_in_envelope(AABB::from_corners(lo, hi))
        .filter(|g| parts.iter().any(|part| in_part(*g.geom(), part)))
        .map(|g| g.data)
        .collect();
    v.sort_unstable();
    v
}

/// "SF2120A008" -> "2120A008": 2-letter prefix ("SF", or "CN" for some
/// city-owned land) + 4-digit block (+ optional letter) + 3-digit lot
/// (+ optional letter). Anything else returns None.
fn parse_mblr(s: &str) -> Option<String> {
    let r = s.strip_prefix("SF").or_else(|| s.strip_prefix("CN"))?.as_bytes();
    if r.len() < 7 || !r[..4].iter().all(u8::is_ascii_digit) {
        return None;
    }
    let bl = if r[4].is_ascii_alphabetic() { 5 } else { 4 };
    let lot = &r[bl..];
    if lot.len() < 3 || lot.len() > 4 || !lot[..3].iter().all(u8::is_ascii_digit) {
        return None;
    }
    std::str::from_utf8(r).ok().map(str::to_string)
}

/// "0000 1380 GREENWICH           ST0207" -> "1380 Greenwich St".
/// Fixed width: [0..4] range-end number, [5..9] street number, [9] number
/// suffix letter, [10..30] street name, [30..32] street type, then a
/// variable-length unit we drop. Rows that don't fit fall back to tokens.
fn clean_address(raw: &str) -> String {
    let b = raw.as_bytes();
    let fixed = raw.is_ascii() && b.len() >= 32 && b[4] == b' ' && b[5..9].iter().all(u8::is_ascii_digit);
    if !fixed {
        let mut toks = raw.split_whitespace().peekable();
        let mut num = 0;
        while let Some(n) = toks.peek().and_then(|t| t.parse::<u32>().ok()) {
            num = if num == 0 { n } else { n.min(num) };
            toks.next();
        }
        let mut words: Vec<String> = toks.map(str::to_string).collect();
        // "ST0207": street type glued to the unit number.
        let multi = words.len() > 1;
        if let Some(last) = words.last_mut().filter(|_| multi) {
            let alpha: String = last.chars().take_while(|c| c.is_ascii_alphabetic()).collect();
            if alpha.len() < last.len() {
                if let Some(t) = street_type(&alpha) {
                    *last = t.to_string();
                }
            }
        }
        let rest = title_words(&words.join(" "));
        return match (num, rest.is_empty()) {
            (_, true) => String::new(),
            (0, _) => rest,
            (n, _) => format!("{n} {rest}"),
        };
    }
    let hi: u32 = raw[0..4].trim().parse().unwrap_or(0);
    let lo: u32 = raw[5..9].parse().unwrap_or(0);
    let (num, suffix) = (if lo > 0 { lo } else { hi }, raw[9..10].trim());
    let (name, typ) = (raw[10..30].trim(), raw[30..32].trim());
    if name.is_empty() {
        return String::new();
    }
    let mut out = if num > 0 { format!("{num}{suffix} ") } else { String::new() };
    out += &title_words(name);
    if !typ.is_empty() {
        out.push(' ');
        out += &street_type(typ).map_or_else(|| title(typ), str::to_string);
    }
    out
}

fn title_words(s: &str) -> String {
    s.split_whitespace()
        .map(|w| street_type_word(w).unwrap_or_else(|| title(w)))
        .collect::<Vec<_>>()
        .join(" ")
}

/// Keep already-converted street types ("St") as they are.
fn street_type_word(w: &str) -> Option<String> {
    (w.chars().next().is_some_and(char::is_uppercase) && w.chars().skip(1).all(char::is_lowercase) && w.len() > 1)
        .then(|| w.to_string())
}

fn street_type(t: &str) -> Option<&'static str> {
    Some(match t {
        "ST" => "St",
        "AV" | "AVE" => "Ave",
        "BL" | "BLVD" => "Blvd",
        "DR" => "Dr",
        "WY" | "WAY" => "Way",
        "TR" | "TE" | "TER" => "Ter",
        "CT" => "Ct",
        "PL" => "Pl",
        "LN" => "Ln",
        "RD" => "Rd",
        "HY" | "HW" | "HWY" => "Hwy",
        "CR" | "CIR" => "Cir",
        "PZ" => "Plaza",
        "AL" => "Alley",
        "PK" => "Park",
        "EX" => "Expy",
        "WK" => "Walk",
        "LP" => "Loop",
        "SQ" => "Sq",
        "RW" => "Row",
        _ => return None,
    })
}

/// "GREENWICH" -> "Greenwich", "03RD" -> "3rd", "O'FARRELL" -> "O'Farrell".
fn title(t: &str) -> String {
    let t = if t.starts_with('0') && t.len() > 1 { t.trim_start_matches('0') } else { t };
    let mut out = String::with_capacity(t.len());
    let mut start = true;
    for c in t.chars() {
        if start && c.is_alphabetic() {
            out.extend(c.to_uppercase());
        } else {
            out.extend(c.to_lowercase());
        }
        start = !c.is_alphanumeric();
    }
    out
}

fn read_pages(dir: &Path) -> Result<Vec<Value>> {
    let mut files: Vec<_> = std::fs::read_dir(dir)
        .with_context(|| format!("{} (run fetch first)", dir.display()))?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.extension().is_some_and(|e| e == "json"))
        .collect();
    files.sort();
    let pages: Vec<Vec<Value>> = files
        .par_iter()
        .map(|f| Ok(serde_json::from_slice(&std::fs::read(f)?)?))
        .collect::<Result<_>>()?;
    Ok(pages.into_iter().flatten().collect())
}

fn str_of<'a>(v: &'a Value, k: &str) -> &'a str {
    v[k].as_str().unwrap_or("")
}

fn point_of(g: &Value) -> Option<[f64; 2]> {
    let c = g["coordinates"].as_array()?;
    Some([c.first()?.as_f64()?, c.get(1)?.as_f64()?])
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn address() {
        assert_eq!(clean_address("0000 1380 GREENWICH           ST0207"), "1380 Greenwich St");
        assert_eq!(clean_address("2750 2700 TAYLOR              ST0000"), "2700 Taylor St");
        assert_eq!(clean_address("0000 0862 31ST                AV0000"), "862 31st Ave");
        assert_eq!(clean_address("0000 5086ADIAMOND HEIGHTS     BL0000"), "5086A Diamond Heights Blvd");
        assert_eq!(clean_address("0000 0000 THE EMBARCADERO       0005H"), "The Embarcadero");
        assert_eq!(clean_address("0000 1380 GREENWICH ST0207"), "1380 Greenwich St");
    }
    #[test]
    fn mblr() {
        assert_eq!(parse_mblr("SF2120A008").as_deref(), Some("2120A008"));
        assert_eq!(parse_mblr("SF6172014A").as_deref(), Some("6172014A"));
        assert_eq!(parse_mblr("SM103250110"), None);
        assert_eq!(parse_mblr("SF7517COM"), None);
    }
}
