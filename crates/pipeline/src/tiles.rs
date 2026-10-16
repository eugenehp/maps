//! Project, simplify, tile and pack buildings for the web (SFT5/SFT6 tiles via the tilefmt crate).
//! Buildings modelled part by part in OpenStreetMap get those parts (domes, setbacks; `parts`).
//! See FORMAT.md (copied to web/data/<city>/) for the layout.
//!
//! Streaming: buildings are read chunk by chunk and reduced right away to
//! compact tile-local Int16 geometry, so memory is ~ the output size.
//! Tiles are grouped into square regions; each region gets its own pack
//! files and attrs file so a client can load progressively by view.

use crate::city::Ctx;
use crate::geom::{area2_i, centroid, Proj};
use crate::ground::Dem;
use crate::model::*;
use crate::store::for_each_chunk;
use anyhow::Result;
use geo::{Coord, LineString, Simplify};
use rayon::prelude::*;
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap};

pub const MAGICS: [&[u8; 4]; 2] = [tilefmt::SFT5, tilefmt::SFT6];
/// Douglas-Peucker tolerance: 3% of the ring's size, between 0.35 and 2 m. Outlines traced from
/// LiDAR carry 0.5-2 m stair-steps that, extruded, stripe facades; this is the rule the browser
/// used to apply itself, done once here so the vertices are never shipped.
const SIMPLIFY_MIN_M: f64 = 0.35;
const SIMPLIFY_MAX_M: f64 = 2.0;
const SIMPLIFY_FRAC: f64 = 0.03;
const MIN_AREA_M2: f64 = 2.0;
const GROUND_TOL_M: f32 = 15.0;
const PACK_TARGET: usize = 6 << 20;
pub const FORMAT_MD: &str = include_str!("../FORMAT.md");

/// Quantized part: rings in tile-local decimetres, first ring outer.
struct Part {
    height: f32,
    base: f32,
    /// bottom above the ground, roof shape and roof height (tilefmt SFT6)
    min: f32,
    shape: u8,
    roof_h: f32,
    rings: Vec<Vec<[i16; 2]>>,
}

struct QB {
    key: String, // stable sort key within a tile
    year: i16,
    flags: u8,
    period: u8,
    floors: u8,
    use_class: u8,
    parts: Vec<Part>,
    addr: String,
    use_def: String,
    units: u32,
    extra: String,
    /// index into the city's landmark models
    model: Option<usize>,
    /// year demolished, 0 = standing
    demolished: i16,
    // Provenance (SOURCES indices; S_NONE = none).
    ysrc: u8,
    hsrc: u8,
    fsrc: u8,
}

#[derive(Default, Clone, Copy)]
struct Stats {
    dropped: usize,
    parts_dropped: usize,
    holes_dropped: usize,
    tri_failed: usize,
    ground_fixed: usize,
    parts_replaced: usize,
    parts_added: usize,
}

pub fn run(ctx: &Ctx) -> Result<()> {
    let city = ctx.city;
    let proj = Proj::new(city.origin);
    let tile_m = city.tile_m;

    // Stream buildings -> per-tile compact records.
    let mut tiles: HashMap<(i32, i32), Vec<QB>> = HashMap::new();
    let dem = crate::ground::Dem::load(&ctx.cache.join("dem.bin"))?;
    if dem.is_none() {
        println!("no DEM (run `ground`): buildings without source ground get base 0");
    }
    let mut used = [false; 256];
    let mut st = Stats::default();
    let parts3d = crate::parts::Index::load(ctx)?;
    let parts3d = parts3d.as_ref();
    let landmarks = crate::landmarks::load(ctx)?;
    let landmarks = &landmarks;
    for_each_chunk(&ctx.buildings(), |chunk| {
        let out: Vec<(Option<((i32, i32), QB)>, Stats)> = chunk
            .into_par_iter()
            .map(|b| {
                let mut s = Stats::default();
                let q = reduce(&b, &proj, tile_m, city.use_ground, dem.as_ref(), parts3d, landmarks, &mut s);
                s.dropped += q.is_none() as usize;
                (q, s)
            })
            .collect();
        for (q, s) in out {
            st.dropped += s.dropped;
            st.parts_dropped += s.parts_dropped;
            st.holes_dropped += s.holes_dropped;
            st.tri_failed += s.tri_failed;
            st.ground_fixed += s.ground_fixed;
            st.parts_replaced += s.parts_replaced;
            st.parts_added += s.parts_added;
            if let Some((t, qb)) = q {
                for s in [qb.ysrc, qb.hsrc, qb.fsrc] {
                    used[s as usize] = true;
                }
                tiles.entry(t).or_default().push(qb);
            }
        }
        Ok(())
    })?;

    // OSM building parts are credited like any other source
    if st.parts_replaced + st.parts_added > 0 {
        used[S_OVT_OSM as usize] = true;
    }
    // City-local source table (global ids in order); 255 stays "none".
    let table: Vec<u8> = (0..SOURCES.len() as u8).filter(|&s| used[s as usize]).collect();
    let mut local = [255u8; 256];
    for (i, &s) in table.iter().enumerate() {
        local[s as usize] = i as u8;
    }
    let local = &local;

    // Order: region (z, x), then tile (z, x) inside it, then key.
    let rt = city.region_tiles;
    let region_of = |t: (i32, i32)| (t.0.div_euclid(rt), t.1.div_euclid(rt));
    let mut keys: Vec<(i32, i32)> = tiles.keys().copied().collect();
    keys.sort_by_key(|&t| {
        let r = region_of(t);
        (r.1, r.0, t.1, t.0)
    });
    tiles.par_iter_mut().for_each(|(_, v)| v.sort_by(|a, b| a.key.cmp(&b.key)));

    clear_outputs(ctx)?;
    std::fs::create_dir_all(ctx.out.join("attrs"))?;
    let mut gid = 0u32;
    let mut tile_meta = Vec::new();
    let mut models: Vec<Value> = Vec::new();
    let mut gone: BTreeMap<(i16, i16), u32> = BTreeMap::new();
    let mut regions = Vec::new();
    let mut year_hist: BTreeMap<i16, u32> = BTreeMap::new();
    let (mut lo, mut hi) = ([f64::MAX; 2], [f64::MIN; 2]);
    let (mut n_parts, mut n_verts, mut approx, mut total_bytes) = (0usize, 0usize, 0usize, 0usize);

    for group in keys.chunk_by(|a, b| region_of(*a) == region_of(*b)) {
        let (rx, rz) = region_of(group[0]);
        let rid = format!("r{rx}_{rz}");
        let gid_region = gid;
        // Encode this region's tiles in parallel.
        let mut gid0s = Vec::with_capacity(group.len());
        for t in group {
            gid0s.push(gid);
            gid += tiles[t].len() as u32;
        }
        let encoded: Vec<(Vec<u8>, [f64; 4], f32)> = group
            .par_iter()
            .zip(&gid0s)
            .map(|(t, &g0)| {
                let origin = tile_origin(*t, tile_m);
                let qbs = &tiles[t];
                let mut bb = [f64::MAX, f64::MAX, f64::MIN, f64::MIN];
                let mut max_h = 0f32;
                for p in qbs.iter().flat_map(|q| &q.parts) {
                    max_h = max_h.max(p.base + p.height);
                    for v in p.rings.iter().flatten() {
                        let (x, z) = (origin[0] as f64 + v[0] as f64 / 10.0, origin[1] as f64 + v[1] as f64 / 10.0);
                        bb = [bb[0].min(x), bb[1].min(z), bb[2].max(x), bb[3].max(z)];
                    }
                }
                (encode_tile(g0, origin, qbs, local), bb, max_h)
            })
            .collect();

        // Packs + attrs for the region.
        let mut packs: Vec<Value> = Vec::new();
        let mut cur: Vec<u8> = Vec::new();
        let mut attrs: Vec<Value> = Vec::new();
        let mut rbb = [f64::MAX, f64::MAX, f64::MIN, f64::MIN];
        let flush = |cur: &mut Vec<u8>, packs: &mut Vec<Value>| -> Result<()> {
            let name = format!("{rid}_{}.bin", packs.len());
            std::fs::write(ctx.out.join(&name), &cur)?;
            packs.push(json!({ "file": name, "size": cur.len() }));
            cur.clear();
            Ok(())
        };
        for ((t, (blob, bb, max_h)), &g0) in group.iter().zip(encoded).zip(&gid0s) {
            let qbs = &tiles[t];
            for (qi, q) in qbs.iter().enumerate() {
                if let Some(i) = q.model {
                    let l = &landmarks[i];
                    let xz = proj.fwd(l.lonlat);
                    models.push(json!({
                        "id": l.id, "name": l.name, "file": format!("models/{}.glb", l.id), "gid": g0 + qi as u32,
                        "x": (xz[0] * 100.0).round() / 100.0, "z": (xz[1] * 100.0).round() / 100.0,
                        "base": q.parts.first().map_or(0.0, |p| p.base), "rotation": l.rotation, "licence": l.licence, "publishable": l.publishable,
                    }));
                    std::fs::create_dir_all(ctx.out.join("models"))?;
                    std::fs::copy(&l.model, ctx.out.join("models").join(format!("{}.glb", l.id)))?;
                }
                let l = |s: u8| local[s as usize];
                let mut row = json!([q.addr, q.use_def, q.units, l(q.ysrc), l(q.hsrc), l(q.fsrc)]);
                if !q.extra.is_empty() {
                    row.as_array_mut().unwrap().push(serde_json::from_str(&q.extra).unwrap_or(Value::Null));
                }
                attrs.push(row);
                if q.demolished != 0 {
                    // [built (0 unknown), demolished] -> count; not in the histogram of what stands
                    *gone.entry((q.year, q.demolished)).or_default() += 1;
                } else if q.year > 0 {
                    *year_hist.entry(q.year).or_default() += 1;
                }
                approx += (q.flags & F_APPROX_YEAR != 0) as usize;
                n_parts += q.parts.len();
                for p in &q.parts {
                    n_verts += p.rings.iter().map(Vec::len).sum::<usize>();
                }
            }
            rbb = [rbb[0].min(bb[0]), rbb[1].min(bb[1]), rbb[2].max(bb[2]), rbb[3].max(bb[3])];
            if !cur.is_empty() && cur.len() + blob.len() > PACK_TARGET {
                flush(&mut cur, &mut packs)?;
            }
            tile_meta.push(json!({
                "id": format!("{}_{}", t.0, t.1),
                "region": regions.len(),
                "file": format!("{rid}_{}.bin", packs.len()),
                "offset": cur.len(),
                "length": blob.len(),
                "origin": tile_origin(*t, tile_m),
                "bbox": bb.map(round1),
                "maxH": round1(max_h as f64),
                "nB": qbs.len(),
                "gid0": g0,
            }));
            cur.extend_from_slice(&blob);
        }
        if !cur.is_empty() {
            flush(&mut cur, &mut packs)?;
        }
        total_bytes += packs.iter().map(|p| p["size"].as_u64().unwrap() as usize).sum::<usize>();
        let attrs_file = format!("attrs/{rid}.json");
        std::fs::write(ctx.out.join(&attrs_file), serde_json::to_string(&attrs)?)?;
        lo = [lo[0].min(rbb[0]), lo[1].min(rbb[1])];
        hi = [hi[0].max(rbb[2]), hi[1].max(rbb[3])];
        regions.push(json!({
            "id": rid,
            "bbox": rbb.map(round1),
            "gid0": gid_region,
            "nB": gid - gid_region,
            "attrs": attrs_file,
            "packs": packs,
        }));
        for t in group {
            tiles.remove(t); // free as we go
        }
    }

    let source_table: Vec<Value> = table
        .iter()
        .map(|&s| {
            let x = &SOURCES[s as usize];
            json!({ "id": x.id, "name": x.name, "url": x.url, "licence": x.licence, "attribution": x.attribution, "publishable": x.publishable })
        })
        .collect();
    let publishable = table.iter().all(|&s| SOURCES[s as usize].publishable);
    let mut attr_parts: Vec<&str> = table.iter().map(|&s| SOURCES[s as usize].attribution).filter(|a| !a.is_empty()).collect();
    if !city.attribution.is_empty() {
        attr_parts.push(city.attribution);
    }
    attr_parts.dedup();
    let mut seen = std::collections::HashSet::new();
    let attribution = attr_parts.into_iter().filter(|a| seen.insert(*a)).collect::<Vec<_>>().join("; ");
    let mut lic: Vec<String> = table
        .iter()
        .map(|&s| SOURCES[s as usize].licence)
        .filter(|l| *l != "derived")
        .map(String::from)
        .collect();
    lic.sort();
    lic.dedup();
    let licence = format!(
        "{}{}",
        lic.join("; "),
        if publishable { "" } else { ". Contains non-publishable sources (publishable=false in sources): local use only." }
    );
    let ll_lo = proj.inv([lo[0], hi[1]]); // south-west (z is south)
    let ll_hi = proj.inv([hi[0], lo[1]]);
    let index = json!({
        "format": "SFT5",
        "city": city.id,
        "name": city.name,
        "attribution": attribution,
        "licence": licence,
        "publishable": publishable,
        "convention": "x = metres east, z = metres south of origin (three.js Y-up, north = -Z). \
            Tile vertices are Int16 decimetres relative to tile origin. Outer rings have positive \
            shoelace area in (x,z) (CCW in x-right/z-up math axes; clockwise seen from above \
            with north up), holes negative. No closing vertex. See FORMAT.md.",
        "origin": { "lon": city.origin[0], "lat": city.origin[1] },
        "tileSize": tile_m,
        "regionTiles": rt,
        "count": gid,
        "groundDatum": if city.use_ground { "NAVD88 metres (source ground, else USGS 3DEP)" } else { "none (base = 0)" },
        "bounds": { "min": [lo[0], lo[1]], "max": [hi[0], hi[1]], "lonLat": [ll_lo, ll_hi] },
        "periods": city.periods.iter().map(|p| json!({
            "name": p.name, "from": p.from, "to": if p.to == 9999 { current_year() } else { p.to }, "color": p.color
        })).collect::<Vec<_>>(),
        "unknownPeriod": PERIOD_UNKNOWN,
        "unknownColor": UNKNOWN_COLOR,
        "uses": USE_CLASSES,
        "flags": {
            "approxYear": F_APPROX_YEAR, "landmark": F_LANDMARK, "parcelSharedYear": F_PARCEL_SHARED,
            "heightEstimated": F_HEIGHT_EST, "tractMedianYear": F_TRACT_YEAR
        },
        "sources": source_table,
        "noSource": 255,
        "attrsColumns": ["address", "use", "units", "yearSource", "heightSource", "footprintSource", "extra?"],
        "yearHist": year_hist,
        "regions": regions,
        "tiles": tile_meta,
        "models": models,
        "demolished": {
            "count": gone.values().sum::<u32>(),
            "pairs": gone.iter().map(|((b, d), n)| json!([b, d, n])).collect::<Vec<_>>(),
        },
    });
    std::fs::write(ctx.out.join("index.json"), serde_json::to_string(&index)?)?;
    std::fs::write(ctx.out.join("FORMAT.md"), FORMAT_MD)?;

    println!(
        "buildings {gid} (dropped {} as slivers), parts {n_parts} (dropped {}), holes dropped {}, verts {n_verts}",
        st.dropped, st.parts_dropped, st.holes_dropped
    );
    println!("source ground > {GROUND_TOL_M} m off the DEM, replaced by DEM: {} buildings", st.ground_fixed);
    println!(
        "OSM building parts: drawn instead of the footprint for {} buildings, added on top for {}",
        st.parts_replaced, st.parts_added
    );
    println!("approximate years in output: {approx} ({:.1}%)", 100.0 * approx as f64 / gid.max(1) as f64);
    println!("tiles {}, regions {}, bounds x {:.0}..{:.0} m, z {:.0}..{:.0} m", tile_meta.len(), index["regions"].as_array().unwrap().len(), lo[0], hi[0], lo[1], hi[1]);
    let attrs_bytes: u64 = std::fs::read_dir(ctx.out.join("attrs"))?.filter_map(|e| e.ok()?.metadata().ok()).map(|m| m.len()).sum();
    println!(
        "packs {:.1} MB, attrs {:.1} MB, index.json {:.2} MB",
        total_bytes as f64 / 1048576.0,
        attrs_bytes as f64 / 1048576.0,
        std::fs::metadata(ctx.out.join("index.json"))?.len() as f64 / 1048576.0
    );
    Ok(())
}

fn round1(v: f64) -> f64 {
    (v * 10.0).round() / 10.0
}

pub fn tile_origin(t: (i32, i32), tile_m: f64) -> [f32; 2] {
    [((t.0 as f64 + 0.5) * tile_m) as f32, ((t.1 as f64 + 0.5) * tile_m) as f32]
}

/// Remove previous tile outputs (only files this step writes).
fn clear_outputs(ctx: &Ctx) -> Result<()> {
    if ctx.out.join("models").exists() {
        std::fs::remove_dir_all(ctx.out.join("models"))?;
    }
    for dir in [ctx.out.clone(), ctx.out.join("attrs")] {
        let Ok(rd) = std::fs::read_dir(&dir) else { continue };
        for e in rd {
            let p = e?.path();
            let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("");
            let pack = p.file_name().and_then(|n| n.to_str()).is_some_and(|n| n.starts_with('r') && n.contains('_'));
            if p.is_file() && ((ext == "bin" && pack) || (ext == "json" && dir.ends_with("attrs"))) {
                std::fs::remove_file(p)?;
            }
        }
    }
    Ok(())
}

/// One building -> (tile, compact record), or None if nothing survives.
fn reduce(
    b: &Building, proj: &Proj, tile_m: f64, use_ground: bool, dem: Option<&Dem>, parts3d: Option<&crate::parts::Index>,
    landmarks: &[crate::landmarks::Landmark], st: &mut Stats,
) -> Option<((i32, i32), QB)> {
    // a landmark model standing in this building replaces the OSM parts it models
    let model = landmarks.iter().position(|l| b.parts.iter().any(|p| crate::geom::in_part(l.lonlat, p)));
    let modelled = |p: &crate::parts::Part3d| {
        model.is_some_and(|i| {
            let l = &landmarks[i];
            let (a, c) = (proj.fwd(p.c), proj.fwd(l.lonlat));
            (a[0] - c[0]).hypot(a[1] - c[1]) <= l.radius && p.min >= l.min_height
        })
    };
    let parts: Vec<Vec<Vec<[f64; 2]>>> = b
        .parts
        .iter()
        .map(|part| part.iter().map(|r| simplify_ring(r.iter().map(|&ll| proj.fwd(ll)))).collect())
        .collect();
    let c = centroid(&parts);
    let t = ((c[0] / tile_m).floor() as i32, (c[1] / tile_m).floor() as i32);
    let origin = tile_origin(t, tile_m);
    // Source ground if known, else the lowest DEM sample under the footprint
    // (centroid + outer vertices) so the building never floats.
    let from_dem = || {
        let dem = dem?;
        std::iter::once(c)
            .chain(parts.iter().filter_map(|p| p.first()).flatten().copied())
            .filter_map(|p| dem.at(p[0], p[1]))
            .reduce(f32::min)
    };
    // A source ground more than GROUND_TOL_M off the DEM is an error.
    let base = if use_ground {
        match (b.ground_m, from_dem()) {
            (Some(g), Some(d)) if (g - d).abs() > GROUND_TOL_M => {
                st.ground_fixed += 1;
                d
            }
            (g, d) => g.or(d).unwrap_or(0.0),
        }
    } else {
        0.0
    };
    // Roof-break sources carry their own per-part heights.
    let height = |i: usize| b.part_heights.get(i).copied().filter(|h| *h >= 2.0).unwrap_or(b.height);
    let own = |st: &mut Stats| parts.iter().enumerate().filter_map(|(i, rings)| quantize_part(rings, origin, height(i), base, st)).collect::<Vec<_>>();
    let extra = |ps: &[&crate::parts::Part3d], st: &mut Stats| -> Vec<Part> {
        ps.iter()
            .filter(|p| !modelled(p))
            .filter_map(|p| {
                // a part with no height of its own, standing on the ground, is as tall as the building
                let h = p.height.or((p.min < 0.5).then_some(b.height))?;
                let rings: Vec<Vec<[f64; 2]>> = p.rings.iter().map(|r| simplify_ring(r.iter().map(|&ll| proj.fwd(ll)))).collect();
                let mut q = quantize_part(&rings, origin, h, base, st)?;
                (q.min, q.shape, q.roof_h) = (dm(p.min.min(h - 0.5).max(0.0)), p.shape, dm(p.roof_h));
                Some(q)
            })
            .collect()
    };
    let qparts: Vec<Part> = match parts3d.map_or(crate::parts::Fit::None, |x| x.fit(b)) {
        crate::parts::Fit::None => own(st),
        crate::parts::Fit::Replace(ps) => {
            let q = extra(&ps, st);
            if q.is_empty() {
                own(st)
            } else {
                st.parts_replaced += 1;
                q
            }
        }
        crate::parts::Fit::Add(ps) => {
            let mut q = own(st);
            let add = extra(&ps, st);
            st.parts_added += !add.is_empty() as usize;
            q.extend(add);
            q
        }
    };
    if qparts.is_empty() {
        return None;
    }
    Some((
        t,
        QB {
            key: b.src_id.clone(),
            year: b.year,
            flags: b.flags(),
            period: b.period,
            floors: b.floors,
            use_class: b.use_class,
            parts: qparts,
            addr: b.addr.clone(),
            use_def: b.use_def.clone(),
            units: b.units,
            extra: b.extra.clone(),
            model,
            demolished: b.demolished,
            ysrc: b.year_src,
            hsrc: b.height_from,
            fsrc: b.footprint_src,
        },
    ))
}

/// Projected ring -> open ring simplified in metres.
fn simplify_ring(pts: impl Iterator<Item = [f64; 2]>) -> Vec<[f64; 2]> {
    let mut ls: Vec<Coord> = pts.map(|p| Coord { x: p[0], y: p[1] }).collect();
    if ls.is_empty() {
        return vec![];
    }
    if ls.first() != ls.last() {
        ls.push(ls[0]);
    }
    let (mut x0, mut y0, mut x1, mut y1) = (f64::MAX, f64::MAX, f64::MIN, f64::MIN);
    for c in &ls {
        x0 = x0.min(c.x); x1 = x1.max(c.x); y0 = y0.min(c.y); y1 = y1.max(c.y);
    }
    let eps = (((x1 - x0).hypot(y1 - y0)) * SIMPLIFY_FRAC).clamp(SIMPLIFY_MIN_M, SIMPLIFY_MAX_M);
    let s = LineString::new(ls).simplify(eps);
    let mut v: Vec<[f64; 2]> = s.0.iter().map(|c| [c.x, c.y]).collect();
    v.pop(); // closing vertex
    v
}

/// Metre rings -> tile-local decimetre rings with enforced orientation, plus
/// roof triangles. None if the outer ring is degenerate or a sliver.
fn quantize_part(rings: &[Vec<[f64; 2]>], origin: [f32; 2], height: f32, base: f32, st: &mut Stats) -> Option<Part> {
    let q = |r: &[[f64; 2]]| -> Option<Vec<[i16; 2]>> {
        let mut out: Vec<[i16; 2]> = Vec::with_capacity(r.len());
        for p in r {
            let x = ((p[0] - origin[0] as f64) * 10.0).round();
            let z = ((p[1] - origin[1] as f64) * 10.0).round();
            if x.abs() > 32767.0 || z.abs() > 32767.0 {
                return None; // part > 3.2 km from its tile centre: not a building
            }
            let v = [x as i16, z as i16];
            if out.last() != Some(&v) {
                out.push(v);
            }
        }
        while out.len() > 1 && out.first() == out.last() {
            out.pop();
        }
        (out.len() >= 3).then_some(out)
    };
    let m2 = |r: &[[i16; 2]]| area2_i(r) as f64 / 2.0 / 100.0;

    let mut outer = match rings.first().and_then(|r| q(r)) {
        Some(o) if m2(&o).abs() >= MIN_AREA_M2 => o,
        _ => {
            st.parts_dropped += 1;
            return None;
        }
    };
    if area2_i(&outer) < 0 {
        outer.reverse();
    }
    let mut out = vec![outer];
    for h in &rings[1..] {
        match q(h) {
            Some(mut h) if m2(&h).abs() >= MIN_AREA_M2 => {
                if area2_i(&h) > 0 {
                    h.reverse();
                }
                out.push(h);
            }
            _ => st.holes_dropped += 1,
        }
    }
    Some(Part { height: dm(height), base: dm(base), min: 0.0, shape: tilefmt::ROOF_FLAT, roof_h: 0.0, rings: out })
}

/// The tile stores decimetres: round here so maxH and the bboxes agree with what is written.
fn dm(v: f32) -> f32 {
    (v * 10.0).round() / 10.0
}

fn encode_tile(gid0: u32, origin: [f32; 2], qbs: &[QB], local: &[u8; 256]) -> Vec<u8> {
    let mut t = tilefmt::Tile { gid0, origin, ..Default::default() };
    t.part_start.push(0);
    t.ring_start.push(0);
    t.vert_start.push(0);
    for q in qbs {
        t.year.push(q.year);
        t.flag.push(q.flags);
        t.period.push(q.period);
        t.floors.push(q.floors);
        t.use_.push(q.use_class);
        t.year_src.push(local[q.ysrc as usize]);
        t.demolished.push(q.demolished);
        t.height_src.push(local[q.hsrc as usize]);
        for p in &q.parts {
            t.height.push(p.height);
            t.base.push(p.base);
            t.min_height.push(p.min);
            t.roof_shape.push(p.shape);
            t.roof_height.push(p.roof_h);
            for r in &p.rings {
                t.xz.extend(r.iter().flat_map(|v| [v[0], v[1]]));
                t.vert_start.push((t.xz.len() / 2) as u32);
            }
            t.ring_start.push((t.vert_start.len() - 1) as u32);
        }
        t.part_start.push((t.ring_start.len() - 1) as u32);
    }
    tilefmt::encode(&t)
}
