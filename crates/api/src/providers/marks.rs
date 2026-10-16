//! User marks in SQLite: the one writable provider so far.
//!
//! A mark sits in a category of an existing layer (e.g. `startups` › `ai`), or in a category of
//! its own, which goes into this provider's layer `mine`.

use super::{Category, Item, ItemInput, ItemStore, LayerDef, LayerProvider, LayerSet, ProviderInfo};
use crate::city::City;
use anyhow::{bail, Result};
use parking_lot::Mutex;
use rusqlite::{params, Connection, OptionalExtension, Row};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

pub const LAYER: &str = "mine";
const COLORS: [&str; 8] = ["#e4572e", "#17bebb", "#ffc914", "#76b041", "#8e44ad", "#2e86de", "#ff6f91", "#6c5b7b"];

pub struct Marks {
    db: Mutex<Connection>,
    /// Bumped on every write; part of the cache key.
    rev: AtomicU64,
}

impl Marks {
    pub fn open(path: &Path) -> Result<Marks> {
        let db = Connection::open(path)?;
        db.execute_batch(
            "PRAGMA journal_mode = WAL;
             CREATE TABLE IF NOT EXISTS marks (
               id INTEGER PRIMARY KEY AUTOINCREMENT,
               city TEXT NOT NULL,
               layer TEXT NOT NULL,          -- an existing layer id, or 'mine'
               category TEXT NOT NULL,       -- category id within that layer
               category_name TEXT,
               category_color TEXT,
               name TEXT NOT NULL,
               role TEXT, from_year INTEGER, to_year INTEGER, url TEXT, note TEXT,
               tags TEXT NOT NULL DEFAULT '[]',
               gid INTEGER NOT NULL,
               lon REAL, lat REAL,
               created TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
               updated TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
             );
             CREATE INDEX IF NOT EXISTS marks_city ON marks(city);",
        )?;
        // columns added after the first release of the table
        let cols: Vec<String> = db.prepare("PRAGMA table_info(marks)")?.query_map([], |r| r.get(1))?.collect::<rusqlite::Result<_>>()?;
        if !cols.iter().any(|c| c == "author") {
            db.execute_batch("ALTER TABLE marks ADD COLUMN author TEXT;")?;
        }
        let n: i64 = db.query_row("SELECT COUNT(*) FROM marks", [], |r| r.get(0))?;
        Ok(Marks { db: Mutex::new(db), rev: AtomicU64::new((n as u64).wrapping_mul(0x9e37_79b9) + 1) })
    }

    fn row(r: &Row) -> rusqlite::Result<Item> {
        let tags: String = r.get("tags")?;
        let (lon, lat): (Option<f64>, Option<f64>) = (r.get("lon")?, r.get("lat")?);
        Ok(Item {
            id: format!("mark:{}", r.get::<_, i64>("id")?),
            layer: r.get("layer")?,
            category: r.get("category")?,
            name: r.get("name")?,
            role: r.get("role")?,
            from: r.get("from_year")?,
            to: r.get("to_year")?,
            url: r.get("url")?,
            note: r.get("note")?,
            wikidata: None,
            source: "user".into(),
            tags: serde_json::from_str(&tags).unwrap_or_default(),
            gids: vec![r.get::<_, i64>("gid")? as u32],
            lonlat: lon.zip(lat).map(|(a, b)| [a, b]),
            author: r.get("author")?,
        })
    }

    /// Category of a new mark: an existing (layer, category), or a named one in `mine`.
    fn placement(input: &ItemInput) -> Result<(String, String, Option<String>, Option<String>)> {
        if let (Some(l), Some(c)) = (&input.layer, &input.category) {
            if l != LAYER {
                return Ok((l.clone(), c.clone(), None, None));
            }
        }
        let name = input.category_name.clone().or(input.category.clone()).unwrap_or_default();
        if name.trim().is_empty() {
            bail!("a mark needs a category: layer+category, or categoryName");
        }
        let id: String = name.to_lowercase().chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '-' }).collect();
        Ok((LAYER.into(), id.trim_matches('-').to_string(), Some(name.trim().to_string()), input.category_color.clone()))
    }
}

impl LayerProvider for Marks {
    fn info(&self) -> ProviderInfo {
        ProviderInfo { id: "marks", name: "Marks", description: "Buildings marked in the map, stored on this server.", writable: true }
    }

    fn version(&self, _city: &City) -> u64 {
        self.rev.load(Ordering::Relaxed)
    }

    fn load(&self, city: &City) -> Result<LayerSet> {
        let items = self.list(&city.id)?;
        // categories of the `mine` layer, from the marks that use it
        let db = self.db.lock();
        let mut st = db.prepare(
            "SELECT category, MAX(category_name), MAX(category_color) FROM marks
             WHERE city = ?1 AND layer = ?2 GROUP BY category ORDER BY MIN(id)",
        )?;
        let cats: Vec<Category> = st
            .query_map(params![city.id, LAYER], |r| {
                Ok((r.get::<_, String>(0)?, r.get::<_, Option<String>>(1)?, r.get::<_, Option<String>>(2)?))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?
            .into_iter()
            .enumerate()
            .map(|(i, (id, name, color))| Category {
                name: name.unwrap_or_else(|| id.clone()),
                id,
                color: color.unwrap_or_else(|| COLORS[i % COLORS.len()].into()),
                parent: None,
                bit: None,
                off: false,
            })
            .collect();
        let layers = if cats.is_empty() {
            vec![]
        } else {
            vec![LayerDef {
                id: LAYER.into(),
                name: "My marks".into(),
                description: "Categories created in the map.".into(),
                licence: "yours".into(),
                publishable: true,
                categories: cats,
            }]
        };
        Ok(LayerSet { layers, items })
    }
}

impl ItemStore for Marks {
    fn list(&self, city: &str) -> Result<Vec<Item>> {
        let db = self.db.lock();
        let mut st = db.prepare("SELECT * FROM marks WHERE city = ?1 ORDER BY id")?;
        let v = st.query_map([city], Marks::row)?.collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(v)
    }

    fn create(&self, city: &str, input: ItemInput, gid: u32) -> Result<Item> {
        let (layer, cat, cname, ccolor) = Marks::placement(&input)?;
        let db = self.db.lock();
        db.execute(
            "INSERT INTO marks (city, layer, category, category_name, category_color, name, role, from_year, to_year,
               url, note, tags, gid, lon, lat, author) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)",
            params![
                city, layer, cat, cname, ccolor, input.name, input.role, input.from, input.to, input.url, input.note,
                serde_json::to_string(&input.tags)?, gid, input.lonlat.map(|p| p[0]), input.lonlat.map(|p| p[1]), input.author
            ],
        )?;
        let id = db.last_insert_rowid();
        self.rev.fetch_add(1, Ordering::Relaxed);
        Ok(db.query_row("SELECT * FROM marks WHERE id = ?1", [id], Marks::row)?)
    }

    fn update(&self, city: &str, id: i64, input: ItemInput, gid: u32) -> Result<Option<Item>> {
        let (layer, cat, cname, ccolor) = Marks::placement(&input)?;
        let db = self.db.lock();
        let n = db.execute(
            "UPDATE marks SET layer=?3, category=?4, category_name=?5, category_color=?6, name=?7, role=?8,
               from_year=?9, to_year=?10, url=?11, note=?12, tags=?13, gid=?14, lon=COALESCE(?15, lon), lat=COALESCE(?16, lat),
               updated=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=?1 AND city=?2",
            params![
                id, city, layer, cat, cname, ccolor, input.name, input.role, input.from, input.to, input.url, input.note,
                serde_json::to_string(&input.tags)?, gid, input.lonlat.map(|p| p[0]), input.lonlat.map(|p| p[1])
            ],
        )?;
        if n == 0 {
            return Ok(None);
        }
        self.rev.fetch_add(1, Ordering::Relaxed);
        Ok(db.query_row("SELECT * FROM marks WHERE id = ?1", [id], Marks::row).optional()?)
    }

    fn delete(&self, city: &str, id: i64) -> Result<bool> {
        let n = self.db.lock().execute("DELETE FROM marks WHERE id = ?1 AND city = ?2", params![id, city])?;
        if n > 0 {
            self.rev.fetch_add(1, Ordering::Relaxed);
        }
        Ok(n > 0)
    }
}
