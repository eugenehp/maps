//! Re-read web/data/<city> and check the invariants documented in FORMAT.md.

use crate::city::Ctx;
use crate::geom::area2_i;
use crate::model::{current_year, PERIOD_UNKNOWN, USE_CLASSES};
use crate::tiles::MAGICS;
use anyhow::{bail, ensure, Context, Result};
use rayon::prelude::*;
use serde_json::Value;
use std::collections::HashMap;


fn check_starts(s: &[u32], total: usize, what: &str) -> Result<()> {
    ensure!(s[0] == 0 && *s.last().unwrap() as usize == total, "{what}: bad ends");
    ensure!(s.windows(2).all(|w| w[0] < w[1]), "{what}: not strictly increasing (empty group)");
    Ok(())
}

#[derive(Default)]
struct Sum {
    nb: usize,
    np: usize,
    nr: usize,
    nv: usize,
    nt: usize,
    approx: usize,
    shared: usize,
    h_est: usize,
    tract: usize,
    no_roof: usize,
    odd_roof: usize,
    per_period: Vec<usize>,
    gids: Vec<u32>,
}

/// Parse and check one tile; returns its stats.
fn check_tile(t: &Value, blob: &[u8], n_periods: usize, n_sources: usize, now: i16) -> Result<Sum> {
    let mut s = Sum { per_period: vec![0; n_periods + 1], ..Default::default() };
    ensure!(blob.len() >= 4 && MAGICS.iter().any(|m| &blob[..4] == *m), "bad magic");
    let tl = tilefmt::decode(blob)?;
    let (b, pp, rr, v) = (tl.n_buildings(), tl.height.len(), tl.vert_start.len() - 1, tl.xz.len() / 2);
    let org = tl.origin;
    ensure!(b == t["nB"].as_u64().unwrap() as usize, "nB mismatch with index");
    ensure!(org[0] as f64 == t["origin"][0].as_f64().unwrap() && org[1] as f64 == t["origin"][1].as_f64().unwrap(), "origin mismatch");
    // re-encoding gives the same bytes: nothing in the tile is outside what the decoder reads
    ensure!(tilefmt::encode(&tl) == blob, "tile does not round-trip");
    let gid: Vec<u32> = (0..b as u32).map(|i| tl.gid0 + i).collect();
    let (year, flag, period, floors, uses) = (&tl.year, &tl.flag, &tl.period, &tl.floors, &tl.use_);
    let (part_start, height, base, ring_start, vert_start, xz) = (&tl.part_start, &tl.height, &tl.base, &tl.ring_start, &tl.vert_start, &tl.xz);
    let (ysrc, hsrc) = (&tl.year_src, &tl.height_src);

    let g0 = t["gid0"].as_u64().unwrap() as u32;
    ensure!(gid.iter().enumerate().all(|(i, &g)| g == g0 + i as u32), "gids not contiguous from gid0");
    for i in 0..b {
        ensure!(year[i] == 0 || (1600..=now).contains(&year[i]), "year {}", year[i]);
        ensure!(flag[i] & !0b1_1111 == 0, "unknown flag bits {:#x}", flag[i]);
        ensure!((ysrc[i] as usize) < n_sources || ysrc[i] == 255, "yearSrc {}", ysrc[i]);
        ensure!((hsrc[i] as usize) < n_sources, "heightSrc {}", hsrc[i]);
        ensure!((ysrc[i] == 255) == (year[i] == 0), "yearSrc/year disagree");
        ensure!(flag[i] & 16 == 0 || flag[i] & 1 != 0, "tract-median year not flagged approximate");
        s.tract += (flag[i] & 16 != 0) as usize;
        let per = period[i];
        ensure!(per == PERIOD_UNKNOWN || (per as usize) < n_periods, "period {per}");
        ensure!((per == PERIOD_UNKNOWN) == (year[i] == 0), "period/year disagree");
        ensure!(floors[i] >= 1 && (uses[i] as usize) < USE_CLASSES.len(), "floors/use");
        s.approx += (flag[i] & 1 != 0) as usize;
        s.shared += (flag[i] & 4 != 0) as usize;
        s.h_est += (flag[i] & 8 != 0) as usize;
        s.per_period[if per == PERIOD_UNKNOWN { n_periods } else { per as usize }] += 1;
    }
    check_starts(part_start, pp, "partStart")?;
    check_starts(ring_start, rr, "ringStart")?;
    check_starts(vert_start, v, "vertStart")?;
    let bb: Vec<f64> = t["bbox"].as_array().unwrap().iter().map(|x| x.as_f64().unwrap()).collect();
    let mut max_h = 0f32;
    for part in 0..pp {
        ensure!(height[part].is_finite() && height[part] > 0.0, "height {}", height[part]);
        ensure!(base[part].is_finite() && base[part].abs() < 9000.0, "base {}", base[part]);
        max_h = max_h.max(base[part] + height[part]);
        let (r0, r1) = (ring_start[part] as usize, ring_start[part + 1] as usize);
        for ring in r0..r1 {
            let pts: Vec<[i16; 2]> = (vert_start[ring]..vert_start[ring + 1])
                .map(|k| [xz[2 * k as usize], xz[2 * k as usize + 1]])
                .collect();
            ensure!(pts.len() >= 3, "ring with {} verts", pts.len());
            ensure!(pts[0] != pts[pts.len() - 1], "duplicate closing vertex");
            let a = area2_i(&pts);
            ensure!(if ring == r0 { a > 0 } else { a < 0 }, "ring {ring} orientation (area2 {a})");
            for q in &pts {
                let (x, z) = (org[0] as f64 + q[0] as f64 / 10.0, org[1] as f64 + q[1] as f64 / 10.0);
                ensure!(x >= bb[0] - 0.06 && x <= bb[2] + 0.06 && z >= bb[1] - 0.06 && z <= bb[3] + 0.06, "vertex outside tile bbox");
            }
        }
    }
    ensure!((max_h as f64 - t["maxH"].as_f64().unwrap()).abs() < 0.06, "maxH mismatch");
    s.nb = b;
    s.np = pp;
    s.nr = rr;
    s.nv = v;
    s.gids = gid;
    Ok(s)
}

pub fn run(ctx: &Ctx) -> Result<()> {
    let m: Value = serde_json::from_slice(&std::fs::read(ctx.out.join("index.json")).context("run tiles first")?)?;
    ensure!(m["format"] == "SFT5", "format");
    let srcs = m["sources"].as_array().context("sources")?;
    let all_pub = srcs.iter().all(|s| s["publishable"].as_bool() == Some(true));
    ensure!(m["publishable"].as_bool() == Some(all_pub), "publishable must equal all(sources.publishable)");
    let count = m["count"].as_u64().context("count")? as usize;
    let n_periods = m["periods"].as_array().unwrap().len();
    let n_sources = m["sources"].as_array().unwrap().len();
    let regions = m["regions"].as_array().context("regions")?;
    let tiles = m["tiles"].as_array().context("tiles")?;
    let now = current_year();

    // Load packs; every byte must be covered by exactly one tile.
    let mut packs: HashMap<String, Vec<u8>> = HashMap::new();
    let mut gid_next = 0u64;
    for r in regions {
        ensure!(r["gid0"].as_u64() == Some(gid_next), "region {} gid0", r["id"]);
        let nb = r["nB"].as_u64().unwrap();
        gid_next += nb;
        for p in r["packs"].as_array().unwrap() {
            let f = p["file"].as_str().unwrap();
            let b = std::fs::read(ctx.out.join(f))?;
            ensure!(b.len() as u64 == p["size"].as_u64().unwrap(), "{f}: size mismatch");
            packs.insert(f.to_string(), b);
        }
        let attrs: Vec<Value> = serde_json::from_slice(&std::fs::read(ctx.out.join(r["attrs"].as_str().unwrap()))?)?;
        ensure!(attrs.len() as u64 == nb, "{}: {} attrs rows, expected {nb}", r["attrs"], attrs.len());
        let src_ok = |v: &Value| v.as_u64().is_some_and(|s| (s as usize) < n_sources || s == 255);
        ensure!(attrs.iter().all(|a| src_ok(&a[3]) && src_ok(&a[4]) && src_ok(&a[5])), "attrs source indices");
    }
    ensure!(gid_next as usize == count, "regions hold {gid_next}, index says {count}");
    let mut covered: HashMap<&str, usize> = HashMap::new();
    for t in tiles {
        let (off, len) = (t["offset"].as_u64().unwrap() as usize, t["length"].as_u64().unwrap() as usize);
        let f = t["file"].as_str().unwrap();
        ensure!(off % 4 == 0 && packs.get(f).is_some_and(|p| off + len <= p.len()), "tile {}: bad offset/length", t["id"]);
        *covered.entry(f).or_default() += len;
    }
    for (f, p) in &packs {
        ensure!(covered.get(f.as_str()) == Some(&p.len()), "{f}: tiles cover {:?} of {} bytes", covered.get(f.as_str()), p.len());
    }

    let sums: Vec<Sum> = tiles
        .par_iter()
        .map(|t| {
            let (off, len) = (t["offset"].as_u64().unwrap() as usize, t["length"].as_u64().unwrap() as usize);
            check_tile(t, &packs[t["file"].as_str().unwrap()][off..off + len], n_periods, n_sources, now)
                .with_context(|| format!("tile {}", t["id"]))
        })
        .collect::<Result<_>>()?;

    let mut seen = vec![false; count];
    let mut tot = Sum { per_period: vec![0; n_periods + 1], ..Default::default() };
    for s in &sums {
        for &g in &s.gids {
            let g = g as usize;
            ensure!(g < count && !seen[g], "gid {g} out of range or duplicated");
            seen[g] = true;
        }
        tot.nb += s.nb;
        tot.np += s.np;
        tot.nr += s.nr;
        tot.nv += s.nv;
        tot.nt += s.nt;
        tot.approx += s.approx;
        tot.shared += s.shared;
        tot.h_est += s.h_est;
        tot.tract += s.tract;
        tot.no_roof += s.no_roof;
        tot.odd_roof += s.odd_roof;
        for (a, b) in tot.per_period.iter_mut().zip(&s.per_period) {
            *a += b;
        }
    }
    ensure!(tot.nb == count, "tiles hold {}, index says {count}", tot.nb);
    if let Some(g) = seen.iter().position(|s| !s) {
        bail!("gid {g} missing");
    }

    verify_ground(ctx)?;
    verify_layers(ctx, count)?;
    let pct = |x: usize| 100.0 * x as f64 / count.max(1) as f64;
    println!("OK: {count} buildings, every gid exactly once");
    println!(
        "tiles {}, regions {}, packs {}, parts {}, rings {}, vertices {}, triangles {}",
        tiles.len(), regions.len(), packs.len(), tot.np, tot.nr, tot.nv, tot.nt
    );
    println!(
        "parts without roof {}, roofs != n-2+2h triangles (earcut drops collinear/degenerate verts) {}",
        tot.no_roof, tot.odd_roof
    );
    println!(
        "flags: approximate year {} ({:.1}%), parcel-shared year {} ({:.1}%), estimated height {} ({:.1}%), area-median year {} ({:.1}%)",
        tot.approx, pct(tot.approx), tot.shared, pct(tot.shared), tot.h_est, pct(tot.h_est), tot.tract, pct(tot.tract)
    );
    println!("publishable: {all_pub}");
    for (i, p) in m["periods"].as_array().unwrap().iter().enumerate() {
        println!("  {:<24} {:>8} ({:.1}%)", p["name"].as_str().unwrap(), tot.per_period[i], pct(tot.per_period[i]));
    }
    println!("  {:<24} {:>8} ({:.1}%)", "unknown", tot.per_period[n_periods], pct(tot.per_period[n_periods]));
    Ok(())
}

/// Terrain tiles and ground layers, if `ground` has run.
fn verify_ground(ctx: &Ctx) -> Result<()> {
    if let Ok(b) = std::fs::read(ctx.out.join("terrain.json")) {
        let t: Value = serde_json::from_slice(&b)?;
        let (nx, nz) = (t["nx"].as_u64().unwrap() as usize, t["nz"].as_u64().unwrap() as usize);
        let tiles = t["tiles"].as_array().context("terrain tiles")?;
        for tile in tiles {
            let (i0, j0) = (tile["i0"].as_u64().unwrap() as usize, tile["j0"].as_u64().unwrap() as usize);
            let (tw, th) = (tile["nx"].as_u64().unwrap() as usize, tile["nz"].as_u64().unwrap() as usize);
            ensure!(i0 + tw <= nx && j0 + th <= nz, "terrain tile out of grid");
            let f = tile["file"].as_str().unwrap();
            let len = std::fs::metadata(ctx.out.join(f))?.len() as usize;
            ensure!(len == tw * th * 2, "{f}: {len} bytes, expected {}", tw * th * 2);
        }
        println!("terrain: {nx}x{nz} cells of {} m, {} tiles OK", t["cell"], tiles.len());
    }
    for name in ["land", "water", "parks"] {
        let Ok(b) = std::fs::read(ctx.out.join(format!("{name}.bin"))) else { continue };
        ensure!(&b[..4] == crate::ground::LAYER_MAGIC, "{name}: magic");
        let nv = u32::from_le_bytes(b[4..8].try_into().unwrap()) as usize;
        let ni = u32::from_le_bytes(b[8..12].try_into().unwrap()) as usize;
        ensure!(b.len() == 12 + nv * 8 + ni * 4 && ni % 3 == 0, "{name}: size");
        let idx = &b[12 + nv * 8..];
        ensure!(idx.chunks_exact(4).all(|c| (u32::from_le_bytes(c.try_into().unwrap()) as usize) < nv), "{name}: index out of range");
        println!("{name}: {nv} vertices, {} triangles OK", ni / 3);
    }
    Ok(())
}

/// layers.bin / layers.json invariants, if `layers` has run.
fn verify_layers(ctx: &Ctx, count: usize) -> Result<()> {
    let Ok(b) = std::fs::read(ctx.out.join("layers.bin")) else { return Ok(()) };
    let j: Value = serde_json::from_slice(&std::fs::read(ctx.out.join("layers.json"))?)?;
    ensure!(&b[..4] == crate::layers::MAGIC, "layers.bin magic");
    let u = |i: usize| u32::from_le_bytes(b[i * 4..i * 4 + 4].try_into().unwrap()) as usize;
    let (nb, nl) = (u(1), u(2));
    ensure!(nb == count, "layers.bin nB {nb} != {count}");
    ensure!(b.len() == 4 * (3 + 2 * nb + nb + 1 + nl), "layers.bin size");
    let items = j["items"].as_array().context("items")?;
    let layers = j["layers"].as_array().context("layers")?;
    let mut used_bits = 0u64;
    for l in layers {
        for c in l["categories"].as_array().unwrap() {
            used_bits |= 1 << c["bit"].as_u64().unwrap();
        }
    }
    let ls = 3 + 2 * nb;
    ensure!(u(ls) == 0 && u(ls + nb) == nl, "linkStart ends");
    for g in 0..nb {
        let (a, z) = (u(ls + g), u(ls + g + 1));
        ensure!(a <= z, "linkStart not monotone");
        let mask = u(3 + 2 * g) as u64 | (u(4 + 2 * g) as u64) << 32;
        ensure!(mask & !used_bits == 0, "mask uses an undefined bit");
        ensure!((mask == 0) == (a == z), "gid {g}: mask/links disagree");
        for k in a..z {
            let it = u(ls + nb + 1 + k);
            ensure!(it < items.len(), "link to item {it} out of range");
            let (li, ci) = (items[it][0].as_u64().unwrap() as usize, items[it][1].as_u64().unwrap() as usize);
            let bit = layers[li]["categories"][ci]["bit"].as_u64().context("item category")?;
            ensure!(mask & (1 << bit) != 0, "gid {g}: item category bit not in mask");
        }
    }
    println!("layers: {} layers, {} items, {nl} links OK", layers.len(), items.len());
    Ok(())
}
