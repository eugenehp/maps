//! Real-estate listings collected locally by ../zillow (Baylease: Zillow, Redfin and Compass
//! listings in a SQLite database). Scraped data for personal research: local use only.
//!
//! Per building (listings whose point is inside the footprint):
//! - a build year: the median of the listings' year built (Zillow, Redfin; Compass has none);
//! - `extra.listings`: how many listings, the median asking rent and the latest asking price, the
//!   median floor area, and when one was last seen.
//!
//! The database is read with `sqlite3 -readonly` (never written) into cache/bay/listings.json,
//! which is reused when the database is not there. $ZILLOW_DB overrides the path.

use crate::city::Ctx;
use crate::geom::in_part;
use crate::model::{Building, S_LISTINGS};
use crate::sources::attach::bbox_of;
use anyhow::{bail, Context, Result};
use rstar::{primitives::GeomWithData, RTree, AABB};
use serde::Deserialize;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::process::Command;

#[derive(Deserialize)]
struct Row {
    src: String,
    lat: f64,
    lng: f64,
    yb: Option<i64>,
    price: Option<i64>,
    status: Option<String>,
    sqft: Option<i64>,
    seen: Option<String>,
}

pub struct Listings {
    rows: Vec<Row>,
    tree: RTree<GeomWithData<[f64; 2], u32>>,
}

/// $ZILLOW_DB, else ../zillow/data/zillow.db next to this repo's directory.
fn db_path(ctx: &Ctx) -> PathBuf {
    std::env::var_os("ZILLOW_DB").map(PathBuf::from).unwrap_or_else(|| {
        let root = ctx.root_cache().parent().unwrap().to_path_buf();
        let root = root.canonicalize().unwrap_or(root);
        root.parent().unwrap().parent().unwrap().join("zillow").join("data").join("zillow.db")
    })
}

fn extract(ctx: &Ctx, out: &std::path::Path) -> Result<()> {
    let db = db_path(ctx);
    if !db.exists() {
        bail!("no listings database at {} (set ZILLOW_DB)", db.display());
    }
    let [w, s, e, n] = ctx.city.bbox;
    let sql = format!(
        "SELECT source AS src, lat, lng, CASE WHEN year_built > 0 THEN year_built END AS yb, rent AS price, status,
                CASE WHEN sqft > 0 THEN sqft END AS sqft, substr(last_seen_at, 1, 10) AS seen
         FROM listings WHERE lat BETWEEN {s} AND {n} AND lng BETWEEN {w} AND {e}"
    );
    println!("listings: reading {} (read-only)...", db.display());
    let o = Command::new("sqlite3").arg("-readonly").arg("-json").arg(&db).arg(&sql).output().context("sqlite3 CLI")?;
    if !o.status.success() {
        bail!("sqlite3: {}", String::from_utf8_lossy(&o.stderr));
    }
    // sqlite3 prints nothing at all for no rows
    let body = if o.stdout.iter().all(u8::is_ascii_whitespace) { b"[]".to_vec() } else { o.stdout };
    std::fs::write(out, body)?;
    Ok(())
}

impl Listings {
    /// None when there is neither the database nor an earlier extract.
    pub fn load(ctx: &Ctx) -> Result<Option<Self>> {
        let path = ctx.cache.join("listings.json");
        if let Err(e) = extract(ctx, &path) {
            if !path.exists() {
                println!("listings: none ({e:#})");
                return Ok(None);
            }
            println!("listings: {e:#}; using the earlier extract");
        }
        let rows: Vec<Row> = serde_json::from_slice(&std::fs::read(&path)?)?;
        let tree = RTree::bulk_load(rows.iter().enumerate().map(|(i, r)| GeomWithData::new([r.lng, r.lat], i as u32)).collect());
        println!("listings: {} ({} with a year built)", rows.len(), rows.iter().filter(|r| r.yb.is_some()).count());
        Ok(Some(Listings { rows, tree }))
    }

    /// Year and listing facts for one building. True if any listing is inside it.
    pub fn apply(&self, b: &mut Building, years: bool) -> bool {
        let (lo, hi) = bbox_of(&b.parts);
        let mine: Vec<&Row> = self
            .tree
            .locate_in_envelope(AABB::from_corners(lo, hi))
            .filter(|g| b.parts.iter().any(|p| in_part(*g.geom(), p)))
            .map(|g| &self.rows[g.data as usize])
            .collect();
        if mine.is_empty() {
            return false;
        }
        let median = |mut v: Vec<i64>| -> Option<i64> {
            v.sort_unstable();
            (!v.is_empty()).then(|| v[v.len() / 2])
        };
        if years {
            if let Some(y) = median(mine.iter().filter_map(|r| r.yb).filter(|y| (1700..2100).contains(y)).collect()) {
                b.year(S_LISTINGS, [y as i16], false, false);
            }
        }
        let status = |r: &Row, s: &str| r.status.as_deref() == Some(s);
        let rent = median(mine.iter().filter(|r| status(r, "for_rent")).filter_map(|r| r.price).filter(|p| *p > 200 && *p < 100_000).collect());
        let price = mine
            .iter()
            .filter(|r| status(r, "for_sale") && r.price.is_some_and(|p| p >= 10_000))
            .max_by(|a, c| a.seen.cmp(&c.seen))
            .and_then(|r| r.price);
        let mut from: Vec<&str> = mine.iter().map(|r| r.src.as_str()).collect();
        from.sort_unstable();
        from.dedup();
        let facts = json!({
            "n": mine.len(),
            "rent": rent,
            "price": price,
            "sqft": median(mine.iter().filter_map(|r| r.sqft).collect()),
            "seen": mine.iter().filter_map(|r| r.seen.as_deref()).max(),
            "from": from,
        });
        let mut extra: Value = serde_json::from_str(&b.extra).unwrap_or_else(|_| json!({}));
        if let Some(o) = extra.as_object_mut() {
            o.insert("listings".into(), facts);
            b.extra = extra.to_string();
        }
        true
    }
}
