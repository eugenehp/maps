//! Building-by-building city data pipeline.
//!
//! cargo run --release -p pipeline -- <city> <fetch|join|years|ground|tiles|layers|verify|compress|all>
//!
//!   fetch  -> cache/<city>/...           (raw downloads, resumable)
//!   join   -> cache/<city>/joined.bin    (common Building records)
//!   years  -> cache/<city>/buildings.bin (cleaned year/height/floors/period)
//!   ground -> web/data/<city>/{terrain.json, terrain/*.bin, land.bin, water.bin, parks.bin}
//!   tiles  -> web/data/<city>/{index.json, r*.bin, attrs/*.json, FORMAT.md}
//!   layers -> layers/<city>/*.json (generated), web/data/<city>/{layers.json, layers.bin}
//!   verify    re-reads web/data/<city> and checks invariants
//!   compress  writes .br/.gz next to the city's data files (for the API server)
//!
//! cargo run --release -p pipeline -- site [--out DIR] [--cities a,b] [--include-local]
//!
//!   site   -> site/ (the static site for GitHub Pages: app, gzipped binaries, publishable cities)

mod compress;
mod datacenters;
mod city;
mod classify;
mod geom;
mod ground;
mod landmarks;
mod layers;
mod model;
mod parts;
mod neurotech;
mod site;
mod sources;
mod store;
mod tiles;
mod verify;
mod years;

use anyhow::{bail, Result};
use city::Ctx;
use std::time::Instant;

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.first().map(String::as_str) == Some("site") {
        return site::run(&args[1..]);
    }
    let (Some(city), Some(step)) = (args.first(), args.get(1)) else {
        bail!("usage: pipeline <city> <fetch|join|years|ground|tiles|layers|verify|compress|all>, or pipeline site [--out DIR] [--cities a,b] [--include-local]");
    };
    let ctx = Ctx::new(city)?;
    let t0 = Instant::now();
    let run = |name: &str, f: fn(&Ctx) -> Result<()>| -> Result<()> {
        let t = Instant::now();
        println!("== {} {name}", ctx.city.id);
        f(&ctx)?;
        println!("== {} {name} done in {:.1}s\n", ctx.city.id, t.elapsed().as_secs_f64());
        Ok(())
    };
    let steps: &[(&str, fn(&Ctx) -> Result<()>)] = &[
        ("fetch", ctx.city.fetch),
        ("join", ctx.city.join),
        ("years", years::run),
        ("ground", ground::run),
        ("tiles", tiles::run),
        ("layers", layers::run),
        ("verify", verify::run),
        ("compress", compress::run),
    ];
    match steps.iter().find(|(n, _)| n == step) {
        Some((n, f)) => run(n, *f)?,
        None if step == "all" => {
            for (n, f) in steps {
                run(n, *f)?;
            }
        }
        None => bail!("unknown step {step:?}"),
    }
    println!("total {:.1}s", t0.elapsed().as_secs_f64());
    Ok(())
}
