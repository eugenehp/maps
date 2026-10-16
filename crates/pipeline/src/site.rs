//! `pipeline site [--out DIR] [--cities sf,nyc] [--include-local]`: assemble the static site
//! (GitHub Pages or any plain file host) from `web/` into `site/`.
//!
//! Static hosts compress HTML/JS/JSON on the fly but send `.bin` and `.wasm` as they are, and
//! cannot be told to send a precompressed file with `Content-Encoding`. So the site carries
//! binaries only as `name.bin.gz` / `threers_bg.wasm.gz`, which the browser unpacks itself
//! (`DecompressionStream`, see web/dataurl.js), and JSON raw. Every city's `index.json` gets a
//! content `version` (the `?v=` of its data URLs), `sw.js` the build's hash, and `index.html`
//! the list of cities (`window.__SITE`), so the page knows it has no API server.
//!
//! Cities whose manifest says `"publishable": false` (sources for local use only) are left out
//! unless `--include-local` is given: everything in the site is public. So are occupancy layers
//! marked `publishable: false`: they are taken out of the published `layers.json` / `layers.bin`.

use anyhow::{bail, Context, Result};
use rayon::prelude::*;
use serde_json::{json, Value};
use std::io::Write;
use std::path::{Path, PathBuf};

/// Hard limit of a file in a GitHub repository, and the size GitHub Pages sites should stay under.
const FILE_LIMIT: u64 = 100 << 20;
const SITE_LIMIT: u64 = 1 << 30;
const MARKER: &str = ".site-build";

struct Opts {
    out: PathBuf,
    cities: Option<Vec<String>>,
    include_local: bool,
}

fn parse(args: &[String], root: &Path) -> Result<Opts> {
    let mut o = Opts { out: root.join("site"), cities: None, include_local: false };
    let mut it = args.iter();
    while let Some(a) = it.next() {
        match a.as_str() {
            "--out" => o.out = PathBuf::from(it.next().context("--out DIR")?),
            "--cities" => o.cities = Some(it.next().context("--cities a,b")?.split(',').map(str::to_string).collect()),
            "--include-local" => o.include_local = true,
            _ => bail!("site: unknown argument {a:?} (usage: pipeline site [--out DIR] [--cities a,b] [--include-local])"),
        }
    }
    Ok(o)
}

/// FNV-1a, for content versions (cache busting, not security).
fn fnv(h: &mut u64, bytes: &[u8]) {
    for &b in bytes {
        *h = (*h ^ b as u64).wrapping_mul(0x100000001b3);
    }
}
fn short(h: u64) -> String {
    format!("{:012x}", h & 0xffff_ffff_ffff)
}

fn gzip(data: &[u8]) -> Result<Vec<u8>> {
    let mut g = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::best());
    g.write_all(data)?;
    Ok(g.finish()?)
}

fn newer(src: &Path, dst: &Path) -> bool {
    let m = |p: &Path| std::fs::metadata(p).and_then(|m| m.modified()).ok();
    !matches!((m(src), m(dst)), (Some(a), Some(b)) if b >= a)
}

fn walk(dir: &Path, out: &mut Vec<PathBuf>) -> Result<()> {
    for e in std::fs::read_dir(dir)? {
        let p = e?.path();
        if p.is_dir() {
            walk(&p, out)?;
        } else {
            out.push(p);
        }
    }
    Ok(())
}

/// What a file under `src` becomes in the site: `None` to leave it out.
enum Kind {
    Copy,
    Gzip,
}
fn kind(p: &Path) -> Option<Kind> {
    match p.extension().and_then(|e| e.to_str())? {
        "br" | "gz" => None,
        "bin" | "wasm" | "glb" => Some(Kind::Gzip),
        _ => Some(Kind::Copy),
    }
}

/// Copy (or gzip) every file of `src` into `dst`; returns (files, hash of the content written).
/// Takes an existing `.gz` next to the source when it is up to date (`pipeline compress`).
fn mirror(src: &Path, dst: &Path, skip: &dyn Fn(&Path) -> bool) -> Result<(Vec<(PathBuf, u64)>, u64)> {
    let mut files = Vec::new();
    walk(src, &mut files)?;
    files.retain(|f| !skip(f.strip_prefix(src).unwrap()));
    files.sort();
    let done: Vec<(PathBuf, u64, u64)> = files
        .par_iter()
        .filter_map(|f| kind(f).map(|k| (f, k)))
        .map(|(f, k)| -> Result<(PathBuf, u64, u64)> {
            let rel = f.strip_prefix(src).unwrap();
            let (to, bytes) = match k {
                Kind::Copy => (dst.join(rel), std::fs::read(f)?),
                Kind::Gzip => {
                    let pre = PathBuf::from(format!("{}.gz", f.display()));
                    let b = if pre.exists() && !newer(f, &pre) { std::fs::read(&pre)? } else { gzip(&std::fs::read(f)?)? };
                    (dst.join(format!("{}.gz", rel.display())), b)
                }
            };
            std::fs::create_dir_all(to.parent().unwrap())?;
            std::fs::write(&to, &bytes)?;
            let mut h = 0xcbf29ce484222325u64;
            fnv(&mut h, rel.to_string_lossy().as_bytes());
            fnv(&mut h, &bytes);
            Ok((to, bytes.len() as u64, h))
        })
        .collect::<Result<_>>()?;
    let mut h = 0xcbf29ce484222325u64;
    for (_, _, fh) in &done {
        fnv(&mut h, &fh.to_le_bytes());
    }
    Ok((done.into_iter().map(|(p, n, _)| (p, n)).collect(), h))
}

/// layers.json + layers.bin (layers/SCHEMA.md) without the layers marked `publishable: false`,
/// and the names of those left out; None when every layer may be published.
fn public_layers(dir: &Path) -> Result<Option<(Vec<u8>, Vec<u8>, Vec<String>)>> {
    let Ok(raw) = std::fs::read(dir.join("layers.json")) else { return Ok(None) };
    let mut j: Value = serde_json::from_slice(&raw)?;
    let layers = j["layers"].as_array().context("layers.json: layers")?.clone();
    if layers.iter().all(|l| l["publishable"] != json!(false)) {
        return Ok(None);
    }
    // old layer index -> new; the category bits of dropped layers are cleared from every mask
    let (mut keep, mut drop_bits, mut dropped, mut kept) = (Vec::new(), 0u64, Vec::new(), Vec::new());
    for l in &layers {
        if l["publishable"] == json!(false) {
            keep.push(None);
            dropped.push(l["name"].as_str().unwrap_or("?").to_string());
            for c in l["categories"].as_array().into_iter().flatten() {
                drop_bits |= 1u64 << c["bit"].as_u64().context("category bit")?;
            }
        } else {
            keep.push(Some(kept.len()));
            kept.push(l.clone());
        }
    }
    let items = j["items"].as_array().context("layers.json: items")?;
    let mut new_idx: Vec<Option<u32>> = Vec::with_capacity(items.len());
    let mut new_items = Vec::new();
    for it in items {
        match keep.get(it[0].as_u64().unwrap_or(u64::MAX) as usize).copied().flatten() {
            Some(li) => {
                let mut it = it.clone();
                it[0] = json!(li);
                new_idx.push(Some(new_items.len() as u32));
                new_items.push(it);
            }
            None => new_idx.push(None),
        }
    }
    j["layers"] = json!(kept);
    j["items"] = json!(new_items);

    let b = std::fs::read(dir.join("layers.bin"))?;
    let u32_at = |i: usize| u32::from_le_bytes(b[i..i + 4].try_into().unwrap());
    if b.len() < 12 || &b[..4] != b"SFL2" {
        bail!("{}: not an SFL2 layers.bin", dir.display());
    }
    let nb = u32_at(4) as usize;
    let (mask0, start0) = (12, 12 + 8 * nb);
    let link0 = start0 + 4 * (nb + 1);
    let mut out = Vec::with_capacity(b.len());
    out.extend_from_slice(b"SFL2");
    let mut links: Vec<Vec<u32>> = Vec::with_capacity(nb);
    for g in 0..nb {
        let (s, e) = (u32_at(start0 + 4 * g) as usize, u32_at(start0 + 4 * (g + 1)) as usize);
        links.push((s..e).filter_map(|k| new_idx[u32_at(link0 + 4 * k) as usize]).collect());
    }
    out.extend_from_slice(&(nb as u32).to_le_bytes());
    out.extend_from_slice(&(links.iter().map(Vec::len).sum::<usize>() as u32).to_le_bytes());
    for g in 0..nb {
        let m = (u32_at(mask0 + 8 * g) as u64 | (u32_at(mask0 + 8 * g + 4) as u64) << 32) & !drop_bits;
        out.extend_from_slice(&(m as u32).to_le_bytes());
        out.extend_from_slice(&((m >> 32) as u32).to_le_bytes());
    }
    let mut acc = 0u32;
    out.extend_from_slice(&0u32.to_le_bytes());
    for l in &links {
        acc += l.len() as u32;
        out.extend_from_slice(&acc.to_le_bytes());
    }
    for l in &links {
        for i in l {
            out.extend_from_slice(&i.to_le_bytes());
        }
    }
    Ok(Some((serde_json::to_vec(&j)?, out, dropped)))
}

pub fn run(args: &[String]) -> Result<()> {
    let root = std::env::var_os("SF_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../.."));
    let root = root.canonicalize().unwrap_or(root);
    let web = root.join("web");
    let o = parse(args, &root)?;

    // start from an empty directory, but only ever delete one this step made
    if o.out.exists() {
        let empty = std::fs::read_dir(&o.out)?.next().is_none();
        if !empty && !o.out.join(MARKER).exists() {
            bail!("{} exists and was not made by `pipeline site`; pick another --out or remove it", o.out.display());
        }
        std::fs::remove_dir_all(&o.out)?;
    }
    std::fs::create_dir_all(&o.out)?;
    std::fs::write(o.out.join(MARKER), "made by `pipeline site`; deleted and rebuilt by it\n")?;
    // no Jekyll on GitHub Pages: serve the files as they are
    std::fs::write(o.out.join(".nojekyll"), "")?;

    // ---- cities ----
    let mut cities = Vec::new();
    let mut ids: Vec<String> = std::fs::read_dir(web.join("data"))?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().join("index.json").exists())
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .collect();
    // the app's order (web/app.js CITIES), then the rest by name
    let rank = |c: &str| ["sf", "bay", "nyc", "boston"].iter().position(|k| *k == c).unwrap_or(99);
    ids.sort_by(|a, b| rank(a).cmp(&rank(b)).then(a.cmp(b)));
    if let Some(want) = &o.cities {
        for c in want {
            if !ids.contains(c) {
                bail!("no built city {c:?} in web/data (have {})", ids.join(", "));
            }
        }
        ids.retain(|c| want.contains(c));
    }
    let mut written: Vec<(PathBuf, u64)> = Vec::new();
    for id in &ids {
        let src = web.join("data").join(id);
        let mut m: Value = serde_json::from_slice(&std::fs::read(src.join("index.json"))?)?;
        if m["publishable"] == json!(false) && !o.include_local {
            let local: Vec<&str> = m["sources"]
                .as_array()
                .map(|s| s.iter().filter(|s| s["publishable"] == json!(false)).filter_map(|s| s["name"].as_str()).collect())
                .unwrap_or_default();
            println!("  {id}: left out — sources for local use only: {}", local.join("; "));
            continue;
        }
        let dst = o.out.join("data").join(id);
        // occupancy layers for local use only are taken out of layers.json / layers.bin
        let layers = if o.include_local { None } else { public_layers(&src)? };
        let skip = |rel: &Path| {
            rel == Path::new("index.json") || (layers.is_some() && (rel == Path::new("layers.json") || rel == Path::new("layers.bin")))
        };
        let (mut files, mut h) = mirror(&src, &dst, &skip)?;
        if let Some((lj, lb, dropped)) = &layers {
            let lb = gzip(lb)?;
            for (name, bytes) in [("layers.json", lj), ("layers.bin.gz", &lb)] {
                std::fs::write(dst.join(name), bytes)?;
                fnv(&mut h, name.as_bytes());
                fnv(&mut h, bytes);
                files.push((dst.join(name), bytes.len() as u64));
            }
            println!("  {id}: layers for local use only left out: {}", dropped.join(", "));
        }
        // the manifest names the version of everything else
        m["version"] = json!(short(h));
        let bytes = serde_json::to_vec(&m)?;
        std::fs::write(dst.join("index.json"), &bytes)?;
        let total: u64 = files.iter().map(|f| f.1).sum::<u64>() + bytes.len() as u64;
        println!("  {id}: {} files, {:.1} MB, version {}", files.len() + 1, total as f64 / 1048576.0, short(h));
        written.extend(files);
        written.push((dst.join("index.json"), bytes.len() as u64));
        cities.push(json!({ "id": id, "name": m["short"].as_str().or(m["name"].as_str()).unwrap_or(id), "count": m["count"] }));
    }
    if cities.is_empty() {
        bail!("no city to publish");
    }

    // ---- the app ----
    let shell_skip = |rel: &Path| {
        let top = rel.components().next().map(|c| c.as_os_str().to_string_lossy().into_owned()).unwrap_or_default();
        let name = rel.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        matches!(top.as_str(), "data" | "tools" | "shots" | ".threers-build")
            || name.starts_with('.')
            || name.ends_with(".sh")
            || name == "index.html"
            || name == "sw.js"
    };
    let (files, shell_hash) = mirror(&web, &o.out, &shell_skip)?;
    written.extend(files);
    // index.html: the cities, static mode, gzipped binaries
    let html = std::fs::read_to_string(web.join("index.html"))?;
    let site = json!({ "static": true, "gz": true, "cities": cities });
    let marker = "window.__SITE = null;";
    if !html.contains(marker) {
        bail!("web/index.html has no `{marker}` line to fill in");
    }
    let html = html.replace(marker, &format!("window.__SITE = {site};"));
    let mut h = shell_hash;
    fnv(&mut h, html.as_bytes());
    for c in &cities {
        fnv(&mut h, c.to_string().as_bytes());
    }
    std::fs::write(o.out.join("index.html"), &html)?;
    let sw = std::fs::read_to_string(web.join("sw.js"))?.replace("__BUILD__", &short(h));
    std::fs::write(o.out.join("sw.js"), &sw)?;
    written.push((o.out.join("index.html"), html.len() as u64));
    written.push((o.out.join("sw.js"), sw.len() as u64));

    // ---- limits ----
    let total: u64 = written.iter().map(|f| f.1).sum();
    let (big, big_n) = written.iter().max_by_key(|f| f.1).map(|f| (f.0.clone(), f.1)).unwrap();
    println!(
        "site: {} files, {:.1} MB in {} (largest {} at {:.1} MB), build {}",
        written.len(), total as f64 / 1048576.0, o.out.display(),
        big.strip_prefix(&o.out).unwrap_or(&big).display(), big_n as f64 / 1048576.0, short(h)
    );
    if let Some((f, n)) = written.iter().find(|f| f.1 > FILE_LIMIT) {
        bail!("{} is {:.0} MB: GitHub refuses files over 100 MB", f.display(), *n as f64 / 1048576.0);
    }
    if total > SITE_LIMIT {
        println!("warning: {:.0} MB is over the 1 GB GitHub Pages sites should stay under", total as f64 / 1048576.0);
    }
    Ok(())
}
