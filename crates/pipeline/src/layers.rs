//! Occupancy layers (see layers/SCHEMA.md): who used a building, when.
//!
//! 1. Generate `layers/<city>/{academia,startups,companies}.json` from open
//!    data (Overture places + land_use campuses, Wikidata). Files with
//!    `"generated": true` are rewritten; anything else (hand-written,
//!    browser exports) is left alone and ingested as is.
//! 2. Resolve every item's `where` to building gids (from the written tiles,
//!    so it must run after `tiles`) and write web/data/<city>/layers.json +
//!    layers.bin.

use crate::city::Ctx;
use crate::classify;
use crate::geom::{centroid, in_part, Proj};
use crate::sources::bay::parse_wkb;
use crate::sources::pq::{bins, f64s, strs};
use crate::sources::wikidata::{self, point, qid, Row};
use anyhow::{bail, Context, Result};
use byteorder::{WriteBytesExt, LE};
use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;
use rayon::prelude::*;
use rstar::{primitives::GeomWithData, primitives::Rectangle, RTree, AABB};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::process::Command;

pub const MAGIC: &[u8; 4] = b"SFL2";
/// Startups: founded in or after this year, not government / nonprofit,
/// in a mapped (non-"other") category or tagged "startup company".
const STARTUP_SINCE: i16 = 1970;
const NEAREST_M: f64 = 25.0;
const MERGE_M: f64 = 100.0;
const OVERTURE: &str = "s3://overturemaps-us-west-2/release";

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub color: String,
    pub parent: Option<String>,
    /// Off until the user turns it on (K-12 schools, IT agencies: many, and rarely what one looks for).
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub off: bool,
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Item {
    pub name: String,
    pub category: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub role: String,
    pub from: Option<i16>,
    pub to: Option<i16>,
    #[serde(rename = "where")]
    pub loc: Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wikidata: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    #[serde(default)]
    pub source: String,
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Layer {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub licence: String,
    #[serde(default)]
    pub publishable: bool,
    #[serde(default)]
    pub generated: bool,
    pub categories: Vec<Category>,
    pub items: Vec<Item>,
}

pub(crate) fn cat(id: &str, name: &str, color: &str, parent: Option<&str>) -> Category {
    Category { id: id.into(), name: name.into(), color: color.into(), parent: parent.map(String::from), off: false }
}

fn academia_categories() -> Vec<Category> {
    vec![
        cat("university", "University", "#1f4e9c", None),
        cat("college", "College / community college", "#3a7bd5", None),
        cat("research", "Research institute / national lab", "#7b3fa0", None),
        cat("hospital", "Teaching hospital / medical school", "#c0392b", None),
        Category { off: true, ..cat("school", "School (K-12)", "#9aa5b1", None) },
        cat("dorm", "Student housing", "#5dade2", None),
    ]
}

/// Sectors of the `companies` layer (classify::sector).
fn company_categories() -> Vec<Category> {
    vec![
        cat("tech", "Technology", "#2e86de", None),
        cat("finance", "Finance & insurance", "#1f6f50", None),
        cat("professional", "Professional services", "#8e44ad", None),
        cat("media", "Media, arts & entertainment", "#e84393", None),
        cat("retail", "Retail & consumer goods", "#f39c12", None),
        cat("food", "Food, drink & hotels", "#d35400", None),
        cat("realestate", "Real estate & construction", "#7f6a4f", None),
        cat("industry", "Manufacturing & energy", "#5d6d7e", None),
        cat("transport", "Transport", "#16a085", None),
        cat("health", "Health care", "#c0392b", None),
        cat("nonprofit", "Nonprofits", "#6c8ebf", None),
        cat("other", "Other", "#a4acb3", None),
    ]
}

fn startup_categories() -> Vec<Category> {
    let mut v = vec![
        cat("software", "Software", "#2e86de", None),
        cat("hardware", "Hardware", "#e67e22", None),
        cat("bio", "Bio & health", "#27ae60", None),
        cat("other", "Other", "#95a5a6", None),
        Category { off: true, ..cat("services", "IT services & agencies", "#b3aa9c", None) },
    ];
    for (id, name, color, parent) in [
        ("ai", "AI & ML", "#8e44ad", "software"),
        ("devtools", "Developer tools", "#3498db", "software"),
        ("saas", "SaaS / enterprise", "#2980b9", "software"),
        ("consumer", "Consumer & social", "#e84393", "software"),
        ("gaming", "Gaming", "#6c5ce7", "software"),
        ("security", "Security", "#2d3436", "software"),
        ("fintech", "Fintech", "#00b894", "software"),
        ("crypto", "Crypto", "#fdcb6e", "software"),
        ("semiconductors", "Semiconductors", "#d35400", "hardware"),
        ("devices", "Devices & electronics", "#e17055", "hardware"),
        ("robotics", "Robotics", "#fab1a0", "hardware"),
        ("space", "Space & aerospace", "#636e72", "hardware"),
        ("energy", "Energy & cleantech", "#badc58", "hardware"),
        ("transport", "Transport & EV", "#f0932b", "hardware"),
        ("biotech", "Biotech", "#16a085", "bio"),
        ("pharma", "Pharma", "#1abc9c", "bio"),
        ("medtech", "Medtech", "#55efc4", "bio"),
        ("healthtech", "Health tech", "#00cec9", "bio"),
    ] {
        v.push(cat(id, name, color, Some(parent)));
    }
    v
}

/// Industry label (Wikidata P452 label or Overture category) -> category.
/// First match wins; order matters (specific before generic).
const INDUSTRY: &[(&str, &str)] = &[
    ("artificial intelligence", "ai"), ("machine learning", "ai"),
    ("video game", "gaming"), ("game", "gaming"),
    ("computer security", "security"), ("cybersecurity", "security"), ("security software", "security"),
    ("cryptocurrenc", "crypto"), ("blockchain", "crypto"),
    ("financial technology", "fintech"), ("fintech", "fintech"), ("payment", "fintech"),
    ("semiconductor", "semiconductors"), ("integrated circuit", "semiconductors"),
    ("robot", "robotics"),
    ("aerospace", "space"), ("spaceflight", "space"), ("space industry", "space"),
    ("renewable", "energy"), ("solar", "energy"), ("clean", "energy"), ("battery", "energy"), ("energy_company", "energy"),
    ("electric vehicle", "transport"), ("automotive", "transport"), ("ridesharing", "transport"), ("transport", "transport"),
    ("biotechnology", "biotech"), ("genom", "biotech"), ("life science", "biotech"), ("b2b_scientific_lab", "biotech"),
    ("pharmaceutical", "pharma"), ("drug", "pharma"),
    ("medical device", "medtech"), ("medical equipment", "medtech"), ("medical technology", "medtech"),
    ("health", "healthtech"),
    ("developer", "devtools"), ("software development", "devtools"), ("version control", "devtools"),
    ("social", "consumer"), ("e-commerce", "consumer"), ("marketplace", "consumer"), ("sharing economy", "consumer"), ("online", "consumer"), ("internet", "consumer"),
    ("food delivery", "consumer"), ("delivery", "consumer"), ("mobile app", "consumer"), ("dating", "consumer"), ("media_news", "consumer"),
    ("software", "saas"), ("cloud", "saas"), ("enterprise", "saas"), ("saas", "saas"),
    ("information technology", "software"), ("information_technology", "software"), ("computer", "hardware"),
    ("consumer electronics", "devices"), ("electronics", "devices"), ("hardware", "devices"), ("telecommunication", "devices"),
];

fn map_industry(labels: &[String]) -> String {
    for (k, c) in INDUSTRY {
        if labels.iter().any(|l| l.to_lowercase().contains(k)) {
            return c.to_string();
        }
    }
    "other".into()
}

/// Overture places categories of the academia layer, -> (layer, category). Tech offices: classify::tech_from_place.
fn place_category(primary: &str) -> Option<(&'static str, &'static str)> {
    Some(match primary {
        "college_university" => ("academia", "university"),
        "medical_school" | "nursing_school" => ("academia", "hospital"),
        "research_institute" | "medical_research_institute" | "educational_research_institute" => ("academia", "research"),
        "university_housing" => ("academia", "dorm"),
        "elementary_school" | "middle_school" | "high_school" | "public_school" | "private_school" | "charter_school" => {
            ("academia", "school")
        }
        _ => return None,
    })
}

pub fn run(ctx: &Ctx) -> Result<()> {
    let root = ctx.root_cache().parent().unwrap().to_path_buf();
    let dir = root.join("layers").join(ctx.city.id);
    let private = root.join("data-private").join("layers").join(ctx.city.id);
    std::fs::create_dir_all(&dir)?;
    std::fs::create_dir_all(&private)?;
    generate(ctx, &dir, &private)?;
    resolve(ctx, &[&dir, &private])
}

// ---------------------------------------------------------------- generate

pub(crate) fn writable(path: &Path) -> bool {
    match std::fs::read(path) {
        Ok(b) => serde_json::from_slice::<Value>(&b).map_or(false, |v| v["generated"].as_bool() == Some(true)),
        Err(_) => true,
    }
}

struct Pt {
    name: String,
    ll: [f64; 2],
}

pub(crate) struct Place {
    pub name: String,
    pub cat: String,
    pub ll: [f64; 2],
    pub web: Option<String>,
    pub addr: String,
    pub wikidata: Option<String>,
    pub conf: f64,
    /// at a mail-drop address
    pub mail: bool,
}

fn generate(ctx: &Ctx, dir: &Path, private: &Path) -> Result<()> {
    let city = ctx.city;
    let cache = ctx.cache.join("layers");
    std::fs::create_dir_all(&cache)?;
    let wd = cache.join("wikidata");
    let [w, s, e, n] = city.bbox;
    let release = "2026-09-23.1";

    // Overture places: every named place in the bbox. Academia and tech offices are picked by
    // category; the rest are where Wikidata companies headquartered "in the city" are found.
    let places = cache.join("places_all.parquet");
    if !places.exists() {
        duckdb(&format!(
            "COPY (SELECT names.primary AS name, taxonomy.primary AS cat, ST_X(geometry) AS x, ST_Y(geometry) AS y,
                    websites[1] AS web, addresses[1].freeform AS addr, sources[1].license AS lic, brand.wikidata AS wikidata,
                    operating_status AS status, confidence
             FROM read_parquet('{OVERTURE}/{release}/theme=places/type=place/*.parquet')
             WHERE bbox.xmin >= {w} AND bbox.xmax <= {e} AND bbox.ymin >= {s} AND bbox.ymax <= {n}
               AND names.primary IS NOT NULL) TO '{}' (FORMAT parquet)",
            places.display()
        ))?;
    }
    let campus = cache.join("campus.parquet");
    if !campus.exists() {
        duckdb(&format!(
            "COPY (SELECT names.primary AS name, class, wikidata, ST_AsWKB(geometry) AS wkb
             FROM read_parquet('{OVERTURE}/{release}/theme=base/type=land_use/*.parquet')
             WHERE subtype = 'education' AND class IN ('university', 'college', 'school')
               AND bbox.xmin >= {w} AND bbox.xmax <= {e} AND bbox.ymin >= {s} AND bbox.ymax <= {n}
               AND names.primary IS NOT NULL
               AND ST_GeometryType(geometry) IN ('POLYGON', 'MULTIPOLYGON')) TO '{}' (FORMAT parquet)",
            campus.display()
        ))?;
    }

    // Wikidata: settlements (to drop city-centroid coordinates), academia,
    // companies by own coordinates and by headquarters.
    let depth = 4;
    let cell = |t: &str, name: &str| -> Result<Vec<Row>> {
        let mut out = Vec::new();
        for b in split_bbox(city.bbox, 0.5) {
            out.extend(wikidata::query_box(t, b, &wd, name, depth)?);
        }
        Ok(out)
    };
    let boxq = |inner: &str| {
        format!(
            "SELECT * WHERE {{ SERVICE wikibase:box {{ ?item wdt:P625 ?coord . \
             bd:serviceParam wikibase:cornerSouthWest \"{{SW}}\"^^geo:wktLiteral . \
             bd:serviceParam wikibase:cornerNorthEast \"{{NE}}\"^^geo:wktLiteral . }} {inner} }}"
        )
    };
    println!("wikidata: settlements...");
    let settle = cell(&boxq("VALUES ?cls { wd:Q486972 wd:Q123705 wd:Q1907114 wd:Q2983893 } ?item wdt:P31/wdt:P279* ?cls ."), "settle")?;
    let mut bad_pts: HashSet<(i64, i64)> = HashSet::new();
    for r in &settle {
        if let Some((p, _)) = point(&r["coord"]) {
            bad_pts.insert(key4(p));
        }
    }
    println!("wikidata: academia...");
    let acad = cell(
        &boxq(
            "VALUES ?cls { wd:Q3918 wd:Q189004 wd:Q31855 wd:Q494230 wd:Q1059324 wd:Q3914 wd:Q1144475 } \
             ?item wdt:P31/wdt:P279* ?cls .",
        ),
        "acad",
    )?;
    println!("wikidata: companies (own coordinates)...");
    let comp_own = cell(&boxq("?item wdt:P31/wdt:P279* wd:Q4830453 ."), "comp")?;
    println!("wikidata: companies (headquarters)...");
    let comp_hq = {
        // HQ statements: the HQ item's coordinate, plus coordinate /
        // street-address qualifiers (common when the HQ is just the city).
        let t = "SELECT ?item ?hq ?coord ?qcoord ?qaddr ?from ?to WHERE { SERVICE wikibase:box { ?hq wdt:P625 ?coord . \
                 bd:serviceParam wikibase:cornerSouthWest \"{SW}\"^^geo:wktLiteral . \
                 bd:serviceParam wikibase:cornerNorthEast \"{NE}\"^^geo:wktLiteral . } \
                 ?item p:P159 ?st . ?st ps:P159 ?hq . OPTIONAL { ?st pq:P580 ?from } OPTIONAL { ?st pq:P582 ?to } \
                 OPTIONAL { ?st pq:P625 ?qcoord } OPTIONAL { ?st pq:P6375 ?qaddr } \
                 ?item wdt:P31/wdt:P279* wd:Q4830453 . }";
        let mut out = Vec::new();
        for b in split_bbox(city.bbox, 0.5) {
            out.extend(wikidata::query_box(t, b, &wd, "hq2", depth)?);
        }
        out
    };
    // Coordinate qualifiers on any HQ statement (the HQ item itself may be
    // a city elsewhere): a global scan filtered to the bbox, fast enough.
    println!("wikidata: headquarters coordinate qualifiers...");
    let comp_hqq = wikidata::query(
        &format!(
            "SELECT ?item ?qcoord ?from ?to ?qaddr WHERE {{ ?st pq:P625 ?qcoord . ?item p:P159 ?st .
               BIND(geof:longitude(?qcoord) AS ?lon) BIND(geof:latitude(?qcoord) AS ?lat)
               FILTER(?lon > {w} && ?lon < {e} && ?lat > {s} && ?lat < {n})
               OPTIONAL {{ ?st pq:P580 ?from }} OPTIONAL {{ ?st pq:P582 ?to }} OPTIONAL {{ ?st pq:P6375 ?qaddr }} }}"
        ),
        &wd.join(format!("hqq_{w}_{s}_{e}_{n}.json")),
    )?;
    let settle_q: HashSet<String> = settle.iter().map(|r| qid(&r["item"])).collect();

    // Candidate locations per company: own coordinate beats HQ coordinate.
    struct Loc {
        ll: Option<[f64; 2]>,
        addr: Option<String>,
        from: Option<i16>,
        to: Option<i16>,
        via_settlement: bool,
    }
    let mut dropped_coarse = 0;
    let ok_pt = |wkt: &str, dropped: &mut usize| -> Option<[f64; 2]> {
        let (p, dec) = point(wkt)?;
        if dec <= 3 || bad_pts.contains(&key4(p)) {
            *dropped += 1;
            return None;
        }
        Some(p)
    };
    let mut locs: HashMap<String, Vec<Loc>> = HashMap::new();
    for r in &comp_own {
        if let Some(p) = ok_pt(&r["coord"], &mut dropped_coarse) {
            locs.entry(qid(&r["item"])).or_default().push(Loc { ll: Some(p), addr: None, from: None, to: None, via_settlement: false });
        }
    }
    for r in &comp_hq {
        let q = qid(&r["item"]);
        let settlement = settle_q.contains(&qid(&r["hq"]));
        let qll = r.get("qcoord").and_then(|c| ok_pt(c, &mut dropped_coarse));
        let ll = qll.or_else(|| if settlement { None } else { ok_pt(&r["coord"], &mut dropped_coarse) });
        let (from, to) = (r.get("from").and_then(|y| wikidata::year(y)), r.get("to").and_then(|y| wikidata::year(y)));
        let addr = r.get("qaddr").filter(|a| !a.is_empty()).cloned();
        locs.entry(q).or_default().push(Loc { ll, addr, from, to, via_settlement: settlement });
    }

    for r in &comp_hqq {
        let Some(p) = ok_pt(&r["qcoord"], &mut dropped_coarse) else { continue };
        let (from, to) = (r.get("from").and_then(|y| wikidata::year(y)), r.get("to").and_then(|y| wikidata::year(y)));
        locs.entry(qid(&r["item"])).or_default().push(Loc { ll: Some(p), addr: None, from, to, via_settlement: false });
    }

    // Details for every candidate.
    let mut ids: Vec<String> = locs.keys().cloned().chain(acad.iter().map(|r| qid(&r["item"]))).collect();
    ids.sort();
    ids.dedup();
    println!("wikidata: details for {} items...", ids.len());
    let det = details(&ids, &wd)?;

    // ---- academia
    let mut acad_items: Vec<Item> = Vec::new();
    let class_rank = |c: &str| match c {
        "Q494230" | "Q1059324" => (0, "hospital"),
        "Q31855" | "Q1144475" => (1, "research"),
        "Q189004" => (2, "college"),
        "Q3918" => (3, "university"),
        _ => (4, "school"),
    };
    let mut best: BTreeMap<String, (i32, &'static str, [f64; 2])> = BTreeMap::new();
    for r in &acad {
        let Some(p) = ok_pt(&r["coord"], &mut dropped_coarse) else { continue };
        let (rank, c) = class_rank(&qid(&r["cls"]));
        let e = best.entry(qid(&r["item"])).or_insert((rank, c, p));
        if rank < e.0 {
            *e = (rank, c, p);
        }
    }
    for (q, (_, c, p)) in &best {
        let d = det.get(q);
        acad_items.push(Item {
            name: d.map_or(q.clone(), |d| d.label.clone()),
            category: c.to_string(),
            role: "campus".into(),
            from: d.and_then(|d| d.inception),
            to: d.and_then(|d| d.dissolved),
            loc: json!({ "lonlat": p }),
            wikidata: Some(q.clone()),
            url: d.and_then(|d| d.url()),
            source: "wikidata".into(),
            ..Default::default()
        });
    }
    // Campus polygons (OSM via Overture); points inside a same-named campus merge into it.
    let mut campuses: Vec<(Item, Vec<Vec<[f64; 2]>>)> = Vec::new();
    for b in ParquetRecordBatchReaderBuilder::try_new(std::fs::File::open(&campus)?)?.build()? {
        let b = b?;
        let (name, class, wdq, wkb) = (strs(col(&b, "name")?)?, strs(col(&b, "class")?)?, strs(col(&b, "wikidata")?)?, bins(col(&b, "wkb")?)?);
        for i in 0..b.num_rows() {
            let Some(parts) = wkb[i].and_then(parse_wkb) else { continue };
            for rings in parts {
                let ring = rings[0].clone();
                campuses.push((
                    Item {
                        name: name[i].unwrap_or("").to_string(),
                        category: match class[i] {
                            Some("university") => "university",
                            Some("college") => "college",
                            _ => "school",
                        }
                        .into(),
                        role: "campus".into(),
                        loc: json!({ "polygon": ring.iter().map(|p| [round6(p[0]), round6(p[1])]).collect::<Vec<_>>() }),
                        wikidata: wdq[i].map(String::from),
                        source: "osm".into(),
                        ..Default::default()
                    },
                    vec![ring],
                ));
            }
        }
    }
    // Overture places: open, permissively licensed records only (CDLA, CC, Apache; not ODbL).
    let mut all: Vec<Place> = Vec::new();
    for b in ParquetRecordBatchReaderBuilder::try_new(std::fs::File::open(&places)?)?.build()? {
        let b = b?;
        let (name, catc, x, y) = (strs(col(&b, "name")?)?, strs(col(&b, "cat")?)?, f64s(col(&b, "x")?)?, f64s(col(&b, "y")?)?);
        let (web, addr, lic, wdq, status) =
            (strs(col(&b, "web")?)?, strs(col(&b, "addr")?)?, strs(col(&b, "lic")?)?, strs(col(&b, "wikidata")?)?, strs(col(&b, "status")?)?);
        let conf = f64s(col(&b, "confidence")?)?;
        for i in 0..b.num_rows() {
            let (Some(nm), Some(x), Some(y)) = (name[i], x[i], y[i]) else { continue };
            if status[i].is_some_and(|s| s != "open") || lic[i].is_some_and(|l| !l.starts_with("CDLA") && !l.starts_with("CC") && !l.starts_with("Apache")) {
                continue;
            }
            all.push(Place {
                name: nm.to_string(),
                cat: catc[i].unwrap_or("").to_string(),
                ll: [round6(x), round6(y)],
                web: web[i].map(String::from),
                addr: addr[i].unwrap_or("").to_string(),
                wikidata: wdq[i].map(String::from),
                conf: conf[i].unwrap_or(0.0),
                mail: false,
            });
        }
    }
    // mail-drops (548 Market St: hundreds of "companies" with a private mailbox) are not offices
    let drops = classify::mail_drops(all.iter().map(|p| p.addr.as_str()));
    let mut n_mail = 0;
    for p in &mut all {
        p.mail = classify::is_pmb(&p.addr) || drops.contains(&classify::street(&p.addr));
    }
    let mut place_acad = Vec::new();
    let mut place_tech = Vec::new();
    for p in &all {
        let host = p.web.as_deref().and_then(classify::host).map(|h| h.0);
        let (layer, category) = match place_category(&p.cat) {
            Some((l, c)) => (l, c),
            None => match classify::tech_from_place(&p.cat) {
                Some(c) => ("startups", c),
                None => continue,
            },
        };
        if layer == "startups" && p.mail {
            n_mail += 1;
            continue;
        }
        // tech offices: what the name says beats the generic category ("software development")
        let category = if layer == "startups" { classify::tech_from_name(&p.name, host.as_deref()).unwrap_or(category) } else { category };
        let it = Item {
            name: p.name.clone(),
            category: category.into(),
            role: if layer == "academia" { "campus".into() } else { "office".into() },
            loc: json!({ "lonlat": p.ll }),
            wikidata: p.wikidata.clone(),
            url: p.web.clone(),
            source: "overture-places".into(),
            ..Default::default()
        };
        if layer == "academia" { place_acad.push(it) } else { place_tech.push(it) }
    }
    println!("overture places: {} open records, {} mail-drop addresses ({n_mail} tech listings there dropped)", all.len(), drops.len());
    let n_campus = campuses.len();
    let academia = merge_academia(acad_items, place_acad, campuses);
    println!("academia: {} items ({} campus polygons before merging)", academia.len(), n_campus);

    // ---- companies headquartered "in the city" without a usable location: find their office
    // among the Overture places, by Wikidata id (brand), by website, or by exact name.
    let mut found: HashMap<String, (&'static str, usize)> = HashMap::new();
    {
        let key = |n: &str| norm_name(n).join(" ");
        let (mut by_q, mut by_host, mut by_name): (HashMap<&str, Vec<usize>>, HashMap<String, Vec<usize>>, HashMap<String, Vec<usize>>) = Default::default();
        for (i, p) in all.iter().enumerate() {
            if p.mail {
                continue;
            }
            if let Some(q) = &p.wikidata {
                by_q.entry(q).or_default().push(i);
            }
            if let Some((h, _)) = p.web.as_deref().and_then(classify::host) {
                by_host.entry(h).or_default().push(i);
            }
            by_name.entry(key(&p.name)).or_default().push(i);
        }
        for (q, ls) in &locs {
            let Some(d) = det.get(q) else { continue };
            // of several offices: one named like the company, an "HQ", an office-like category, then Overture's confidence
            let score = |i: usize| {
                let p = &all[i];
                let low = p.name.to_lowercase();
                p.conf + 0.3 * similar(&p.name, &d.label) as u8 as f64 + 0.2 * (low.contains(" hq") || low.contains("headquarters")) as u8 as f64
                    + 0.1 * classify::office_like(&p.cat) as u8 as f64
            };
            let best = |v: &[usize]| v.iter().copied().max_by(|&a, &b| score(a).total_cmp(&score(b)));
            // (a bare street address from Wikidata is often a registered or mail-drop address:
            // an office found among the places is used instead)
            if ls.iter().any(|l| l.ll.is_some() || l.addr.is_some()) {
                continue;
            }
            // more than 3 candidates: a chain (bank branches, shops), no single headquarters
            let few = |v: &&Vec<usize>| v.len() <= 3;
            let hit = by_q.get(q.as_str()).filter(few).and_then(|v| best(v)).map(|i| ("id", i))
                .or_else(|| {
                    let (h, bare) = d.website.as_deref().and_then(classify::host)?;
                    if !bare || classify::generic_host(&h) {
                        return None;
                    }
                    by_host.get(&h).filter(few).and_then(|v| best(v)).map(|i| ("website", i))
                })
                .or_else(|| {
                    let k = key(&d.label);
                    if k.chars().filter(|c| c.is_alphanumeric()).count() < 4 {
                        return None;
                    }
                    let v: Vec<usize> = by_name.get(&k).filter(few)?.iter().copied().filter(|&i| classify::office_like(&all[i].cat)).collect();
                    best(&v).map(|i| ("name", i))
                });
            if let Some(h) = hit {
                found.insert(q.clone(), h);
            }
        }
        for (q, (_, i)) in &found {
            locs.get_mut(q).unwrap().push(Loc { ll: Some(all[*i].ll), addr: None, from: None, to: None, via_settlement: false });
        }
        let mut how: BTreeMap<&str, usize> = BTreeMap::new();
        for (h, _) in found.values() {
            *how.entry(h).or_default() += 1;
        }
        println!("companies located through Overture places: {} ({how:?})", found.len());
    }

    // ---- companies / startups
    // nonprofit, government agency, government organisation, international / intergovernmental org
    let gov = ["Q163740", "Q327333", "Q2659904", "Q484652", "Q245065"];
    let mut startups = Vec::new();
    let mut companies = Vec::new();
    let mut no_loc = 0;
    let mut n_not_company = 0;
    for (q, ls) in &locs {
        let Some(d) = det.get(q) else { continue };
        let mut tags = Vec::new();
        if d.acquired {
            tags.push("acquired".to_string());
        }
        if d.public {
            tags.push("public".into());
        }
        if d.dissolved.is_some() {
            tags.push("defunct".into());
        }
        if d.startup {
            tags.push("startup".into());
        }
        let mut category = map_industry(&d.industries);
        if category == "other" {
            category = map_industry(&d.type_labels);
        }
        if category == "other" {
            // Fall back on the item's own type: technology / software company, website, online service.
            for (t, c) in [("Q1058914", "saas"), ("Q18388277", "software"), ("Q35127", "consumer"), ("Q19967801", "consumer")] {
                if d.types.iter().any(|x| x == t) {
                    category = c.into();
                    break;
                }
            }
        }
        // the name beats nothing and the generic labels ("Scale AI": software industry)
        let host = d.website.as_deref().and_then(classify::host).map(|h| h.0);
        if matches!(category.as_str(), "other" | "saas" | "software" | "consumer") {
            if let Some(c) = classify::tech_from_name(&d.label, host.as_deref()).filter(|c| *c != "services") {
                category = c.into();
            }
        }
        let place = found.get(q).map(|(_, i)| &all[*i]);
        // then the office it was found at (Dropbox: no industry, a "software_development" place)
        if category == "other" {
            if let Some(c) = place.and_then(|p| classify::tech_from_place(&p.cat)).filter(|c| *c != "services") {
                category = c.into();
            }
        }
        if classify::not_a_company(&d.type_labels) {
            n_not_company += 1;
            continue;
        }
        let is_startup = (d.startup || category != "other")
            && d.inception.is_some_and(|y| y >= STARTUP_SINCE)
            && !d.types.iter().any(|t| gov.contains(&t.as_str()));
        // One item per distinct location; settlement-only HQs fall back to the street address.
        let mut seen = HashSet::new();
        let mut emitted = false;
        for l in ls {
            if place.is_some() && l.ll.is_none() {
                continue; // the office found beats a bare address
            }
            let addr = l.addr.as_ref().or(d.address.as_ref().filter(|_| l.via_settlement));
            let loc = match (l.ll, addr) {
                (Some(p), _) => json!({ "lonlat": [round6(p[0]), round6(p[1])] }),
                (None, Some(a)) => json!({ "address": a.split(',').next().unwrap_or(a).trim() }),
                _ => continue,
            };
            if !seen.insert(loc.to_string()) {
                continue;
            }
            emitted = true;
            let it = Item {
                name: d.label.clone(),
                category: if is_startup {
                    category.clone()
                } else {
                    let nonprofit = d.types.iter().any(|t| t == "Q163740")
                        || d.type_labels.iter().any(|t| { let t = t.to_lowercase(); t.contains("nonprofit") || t.contains("non-profit") || t.contains("charit") });
                    let s = if nonprofit { "nonprofit" } else { classify::sector(&d.industries, &d.type_labels, place.map(|p| p.cat.as_str())) };
                    // a tech company too old to count as a startup
                    if s == "other" && category != "other" { "tech".into() } else { s.into() }
                },
                tags: tags.clone(),
                role: "hq".into(),
                from: l.from.or(d.inception),
                to: l.to.or(d.dissolved),
                loc,
                wikidata: Some(q.clone()),
                url: d.url(),
                source: if l.ll.is_some() && place.is_some_and(|p| Some(p.ll) == l.ll) { "wikidata+overture-places".into() } else { "wikidata".into() },
                ..Default::default()
            };
            if is_startup { startups.push(it) } else { companies.push(it) }
        }
        no_loc += (!emitted) as usize;
    }
    // Current tech occupants from Overture places; drop those duplicating a Wikidata item nearby.
    let wd_pts: Vec<Pt> = startups.iter().chain(&companies).filter_map(|i| Some(Pt { name: i.name.clone(), ll: lonlat(&i.loc)? })).collect();
    let tree = RTree::bulk_load(wd_pts.iter().enumerate().map(|(i, p)| GeomWithData::new(p.ll, i)).collect::<Vec<_>>());
    let mut dup = 0;
    for it in place_tech {
        let ll = lonlat(&it.loc).unwrap();
        let near = tree.locate_within_distance(ll, deg2(ll, MERGE_M)).any(|g| similar(&wd_pts[g.data].name, &it.name));
        if near {
            dup += 1;
        } else {
            startups.push(it);
        }
    }
    println!(
        "companies: wikidata {} with a usable location ({} without; {} coarse/city-centroid coordinates dropped), startups {}, older/other {}, overture duplicates dropped {dup}, not companies (libraries, schools, agencies) {n_not_company}",
        locs.len() - no_loc, no_loc, dropped_coarse, startups.len(), companies.len()
    );

    let write = |id: &str, name: &str, desc: &str, licence: &str, cats: Vec<Category>, items: Vec<Item>| -> Result<()> {
        let path = dir.join(format!("{id}.json"));
        if !writable(&path) {
            println!("  {id}.json is user-maintained: not regenerated");
            return Ok(());
        }
        let l = Layer {
            id: id.into(),
            name: name.into(),
            description: desc.into(),
            licence: licence.into(),
            publishable: true,
            generated: true,
            categories: cats,
            items,
        };
        std::fs::write(&path, serde_json::to_string_pretty(&l)?)?;
        Ok(())
    };
    write(
        "academia",
        "Academia",
        "Universities, colleges, research institutes, teaching hospitals, schools and student housing.",
        "Wikidata (CC0); OpenStreetMap campus outlines via Overture Maps (ODbL, attribution + share-alike); Overture places (CDLA-Permissive-2.0, Apache-2.0)",
        academia_categories(),
        academia,
    )?;
    write(
        "startups",
        "Startups & tech",
        &format!(
            "Companies founded {STARTUP_SINCE} or later in tech/bio (Wikidata, with headquarters history), plus current tech offices (Overture places)."
        ),
        "Wikidata (CC0); Overture places (CDLA-Permissive-2.0, Apache-2.0)",
        startup_categories(),
        startups,
    )?;
    crate::neurotech::generate(ctx, private, &all)?;
    crate::datacenters::generate(ctx, dir, private)?;
    write(
        "companies",
        "Other companies",
        "Older or non-tech companies headquartered here (Wikidata), by sector.",
        "Wikidata (CC0); Overture places (CDLA-Permissive-2.0, Apache-2.0)",
        company_categories(),
        companies,
    )?;
    Ok(())
}

/// Academia merge: same Q-id, or a point inside / within MERGE_M of a
/// similarly named item; polygons win (they cover the whole campus).
fn merge_academia(wd: Vec<Item>, places: Vec<Item>, campuses: Vec<(Item, Vec<Vec<[f64; 2]>>)>) -> Vec<Item> {
    let mut out: Vec<Item> = Vec::new();
    let mut polys: Vec<(usize, Vec<Vec<[f64; 2]>>)> = Vec::new();
    for (it, rings) in campuses {
        polys.push((out.len(), rings));
        out.push(it);
    }
    for it in wd.into_iter().chain(places) {
        let ll = lonlat(&it.loc).unwrap();
        let by_q = it.wikidata.as_ref().and_then(|q| out.iter().position(|o| o.wikidata.as_ref() == Some(q)));
        let by_poly = || polys.iter().find(|(i, r)| in_part(ll, r) && similar(&out[*i].name, &it.name)).map(|(i, _)| *i);
        let by_near = || {
            out.iter().position(|o| {
                lonlat(&o.loc).is_some_and(|p| dist_m(p, ll) <= MERGE_M) && similar(&o.name, &it.name)
            })
        };
        match by_q.or_else(by_poly).or_else(by_near) {
            Some(i) => {
                let o = &mut out[i];
                // Polygon / first item keeps its geometry; adopt metadata.
                if o.wikidata.is_none() {
                    o.wikidata = it.wikidata.clone();
                }
                if it.source == "wikidata" {
                    o.name = it.name.clone();
                    o.from = o.from.or(it.from);
                    o.to = o.to.or(it.to);
                    o.category = it.category.clone();
                }
                o.url = o.url.clone().or(it.url.clone());
                if !o.source.contains(&it.source) {
                    o.source = format!("{}+{}", o.source, it.source);
                }
            }
            None => out.push(it),
        }
    }
    // Polygons of the same wikidata item stay separate items (multi-site campuses).
    out
}

struct Detail {
    label: String,
    inception: Option<i16>,
    dissolved: Option<i16>,
    industries: Vec<String>,
    types: Vec<String>,
    /// English labels of `types` ("hotel", "record label"): the sector when there is no industry
    type_labels: Vec<String>,
    acquired: bool,
    public: bool,
    startup: bool,
    website: Option<String>,
    wiki: Option<String>,
    address: Option<String>,
}

impl Detail {
    fn url(&self) -> Option<String> {
        self.wiki.clone().or(self.website.clone())
    }
}

fn details(ids: &[String], wd: &Path) -> Result<HashMap<String, Detail>> {
    let mut out = HashMap::new();
    for (k, chunk) in ids.chunks(150).enumerate() {
        let values = chunk.iter().map(|q| format!("wd:{q}")).collect::<Vec<_>>().join(" ");
        let q = format!(
            "SELECT ?item ?itemLabel (MIN(?inc) AS ?inception) (MIN(?dis) AS ?dissolved)
               (GROUP_CONCAT(DISTINCT ?indLabel; separator='|') AS ?inds) (GROUP_CONCAT(DISTINCT STR(?type); separator='|') AS ?types)
               (GROUP_CONCAT(DISTINCT ?typeLabel; separator='|') AS ?typeLabels)
               (SAMPLE(?owner) AS ?own) (SAMPLE(?parent) AS ?par) (SAMPLE(?exch) AS ?ex) (SAMPLE(?site) AS ?web)
               (SAMPLE(?article) AS ?wiki) (SAMPLE(?addr) AS ?address) WHERE {{
              VALUES ?item {{ {values} }}
              OPTIONAL {{ ?item wdt:P571 ?inc }} OPTIONAL {{ ?item wdt:P576 ?dis }}
              OPTIONAL {{ ?item wdt:P452 ?ind . ?ind rdfs:label ?indLabel FILTER(lang(?indLabel) = 'en') }}
              OPTIONAL {{ ?item wdt:P31 ?type OPTIONAL {{ ?type rdfs:label ?typeLabel FILTER(lang(?typeLabel) = 'en') }} }} OPTIONAL {{ ?item wdt:P127 ?owner }} OPTIONAL {{ ?item wdt:P749 ?parent }}
              OPTIONAL {{ ?item wdt:P414 ?exch }} OPTIONAL {{ ?item wdt:P856 ?site }} OPTIONAL {{ ?item wdt:P6375 ?addr }}
              OPTIONAL {{ ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }}
              SERVICE wikibase:label {{ bd:serviceParam wikibase:language 'en'. }}
            }} GROUP BY ?item ?itemLabel"
        );
        let h = format!("{:016x}", fxhash(&values));
        for r in wikidata::query(&q, &wd.join(format!("details2_{k:04}_{h}.json")))? {
            let get = |k: &str| r.get(k).filter(|v| !v.is_empty()).cloned();
            let types: Vec<String> = get("types").map(|t| t.split('|').map(qid).collect()).unwrap_or_default();
            out.insert(
                qid(&r["item"]),
                Detail {
                    label: get("itemLabel").unwrap_or_default(),
                    inception: get("inception").and_then(|y| wikidata::year(&y)),
                    dissolved: get("dissolved").and_then(|y| wikidata::year(&y)),
                    industries: get("inds").map(|t| t.split('|').map(String::from).collect()).unwrap_or_default(),
                    startup: types.iter().any(|t| t == "Q131524"),
                    type_labels: get("typeLabels").map(|t| t.split('|').map(String::from).collect()).unwrap_or_default(),
                    types,
                    acquired: get("own").is_some() || get("par").is_some(),
                    public: get("ex").is_some(),
                    website: get("web"),
                    wiki: get("wiki"),
                    address: get("address"),
                },
            );
        }
    }
    Ok(out)
}

fn fxhash(s: &str) -> u64 {
    s.bytes().fold(0xcbf29ce484222325u64, |h, b| (h ^ b as u64).wrapping_mul(0x100000001b3))
}

fn duckdb(copy_sql: &str) -> Result<()> {
    let sql = format!("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial; SET s3_region='us-west-2'; SET enable_progress_bar=false; {copy_sql};");
    if !Command::new("duckdb").arg("-c").arg(&sql).status().context("duckdb")?.success() {
        bail!("duckdb failed");
    }
    Ok(())
}

fn col<'a>(b: &'a arrow_array::RecordBatch, n: &str) -> Result<&'a dyn arrow_array::Array> {
    Ok(b.column_by_name(n).with_context(|| format!("column {n}"))?.as_ref())
}

fn split_bbox(b: [f64; 4], max: f64) -> Vec<[f64; 4]> {
    let (nx, ny) = (((b[2] - b[0]) / max).ceil().max(1.0) as usize, ((b[3] - b[1]) / max).ceil().max(1.0) as usize);
    let (dx, dy) = ((b[2] - b[0]) / nx as f64, (b[3] - b[1]) / ny as f64);
    (0..ny).flat_map(|j| (0..nx).map(move |i| [b[0] + i as f64 * dx, b[1] + j as f64 * dy, b[0] + (i + 1) as f64 * dx, b[1] + (j + 1) as f64 * dy])).collect()
}

fn key4(p: [f64; 2]) -> (i64, i64) {
    ((p[0] * 1e4).round() as i64, (p[1] * 1e4).round() as i64)
}

pub(crate) fn round6(v: f64) -> f64 {
    (v * 1e6).round() / 1e6
}

fn lonlat(v: &Value) -> Option<[f64; 2]> {
    let a = v["lonlat"].as_array()?;
    Some([a.first()?.as_f64()?, a.get(1)?.as_f64()?])
}

fn dist_m(a: [f64; 2], b: [f64; 2]) -> f64 {
    let kx = 111_320.0 * a[1].to_radians().cos();
    (((a[0] - b[0]) * kx).powi(2) + ((a[1] - b[1]) * 110_574.0).powi(2)).sqrt()
}

/// Squared degree radius roughly matching `m` metres (for rstar queries).
fn deg2(p: [f64; 2], m: f64) -> f64 {
    let d = m / (111_320.0 * p[1].to_radians().cos());
    d * d
}

pub(crate) fn norm_name(s: &str) -> Vec<String> {
    let stop = ["the", "of", "inc", "llc", "corp", "corporation", "co", "company", "ltd", "at", "and", "&"];
    s.to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| !w.is_empty() && !stop.contains(w))
        .map(String::from)
        .collect()
}

/// Token overlap >= 0.5 of the shorter name (or one contains the other).
pub(crate) fn similar(a: &str, b: &str) -> bool {
    let (x, y) = (norm_name(a), norm_name(b));
    if x.is_empty() || y.is_empty() {
        return false;
    }
    let (xs, ys): (HashSet<&String>, HashSet<&String>) = (x.iter().collect(), y.iter().collect());
    let common = xs.intersection(&ys).count();
    common >= 1 && common as f64 >= 0.5 * xs.len().min(ys.len()) as f64
}

// ---------------------------------------------------------------- resolve

/// Buildings decoded from the written tiles, in metres.
struct Bldg {
    rings: Vec<Vec<Vec<[f64; 2]>>>, // parts -> rings
    c: [f64; 2],
}

fn load_buildings(ctx: &Ctx) -> Result<(Vec<Bldg>, Vec<String>)> {
    let m: Value = serde_json::from_slice(&std::fs::read(ctx.out.join("index.json")).context("run tiles first")?)?;
    let count = m["count"].as_u64().unwrap() as usize;
    let mut bs: Vec<Option<Bldg>> = (0..count).map(|_| None).collect();
    let mut packs: HashMap<String, Vec<u8>> = HashMap::new();
    for t in m["tiles"].as_array().unwrap() {
        let f = t["file"].as_str().unwrap();
        if !packs.contains_key(f) {
            packs.insert(f.to_string(), std::fs::read(ctx.out.join(f))?);
        }
        let (off, len) = (t["offset"].as_u64().unwrap() as usize, t["length"].as_u64().unwrap() as usize);
        for (g, b) in decode_tile(&packs[f][off..off + len]) {
            bs[g as usize] = Some(b);
        }
    }
    let mut addr = vec![String::new(); count];
    for r in m["regions"].as_array().unwrap() {
        let g0 = r["gid0"].as_u64().unwrap() as usize;
        let rows: Vec<Value> = serde_json::from_slice(&std::fs::read(ctx.out.join(r["attrs"].as_str().unwrap()))?)?;
        for (k, row) in rows.iter().enumerate() {
            addr[g0 + k] = row[0].as_str().unwrap_or("").to_string();
        }
    }
    Ok((bs.into_iter().map(|b| b.expect("gid missing in tiles")).collect(), addr))
}

fn decode_tile(b: &[u8]) -> Vec<(u32, Bldg)> {
    let t = tilefmt::decode(b).expect("tile");
    let (ox, oz) = (t.origin[0] as f64, t.origin[1] as f64);
    let xz = |k: usize| [t.xz[2 * k] as f64 / 10.0 + ox, t.xz[2 * k + 1] as f64 / 10.0 + oz];
    (0..t.n_buildings())
        .map(|i| {
            let parts: Vec<Vec<Vec<[f64; 2]>>> = (t.part_start[i]..t.part_start[i + 1])
                .map(|p| {
                    (t.ring_start[p as usize]..t.ring_start[p as usize + 1])
                        .map(|r| (t.vert_start[r as usize]..t.vert_start[r as usize + 1]).map(|k| xz(k as usize)).collect())
                        .collect()
                })
                .collect();
            let c = centroid(&parts);
            (t.gid0 + i as u32, Bldg { rings: parts, c })
        })
        .collect()
}

/// Lower-case, abbreviated street types, no punctuation: "1355 Market Street" -> "1355 market st".
pub fn norm_addr(s: &str) -> String {
    let map = |w: &str| -> String {
        match w {
            "street" => "st",
            "avenue" | "av" => "ave",
            "boulevard" => "blvd",
            "drive" => "dr",
            "road" => "rd",
            "place" => "pl",
            "court" => "ct",
            "lane" => "ln",
            "terrace" => "ter",
            "highway" => "hwy",
            "parkway" => "pkwy",
            "square" => "sq",
            "north" => "n",
            "south" => "s",
            "east" => "e",
            "west" => "w",
            "first" => "1st",
            "second" => "2nd",
            "third" => "3rd",
            "fourth" => "4th",
            "fifth" => "5th",
            other => other,
        }
        .to_string()
    };
    s.to_lowercase()
        .replace(['.', ',', '#'], " ")
        .split_whitespace()
        .map(map)
        .collect::<Vec<_>>()
        .join(" ")
}

struct Resolver {
    proj: Proj,
    bs: Vec<Bldg>,
    tree: RTree<GeomWithData<Rectangle<[f64; 2]>, u32>>,
    addr: HashMap<String, Vec<u32>>,
}

/// Every address in the city's index -> lon/lat of (the first) building with it.
pub(crate) fn address_points(ctx: &Ctx) -> Result<HashMap<String, [f64; 2]>> {
    let r = Resolver::new(ctx)?;
    let mut out = HashMap::new();
    for (a, gs) in &r.addr {
        let Some(b) = gs.first().and_then(|&g| r.bs.get(g as usize)) else { continue };
        let pts: Vec<[f64; 2]> = b.rings.iter().flatten().flatten().copied().collect();
        if pts.is_empty() {
            continue;
        }
        let c = [pts.iter().map(|p| p[0]).sum::<f64>() / pts.len() as f64, pts.iter().map(|p| p[1]).sum::<f64>() / pts.len() as f64];
        out.insert(a.clone(), r.proj.inv(c));
    }
    Ok(out)
}

impl Resolver {
    fn new(ctx: &Ctx) -> Result<Self> {
        let (bs, addrs) = load_buildings(ctx)?;
        let tree = RTree::bulk_load(
            bs.iter()
                .enumerate()
                .map(|(i, b)| {
                    let (mut lo, mut hi) = ([f64::MAX; 2], [f64::MIN; 2]);
                    for p in b.rings.iter().flatten().flatten() {
                        lo = [lo[0].min(p[0]), lo[1].min(p[1])];
                        hi = [hi[0].max(p[0]), hi[1].max(p[1])];
                    }
                    GeomWithData::new(Rectangle::from_corners(lo, hi), i as u32)
                })
                .collect(),
        );
        let mut addr: HashMap<String, Vec<u32>> = HashMap::new();
        for (g, a) in addrs.iter().enumerate() {
            if !a.is_empty() {
                addr.entry(norm_addr(a)).or_default().push(g as u32);
            }
        }
        Ok(Resolver { proj: Proj::new(ctx.city.origin), bs, tree, addr })
    }

    fn at_point(&self, ll: [f64; 2]) -> Option<u32> {
        let p = self.proj.fwd(ll);
        if let Some(g) = self.tree.locate_all_at_point(p).find(|g| self.bs[g.data as usize].rings.iter().any(|r| in_part(p, r))) {
            return Some(g.data);
        }
        let env = AABB::from_corners([p[0] - NEAREST_M, p[1] - NEAREST_M], [p[0] + NEAREST_M, p[1] + NEAREST_M]);
        self.tree
            .locate_in_envelope_intersecting(env)
            .map(|g| (edge_dist(p, &self.bs[g.data as usize].rings), g.data))
            .filter(|(d, _)| *d <= NEAREST_M)
            .min_by(|a, b| a.0.partial_cmp(&b.0).unwrap())
            .map(|x| x.1)
    }

    fn resolve(&self, w: &Value) -> std::result::Result<Vec<u32>, &'static str> {
        if let Some(ll) = lonlat(w) {
            return self.at_point(ll).map(|g| vec![g]).ok_or("no building at point");
        }
        if let Some(a) = w["address"].as_str() {
            return self.addr.get(&norm_addr(a)).cloned().ok_or("address not found");
        }
        if let Some(g) = w["gid"].as_u64() {
            return if (g as usize) < self.bs.len() { Ok(vec![g as u32]) } else { Err("gid out of range") };
        }
        if let Some(poly) = w["polygon"].as_array() {
            let ring: Vec<[f64; 2]> = poly.iter().filter_map(|p| Some(self.proj.fwd([p[0].as_f64()?, p[1].as_f64()?]))).collect();
            if ring.len() < 3 {
                return Err("bad polygon");
            }
            let (mut lo, mut hi) = ([f64::MAX; 2], [f64::MIN; 2]);
            for p in &ring {
                lo = [lo[0].min(p[0]), lo[1].min(p[1])];
                hi = [hi[0].max(p[0]), hi[1].max(p[1])];
            }
            let v: Vec<u32> = self
                .tree
                .locate_in_envelope_intersecting(AABB::from_corners(lo, hi))
                .filter(|g| crate::geom::in_ring(self.bs[g.data as usize].c, &ring))
                .map(|g| g.data)
                .collect();
            return if v.is_empty() { Err("no building centroid inside polygon") } else { Ok(v) };
        }
        Err("bad where")
    }
}

fn edge_dist(p: [f64; 2], parts: &[Vec<Vec<[f64; 2]>>]) -> f64 {
    let mut best = f64::MAX;
    for r in parts.iter().flatten() {
        for i in 0..r.len() {
            let (a, b) = (r[i], r[(i + 1) % r.len()]);
            let (dx, dz) = (b[0] - a[0], b[1] - a[1]);
            let l2 = dx * dx + dz * dz;
            let t = if l2 > 0.0 { (((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2).clamp(0.0, 1.0) } else { 0.0 };
            let (qx, qz) = (a[0] + t * dx, a[1] + t * dz);
            best = best.min(((p[0] - qx).powi(2) + (p[1] - qz).powi(2)).sqrt());
        }
    }
    best
}

fn resolve(ctx: &Ctx, dirs: &[&Path]) -> Result<()> {
    let mut files: Vec<PathBuf> = dirs
        .iter()
        .filter_map(|dir| std::fs::read_dir(dir).ok())
        .flat_map(|rd| rd.filter_map(|e| e.ok().map(|e| e.path())))
        .filter(|p| p.extension().is_some_and(|e| e == "json"))
        .collect();
    files.sort();
    let mut layers: Vec<Layer> = Vec::new();
    for f in &files {
        let l: Layer = serde_json::from_slice(&std::fs::read(f)?).with_context(|| format!("parse {}", f.display()))?;
        layers.push(l);
    }
    let rs = Resolver::new(ctx)?;
    let nb = rs.bs.len();

    // Global category bits.
    let mut bit = 0u32;
    let mut cats_json = Vec::new();
    let mut bits: Vec<HashMap<String, (usize, u32)>> = Vec::new(); // per layer: cat id -> (cat idx, bit)
    for l in &layers {
        let mut m = HashMap::new();
        let mut cj = Vec::new();
        for (ci, c) in l.categories.iter().enumerate() {
            if bit >= 64 {
                bail!("more than 64 categories across layers");
            }
            m.insert(c.id.clone(), (ci, bit));
            let mut j = json!({ "id": c.id, "name": c.name, "color": c.color, "parent": c.parent, "bit": bit });
            if c.off {
                j["off"] = json!(true);
            }
            cj.push(j);
            bit += 1;
        }
        bits.push(m);
        cats_json.push(cj);
    }

    let mut sources: Vec<String> = Vec::new();
    let mut items_json = Vec::new();
    let mut links: Vec<Vec<u32>> = vec![Vec::new(); nb];
    let mut mask = vec![0u64; nb];
    let mut unresolved: BTreeMap<(String, String, &'static str), usize> = BTreeMap::new();
    for (li, l) in layers.iter().enumerate() {
        let res: Vec<std::result::Result<Vec<u32>, &'static str>> = l.items.par_iter().map(|it| rs.resolve(&it.loc)).collect();
        let mut ok = 0;
        for (it, r) in l.items.iter().zip(res) {
            let gids = match r {
                Ok(g) => g,
                Err(e) => {
                    *unresolved.entry((l.id.clone(), it.source.clone(), e)).or_default() += 1;
                    continue;
                }
            };
            let Some(&(ci, b)) = bits[li].get(&it.category).or_else(|| bits[li].get("other")) else {
                *unresolved.entry((l.id.clone(), it.source.clone(), "unknown category")).or_default() += 1;
                continue;
            };
            let parent_bit = l.categories[ci].parent.as_ref().and_then(|p| bits[li].get(p)).map(|x| x.1);
            let si = match sources.iter().position(|s| *s == it.source) {
                Some(i) => i,
                None => {
                    sources.push(it.source.clone());
                    sources.len() - 1
                }
            };
            let idx = items_json.len() as u32;
            items_json.push(json!([li, ci, it.name, it.role, it.from, it.to, it.url, it.note, it.wikidata, si, it.tags]));
            for g in gids {
                links[g as usize].push(idx);
                mask[g as usize] |= 1 << b;
                if let Some(pb) = parent_bit {
                    mask[g as usize] |= 1 << pb;
                }
            }
            ok += 1;
        }
        println!("layer {}: {} items, {ok} resolved", l.id, l.items.len());
    }
    for ((l, s, e), n) in &unresolved {
        println!("  unresolved {l}/{s}: {n} ({e})");
    }

    // layers.json + layers.bin
    let lj = json!({
        "layers": layers.iter().zip(&cats_json).map(|(l, c)| json!({
            "id": l.id, "name": l.name, "description": l.description, "licence": l.licence, "publishable": l.publishable, "categories": c
        })).collect::<Vec<_>>(),
        "itemColumns": ["layer", "category", "name", "role", "from", "to", "url", "note", "wikidata", "source", "tags"],
        "items": items_json,
        "sources": sources,
    });
    std::fs::write(ctx.out.join("layers.json"), serde_json::to_string(&lj)?)?;
    let nl: usize = links.iter().map(Vec::len).sum();
    let mut b = Vec::with_capacity(12 + nb * 12 + nl * 4);
    b.extend_from_slice(MAGIC);
    b.write_u32::<LE>(nb as u32)?;
    b.write_u32::<LE>(nl as u32)?;
    for m in &mask {
        b.write_u32::<LE>(*m as u32)?;
        b.write_u32::<LE>((*m >> 32) as u32)?;
    }
    let mut acc = 0u32;
    b.write_u32::<LE>(0)?;
    for l in &links {
        acc += l.len() as u32;
        b.write_u32::<LE>(acc)?;
    }
    for l in &links {
        for &i in l {
            b.write_u32::<LE>(i)?;
        }
    }
    std::fs::write(ctx.out.join("layers.bin"), &b)?;
    println!(
        "layers.json {:.2} MB, layers.bin {:.2} MB, {} buildings with an occupant",
        std::fs::metadata(ctx.out.join("layers.json"))?.len() as f64 / 1048576.0,
        b.len() as f64 / 1048576.0,
        links.iter().filter(|l| !l.is_empty()).count()
    );

    // Sanity: pile-ups and spot checks.
    let names: Vec<String> = items_json.iter().map(|v| v[2].as_str().unwrap_or("").to_string()).collect();
    let startup_layer = layers.iter().position(|l| l.id == "startups");
    let mut top: Vec<(usize, u32)> = links
        .iter()
        .enumerate()
        .map(|(g, l)| (l.iter().filter(|&&i| Some(items_json[i as usize][0].as_u64().unwrap() as usize) == startup_layer).count(), g as u32))
        .filter(|x| x.0 > 0)
        .collect();
    top.sort_by(|a, b| b.0.cmp(&a.0));
    let addrs = load_buildings(ctx)?.1;
    println!("top buildings by startup items:");
    for (n, g) in top.iter().take(20) {
        let sample: Vec<&str> = links[*g as usize].iter().take(4).map(|&i| names[i as usize].as_str()).collect();
        println!("  gid {g:>8} {n:>4} items  {:<28} e.g. {}", addrs[*g as usize], sample.join("; "));
    }
    println!("spot checks:");
    for (label, at, expect) in spot_checks(ctx.city.id) {
        let g = match at {
            Spot::Ll(ll) => rs.at_point(ll),
            Spot::Addr(a) => rs.addr.get(&norm_addr(a)).and_then(|v| v.first().copied()),
        };
        let found: Vec<&str> = g.map(|g| links[g as usize].iter().map(|&i| names[i as usize].as_str()).collect()).unwrap_or_default();
        let hit = found.iter().any(|n| expect.iter().any(|e| n.to_lowercase().contains(&e.to_lowercase())));
        println!(
            "  [{}] {label}: gid {:?} {} -> {}",
            if hit { "ok" } else { "--" },
            g,
            g.map_or("", |g| addrs[g as usize].as_str()),
            if found.is_empty() { "(nothing)".to_string() } else { found.iter().take(5).cloned().collect::<Vec<_>>().join("; ") }
        );
    }
    Ok(())
}

enum Spot {
    Ll([f64; 2]),
    Addr(&'static str),
}

fn spot_checks(city: &str) -> Vec<(&'static str, Spot, &'static [&'static str])> {
    use Spot::*;
    match city {
        "sf" => vec![
            ("UCSF Mission Bay (Genentech Hall, 600 16th St)", Addr("600 16th St"), &["UCSF", "University of California, San Francisco", "UC San Francisco"][..]),
            ("Salesforce Tower (415 Mission St)", Addr("415 Mission St"), &["Salesforce"][..]),
            ("Twitter/X (1355 Market St)", Ll([-122.4172, 37.7768]), &["Twitter", "X Corp"][..]),
            ("Airbnb (888 Brannan St)", Ll([-122.4050, 37.7719]), &["Airbnb"][..]),
        ],
        "bay" => vec![
            ("Stanford (Main Quad)", Ll([-122.1700, 37.4275]), &["Stanford"][..]),
            ("UC Berkeley (Sather Tower)", Ll([-122.2578, 37.8721]), &["Berkeley"][..]),
            ("HP Garage, 367 Addison Ave", Ll([-122.1544, 37.4434]), &["Hewlett", "HP"][..]),
            ("Apple Park", Ll([-122.0090, 37.3349]), &["Apple"][..]),
            ("Googleplex", Ll([-122.0841, 37.4220]), &["Google", "Alphabet"][..]),
        ],
        "nyc" => vec![
            ("Columbia (Low Library)", Ll([-73.9619, 40.8080]), &["Columbia"][..]),
            ("NYU (Bobst Library)", Ll([-73.9973, 40.7295]), &["New York University", "NYU"][..]),
            ("Cornell Tech", Ll([-73.9580, 40.7553]), &["Cornell"][..]),
        ],
        "boston" => vec![
            ("MIT (Building 10)", Ll([-71.0921, 42.3596]), &["Massachusetts Institute of Technology", "MIT"][..]),
            ("Harvard (University Hall)", Ll([-71.1167, 42.3745]), &["Harvard"][..]),
            ("Moderna (325 Binney St)", Ll([-71.0845, 42.3662]), &["Moderna"][..]),
            ("Akamai (145 Broadway)", Ll([-71.0864, 42.3626]), &["Akamai"][..]),
        ],
        _ => vec![],
    }
}
