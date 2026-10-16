//! `compress`: write `.br` (brotli 11) and `.gz` (gzip 9) next to every data file of the city,
//! so the server sends them as they are instead of compressing on every request. Browsers only
//! take brotli over HTTPS; plain-HTTP clients (a LAN address) get the gzip copy.

use crate::city::Ctx;
use anyhow::Result;
use rayon::prelude::*;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

fn walk(dir: &Path, out: &mut Vec<PathBuf>) -> Result<()> {
    for e in std::fs::read_dir(dir)? {
        let p = e?.path();
        if p.is_dir() {
            walk(&p, out)?;
        } else if matches!(p.extension().and_then(|e| e.to_str()), Some("bin" | "json")) {
            out.push(p);
        }
    }
    Ok(())
}

fn fresh(src: &Path, dst: &Path) -> bool {
    let m = |p: &Path| std::fs::metadata(p).and_then(|m| m.modified()).ok();
    matches!((m(src), m(dst)), (Some(a), Some(b)) if b >= a)
}

pub fn run(ctx: &Ctx) -> Result<()> {
    let mut files = Vec::new();
    walk(&ctx.out, &mut files)?;
    let (raw, br, gz, skipped) = (AtomicU64::new(0), AtomicU64::new(0), AtomicU64::new(0), AtomicU64::new(0));
    files.par_iter().try_for_each(|f| -> Result<()> {
        let data = std::fs::read(f)?;
        raw.fetch_add(data.len() as u64, Ordering::Relaxed);
        let (fb, fg) = (f.with_extension(format!("{}.br", f.extension().unwrap().to_str().unwrap())), f.with_extension(format!("{}.gz", f.extension().unwrap().to_str().unwrap())));
        if fresh(f, &fb) && fresh(f, &fg) {
            skipped.fetch_add(1, Ordering::Relaxed);
            br.fetch_add(std::fs::metadata(&fb)?.len(), Ordering::Relaxed);
            gz.fetch_add(std::fs::metadata(&fg)?.len(), Ordering::Relaxed);
            return Ok(());
        }
        let mut b = Vec::new();
        {
            let mut w = brotli::CompressorWriter::new(&mut b, 1 << 16, 11, 22);
            w.write_all(&data)?;
        }
        let mut g = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::best());
        g.write_all(&data)?;
        let g = g.finish()?;
        br.fetch_add(b.len() as u64, Ordering::Relaxed);
        gz.fetch_add(g.len() as u64, Ordering::Relaxed);
        std::fs::write(&fb, b)?;
        std::fs::write(&fg, g)?;
        Ok(())
    })?;
    let mb = |a: &AtomicU64| a.load(Ordering::Relaxed) as f64 / 1048576.0;
    println!(
        "{} files ({} up to date): {:.1} MB raw, {:.1} MB brotli, {:.1} MB gzip",
        files.len(), skipped.load(Ordering::Relaxed), mb(&raw), mb(&br), mb(&gz)
    );
    Ok(())
}
