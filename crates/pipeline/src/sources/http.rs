//! Blocking HTTP helpers and resumable Socrata paging.

use anyhow::{bail, Context, Result};
use std::path::Path;
use std::time::Duration;

pub fn agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(30))
        .timeout_read(Duration::from_secs(600))
        .build()
}

/// GET with retries and exponential backoff.
pub fn get(agent: &ureq::Agent, url: &str) -> Result<String> {
    let mut last: Option<anyhow::Error> = None;
    for attempt in 0..4 {
        if attempt > 0 {
            std::thread::sleep(Duration::from_secs(5 << attempt));
        }
        match agent.get(url).call() {
            Ok(r) => {
                // into_string() caps bodies at 10 MB; pages are bigger.
                let mut s = String::new();
                match std::io::Read::read_to_string(&mut r.into_reader(), &mut s) {
                    Ok(_) => return Ok(s),
                    Err(e) => last = Some(e.into()),
                }
            }
            Err(e) => {
                eprintln!("  GET failed ({e}), retrying");
                last = Some(e.into());
            }
        }
    }
    bail!("GET {url}: {}", last.unwrap())
}

/// Download `url` to `path` unless it already exists (atomic via .tmp).
pub fn get_cached(agent: &ureq::Agent, url: &str, path: &Path) -> Result<String> {
    if path.exists() {
        return Ok(std::fs::read_to_string(path)?);
    }
    let body = get(agent, url)?;
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, &body)?;
    std::fs::rename(&tmp, path)?;
    Ok(body)
}

/// Socrata SoQL paging: one cached JSON file per page of `page` rows.
pub fn fetch_paged(agent: &ureq::Agent, dir: &Path, url: &str, page: usize) -> Result<usize> {
    std::fs::create_dir_all(dir)?;
    let mut total = 0;
    for i in 0.. {
        let path = dir.join(format!("page_{i:03}.json"));
        let body = get_cached(agent, &format!("{url}&$limit={page}&$offset={}", i * page), &path)?;
        let n = serde_json::from_str::<Vec<serde::de::IgnoredAny>>(&body)
            .with_context(|| format!("parse {}", path.display()))?
            .len();
        println!("  {} : {n} rows", path.display());
        total += n;
        if n < page {
            break;
        }
    }
    Ok(total)
}
