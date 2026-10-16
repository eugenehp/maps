//! Data centre layers.
//!
//! - `datacenters` (publishable), from open sources:
//!   - PNNL IM3 Open Source Data Center Atlas (ODbL, from OpenStreetMap): building and campus
//!     outlines, with operator and floor area;
//!   - OpenStreetMap (`telecom=data_center`, `building=data_center`, telephone exchanges
//!     `telecom=exchange`), via the Overpass API (ODbL); points inside an IM3 outline are the same
//!     facility and are dropped;
//!   - Compute Atlas (CC BY 4.0): status, capacity (MW) and project history; only records with
//!     exact coordinates; merged into a facility within 80 m.
//! - `datacenters-local` (local use only): PeeringDB interconnection facilities (its terms forbid
//!   redistribution without permission), plus facility lists dropped into
//!   `cache/datacenters/<source>/local.json` (see `Extra` below).
//!
//! Points resolve to the building that contains them (else the nearest within 25 m).

use crate::city::Ctx;
use crate::layers::{cat, round6, writable, Category, Item, Layer};
use anyhow::{bail, Context, Result};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::path::Path;
use std::process::Command;

const UA: &str =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0";
const PEERINGDB: &str = "https://www.peeringdb.com/api/fac?country=US&status=ok&depth=0";
const OVERPASS: &str = "https://overpass-api.de/api/interpreter";
const IM3: &str = "https://immm-sfa.github.io/datacenter-atlas/im3_datacenter_footprints.geojson";
const COMPUTE_ATLAS: &str = "https://raw.githubusercontent.com/ek33450505/compute-atlas/main/data/facilities.json";
const MERGE_M: f64 = 80.0;
const CLOSE_M: f64 = 35.0;
/// Hyperscale / cloud operators: their own buildings, not rented space.
const CLOUD: &[&str] = &["google", "microsoft", "amazon", "aws", "meta", "facebook", "apple", "oracle", "ibm", "yahoo", "linkedin", "twitter", "x corp"];

fn public_categories() -> Vec<Category> {
    vec![
        cat("datacenter", "Data centre", "#2b6cb0", None),
        cat("cloud", "Cloud / company-owned", "#7b3fa0", None),
        cat("exchange", "Telephone exchange", "#8a7f6e", None),
        cat("hall", "Data hall in a larger building", "#4fa3c7", None),
        cat("planned", "Planned / under construction", "#9aa5b1", None),
    ]
}
fn local_categories() -> Vec<Category> {
    vec![
        cat("carrier", "Carrier hotel / exchange point", "#c0392b", None),
        cat("colo", "Colocation", "#e67e22", None),
        cat("cloud", "Cloud / company-owned", "#7b3fa0", None),
        cat("planned", "Planned / under construction", "#9aa5b1", None),
    ]
}

fn curl(args: &[&str]) -> Result<String> {
    let o = Command::new("curl").args(["-s", "--max-time", "180", "-A", UA]).args(args).output().context("curl")?;
    if !o.status.success() {
        bail!("curl {:?}: exit {}", args.last(), o.status);
    }
    Ok(String::from_utf8_lossy(&o.stdout).into_owned())
}

fn cached(path: &Path, fetch: impl FnOnce() -> Result<String>) -> Result<Option<Value>> {
    if !path.exists() {
        match fetch().and_then(|s| serde_json::from_str::<Value>(&s).map(|v| (s, v)).map_err(Into::into)) {
            Ok((s, _)) => {
                std::fs::create_dir_all(path.parent().unwrap())?;
                std::fs::write(path, s)?;
            }
            Err(e) => {
                println!("  {}: not fetched ({e:#})", path.display());
                return Ok(None);
            }
        }
    }
    Ok(Some(serde_json::from_slice(&std::fs::read(path)?)?))
}

fn is_cloud(op: &str) -> bool {
    let o = op.to_lowercase();
    CLOUD.iter().any(|c| o.split(|ch: char| !ch.is_alphanumeric()).any(|w| w == *c) || o.starts_with(c))
}

fn item(name: &str, category: &str, ll: [f64; 2], source: &str) -> Item {
    Item {
        name: name.to_string(),
        category: category.into(),
        role: "facility".into(),
        loc: json!({ "lonlat": [round6(ll[0]), round6(ll[1])] }),
        source: source.into(),
        ..Default::default()
    }
}

/// A facility list in a common shape, from a research tool: `cache/datacenters/<source>/local.json`
/// = `{ "source": id, "licence": text, "publishable": bool, "facilities": [Extra] }`.
#[derive(Deserialize)]
struct Extra {
    name: String,
    lat: f64,
    lon: f64,
    #[serde(default)]
    operator: Option<String>,
    /// operational | planned | under construction | …
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    opened: Option<i16>,
    #[serde(default)]
    mw: Option<f64>,
    #[serde(default)]
    url: Option<String>,
}

/// Data centre names (operators, "data center"), for Overture places and OSM features not tagged as such.
/// Data centre names: "data center" / "colocation" / "colo", or an operator whose name is not also a
/// surname or another trade (Markley, Sabey, DataBank, Evocative… count only with "data"/"colo").
const DC_NAME: &str = "(?i)(data ?cent(er|re)s?\\b|datacenter|colocation|\\bcolo\\b|equinix|digital realty|coresite|cyrusone|colovore|hurricane electric|telehouse|flexential|edgeconnex|centersquare|cyxtera|\\btelx\\b|opencolo|vxchnge|unitedlayer|fortress data|dataverge|cologix|serverfarm|\\binap\\b|internap|vantage data|ntt global data|hudson ix)";
/// …but not these (offices, shops, firms, programmes and people named after the trade).
const DC_NOT: &str = "(?i)(office|mortgage|lender|design|solutions|consult|recruit|staffing|cafe|soul|restaurant|store|shop|park\\b|clinic|m\\.d\\.|insurance|careers|headquarters|\\bhq\\b|training|academy|school|college|university|gallery|resort|salon|crystallograph|program|delivered|compliance|services llc|efficiency|first databank|teikoku|trust$|resources)";

pub fn generate(ctx: &Ctx, dir: &Path, private_dir: &Path) -> Result<()> {
    let [w, s, e, n] = ctx.city.bbox;
    let inside = |ll: [f64; 2]| ll[0] >= w && ll[0] <= e && ll[1] >= s && ll[1] <= n;
    let cache = ctx.cache.join("layers");

    // ---- OpenStreetMap ----
    let pub_path = dir.join("datacenters.json");
    let mut osm_pts: Vec<[f64; 2]> = Vec::new();
    if writable(&pub_path) {
        let q = format!(
            "[out:json][timeout:120];(nwr[\"telecom\"=\"data_center\"]({s},{w},{n},{e});nwr[\"building\"=\"data_center\"]({s},{w},{n},{e});\
             nwr[\"telecom\"=\"exchange\"]({s},{w},{n},{e});\
             nwr[\"name\"~\"[Dd]ata ?[Cc]ent(er|re)|Equinix|CoreSite|Digital Realty|Colocation\"][\"building\"]({s},{w},{n},{e}););out tags center;"
        );
        let osm = cached(&cache.join("osm_datacenters_v2.json"), || curl(&["--retry", "6", "--retry-delay", "30", "--retry-all-errors", "--fail", "--data-urlencode", &format!("data={q}"), OVERPASS]))?;
        let root = ctx.root_cache().join("datacenters");
        let mut items = Vec::new();
        let mut counts: BTreeMap<&str, usize> = BTreeMap::new();

        // IM3 outlines first: they are the most precise
        let im3 = cached(&root.join("pnnl-im3").join("footprints_us.geojson"), || curl(&[IM3]))?;
        let mut outlines: Vec<Vec<Vec<[f64; 2]>>> = Vec::new();
        for f in im3.as_ref().and_then(|v| v["features"].as_array()).into_iter().flatten() {
            let p = &f["properties"];
            let g = &f["geometry"];
            let ring = |r: &Value| -> Vec<[f64; 2]> {
                r.as_array().into_iter().flatten().filter_map(|c| Some([c[0].as_f64()?, c[1].as_f64()?])).collect()
            };
            let polys: Vec<Vec<[f64; 2]>> = match g["type"].as_str() {
                Some("Polygon") => vec![ring(&g["coordinates"][0])],
                Some("MultiPolygon") => g["coordinates"].as_array().into_iter().flatten().map(|pl| ring(&pl[0])).collect(),
                _ => vec![],
            };
            let pt = match g["type"].as_str() {
                Some("Point") => g["coordinates"][0].as_f64().zip(g["coordinates"][1].as_f64()).map(|(x, y)| [x, y]),
                _ => polys.first().and_then(|r| r.first()).copied(),
            };
            let Some(pt) = pt else { continue };
            if !inside(pt) {
                continue;
            }
            let op = p["operator"].as_str().unwrap_or("");
            let name = p["name"].as_str().filter(|s| !s.is_empty()).map(str::to_string)
                .unwrap_or_else(|| if op.is_empty() { "Data centre".into() } else { format!("{op} data centre") });
            let category = if is_cloud(op) { "cloud" } else { "datacenter" };
            for poly in if polys.is_empty() { vec![vec![]] } else { polys.clone() } {
                let mut it = item(&name, category, pt, "pnnl-im3");
                if poly.len() >= 3 {
                    it.loc = json!({ "polygon": poly.iter().map(|c| [round6(c[0]), round6(c[1])]).collect::<Vec<_>>() });
                    outlines.push(vec![poly.clone()]);
                }
                let mut note = vec![op.to_string()];
                if let Some(sq) = p["sqft"].as_f64().filter(|v| *v > 0.0) {
                    note.push(format!("{} ft²", fmt_int(sq)));
                }
                it.note = Some(note.into_iter().filter(|s| !s.is_empty()).collect::<Vec<_>>().join(" · ")).filter(|s| !s.is_empty());
                if !op.is_empty() {
                    it.tags.push(op.to_lowercase());
                }
                osm_pts.push(pt);
                items.push(it);
                *counts.entry("pnnl-im3").or_default() += 1;
            }
        }
        let in_outline = |ll: [f64; 2]| outlines.iter().any(|o| crate::geom::in_part(ll, o));
        for el in osm.as_ref().and_then(|v| v["elements"].as_array()).into_iter().flatten() {
            let t = &el["tags"];
            let ll = match (el["lon"].as_f64(), el["lat"].as_f64()) {
                (Some(x), Some(y)) => [x, y],
                _ => match (el["center"]["lon"].as_f64(), el["center"]["lat"].as_f64()) {
                    (Some(x), Some(y)) => [x, y],
                    _ => continue,
                },
            };
            let op = t["operator"].as_str().or(t["brand"].as_str()).unwrap_or("");
            let exchange = t["telecom"] == "exchange";
            let name = t["name"].as_str().map(str::to_string).unwrap_or_else(|| {
                let kind = if exchange { "Telephone exchange" } else { "Data centre" };
                if op.is_empty() { kind.to_string() } else { format!("{op} {}", kind.to_lowercase()) }
            });
            let category = if exchange { "exchange" } else if is_cloud(op) { "cloud" } else { "datacenter" };
            if !exchange && in_outline(ll) {
                continue; // the IM3 outline of the same facility
            }
            let mut it = item(&name, category, ll, "osm");
            it.from = t["start_date"].as_str().and_then(|d| d.get(..4)).and_then(|y| y.parse().ok());
            it.note = (!op.is_empty() && !name.contains(op)).then(|| op.to_string());
            it.url = t["website"].as_str().map(str::to_string);
            if !op.is_empty() {
                it.tags.push(op.to_lowercase());
            }
            osm_pts.push(ll);
            items.push(it);
            *counts.entry("osm").or_default() += 1;
        }

        // Compute Atlas: merged into a facility within MERGE_M, else its own item
        let ca = cached(&root.join("compute-atlas").join("facilities_us.json"), || curl(&[COMPUTE_ATLAS]))?;
        let (mut merged, mut approx) = (0usize, 0usize);
        // approximate points with a street address are placed like the compiled lists below
        let mut ca_approx: Vec<Value> = Vec::new();
        for f in ca.as_ref().and_then(|v| v.as_array()).into_iter().flatten() {
            let l = &f["location"];
            let (Some(x), Some(y)) = (l["lon"].as_f64(), l["lat"].as_f64()) else { continue };
            if !inside([x, y]) {
                continue;
            }
            if l["precision"].as_str() != Some("exact") {
                approx += 1;
                if let Some(street) = l["street"].as_str().filter(|s| s.chars().next().is_some_and(|c| c.is_ascii_digit())) {
                    let st = f["status"].as_str().unwrap_or("");
                    let mw = f["capacityMw"]["operational"].as_f64().or(f["capacityMw"]["planned"].as_f64())
                        .or(f["capacityMw"].as_object().and_then(|o| o.values().find_map(Value::as_f64)));
                    ca_approx.push(json!({
                        "name": f["name"], "operator": f["operator"], "address": street, "city": l["city"], "state": l["state"],
                        "zip": l["postalCode"], "status": if st == "under_construction" { "under construction" } else { st },
                        "mw": mw, "mw_note": "",
                    }));
                }
                continue; // a town or a road: placed by its street address, if it has one
            }
            let st = f["status"].as_str().unwrap_or("");
            if st == "cancelled" {
                continue;
            }
            let op = f["operator"].as_str().unwrap_or("");
            let mw = f["capacityMw"]["operational"].as_f64().or(f["capacityMw"]["planned"].as_f64())
                .or(f["capacityMw"].as_object().and_then(|o| o.values().find_map(Value::as_f64)));
            let planned = matches!(st, "proposed" | "permitted" | "under_construction" | "planned");
            let mut facts = vec![];
            if let Some(mw) = mw {
                facts.push(format!("{mw:.0} MW{}", if planned { " planned" } else { "" }));
            }
            if planned {
                facts.push(st.replace('_', " "));
            }
            let year = f["announcedDate"].as_str().and_then(|d| d.get(..4)).and_then(|y| y.parse::<i16>().ok());
            let near = nearest(&mut items, [x, y], f["name"].as_str().unwrap_or(""), op);
            if let Some(it) = near {
                let mut n: Vec<String> = it.note.clone().into_iter().collect();
                n.extend(facts);
                it.note = Some(n.join(" · "));
                if !it.source.contains("compute-atlas") {
                    it.source = format!("{}+compute-atlas", it.source);
                }
                merged += 1;
                continue;
            }
            let name = f["name"].as_str().unwrap_or("Data centre");
            let category = if planned { "planned" } else if is_cloud(op) { "cloud" } else { "datacenter" };
            let mut it = item(name, category, [x, y], "compute-atlas");
            let mut note = vec![op.to_string()];
            note.extend(facts);
            it.note = Some(note.into_iter().filter(|s| !s.is_empty()).collect::<Vec<_>>().join(" · ")).filter(|s| !s.is_empty());
            it.from = if planned { None } else { year };
            if !op.is_empty() {
                it.tags.push(op.to_lowercase());
            }
            items.push(it);
            *counts.entry("compute-atlas").or_default() += 1;
        }
        // compiled lists with an open basis: cache/datacenters/<source>/open.json (operator
        // websites, government records), placed by coordinates or by street address
        let mut opens: Vec<std::path::PathBuf> = std::fs::read_dir(&root).into_iter().flatten().filter_map(|e| e.ok())
            .map(|e| e.path().join("open.json")).filter(|p| p.exists()).collect();
        opens.sort();
        let mut lists: Vec<Value> = Vec::new();
        for p in &opens {
            lists.push(serde_json::from_slice(&std::fs::read(p)?).with_context(|| format!("{}", p.display()))?);
        }
        if !ca_approx.is_empty() {
            lists.push(json!({ "source": "compute-atlas", "facilities": ca_approx }));
        }
        if !lists.is_empty() {
            let at = crate::layers::address_points(ctx)?;
            let city_state = match ctx.city.id { "nyc" => "NY", "boston" => "MA", _ => "CA" };
            // street addresses the city's buildings don't carry: Overture address points
            let mut want: Vec<(String, String, String)> = Vec::new();
            for v in &lists {
                for f in v["facilities"].as_array().into_iter().flatten() {
                    let addr = f["address"].as_str().unwrap_or("");
                    if f["state"].as_str().is_some_and(|st| st != city_state) || f["lat"].is_number() || addr.is_empty() || at.contains_key(&crate::layers::norm_addr(first_line(addr))) {
                        continue;
                    }
                    let zip = f["zip"].as_str().map(str::to_string).or(f["zip"].as_i64().map(|z| z.to_string())).unwrap_or_default();
                    if let Some((num, street)) = split_number(first_line(addr)) {
                        want.push((num, crate::layers::norm_addr(&street), zip));
                    }
                }
            }
            let geo = geocode(ctx, &want)?;
            let (mut placed, mut by_addr, mut unplaced, mut merged_o) = (0usize, 0usize, 0usize, 0usize);
            for v in &lists {
                let src: &'static str = Box::leak(v["source"].as_str().unwrap_or("compiled").to_string().into_boxed_str());
                for f in v["facilities"].as_array().into_iter().flatten() {
                    // a street address exists in many cities: only this city's state
                    let state = f["state"].as_str().unwrap_or("");
                    if !state.is_empty() && state != city_state {
                        continue;
                    }
                    // addresses only inferred (a numbering pattern, a search snippet) are not placed
                    if f["confidence"].as_str().is_some_and(|c| c != "high") {
                        continue;
                    }
                    let st = f["status"].as_str().unwrap_or("").to_lowercase();
                    if ["withdrawn", "cancel", "closed", "demolish", "decommission"].iter().any(|k| st.contains(k)) {
                        continue;
                    }
                    let addr = f["address"].as_str().unwrap_or("");
                    let zip = f["zip"].as_str().map(str::to_string).or(f["zip"].as_i64().map(|z| z.to_string())).unwrap_or_default();
                    let ll = f["lon"].as_f64().zip(f["lat"].as_f64()).map(|(x, y)| [x, y]).or_else(|| {
                        let a = crate::layers::norm_addr(first_line(addr));
                        at.get(&a).copied().or_else(|| {
                            let (num, street) = split_number(first_line(addr))?;
                            let k = (num, crate::layers::norm_addr(&street));
                            let hits = geo.get(&k)?;
                            // the one in the right ZIP, else the only one
                            hits.iter().find(|h| !zip.is_empty() && h.0 == zip).or((hits.len() == 1).then(|| &hits[0])).map(|h| h.1)
                        }).inspect(|_| by_addr += 1)
                    });
                    let Some(ll) = ll.filter(|ll| inside(*ll)) else {
                        unplaced += ll.is_none() as usize;
                        continue;
                    };
                    let name = f["name"].as_str().unwrap_or("Data centre");
                    let op = f["operator"].as_str().unwrap_or("");
                    let planned = ["plan", "propos", "approv", "construct", "permit", "pending"].iter().any(|k| st.contains(k));
                    let mut facts = Vec::new();
                    if let Some(mw) = f["mw"].as_f64() {
                        let what = f["mw_note"].as_str().or(f["mw_basis"].as_str()).unwrap_or(if src.contains("gov") { "backup generation" } else { "" });
                        facts.push(format!("{mw:.0} MW{}", if what.is_empty() { String::new() } else { format!(" {what}") }));
                    }
                    // benchmarking records: a Data Center use inside another property type is a data hall
                    let ptype = f["primary_type"].as_str().unwrap_or("");
                    let hall = !ptype.is_empty() && ptype != "Data Center";
                    if let Some(sq) = f["dc_sqft"].as_f64().filter(|v| *v > 0.0) {
                        let yr = f["year"].as_i64().map(|y| format!(" ({y})")).unwrap_or_default();
                        facts.push(format!("{} ft² {}{yr}", fmt_int(sq), if hall { "data hall" } else { "data centre" }));
                    }
                    if let Some(c) = f["capacity_mw"].as_f64() {
                        facts.push(format!("{c:.0} MW capacity"));
                    }
                    if let Some(r) = f["record"].as_str().or(f["records"][0].as_str()) {
                        facts.push(r.to_string());
                    }
                    if planned {
                        facts.push(st.clone());
                    }
                    if let Some(it) = nearest(&mut items, ll, name, op) {
                        let mut n: Vec<String> = it.note.clone().into_iter().collect();
                        if !op.is_empty() && !n.iter().any(|x| x.contains(op)) {
                            n.push(op.to_string());
                        }
                        n.extend(facts);
                        it.note = Some(n.join(" · ")).filter(|s| !s.is_empty());
                        if it.url.is_none() {
                            it.url = f["url"].as_str().map(str::to_string);
                        }
                        if !it.source.contains(src) {
                            it.source = format!("{}+{src}", it.source);
                        }
                        merged_o += 1;
                        continue;
                    }
                    let category = if planned { "planned" } else if hall { "hall" } else if is_cloud(op) { "cloud" } else { "datacenter" };
                    let mut it = item(name, category, ll, src);
                    let mut note = vec![op.to_string()];
                    note.extend(facts);
                    it.note = Some(note.into_iter().filter(|s| !s.is_empty()).collect::<Vec<_>>().join(" · ")).filter(|s| !s.is_empty());
                    it.url = f["url"].as_str().map(str::to_string);
                    it.from = f["opened"].as_i64().map(|y| y as i16);
                    if !op.is_empty() {
                        it.tags.push(op.to_lowercase());
                    }
                    items.push(it);
                    placed += 1;
                    *counts.entry(src).or_default() += 1;
                }
            }
            println!("  compiled lists: {placed} new, {merged_o} merged into others ({by_addr} placed by address), {unplaced} not placed");
        }

        // Overture places named like a data centre (CDLA-Permissive-2.0 / Apache-2.0)
        let places = ctx.cache.join("layers").join("places_all.parquet");
        if places.exists() {
            let (re, not) = (regex::Regex::new(DC_NAME)?, regex::Regex::new(DC_NOT)?);
            let (mut new_p, mut merged_p) = (0usize, 0usize);
            use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;
            for b in ParquetRecordBatchReaderBuilder::try_new(std::fs::File::open(&places)?)?.build()? {
                let b = b?;
                let col = |n: &str| b.column_by_name(n).with_context(|| format!("places column {n}"));
                let (names, cats, xs, ys, lic, st) = (
                    crate::sources::pq::strs(col("name")?)?, crate::sources::pq::strs(col("cat")?)?,
                    crate::sources::pq::f64s(col("x")?)?, crate::sources::pq::f64s(col("y")?)?,
                    crate::sources::pq::strs(col("lic")?)?, crate::sources::pq::strs(col("status")?)?,
                );
                for i in 0..b.num_rows() {
                    let (Some(name), Some(x), Some(y)) = (names[i], xs[i], ys[i]) else { continue };
                    if !re.is_match(name) || not.is_match(name) || !inside([x, y]) {
                        continue;
                    }
                    let cat = cats[i].unwrap_or("");
                    if cat.contains("store") || cat.contains("restaurant") || cat.contains("mortgage") || cat.contains("real_estate_agent") || cat == "park"
                        || cat.contains("college") || cat.contains("school") || cat.contains("university") {
                        continue;
                    }
                    if !matches!(lic[i], Some(l) if l.starts_with("CDLA") || l.starts_with("CC") || l.starts_with("Apache")) || st[i].is_some_and(|s| s != "open") {
                        continue;
                    }
                    if let Some(it) = nearest(&mut items, [x, y], name, "") {
                        if !it.source.contains("overture-places") {
                            it.source = format!("{}+overture-places", it.source);
                        }
                        merged_p += 1;
                        continue;
                    }
                    let category = if is_cloud(name) { "cloud" } else { "datacenter" };
                    items.push(item(name, category, [x, y], "overture-places"));
                    *counts.entry("overture-places").or_default() += 1;
                    new_p += 1;
                }
            }
            println!("  Overture places named like a data centre: {new_p} new, {merged_p} merged into others");
        }

        // energy disclosure: buildings that report a data centre use
        let bm = benchmarking(ctx, &root)?;
        let mut bm_merged = 0usize;
        for b in bm {
            if let Some(ll) = b.ll {
                if !inside(ll) {
                    continue;
                }
                if let Some(it) = nearest(&mut items, ll, &b.name, "").filter(|it| !it.source.contains("ll84") && !it.source.contains("beudo")) {
                    let mut n: Vec<String> = it.note.clone().into_iter().collect();
                    n.extend(b.facts);
                    it.note = Some(n.join(" · "));
                    if !it.source.contains(b.source) {
                        it.source = format!("{}+{}", it.source, b.source);
                    }
                    bm_merged += 1;
                    continue;
                }
            }
            let mut it = item(&b.name, b.category, b.ll.unwrap_or([0.0, 0.0]), b.source);
            if b.ll.is_none() {
                it.loc = json!({ "address": b.address });
            }
            it.note = Some(b.facts.join(" · ")).filter(|s| !s.is_empty());
            items.push(it);
            *counts.entry(b.source).or_default() += 1;
        }
        println!(
            "datacenters (open): {counts:?}; Compute Atlas merged into others {merged}, approximate (left out) {approx}; \
             energy disclosures merged into others {bm_merged}"
        );
        let l = Layer {
            id: "datacenters".into(),
            name: "Data centres".into(),
            description: "Data centres (outlines from the PNNL IM3 Data Center Atlas and OpenStreetMap; status, capacity and plans from Compute Atlas) and telephone exchanges.".into(),
            licence: "© OpenStreetMap contributors, ODbL 1.0 (Overpass API); PNNL IM3 Open Source Data Center Atlas (ODbL 1.0, DOI 10.57931/2550666); Data from Compute Atlas by Edward Kubiak, CC BY 4.0; Overture places (CDLA-Permissive-2.0, Apache-2.0); operators' own location pages, California government records (CEC, CEQAnet) and building energy benchmarking (CEC AB 802, San José BPO CC0, SF ECB PDDL, Brisbane, ENERGY STAR), placed with Overture address points; SF Assessor roll (ODC-PDDL); energy disclosures: NYC LL84 (NYC Open Data), Boston BERDO (ODC-PDDL), Cambridge BEUDO (City of Cambridge open data)".into(),
            publishable: true,
            generated: true,
            categories: public_categories(),
            items,
        };
        std::fs::write(&pub_path, serde_json::to_string_pretty(&l)?)?;
    }

    // ---- local sources ----
    let local_path = private_dir.join("datacenters-local.json");
    if !writable(&local_path) {
        return Ok(());
    }
    let mut items = Vec::new();
    let mut counts: BTreeMap<String, usize> = BTreeMap::new();
    let mut licences = vec!["PeeringDB (AUP: no redistribution without permission)".to_string()];
    let root = ctx.root_cache().join("datacenters");
    let pdb = cached(&root.join("peeringdb").join("fac_us.json"), || curl(&[PEERINGDB]))?;
    for f in pdb.as_ref().and_then(|v| v["data"].as_array()).into_iter().flatten() {
        let (Some(x), Some(y)) = (f["longitude"].as_f64(), f["latitude"].as_f64()) else { continue };
        if !inside([x, y]) {
            continue;
        }
        let (nets, ixs) = (f["net_count"].as_u64().unwrap_or(0), f["ix_count"].as_u64().unwrap_or(0));
        let org = f["org_name"].as_str().unwrap_or("");
        let category = if ixs > 0 || nets >= 20 { "carrier" } else if is_cloud(org) { "cloud" } else { "colo" };
        let mut it = item(f["name"].as_str().unwrap_or("Facility"), category, [x, y], "peeringdb");
        let mut note = vec![org.to_string()];
        if nets > 0 {
            note.push(format!("{nets} network{}", if nets > 1 { "s" } else { "" }));
        }
        if ixs > 0 {
            note.push(format!("{ixs} exchange point{}", if ixs > 1 { "s" } else { "" }));
        }
        it.note = Some(note.into_iter().filter(|s| !s.is_empty()).collect::<Vec<_>>().join(" · "));
        it.url = f["website"].as_str().filter(|s| !s.is_empty()).map(str::to_string);
        if !org.is_empty() {
            it.tags.push(org.to_lowercase());
        }
        items.push(it);
        *counts.entry("peeringdb".into()).or_default() += 1;
    }
    // research-tool drops
    if let Ok(rd) = std::fs::read_dir(&root) {
        let mut dirs: Vec<_> = rd.filter_map(|e| e.ok()).map(|e| e.path()).filter(|p| p.join("local.json").exists()).collect();
        dirs.sort();
        for d in dirs {
            let v: Value = serde_json::from_slice(&std::fs::read(d.join("local.json"))?)?;
            let src = v["source"].as_str().map(str::to_string).unwrap_or_else(|| d.file_name().unwrap().to_string_lossy().into_owned());
            let fs: Vec<Extra> = serde_json::from_value(v["facilities"].clone()).with_context(|| format!("{}", d.display()))?;
            if let Some(l) = v["licence"].as_str() {
                licences.push(format!("{src}: {l}"));
            }
            for f in fs {
                if !inside([f.lon, f.lat]) {
                    continue;
                }
                let st = f.status.as_deref().unwrap_or("").to_lowercase();
                let op = f.operator.as_deref().unwrap_or("");
                let category = if st.contains("plan") || st.contains("construct") || st.contains("propos") {
                    "planned"
                } else if is_cloud(op) {
                    "cloud"
                } else {
                    "colo"
                };
                let mut it = item(&f.name, category, [f.lon, f.lat], &src);
                it.from = f.opened;
                let mut note = vec![op.to_string()];
                if let Some(mw) = f.mw {
                    note.push(format!("{} MW", fmt_mw(mw)));
                }
                if !st.is_empty() && category != "planned" && st != "operational" {
                    note.push(st.clone());
                }
                it.note = Some(note.into_iter().filter(|s| !s.is_empty()).collect::<Vec<_>>().join(" · ")).filter(|s| !s.is_empty());
                it.url = f.url.or_else(|| {
                    (src == "dcmap.us").then(|| "https://dcmap.us/states/california/".to_string())
                });
                if !op.is_empty() {
                    it.tags.push(op.to_lowercase());
                }
                items.push(it);
                *counts.entry(src.clone()).or_default() += 1;
            }
        }
    }
    println!("datacenters (local): {counts:?}");
    let l = Layer {
        id: "datacenters-local".into(),
        name: "Data centres (more)".into(),
        description: "Interconnection and colocation facilities from PeeringDB (with how many networks and exchange points are in each), and facility lists from data centre maps.".into(),
        licence: format!("{}. Local use only.", licences.join("; ")),
        publishable: false,
        generated: true,
        categories: local_categories(),
        items,
    };
    std::fs::write(&local_path, serde_json::to_string_pretty(&l)?)?;
    Ok(())
}

fn metres(a: [f64; 2], b: [f64; 2]) -> f64 {
    let k = (a[1].to_radians()).cos() * 111_320.0;
    ((a[0] - b[0]) * k).hypot((a[1] - b[1]) * 110_540.0)
}
fn fmt_int(v: f64) -> String {
    let s = format!("{:.0}", v);
    let mut out = String::new();
    for (i, c) in s.chars().enumerate() {
        if i > 0 && (s.len() - i) % 3 == 0 {
            out.push(',');
        }
        out.push(c);
    }
    out
}

fn fmt_mw(v: f64) -> String {
    if v.fract().abs() < 0.05 {
        format!("{v:.0}")
    } else {
        format!("{v:.1}")
    }
}

/// The facility already listed at `ll` (not a telephone exchange): the outline containing it,
/// else a point within CLOSE_M, else one within MERGE_M with a similar name or the same operator.
fn nearest<'a>(items: &'a mut [Item], ll: [f64; 2], name: &str, op: &str) -> Option<&'a mut Item> {
    let poly = |it: &Item| -> Option<Vec<[f64; 2]>> {
        it.loc["polygon"].as_array().map(|a| a.iter().filter_map(|c| Some([c[0].as_f64()?, c[1].as_f64()?])).collect())
    };
    let point = |it: &Item| it.loc["lonlat"].as_array().and_then(|a| Some([a[0].as_f64()?, a[1].as_f64()?]))
        .or_else(|| poly(it).and_then(|p| centre(&p)));
    let same = |it: &Item| {
        crate::layers::similar(&it.name, name)
            || (!op.is_empty() && (it.tags.iter().any(|t| *t == op.to_lowercase()) || it.note.as_deref().is_some_and(|n| n.starts_with(op))))
    };
    let score = |it: &Item| -> Option<u8> {
        if it.category == "exchange" {
            return None;
        }
        if poly(it).is_some_and(|p| p.len() >= 3 && crate::geom::in_ring(ll, &p)) {
            return Some(0);
        }
        let d = point(it).map_or(f64::MAX, |p| metres(p, ll));
        if d <= CLOSE_M { Some(1) } else if d <= MERGE_M && same(it) { Some(2) } else { None }
    };
    let best = items.iter().enumerate().filter_map(|(i, it)| score(it).map(|s| (s, i))).min()?;
    items.get_mut(best.1)
}
fn centre(p: &[[f64; 2]]) -> Option<[f64; 2]> {
    (!p.is_empty()).then(|| [p.iter().map(|c| c[0]).sum::<f64>() / p.len() as f64, p.iter().map(|c| c[1]).sum::<f64>() / p.len() as f64])
}

/// A building that reports a data centre in a city's energy disclosure.
struct Bench {
    name: String,
    address: String,
    ll: Option<[f64; 2]>,
    category: &'static str,
    facts: Vec<String>,
    source: &'static str,
}

/// Data halls this big (ft²) inside another building are worth showing; smaller ones are server rooms.
const HALL_MIN_SQFT: f64 = 10_000.0;
const LL84: &str = "https://data.cityofnewyork.us/resource/5zyy-y8am.json";
const BEUDO: &str = "https://data.cambridgema.gov/resource/72g6-j7aq.json";
const BERDO: &str = "https://data.boston.gov/dataset/b09a8b71-274b-4365-9ce6-49b8b44602ef/resource/911db0b1-437f-43ba-86bb-860cc1cd9319/download/2025-reported-energy-and-water-metrics.xlsx";

fn sqft_note(dc: f64, whole: bool, year: &str, what: &str) -> String {
    format!("{} ft² {}{} ({what} {year})", fmt_int(dc), if whole { "data centre" } else { "data hall" }, "")
}

fn benchmarking(ctx: &Ctx, root: &Path) -> Result<Vec<Bench>> {
    let mut out = Vec::new();
    let num = |v: &Value| v.as_str().and_then(|s| s.parse::<f64>().ok()).or(v.as_f64());
    let telco = |owner: &str| {
        let o = owner.to_uppercase();
        o.contains("TEL & TEL") || o.contains("TEL * TEL") || o.contains("TELEPHONE") || o.contains("VERIZON")
    };
    match ctx.city.id {
        "nyc" => {
            let url = format!(
                "{LL84}?$select=report_year,property_name,address_1,largest_property_use_type,data_center_gross_floor_area,\
                 data_center_it_site_energy,data_center_pue,latitude,longitude\
                 &$where=largest_property_use_type='Data Center' OR list_of_all_property_use like '%Data Center%'&$limit=20000"
            );
            let v = cached(&root.join("ll84").join("nyc.json"), || curl(&["-G", &url.replace(' ', "%20").replace('%', "%25").replace("%2520", "%20")]))?;
            // latest report per address
            let mut latest: BTreeMap<String, Value> = BTreeMap::new();
            for r in v.as_ref().and_then(Value::as_array).into_iter().flatten() {
                let k = r["address_1"].as_str().unwrap_or("").to_uppercase();
                let y = |r: &Value| r["report_year"].as_str().unwrap_or("").to_string();
                if latest.get(&k).is_none_or(|o| y(o) < y(r)) {
                    latest.insert(k, r.clone());
                }
            }
            // one record per building: the same one is often filed under several spellings
            let mut by_place: BTreeMap<(i64, i64), Value> = BTreeMap::new();
            for r in latest.into_values() {
                let k = match (num(&r["longitude"]), num(&r["latitude"])) {
                    (Some(x), Some(y)) => ((x * 3000.0).round() as i64, (y * 3000.0).round() as i64),
                    _ => (i64::MAX, by_place.len() as i64),
                };
                let better = |o: &Value| {
                    let y = |r: &Value| r["report_year"].as_str().unwrap_or("").to_string();
                    (y(&r), num(&r["data_center_gross_floor_area"]).unwrap_or(0.0)) > (y(o), num(&o["data_center_gross_floor_area"]).unwrap_or(0.0))
                };
                if by_place.get(&k).is_none_or(better) {
                    by_place.insert(k, r);
                }
            }
            for r in by_place.values() {
                let dc = num(&r["data_center_gross_floor_area"]).unwrap_or(0.0);
                let whole = r["largest_property_use_type"] == "Data Center";
                if !whole && dc < HALL_MIN_SQFT {
                    continue;
                }
                let ll = num(&r["longitude"]).zip(num(&r["latitude"])).map(|(x, y)| [x, y]);
                let year = r["report_year"].as_str().unwrap_or("");
                let mut facts = vec![sqft_note(dc, whole, year, "LL84")];
                if let Some(kwh) = num(&r["data_center_it_site_energy"]).filter(|k| *k > 0.0) {
                    facts.push(format!("{:.1} MW IT load", kwh / 8760.0 / 1000.0));
                }
                if let Some(pue) = num(&r["data_center_pue"]).filter(|p| *p >= 1.0) {
                    facts.push(format!("PUE {pue:.2}"));
                }
                let addr = r["address_1"].as_str().unwrap_or("").to_string();
                let pname = r["property_name"].as_str().filter(|n| !n.is_empty() && *n != "Not Available").unwrap_or(&addr);
                // telephone central offices file as "CO/VZT/104 BROAD ST/NEW YORK/NY"
                let (name, category) = if let Some(rest) = pname.strip_prefix("CO/") {
                    let mut f = rest.split('/');
                    let who = f.next().unwrap_or("");
                    let street = crate::sources::nyc::title_case(f.next().unwrap_or(&addr));
                    let op = if who == "VZT" { "Verizon " } else { "" };
                    (format!("{op}central office, {street}"), "exchange")
                } else {
                    (pname.to_string(), if whole { "datacenter" } else { "hall" })
                };
                out.push(Bench { name, address: addr, ll, category, facts, source: "nyc-ll84" });
            }
        }
        "boston" => {
            // Cambridge BEUDO (has coordinates)
            let url = format!(
                "{BEUDO}?$select=data_year,address,owner,primary_property_type_self_selected,all_property_uses,latitude,longitude\
                 &$where=all_property_uses%20like%20'%25Data%20Center%25'&$limit=5000"
            );
            let v = cached(&root.join("beudo").join("cambridge.json"), || curl(&["-G", &url]))?;
            let mut latest: BTreeMap<String, Value> = BTreeMap::new();
            for r in v.as_ref().and_then(Value::as_array).into_iter().flatten() {
                let k = r["address"].as_str().unwrap_or("").to_uppercase();
                let y = |r: &Value| r["data_year"].as_str().unwrap_or("").to_string();
                if latest.get(&k).is_none_or(|o| y(o) < y(r)) {
                    latest.insert(k, r.clone());
                }
            }
            for r in latest.values() {
                let uses = r["all_property_uses"].as_str().unwrap_or("");
                let dc = data_center_sqft(uses);
                let whole = r["primary_property_type_self_selected"] == "Data Center";
                if !whole && dc < HALL_MIN_SQFT {
                    continue;
                }
                let owner = r["owner"].as_str().unwrap_or("");
                let ll = num(&r["longitude"]).zip(num(&r["latitude"])).map(|(x, y)| [x, y]);
                let addr = r["address"].as_str().unwrap_or("").to_string();
                let cat = if telco(owner) || owner.contains("AT&T") { "exchange" } else if whole { "datacenter" } else { "hall" };
                let facts = vec![sqft_note(dc, whole, r["data_year"].as_str().unwrap_or(""), "BEUDO")];
                out.push(Bench { name: addr.clone(), address: addr, ll, category: cat, facts, source: "cambridge-beudo" });
            }
            // Boston BERDO (addresses only; an Excel workbook)
            let xlsx = root.join("berdo").join("berdo_2025.xlsx");
            if !xlsx.exists() {
                std::fs::create_dir_all(xlsx.parent().unwrap())?;
                if let Err(e) = curl(&["-L", "-o", xlsx.to_str().unwrap(), BERDO]) {
                    println!("  BERDO not fetched ({e:#})");
                }
            }
            if xlsx.exists() {
                use calamine::{open_workbook_auto, Data, Reader};
                let known = crate::neurotech::addresses(ctx)?;
                let mut wb = open_workbook_auto(&xlsx).context("BERDO workbook")?;
                let range = wb.worksheet_range("Data Disclosure").context("BERDO: Data Disclosure sheet")?;
                let mut rows = range.rows();
                rows.next();
                let head: Vec<String> = rows.next().map(|r| r.iter().map(|c| c.to_string()).collect()).unwrap_or_default();
                let col = |n: &str| head.iter().position(|h| h == n);
                let (ca, cpa, cown, clp, cuses) = (
                    col("Building Address"), col("Parcel Address"), col("Property Owner Name"), col("Largest Property Type"),
                    col("All Property Types and GFAs"),
                );
                let cell = |r: &[Data], c: Option<usize>| c.and_then(|c| r.get(c)).map(|d| d.to_string()).unwrap_or_default();
                for r in rows {
                    let uses = cell(r, cuses);
                    let dc = data_center_sqft(&uses);
                    let whole = cell(r, clp) == "Data Center";
                    if !whole && dc < HALL_MIN_SQFT {
                        continue;
                    }
                    // the building address, either end of a range ("29-51 Belvidere St"), else the parcel's
                    // ("42  30 Saratoga St": two numbers): the first the city's address index knows
                    let mut cands = Vec::new();
                    for raw in [cell(r, ca), cell(r, cpa)] {
                        let words: Vec<&str> = raw.split_whitespace().collect();
                        let nums: Vec<&str> = words.iter().take_while(|w| w.chars().all(|c| c.is_ascii_digit() || c == '-')).copied().collect();
                        let street = words[nums.len()..].join(" ");
                        for n in nums.iter().flat_map(|n| n.split('-')) {
                            cands.push(format!("{n} {street}"));
                        }
                        if nums.is_empty() && !street.is_empty() {
                            cands.push(street);
                        }
                    }
                    let addr = cands.iter().find(|c| known.contains(&crate::layers::norm_addr(c))).or(cands.first()).cloned().unwrap_or_default();
                    let owner = cell(r, cown);
                    let cat = if telco(&owner) { "exchange" } else if whole { "datacenter" } else { "hall" };
                    let facts = vec![sqft_note(dc, whole, "2025", "BERDO")];
                    out.push(Bench { name: addr.clone(), address: addr, ll: None, category: cat, facts, source: "boston-berdo" });
                }
            }
        }
        _ => {}
    }
    // SF Assessor: parcels of class "Industrial Data Center" (public domain; the roll `sf` fetched)
    if matches!(ctx.city.id, "sf" | "bay") {
        let dir = ctx.root_cache().join("sf").join("assessor_2025");
        let mut seen = std::collections::HashSet::new();
        for e in std::fs::read_dir(&dir).into_iter().flatten().filter_map(|e| e.ok()) {
            let rows: Vec<Value> = serde_json::from_slice(&std::fs::read(e.path())?).unwrap_or_default();
            for r in rows {
                if r["property_class_code_definition"] != "Industrial Data Center" || !seen.insert(r["parcel_number"].to_string()) {
                    continue;
                }
                let c = &r["the_geom"]["coordinates"];
                let ll = c[0].as_f64().zip(c[1].as_f64()).map(|(x, y)| [x, y]);
                // "0000 0365 MAIN                ST0000" -> "365 Main St"
                let loc = r["property_location"].as_str().unwrap_or("");
                let words: Vec<&str> = loc.split_whitespace().collect();
                let num = words.get(1).map(|n| n.trim_start_matches('0')).unwrap_or("");
                let street: Vec<String> = words.iter().skip(2).map(|w| w.trim_end_matches(|c: char| c.is_ascii_digit())).filter(|w| !w.is_empty())
                    .map(|w| crate::sources::nyc::title_case(w)).collect();
                let addr = format!("{num} {}", street.join(" "));
                let facts = vec!["SF Assessor: Industrial Data Center".to_string()];
                out.push(Bench { name: addr.clone(), address: addr, ll, category: "datacenter", facts, source: "sf-assessor" });
            }
        }
    }
    println!("  energy disclosures and assessor rolls: {} buildings with a data centre", out.len());
    Ok(out)
}

/// "Office (199472.0),Data Center (2028.0)" -> 2028
fn data_center_sqft(uses: &str) -> f64 {
    uses.split("Data Center (").nth(1).and_then(|r| r.split(')').next()).and_then(|v| v.trim().parse().ok()).unwrap_or(0.0)
}

fn first_line(a: &str) -> &str {
    a.split(['#', ',']).next().unwrap_or(a).trim()
}
/// "2590 Walsh Ave" -> ("2590", "Walsh Ave"); "1-3 X St" -> ("1", "X St")
fn split_number(a: &str) -> Option<(String, String)> {
    let (n, rest) = a.split_once(' ')?;
    let n = n.split('-').next()?;
    (n.chars().all(|c| c.is_ascii_digit()) && !n.is_empty()).then(|| (n.to_string(), rest.to_string()))
}

/// (number, normalised street) -> [(zip, lon/lat)] from Overture address points in the city's bbox,
/// for just the house numbers asked for (one S3 query, cached by the set asked).
fn geocode(ctx: &Ctx, want: &[(String, String, String)]) -> Result<std::collections::HashMap<(String, String), Vec<(String, [f64; 2])>>> {
    let mut out: std::collections::HashMap<(String, String), Vec<(String, [f64; 2])>> = Default::default();
    if want.is_empty() {
        return Ok(out);
    }
    let mut nums: Vec<&str> = want.iter().map(|w| w.0.as_str()).collect();
    nums.sort();
    nums.dedup();
    let mut h = 0xcbf29ce484222325u64;
    for n in &nums {
        for b in n.bytes().chain([b',']) {
            h = (h ^ b as u64).wrapping_mul(0x100000001b3);
        }
    }
    let path = ctx.cache.join("layers").join(format!("addr_geocode_{:012x}.json", h & 0xffff_ffff_ffff));
    if !path.exists() {
        let [w, s, e, n] = ctx.city.bbox;
        let list = nums.iter().map(|n| format!("'{n}'")).collect::<Vec<_>>().join(",");
        let sql = format!(
            "INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial; SET s3_region='us-west-2'; SET enable_progress_bar=false;
             COPY (SELECT number, street, postcode, ST_X(geometry) AS x, ST_Y(geometry) AS y
                   FROM read_parquet('s3://overturemaps-us-west-2/release/2026-09-23.1/theme=addresses/type=address/*.parquet')
                   WHERE country = 'US' AND bbox.xmin BETWEEN {w} AND {e} AND bbox.ymin BETWEEN {s} AND {n} AND number IN ({list}))
             TO '{}' (FORMAT json, ARRAY true);",
            path.display()
        );
        println!("  geocoding {} addresses (Overture address points)...", want.len());
        if !Command::new("duckdb").arg("-c").arg(&sql).status().context("duckdb")?.success() {
            println!("  geocoding failed");
            return Ok(out);
        }
    }
    let rows: Vec<Value> = serde_json::from_slice(&std::fs::read(&path)?).unwrap_or_default();
    let wanted: std::collections::HashSet<(String, String)> = want.iter().map(|w| (w.0.clone(), w.1.clone())).collect();
    for r in rows {
        let k = (r["number"].as_str().unwrap_or("").to_string(), crate::layers::norm_addr(r["street"].as_str().unwrap_or("")));
        if !wanted.contains(&k) {
            continue;
        }
        let (Some(x), Some(y)) = (r["x"].as_f64(), r["y"].as_f64()) else { continue };
        let zip = r["postcode"].as_str().unwrap_or("").chars().take(5).collect();
        out.entry(k).or_default().push((zip, [x, y]));
    }
    Ok(out)
}
