//! Wikidata SPARQL with on-disk caching and box splitting on timeouts.

use anyhow::{bail, Result};
use serde_json::Value;
use std::collections::HashMap;
use std::path::Path;
use std::time::Duration;

const ENDPOINT: &str = "https://query.wikidata.org/sparql";
const UA: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:147.0) Gecko/20100101 Firefox/147.0 sf-buildings-pipeline/0.1";

pub type Row = HashMap<String, String>;

/// Run a query (cached by file name), returning value strings per row.
pub fn query(sparql: &str, cache: &Path) -> Result<Vec<Row>> {
    // A cached body that doesn't parse is a response cut off mid-stream by an
    // earlier run; drop it and ask again.
    let cached = std::fs::read_to_string(cache).ok().filter(|b| serde_json::from_str::<Value>(b).is_ok());
    let body = if let Some(b) = cached {
        b
    } else {
        let a = ureq::AgentBuilder::new().timeout_read(Duration::from_secs(90)).build();
        let mut last = String::new();
        let mut body = None;
        for attempt in 0..3 {
            if attempt > 0 {
                std::thread::sleep(Duration::from_secs(10 << attempt));
            }
            match a
                .post(ENDPOINT)
                .set("User-Agent", UA)
                .set("Accept", "application/sparql-results+json")
                .send_form(&[("query", sparql)])
            {
                Ok(r) => {
                    let mut s = String::new();
                    std::io::Read::read_to_string(&mut r.into_reader(), &mut s)?;
                    if s.trim_start().starts_with('{') {
                        // Wikidata answers 200 and then stops writing when the
                        // query hits its time limit, so a body that doesn't
                        // parse is a timeout too: the caller splits the box.
                        if serde_json::from_str::<Value>(&s).is_err() {
                            bail!("timeout (truncated response)");
                        }
                        body = Some(s);
                        break;
                    }
                    last = s.chars().take(200).collect();
                }
                // 500 = query timeout: retrying the same box won't help.
                Err(ureq::Error::Status(500, _)) => bail!("timeout"),
                Err(e) => last = e.to_string(),
            }
        }
        let Some(b) = body else { bail!("wikidata: {last}") };
        std::fs::create_dir_all(cache.parent().unwrap())?;
        std::fs::write(cache, &b)?;
        b
    };
    let v: Value = serde_json::from_str(&body)?;
    Ok(v["results"]["bindings"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|b| b.as_object().unwrap().iter().map(|(k, x)| (k.clone(), x["value"].as_str().unwrap_or("").to_string())).collect())
        .collect())
}

/// Run `template` (with {SW} / {NE} WKT points) over `bbox`, splitting the
/// box into quarters (down to `depth` levels) when the server times out.
pub fn query_box(template: &str, bbox: [f64; 4], cache_dir: &Path, name: &str, depth: u32) -> Result<Vec<Row>> {
    let [w, s, e, n] = bbox;
    let q = template.replace("{SW}", &format!("Point({w} {s})")).replace("{NE}", &format!("Point({e} {n})"));
    let file = cache_dir.join(format!("{name}_{w:.3}_{s:.3}_{e:.3}_{n:.3}.json"));
    match query(&q, &file) {
        Ok(r) => Ok(r),
        Err(err) if depth > 0 && err.to_string().contains("timeout") => {
            let (mx, my) = ((w + e) / 2.0, (s + n) / 2.0);
            let mut out = Vec::new();
            for b in [[w, s, mx, my], [mx, s, e, my], [w, my, mx, n], [mx, my, e, n]] {
                out.extend(query_box(template, b, cache_dir, name, depth - 1)?);
            }
            Ok(out)
        }
        Err(err) => Err(err),
    }
}

/// Q-id from an entity URI.
pub fn qid(uri: &str) -> String {
    uri.rsplit('/').next().unwrap_or("").to_string()
}

/// Year from an xsd:dateTime ("1976-01-01T00:00:00Z", "-0100-…").
pub fn year(s: &str) -> Option<i16> {
    let t = s.trim_start_matches('+');
    let (neg, t) = t.strip_prefix('-').map_or((false, t), |r| (true, r));
    let y: i16 = t.split('-').next()?.parse().ok()?;
    Some(if neg { -y } else { y })
}

/// "Point(lon lat)" -> ([lon, lat], decimals of the more precise ordinate;
/// trailing zeros are dropped in WKT, so one short ordinate is no signal).
pub fn point(wkt: &str) -> Option<([f64; 2], usize)> {
    let inner = wkt.split_once('(')?.1.trim_end_matches(')');
    let mut it = inner.split_whitespace();
    let (a, b) = (it.next()?, it.next()?);
    let dec = |s: &str| s.split_once('.').map_or(0, |(_, d)| d.len());
    Some(([a.parse().ok()?, b.parse().ok()?], dec(a).max(dec(b))))
}
