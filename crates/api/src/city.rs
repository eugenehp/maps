//! Read access to one city's pipeline output (`web/data/<city>/`): the manifest, the per-region
//! attribute rows, and the SFT4 tiles — enough to describe any building by gid or by location.

use anyhow::{Context, Result};
use parking_lot::Mutex;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, OnceLock};

use crate::spatial::Index;

pub struct City {
    pub id: String,
    pub dir: PathBuf,
    /// index.json as written by the pipeline.
    pub manifest: Value,
    pub count: u32,
    origin: (f64, f64),
    /// WGS84 metres per degree at the origin, as the pipeline's geom.rs.
    mpd: (f64, f64),
    tiles: Vec<TileRef>,
    regions: Vec<RegionRef>,
    attrs: Mutex<HashMap<usize, Arc<Vec<Value>>>>,
    parsed: Mutex<HashMap<usize, Arc<Tile>>>,
    index: OnceLock<Arc<Index>>,
    index_lock: Mutex<()>,
}

struct TileRef {
    file: String,
    offset: u64,
    length: usize,
    gid0: u32,
    n: u32,
}

struct RegionRef {
    attrs: String,
    gid0: u32,
    n: u32,
}

pub use tilefmt::Tile;

impl City {
    pub fn open(id: &str, dir: &Path) -> Result<City> {
        let manifest: Value = serde_json::from_slice(&std::fs::read(dir.join("index.json")).context("index.json")?)?;
        let num = |v: &Value| v.as_f64().unwrap_or(0.0);
        let origin = (num(&manifest["origin"]["lon"]), num(&manifest["origin"]["lat"]));
        let p = origin.1.to_radians();
        let mpd = (
            111_412.84 * p.cos() - 93.5 * (3.0 * p).cos(),
            111_132.954 - 559.822 * (2.0 * p).cos() + 1.175 * (4.0 * p).cos(),
        );
        let tiles = manifest["tiles"]
            .as_array()
            .context("tiles")?
            .iter()
            .map(|t| {
                TileRef {
                    file: t["file"].as_str().unwrap_or_default().to_string(),
                    offset: t["offset"].as_u64().unwrap_or(0),
                    length: t["length"].as_u64().unwrap_or(0) as usize,
                    gid0: t["gid0"].as_u64().unwrap_or(0) as u32,
                    n: t["nB"].as_u64().unwrap_or(0) as u32,
                }
            })
            .collect();
        let regions = manifest["regions"]
            .as_array()
            .map(|a| {
                a.iter()
                    .map(|r| RegionRef {
                        attrs: r["attrs"].as_str().unwrap_or_default().to_string(),
                        gid0: r["gid0"].as_u64().unwrap_or(0) as u32,
                        n: r["nB"].as_u64().unwrap_or(0) as u32,
                    })
                    .collect()
            })
            .unwrap_or_default();
        Ok(City {
            id: id.to_string(),
            dir: dir.to_path_buf(),
            count: manifest["count"].as_u64().unwrap_or(0) as u32,
            manifest,
            origin,
            mpd,
            tiles,
            regions,
            attrs: Mutex::new(HashMap::new()),
            parsed: Mutex::new(HashMap::new()),
            index: OnceLock::new(),
            index_lock: Mutex::new(()),
        })
    }

    pub fn summary(&self) -> Value {
        let m = &self.manifest;
        json!({
            "id": self.id, "name": m["name"], "count": self.count, "origin": m["origin"],
            "bounds": m["bounds"], "periods": m["periods"], "uses": m["uses"], "sources": m["sources"],
            "attribution": m["attribution"], "licence": m["licence"], "publishable": m["publishable"],
            "format": m["format"],
        })
    }

    pub fn to_xz(&self, lon: f64, lat: f64) -> (f64, f64) {
        ((lon - self.origin.0) * self.mpd.0, -(lat - self.origin.1) * self.mpd.1)
    }
    pub fn to_lonlat(&self, x: f64, z: f64) -> (f64, f64) {
        (self.origin.0 + x / self.mpd.0, self.origin.1 - z / self.mpd.1)
    }

    fn tile_of(&self, gid: u32) -> Option<usize> {
        // tiles are in gid order with contiguous ranges
        let i = self.tiles.partition_point(|t| t.gid0 + t.n <= gid);
        (i < self.tiles.len() && self.tiles[i].gid0 <= gid).then_some(i)
    }

    fn tile(&self, i: usize) -> Result<Arc<Tile>> {
        if let Some(t) = self.parsed.lock().get(&i) {
            return Ok(t.clone());
        }
        let t = Arc::new(tilefmt::decode(&self.read_tile(i)?)?);
        let mut cache = self.parsed.lock();
        if cache.len() > 512 {
            cache.clear();
        }
        cache.insert(i, t.clone());
        Ok(t)
    }

    fn attr_row(&self, gid: u32) -> Result<Option<Value>> {
        let Some(ri) = self.regions.iter().position(|r| gid >= r.gid0 && gid < r.gid0 + r.n) else { return Ok(None) };
        let rows = {
            let cached = self.attrs.lock().get(&ri).cloned();
            match cached {
                Some(r) => r,
                None => {
                    let rows: Vec<Value> = serde_json::from_slice(&std::fs::read(self.dir.join(&self.regions[ri].attrs))?)?;
                    let rows = Arc::new(rows);
                    let mut c = self.attrs.lock();
                    if c.len() > 32 {
                        c.clear();
                    }
                    c.insert(ri, rows.clone());
                    rows
                }
            }
        };
        Ok(rows.get((gid - self.regions[ri].gid0) as usize).cloned())
    }

    /// Everything known about one building, decoded (names instead of indices).
    pub fn building(&self, gid: u32) -> Result<Option<Value>> {
        let Some(ti) = self.tile_of(gid) else { return Ok(None) };
        let t = self.tile(ti)?;
        let b = (gid - self.tiles[ti].gid0) as usize;
        let m = &self.manifest;
        let no = m["noSource"].as_u64().unwrap_or(255) as u8;
        let source = |i: u8| if i == no { Value::Null } else { m["sources"][i as usize]["id"].clone() };
        let fl = t.flag[b];
        let (p0, p1) = (t.part_start[b] as usize, t.part_start[b + 1] as usize);
        let height = (p0..p1).map(|p| t.height[p]).fold(0.0f32, f32::max);
        let base = (p0..p1).map(|p| t.base[p]).fold(f32::INFINITY, f32::min);
        let (cx, cz) = self.centroid(&t, b);
        let (lon, lat) = self.to_lonlat(cx, cz);
        let row = self.attr_row(gid)?.unwrap_or(Value::Null);
        let cols = m["attrsColumns"].as_array().cloned().unwrap_or_default();
        let col = |name: &str| cols.iter().position(|c| c.as_str().map(|s| s.trim_end_matches('?')) == Some(name)).map(|k| row[k].clone()).unwrap_or(Value::Null);
        let fsrc = col("footprintSource").as_u64().map(|i| source(i as u8)).unwrap_or(Value::Null);
        Ok(Some(json!({
            "gid": gid,
            "year": if t.year[b] > 0 { json!(t.year[b]) } else { Value::Null },
            "period": m["periods"].get(t.period[b] as usize).map(|p| p["name"].clone()).unwrap_or(Value::Null),
            "flags": {
                "approximateYear": fl & 1 != 0, "landmark": fl & 2 != 0, "parcelSharedYear": fl & 4 != 0,
                "estimatedHeight": fl & 8 != 0, "censusAreaMedianYear": fl & 16 != 0,
            },
            "floors": t.floors[b], "use": m["uses"].get(t.use_[b] as usize).cloned().unwrap_or(Value::Null),
            "height": round1(height), "base": if base.is_finite() { json!(round1(base)) } else { Value::Null },
            "parts": p1 - p0,
            "demolished": t.demolished.get(b).filter(|&&y| y != 0),
            "address": col("address"), "useDetail": col("use"), "units": col("units"), "extra": col("extra"),
            "sources": { "year": source(t.year_src[b]), "height": source(t.height_src[b]), "footprint": fsrc },
            "lonlat": [round7(lon), round7(lat)],
        })))
    }

    fn centroid(&self, t: &Tile, b: usize) -> (f64, f64) {
        let (mut sx, mut sz, mut n) = (0.0, 0.0, 0.0);
        let p = t.part_start[b] as usize;
        let r = t.ring_start[p] as usize;
        for v in t.vert_start[r] as usize..t.vert_start[r + 1] as usize {
            sx += t.xz[2 * v] as f64 / 10.0;
            sz += t.xz[2 * v + 1] as f64 / 10.0;
            n += 1.0;
        }
        let n = f64::max(n, 1.0);
        (t.origin[0] as f64 + sx / n, t.origin[1] as f64 + sz / n)
    }

    /// The spatial/attribute index, built from every tile on first use.
    pub fn index(&self) -> Result<Arc<Index>> {
        if let Some(i) = self.index.get() {
            return Ok(i.clone());
        }
        let _g = self.index_lock.lock();
        if let Some(i) = self.index.get() {
            return Ok(i.clone());
        }
        let t0 = std::time::Instant::now();
        let mut ix = Index::with_capacity(self.count as usize);
        for (ti, r) in self.tiles.iter().enumerate() {
            let t = tilefmt::decode(&self.read_tile(ti)?)?;
            for b in 0..r.n as usize {
                let (cx, cz) = self.centroid(&t, b);
                let (mut x0, mut z0, mut x1, mut z1) = (f32::MAX, f32::MAX, f32::MIN, f32::MIN);
                let (p0, p1) = (t.part_start[b] as usize, t.part_start[b + 1] as usize);
                for p in p0..p1 {
                    let r0 = t.ring_start[p] as usize;
                    for v in t.vert_start[r0] as usize..t.vert_start[r0 + 1] as usize {
                        let x = t.origin[0] + t.xz[2 * v] as f32 / 10.0;
                        let z = t.origin[1] + t.xz[2 * v + 1] as f32 / 10.0;
                        x0 = x0.min(x); x1 = x1.max(x); z0 = z0.min(z); z1 = z1.max(z);
                    }
                }
                ix.cx.push(cx as f32);
                ix.cz.push(cz as f32);
                ix.bbox.push([x0, z0, x1, z1]);
                ix.year.push(t.year[b]);
                ix.period.push(t.period[b]);
                ix.use_.push(t.use_[b]);
                ix.flags.push(t.flag[b]);
                ix.floors.push(t.floors[b]);
                ix.height.push((p0..p1).map(|p| t.height[p]).fold(0.0, f32::max));
                ix.year_src.push(t.year_src[b]);
                ix.demolished.push(t.demolished.get(b).copied().unwrap_or(0));
            }
        }
        ix.build_grid();
        eprintln!("index {}: {} buildings in {:.1} s", self.id, ix.len(), t0.elapsed().as_secs_f32());
        let ix = Arc::new(ix);
        let _ = self.index.set(ix.clone());
        Ok(ix)
    }

    fn read_tile(&self, i: usize) -> Result<Vec<u8>> {
        use std::io::{Read, Seek, SeekFrom};
        let r = &self.tiles[i];
        let mut f = std::fs::File::open(self.dir.join(&r.file))?;
        f.seek(SeekFrom::Start(r.offset))?;
        let mut buf = vec![0u8; r.length];
        f.read_exact(&mut buf)?;
        Ok(buf)
    }

    /// Footprint as GeoJSON MultiPolygon coordinates ([lon, lat]), one polygon per part.
    pub fn footprint(&self, gid: u32) -> Result<Option<Vec<Vec<Vec<[f64; 2]>>>>> {
        let Some(ti) = self.tile_of(gid) else { return Ok(None) };
        let t = self.tile(ti)?;
        let b = (gid - self.tiles[ti].gid0) as usize;
        let mut polys = Vec::new();
        for p in t.part_start[b] as usize..t.part_start[b + 1] as usize {
            let mut rings = Vec::new();
            for r in t.ring_start[p] as usize..t.ring_start[p + 1] as usize {
                let mut ring: Vec<[f64; 2]> = (t.vert_start[r] as usize..t.vert_start[r + 1] as usize)
                    .map(|v| {
                        let (lon, lat) = self.to_lonlat(t.origin[0] as f64 + t.xz[2 * v] as f64 / 10.0, t.origin[1] as f64 + t.xz[2 * v + 1] as f64 / 10.0);
                        [round7(lon), round7(lat)]
                    })
                    .collect();
                // GeoJSON wants closed rings, outer counter-clockwise in lon/lat: the tiles have
                // outer rings clockwise in lon/lat (FORMAT.md), so reverse every ring
                ring.reverse();
                if let Some(&f) = ring.first() {
                    ring.push(f);
                }
                rings.push(ring);
            }
            polys.push(rings);
        }
        Ok(Some(polys))
    }

    /// (inside, distance in metres to the outline) for a point in the city frame.
    fn footprint_distance(&self, gid: u32, x: f64, z: f64) -> Result<(bool, f32)> {
        let Some(ti) = self.tile_of(gid) else { return Ok((false, f32::MAX)) };
        let t = self.tile(ti)?;
        let b = (gid - self.tiles[ti].gid0) as usize;
        let (lx, lz) = (((x - t.origin[0] as f64) * 10.0) as f32, ((z - t.origin[1] as f64) * 10.0) as f32);
        let mut best = f32::MAX;
        for p in t.part_start[b] as usize..t.part_start[b + 1] as usize {
            let mut inside = false;
            for ring in t.ring_start[p] as usize..t.ring_start[p + 1] as usize {
                let (v0, v1) = (t.vert_start[ring] as usize, t.vert_start[ring + 1] as usize);
                let mut j = v1 - 1;
                for k in v0..v1 {
                    let (xi, zi) = (t.xz[2 * k] as f32, t.xz[2 * k + 1] as f32);
                    let (xj, zj) = (t.xz[2 * j] as f32, t.xz[2 * j + 1] as f32);
                    if (zi > lz) != (zj > lz) && lx < (xj - xi) * (lz - zi) / (zj - zi) + xi {
                        inside = !inside;
                    }
                    let (ex, ez) = (xj - xi, zj - zi);
                    let l2 = ex * ex + ez * ez;
                    let u = if l2 > 0.0 { (((lx - xi) * ex + (lz - zi) * ez) / l2).clamp(0.0, 1.0) } else { 0.0 };
                    best = best.min(((lx - xi - u * ex).powi(2) + (lz - zi - u * ez).powi(2)).sqrt() / 10.0);
                    j = k;
                }
            }
            if inside {
                return Ok((true, 0.0));
            }
        }
        Ok((false, best))
    }

    /// The building whose footprint contains (lon, lat), else the one whose outline is nearest
    /// within 25 m (as the pipeline resolves layer items).
    pub fn building_at(&self, lon: f64, lat: f64) -> Result<Option<u32>> {
        const NEAR: f32 = 25.0;
        let (x, z) = self.to_xz(lon, lat);
        let ix = self.index()?;
        let mut nearest: Option<(f32, u32)> = None;
        for g in ix.covering(x as f32, z as f32, NEAR) {
            let (inside, d) = self.footprint_distance(g, x, z)?;
            if inside {
                return Ok(Some(g));
            }
            if d <= NEAR && nearest.is_none_or(|(bd, _)| d < bd) {
                nearest = Some((d, g));
            }
        }
        Ok(nearest.map(|(_, g)| g))
    }
}

fn round1(v: f32) -> f64 {
    (v as f64 * 10.0).round() / 10.0
}
fn round7(v: f64) -> f64 {
    (v * 1e7).round() / 1e7
}
