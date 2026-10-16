//! Ground layers for rendering: terrain heightmap (USGS 3DEP) and
//! triangulated land / water / parks polygons (Overture Maps base theme,
//! from OpenStreetMap — ODbL). Writes web/data/<city>/{terrain.json,
//! terrain/*.bin, land.bin, water.bin, parks.bin} and cache/<city>/dem.bin
//! (used by `tiles` for building bases where the source has no ground).
//! See FORMAT.md.

use crate::city::Ctx;
use crate::geom::Proj;
use crate::sources::bay::parse_wkb;
use crate::sources::http::agent;
use crate::sources::pq::bins;
use anyhow::{bail, Context, Result};
use byteorder::{WriteBytesExt, LE};
use geo::{Coord, LineString, Simplify};
use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;
use rayon::prelude::*;
use serde_json::json;
use std::path::Path;
use std::process::Command;

const DEM_URL: &str = "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage";
const DEM_CHUNK: usize = 2000;
const TERRAIN_TILE: usize = 256;
const NODATA: u16 = u16::MAX;
pub const LAYER_MAGIC: &[u8; 4] = b"SFL1";
const OVERTURE: &str = "s3://overturemaps-us-west-2/release";

pub fn run(ctx: &Ctx) -> Result<()> {
    dem(ctx)?;
    layers(ctx)?;
    Ok(())
}

/// City-frame grid of f32 heights (NaN = no data); row 0 is the northern edge.
pub struct Dem {
    pub x0: f64, // centre of cell (0, 0)
    pub z0: f64,
    pub cell: f64,
    pub nx: usize,
    pub nz: usize,
    pub h: Vec<f32>,
}

impl Dem {
    pub fn load(path: &Path) -> Result<Option<Dem>> {
        let Ok(b) = std::fs::read(path) else { return Ok(None) };
        let f = |i: usize| f64::from_le_bytes(b[i * 8..i * 8 + 8].try_into().unwrap());
        let (x0, z0, cell, nx, nz) = (f(0), f(1), f(2), f(3) as usize, f(4) as usize);
        let h = b[40..].chunks_exact(4).map(|c| f32::from_le_bytes(c.try_into().unwrap())).collect::<Vec<_>>();
        if h.len() != nx * nz {
            bail!("{}: bad size", path.display());
        }
        Ok(Some(Dem { x0, z0, cell, nx, nz, h }))
    }
    /// Bilinear height at a city-frame point.
    pub fn at(&self, x: f64, z: f64) -> Option<f32> {
        let (fx, fz) = ((x - self.x0) / self.cell, (z - self.z0) / self.cell);
        if fx < 0.0 || fz < 0.0 || fx > (self.nx - 1) as f64 || fz > (self.nz - 1) as f64 {
            return None;
        }
        let (i, j) = ((fx as usize).min(self.nx - 2), (fz as usize).min(self.nz - 2));
        let (tx, tz) = ((fx - i as f64) as f32, (fz - j as f64) as f32);
        let g = |i: usize, j: usize| self.h[j * self.nx + i];
        let v = (g(i, j) * (1.0 - tx) + g(i + 1, j) * tx) * (1.0 - tz) + (g(i, j + 1) * (1.0 - tx) + g(i + 1, j + 1) * tx) * tz;
        v.is_finite().then_some(v)
    }
}

fn dem(ctx: &Ctx) -> Result<()> {
    let city = ctx.city;
    let [w, s, e, n] = city.bbox;
    let cell = city.ground_cell_m;
    // Source raster in lon/lat, ~1.5 px per output cell.
    // The ImageServer forces square pixels (it widens the bbox otherwise),
    // so ask for equal degree steps; tie points are checked below.
    let dlat = cell / 1.5 / 110_900.0;
    let dlon = dlat;
    let (wpx, hpx) = (((e - w) / dlon).ceil() as usize, ((n - s) / dlat).ceil() as usize);
    let dir = ctx.cache.join("dem");
    std::fs::create_dir_all(&dir)?;
    let a = agent();
    let mut mosaic = vec![f32::NAN; wpx * hpx];
    let chunks: Vec<(usize, usize)> = (0..hpx.div_ceil(DEM_CHUNK)).flat_map(|r| (0..wpx.div_ceil(DEM_CHUNK)).map(move |c| (r, c))).collect();
    println!("dem: {wpx}x{hpx} px source raster in {} chunks", chunks.len());
    for (r, c) in chunks {
        let (px0, py0) = (c * DEM_CHUNK, r * DEM_CHUNK);
        let (cw, ch) = (DEM_CHUNK.min(wpx - px0), DEM_CHUNK.min(hpx - py0));
        let (cw0, cn0) = (w + px0 as f64 * dlon, n - py0 as f64 * dlat);
        let (ce, cs) = (cw0 + cw as f64 * dlon, cn0 - ch as f64 * dlat);
        let path = dir.join(format!("c_{r}_{c}.tif"));
        if !path.exists() {
            let url = format!(
                "{DEM_URL}?bbox={cw0},{cs},{ce},{cn0}&bboxSR=4326&imageSR=4326&size={cw},{ch}&format=tiff&pixelType=F32\
                 &noData=-9999&interpolation=RSP_BilinearInterpolation&f=image"
            );
            let mut last = None;
            for attempt in 0..4 {
                if attempt > 0 {
                    std::thread::sleep(std::time::Duration::from_secs(5 << attempt));
                }
                match a.get(&url).call() {
                    Ok(resp) => {
                        let mut buf = Vec::new();
                        std::io::Read::read_to_end(&mut resp.into_reader(), &mut buf)?;
                        if buf.starts_with(b"II") || buf.starts_with(b"MM") {
                            std::fs::write(path.with_extension("part"), &buf)?;
                            std::fs::rename(path.with_extension("part"), &path)?;
                            last = None;
                            break;
                        }
                        last = Some(String::from_utf8_lossy(&buf[..buf.len().min(200)]).to_string());
                    }
                    Err(err) => last = Some(err.to_string()),
                }
            }
            if let Some(err) = last {
                bail!("3DEP chunk {r},{c}: {err}");
            }
        }
        let mut dec = tiff::decoder::Decoder::new(std::io::BufReader::new(std::fs::File::open(&path)?))?;
        let (tw, th) = dec.dimensions()?;
        // GeoTIFF ModelPixelScale / ModelTiepoint must match what we asked for.
        let scale = dec.get_tag_f64_vec(tiff::tags::Tag::Unknown(33550))?;
        let tie = dec.get_tag_f64_vec(tiff::tags::Tag::Unknown(33922))?;
        let tol = dlat * 0.01;
        if (scale[0] - dlon).abs() > tol * 1e-2 || (scale[1] - dlat).abs() > tol * 1e-2 || (tie[3] - cw0).abs() > tol || (tie[4] - cn0).abs() > tol {
            bail!("{}: georeference {scale:?} {tie:?} differs from the request (delete it and rerun)", path.display());
        }
        let px = match dec.read_image()? {
            tiff::decoder::DecodingResult::F32(v) => v,
            _ => bail!("{}: expected F32 tiff", path.display()),
        };
        if (tw as usize, th as usize) != (cw, ch) {
            bail!("{}: got {tw}x{th}, asked {cw}x{ch}", path.display());
        }
        for y in 0..ch {
            for x in 0..cw {
                let v = px[y * cw + x];
                mosaic[(py0 + y) * wpx + px0 + x] = if v > -1000.0 && v < 9000.0 { v } else { f32::NAN };
            }
        }
    }

    // Resample to the city frame (bilinear in lon/lat).
    let proj = Proj::new(city.origin);
    let corners = [[w, s], [w, n], [e, s], [e, n]].map(|p| proj.fwd(p));
    let (xmin, xmax) = corners.iter().fold((f64::MAX, f64::MIN), |a, p| (a.0.min(p[0]), a.1.max(p[0])));
    let (zmin, zmax) = corners.iter().fold((f64::MAX, f64::MIN), |a, p| (a.0.min(p[1]), a.1.max(p[1])));
    let (nx, nz) = (((xmax - xmin) / cell) as usize, ((zmax - zmin) / cell) as usize);
    let (x0, z0) = (xmin + cell / 2.0, zmin + cell / 2.0);
    let sample = |lon: f64, lat: f64| -> f32 {
        let fx = (lon - w) / dlon - 0.5;
        let fy = (n - lat) / dlat - 0.5;
        if fx < 0.0 || fy < 0.0 || fx >= (wpx - 1) as f64 || fy >= (hpx - 1) as f64 {
            return f32::NAN;
        }
        let (i, j) = (fx as usize, fy as usize);
        let (tx, ty) = ((fx - i as f64) as f32, (fy - j as f64) as f32);
        let g = |i: usize, j: usize| mosaic[j * wpx + i];
        (g(i, j) * (1.0 - tx) + g(i + 1, j) * tx) * (1.0 - ty) + (g(i, j + 1) * (1.0 - tx) + g(i + 1, j + 1) * tx) * ty
    };
    let h: Vec<f32> = (0..nz)
        .into_par_iter()
        .flat_map_iter(|j| {
            let sample = &sample;
            let proj = &proj;
            (0..nx).map(move |i| {
                let ll = proj.inv([x0 + i as f64 * cell, z0 + j as f64 * cell]);
                sample(ll[0], ll[1])
            })
        })
        .collect();
    drop(mosaic);
    let valid: Vec<f32> = h.iter().copied().filter(|v| v.is_finite()).collect();
    let (hmin, hmax) = valid.iter().fold((f32::MAX, f32::MIN), |a, &v| (a.0.min(v), a.1.max(v)));
    println!("dem: {nx}x{nz} cells of {cell} m, {:.1}% with data, {hmin:.1}..{hmax:.1} m", 100.0 * valid.len() as f64 / h.len() as f64);

    // cache/<city>/dem.bin for `tiles`: 5 f64 then f32 grid.
    let mut b = Vec::with_capacity(40 + h.len() * 4);
    for v in [x0, z0, cell, nx as f64, nz as f64] {
        b.write_f64::<LE>(v)?;
    }
    for v in &h {
        b.write_f32::<LE>(*v)?;
    }
    std::fs::write(ctx.cache.join("dem.bin"), b)?;

    // Web tiles: Uint16 decimetres above `offset`, with a 1-cell overlap.
    let offset = (hmin as f64).floor() - 1.0;
    let out = ctx.out.join("terrain");
    std::fs::create_dir_all(&out)?;
    for e in std::fs::read_dir(&out)? {
        let p = e?.path();
        if p.extension().is_some_and(|x| x == "bin") {
            std::fs::remove_file(p)?;
        }
    }
    let mut tiles = Vec::new();
    let mut bytes = 0;
    for tj in 0..nz.div_ceil(TERRAIN_TILE) {
        for ti in 0..nx.div_ceil(TERRAIN_TILE) {
            let (i0, j0) = (ti * TERRAIN_TILE, tj * TERRAIN_TILE);
            let (tw, th) = ((TERRAIN_TILE + 1).min(nx - i0), (TERRAIN_TILE + 1).min(nz - j0));
            let mut q16: Vec<u16> = Vec::with_capacity(tw * th);
            let (mut tmin, mut tmax, mut any) = (f32::MAX, f32::MIN, false);
            for j in j0..j0 + th {
                for i in i0..i0 + tw {
                    let v = h[j * nx + i];
                    let q = if v.is_finite() {
                        any = true;
                        tmin = tmin.min(v);
                        tmax = tmax.max(v);
                        (((v as f64 - offset) * 10.0).round() as i64).clamp(0, NODATA as i64 - 1) as u16
                    } else {
                        NODATA
                    };
                    q16.push(q);
                }
            }
            // "delta-shuffle": each row as differences from the cell to its west (wrapping, so
            // no-data cells survive exactly), then all low bytes, then all high bytes. Terrain
            // is smooth: the high bytes are nearly all 0 / 255 and compress to almost nothing.
            let mut d = Vec::with_capacity(q16.len());
            for row in q16.chunks(tw) {
                let mut prev = 0u16;
                for &q in row {
                    d.push(q.wrapping_sub(prev));
                    prev = q;
                }
            }
            let mut buf = Vec::with_capacity(tw * th * 2);
            buf.extend(d.iter().map(|v| *v as u8));
            buf.extend(d.iter().map(|v| (*v >> 8) as u8));
            if !any {
                continue; // all water / outside coverage
            }
            let file = format!("terrain/t_{ti}_{tj}.bin");
            std::fs::write(ctx.out.join(&file), &buf)?;
            bytes += buf.len();
            tiles.push(json!({ "file": file, "i0": i0, "j0": j0, "nx": tw, "nz": th, "min": tmin, "max": tmax }));
        }
    }
    let meta = json!({
        "source": "USGS 3D Elevation Program (3DEP) 1/3 arc-second, via the National Map 3DEPElevation ImageServer (public domain)",
        "datum": "NAVD88 metres (same as building base)",
        "cell": cell, "x0": x0, "z0": z0, "nx": nx, "nz": nz,
        "offset": offset, "scale": 0.1, "nodata": NODATA, "encoding": "delta-shuffle",
        "tileCells": TERRAIN_TILE, "overlap": 1,
        "min": hmin, "max": hmax,
        "tiles": tiles,
    });
    std::fs::write(ctx.out.join("terrain.json"), serde_json::to_string(&meta)?)?;
    println!("terrain: {} tiles, {:.1} MB", meta["tiles"].as_array().unwrap().len(), bytes as f64 / 1048576.0);
    Ok(())
}

/// (output name, Overture base type, SQL filter)
const LAYERS: &[(&str, &str, &str)] = &[
    ("land", "land", "subtype = 'land'"),
    ("water", "water", "coalesce(class, '') NOT IN ('swimming_pool', 'fountain')"),
    ("parks", "land_use", "subtype IN ('park', 'golf') OR class IN ('recreation_ground', 'nature_reserve', 'cemetery', 'garden')"),
];

fn layers(ctx: &Ctx) -> Result<()> {
    let city = ctx.city;
    let release = std::fs::read_to_string(ctx.root_cache().join("bay").join("overture_release.txt"))
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|_| "2026-09-23.1".to_string());
    let [w, s, e, n] = city.bbox;
    let proj = Proj::new(city.origin);
    for (name, ty, filter) in LAYERS {
        let pq = ctx.cache.join(format!("ground_{name}.parquet"));
        if !pq.exists() {
            let tmp = pq.with_extension("tmp");
            let sql = format!(
                "INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial; SET s3_region='us-west-2'; SET enable_progress_bar=false;
                 COPY (
                   SELECT ST_AsWKB(ST_CollectionExtract(ST_Intersection(geometry, ST_MakeEnvelope({w}, {s}, {e}, {n})), 3)) AS wkb
                   FROM read_parquet('{OVERTURE}/{release}/theme=base/type={ty}/*.parquet')
                   WHERE bbox.xmin < {e} AND bbox.xmax > {w} AND bbox.ymin < {n} AND bbox.ymax > {s}
                     AND ST_GeometryType(geometry) IN ('POLYGON', 'MULTIPOLYGON') AND ({filter})
                 ) TO '{}' (FORMAT parquet, COMPRESSION zstd);",
                tmp.display()
            );
            println!("{name}: querying Overture base/{ty}...");
            if !Command::new("duckdb").arg("-c").arg(&sql).status().context("duckdb")?.success() {
                bail!("duckdb failed for {name}");
            }
            std::fs::rename(&tmp, &pq)?;
        }
        let mut polys: Vec<Vec<Vec<[f64; 2]>>> = Vec::new();
        for batch in ParquetRecordBatchReaderBuilder::try_new(std::fs::File::open(&pq)?)?.build()? {
            let batch = batch?;
            for g in bins(batch.column_by_name("wkb").context("wkb")?)?.into_iter().flatten() {
                polys.extend(parse_wkb(g).unwrap_or_default());
            }
        }
        let eps = city.ground_simplify_m;
        let tris: Vec<(Vec<[f32; 2]>, Vec<u32>)> = polys
            .par_iter()
            .filter_map(|rings| {
                let rings: Vec<Vec<[f64; 2]>> = rings
                    .iter()
                    .map(|r| simplify(r.iter().map(|&ll| proj.fwd(ll)), eps))
                    .filter(|r| r.len() >= 3 && area(r).abs() >= eps * eps)
                    .collect();
                if rings.is_empty() || rings[0].len() < 3 {
                    return None;
                }
                let mut flat = Vec::new();
                let mut holes = Vec::new();
                for (i, r) in rings.iter().enumerate() {
                    if i > 0 {
                        holes.push(flat.len() / 2);
                    }
                    flat.extend(r.iter().flat_map(|p| [p[0], p[1]]));
                }
                let idx = earcutr::earcut(&flat, &holes, 2).ok()?;
                let verts = flat.chunks_exact(2).map(|c| [c[0] as f32, c[1] as f32]).collect();
                Some((verts, idx.into_iter().map(|i| i as u32).collect()))
            })
            .collect();
        let (nv, ni): (usize, usize) = tris.iter().fold((0, 0), |a, t| (a.0 + t.0.len(), a.1 + t.1.len()));
        let mut b = Vec::with_capacity(12 + nv * 8 + ni * 4);
        b.extend_from_slice(LAYER_MAGIC);
        b.write_u32::<LE>(nv as u32)?;
        b.write_u32::<LE>(ni as u32)?;
        for (v, _) in &tris {
            for p in v {
                b.write_f32::<LE>(p[0])?;
                b.write_f32::<LE>(p[1])?;
            }
        }
        let mut base = 0u32;
        for (v, idx) in &tris {
            for &i in idx {
                b.write_u32::<LE>(base + i)?;
            }
            base += v.len() as u32;
        }
        std::fs::write(ctx.out.join(format!("{name}.bin")), &b)?;
        println!("{name}: {} polygons -> {nv} vertices, {} triangles, {:.1} MB", polys.len(), ni / 3, b.len() as f64 / 1048576.0);
    }
    Ok(())
}

fn simplify(pts: impl Iterator<Item = [f64; 2]>, eps: f64) -> Vec<[f64; 2]> {
    let mut ls: Vec<Coord> = pts.map(|p| Coord { x: p[0], y: p[1] }).collect();
    if ls.len() < 4 {
        return vec![];
    }
    if ls.first() != ls.last() {
        ls.push(ls[0]);
    }
    let mut v: Vec<[f64; 2]> = LineString::new(ls).simplify(eps).0.iter().map(|c| [c.x, c.y]).collect();
    v.pop();
    v
}

fn area(r: &[[f64; 2]]) -> f64 {
    let n = r.len();
    (0..n).map(|i| r[i][0] * r[(i + 1) % n][1] - r[(i + 1) % n][0] * r[i][1]).sum::<f64>() / 2.0
}
