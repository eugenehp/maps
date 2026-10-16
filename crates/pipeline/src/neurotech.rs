//! The `neurotech` occupancy layer: neuroscience, neurotech and BCI companies from the
//! neurotech index (`../neurotech`, a SQLite database kept by another project; opened read-only).
//!
//! Where a company is, in order: its HQ or an office street address, when it is in the city
//! and matches the city's address index; else its office among the Overture places, by website
//! host (bare site URLs; generic hosts and hosts with more than 3 places never match); else
//! the exact name (office-like categories, at most 3 places, and only when the index puts the
//! HQ or an office in the city). Companies found nowhere are left out.
//!
//! Only facts are taken (name, website, founding year, status, segment); no summaries.

use crate::city::Ctx;
use crate::classify;
use crate::layers::{cat, norm_addr, norm_name, round6, similar, writable, Category, Item, Layer, Place};
use anyhow::{Context, Result};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Deserialize)]
struct Company {
    name: String,
    website: Option<String>,
    hq_street: Option<String>,
    hq_city: Option<String>,
    founded: Option<i64>,
    status: Option<String>,
    /// segments, first (primary) first, '|'-separated
    segments: Option<String>,
    /// other domains (country / brand sites), '|'-separated
    domains: Option<String>,
    /// JSON array of {street, city}
    offices: Option<String>,
}

#[derive(Deserialize)]
struct Office {
    street: Option<String>,
    city: Option<String>,
}

/// The neurotech index: $NEUROTECH_DB, else ../neurotech/neurotech.db next to this repo.
fn db_path(ctx: &Ctx) -> PathBuf {
    std::env::var_os("NEUROTECH_DB").map(PathBuf::from).unwrap_or_else(|| {
        let root = ctx.root_cache().parent().unwrap().to_path_buf();
        let root = root.canonicalize().unwrap_or(root);
        root.parent().unwrap().parent().unwrap().join("neurotech").join("neurotech.db")
    })
}

/// US (or country-less) companies with their offices, extracted read-only into cache/neurotech.json.
/// The database changes often, so it is read again on every run; the extract is the fallback.
fn extract(ctx: &Ctx) -> Result<Option<Vec<Company>>> {
    let out = ctx.root_cache().join("neurotech.json");
    let db = db_path(ctx);
    let sql = "SELECT c.id, c.name, c.website, c.hq_street, c.hq_city, c.founded, c.status,
          (SELECT group_concat(segment, '|') FROM (SELECT segment FROM company_segments s WHERE s.company_id = c.id ORDER BY position)) AS segments,
          (SELECT group_concat(domain, '|') FROM company_sites d WHERE d.company_id = c.id) AS domains,
          (SELECT json_group_array(json_object('street', o.street, 'city', o.city)) FROM offices o
             WHERE o.company_id = c.id AND (o.country_code = 'US' OR o.country IN ('United States', 'USA', 'US'))) AS offices
        FROM companies c
        WHERE coalesce(c.hq_country, '') IN ('United States', 'USA', 'US', '')
           OR EXISTS (SELECT 1 FROM offices o WHERE o.company_id = c.id AND (o.country_code = 'US' OR o.country IN ('United States', 'USA', 'US')))";
    if db.exists() {
        let r = Command::new("sqlite3").arg("-readonly").arg("-json").arg(&db).arg(sql).output();
        match r {
            Ok(o) if o.status.success() => std::fs::write(&out, &o.stdout)?,
            Ok(o) => println!("neurotech: sqlite3 failed ({}), using the last extract", String::from_utf8_lossy(&o.stderr).trim()),
            Err(e) => println!("neurotech: sqlite3 not found ({e}), using the last extract"),
        }
    }
    if !out.exists() {
        println!("neurotech: no index at {} and no extract: layer skipped", db.display());
        return Ok(None);
    }
    let b = std::fs::read(&out)?;
    if b.iter().all(|c| c.is_ascii_whitespace()) {
        return Ok(Some(Vec::new()));
    }
    Ok(Some(serde_json::from_slice(&b).context("parse neurotech extract")?))
}

/// Place names (lower case) counted as "in the city" for addresses and name matches.
fn city_names(city: &str) -> &'static [&'static str] {
    match city {
        "sf" => &["san francisco"],
        "bay" => &[
            "san francisco", "south san francisco", "oakland", "berkeley", "emeryville", "alameda", "albany", "richmond",
            "el cerrito", "san leandro", "hayward", "union city", "fremont", "newark", "pleasanton", "dublin", "livermore",
            "san ramon", "danville", "walnut creek", "concord", "pleasant hill", "lafayette", "orinda", "moraga", "martinez",
            "pittsburg", "antioch", "brentwood", "hercules", "pinole", "san pablo", "daly city", "brisbane", "pacifica",
            "san bruno", "millbrae", "burlingame", "san mateo", "foster city", "belmont", "san carlos", "redwood city",
            "redwood shores", "menlo park", "atherton", "east palo alto", "palo alto", "stanford", "los altos", "los altos hills",
            "mountain view", "sunnyvale", "santa clara", "cupertino", "san jose", "campbell", "los gatos", "saratoga", "milpitas",
            "morgan hill", "gilroy", "half moon bay", "portola valley", "woodside", "sausalito", "mill valley", "san rafael",
            "novato", "larkspur", "corte madera", "tiburon", "san anselmo", "petaluma", "santa rosa", "sonoma", "napa",
            "vallejo", "benicia", "fairfield", "vacaville", "santa cruz", "scotts valley", "watsonville", "boulder creek",
        ],
        "nyc" => &[
            "new york", "new york city", "nyc", "manhattan", "brooklyn", "bronx", "the bronx", "queens", "staten island",
            "long island city", "astoria", "flushing", "jamaica",
        ],
        "boston" => &[
            "boston", "cambridge", "somerville", "brookline", "charlestown", "allston", "brighton", "roxbury", "dorchester",
            "jamaica plain", "south boston", "east boston", "back bay", "chestnut hill",
        ],
        _ => &[],
    }
}

/// Neurotech segments, grouped. The first (primary) segment decides.
fn categories() -> Vec<Category> {
    vec![
        cat("bci", "Brain–computer interfaces", "#6a3d9a", None),
        cat("neuromodulation", "Neuromodulation", "#e31a1c", None),
        cat("imaging", "Neuroimaging", "#1f78b4", None),
        cat("monitoring", "Diagnostics & monitoring", "#33a02c", None),
        cat("pharma", "Drugs, genetics & psychedelics", "#ff7f00", None),
        cat("digital", "Digital therapeutics & neuro-AI", "#a6761d", None),
        cat("consumer", "Consumer & sleep", "#e84393", None),
        cat("devices", "Surgery, prosthetics & rehab", "#00838f", None),
        cat("tools", "Research tools & services", "#7f8c8d", None),
        Category { off: true, ..cat("advocacy", "Patient advocacy", "#9aa5b1", None) },
        cat("other", "Other", "#b8b0a2", None),
    ]
}

fn category(segment: &str) -> &'static str {
    match segment {
        "bci-invasive" | "bci-noninvasive" => "bci",
        "neuromodulation" => "neuromodulation",
        "neuroimaging" => "imaging",
        "diagnostics" | "neuromonitoring" => "monitoring",
        "neuro-pharma" | "psychedelics" | "neurogenetics" | "neuro-oncology" => "pharma",
        "digital-therapeutics" | "neuro-ai" => "digital",
        "consumer-neurotech" | "sleep-tech" | "neuromarketing" => "consumer",
        "neurosurgery" | "neuroprosthetics" | "sensory-restoration" | "neurorehab" => "devices",
        "research-tools" | "organoids" | "contract-manufacturing" | "clinical-trials" | "licenses" => "tools",
        "patient-advocacy" => "advocacy",
        _ => "other",
    }
}

/// "2443 Fillmore St. #380-6060": a box number at a mail store, not an office.
fn mailbox(s: &str) -> bool {
    classify::is_pmb(s)
        || s.split('#').skip(1).any(|t| {
            let t = t.trim();
            let (a, b) = t.split_once('-').unwrap_or((t, ""));
            !a.is_empty() && a.chars().all(|c| c.is_ascii_digit()) && b.chars().take_while(|c| c.is_ascii_digit()).count() >= 3
        })
}

/// Addresses of the city's buildings (normalised), from the attrs the tiles step wrote.
pub(crate) fn addresses(ctx: &Ctx) -> Result<HashSet<String>> {
    let m: Value = serde_json::from_slice(&std::fs::read(ctx.out.join("index.json")).context("run tiles first")?)?;
    let mut out = HashSet::new();
    for r in m["regions"].as_array().context("regions")? {
        let rows: Vec<Value> = serde_json::from_slice(&std::fs::read(ctx.out.join(r["attrs"].as_str().context("attrs")?))?)?;
        for row in rows {
            if let Some(a) = row[0].as_str().filter(|a| !a.is_empty()) {
                out.insert(norm_addr(a));
            }
        }
    }
    Ok(out)
}

pub fn generate(ctx: &Ctx, dir: &Path, all: &[Place]) -> Result<()> {
    let path = dir.join("neurotech.json");
    if !writable(&path) {
        println!("  neurotech.json is user-maintained: not regenerated");
        return Ok(());
    }
    let Some(companies) = extract(ctx)? else { return Ok(()) };
    let names: HashSet<&str> = city_names(ctx.city.id).iter().copied().collect();
    let here = |c: &Option<String>| c.as_deref().is_some_and(|c| names.contains(c.trim().to_lowercase().as_str()));
    let addrs = addresses(ctx)?;

    let key = |n: &str| norm_name(n).join(" ");
    let (mut by_host, mut by_name): (HashMap<String, Vec<usize>>, HashMap<String, Vec<usize>>) = Default::default();
    for (i, p) in all.iter().enumerate() {
        if p.mail {
            continue;
        }
        if let Some((h, _)) = p.web.as_deref().and_then(classify::host) {
            by_host.entry(h).or_default().push(i);
        }
        by_name.entry(key(&p.name)).or_default().push(i);
    }
    let few = |v: &&Vec<usize>| v.len() <= 3;
    let drops = classify::mail_drops(all.iter().map(|p| p.addr.as_str()));

    let mut items = Vec::new();
    let mut how: BTreeMap<&str, usize> = BTreeMap::new();
    let (mut in_city, mut unlocated) = (0, 0);
    for c in &companies {
        let offices: Vec<Office> = c.offices.as_deref().and_then(|o| serde_json::from_str(o).ok()).unwrap_or_default();
        let hq_here = here(&c.hq_city);
        let office_here = offices.iter().any(|o| here(&o.city));
        let segment = c.segments.as_deref().and_then(|s| s.split('|').next()).unwrap_or("");
        let status = c.status.as_deref().unwrap_or("unknown");
        let tags: Vec<String> = match status {
            "public" | "acquired" | "defunct" | "academic" | "nonprofit" | "subsidiary" => vec![status.to_string()],
            _ => vec![],
        };
        let item = |role: &str, loc: Value, source: &str| Item {
            name: c.name.clone(),
            category: category(segment).into(),
            tags: tags.clone(),
            role: role.into(),
            from: c.founded.and_then(|y| i16::try_from(y).ok()).filter(|y| (1800..=2100).contains(y)),
            to: None,
            loc,
            url: c.website.clone(),
            source: source.into(),
            ..Default::default()
        };

        // 1. street addresses in the city
        let mut found = Vec::new();
        let mut seen = HashSet::new();
        let streets = std::iter::once((c.hq_street.as_deref(), hq_here, "hq"))
            .chain(offices.iter().map(|o| (o.street.as_deref(), here(&o.city), "office")));
        for (street, ok, role) in streets {
            let Some(s) = street.filter(|s| ok && !s.trim().is_empty()) else { continue };
            let s = classify::street(s);
            if mailbox(street.unwrap()) || drops.contains(&s) {
                continue;
            }
            if addrs.contains(&norm_addr(&s)) && seen.insert(norm_addr(&s)) {
                found.push(item(role, json!({ "address": s }), "neurotech-index"));
                *how.entry("address").or_default() += 1;
            }
        }
        // 2. the office among the Overture places, by website
        if found.is_empty() {
            let score = |i: usize| {
                let p = &all[i];
                p.conf + 0.3 * similar(&p.name, &c.name) as u8 as f64 + 0.1 * classify::office_like(&p.cat) as u8 as f64
            };
            let best = |v: &[usize]| v.iter().copied().max_by(|&a, &b| score(a).total_cmp(&score(b)));
            let site = c.website.as_deref().and_then(classify::host).filter(|(h, bare)| *bare && !classify::generic_host(h)).map(|h| h.0);
            let hosts = site.into_iter().chain(c.domains.iter().flat_map(|d| d.split('|')).filter_map(classify::host).map(|h| h.0));
            let mut hit = None;
            for h in hosts {
                if classify::generic_host(&h) {
                    continue;
                }
                if let Some(i) = by_host.get(&h).filter(few).and_then(|v| best(v)) {
                    hit = Some((i, "website"));
                    break;
                }
            }
            // 3. the exact name, when the index says the company is here
            if hit.is_none() && (hq_here || office_here) {
                let k = key(&c.name);
                if k.chars().filter(|c| c.is_alphanumeric()).count() >= 4 {
                    if let Some(v) = by_name.get(&k).filter(few) {
                        let v: Vec<usize> = v.iter().copied().filter(|&i| classify::office_like(&all[i].cat)).collect();
                        hit = best(&v).map(|i| (i, "name"));
                    }
                }
            }
            if let Some((i, by)) = hit {
                let p = all[i].ll;
                found.push(item(if hq_here { "hq" } else { "office" }, json!({ "lonlat": [round6(p[0]), round6(p[1])] }), "neurotech-index+overture-places"));
                *how.entry(by).or_default() += 1;
            }
        }
        if hq_here || office_here || !found.is_empty() {
            in_city += 1;
        }
        if found.is_empty() {
            unlocated += (hq_here || office_here) as usize;
            continue;
        }
        items.extend(found);
    }
    println!(
        "neurotech: {} US companies in the index, {in_city} here, {} items ({how:?}), {unlocated} here but not located",
        companies.len(),
        items.len()
    );
    let l = Layer {
        id: "neurotech".into(),
        name: "Neurotech".into(),
        description: "Neuroscience, neurotech and brain–computer-interface companies (the neurotech index), by primary segment.".into(),
        licence: "The neurotech index (../neurotech; no licence stated: local use only), located with Overture places (CDLA-Permissive-2.0, Apache-2.0)".into(),
        publishable: false,
        generated: true,
        categories: categories(),
        items,
    };
    std::fs::write(&path, serde_json::to_string_pretty(&l)?)?;
    Ok(())
}
