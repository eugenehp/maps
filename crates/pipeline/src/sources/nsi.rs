//! USACE National Structure Inventory (public domain): one point per
//! structure with `num_story` and `med_yr_blt` (the census-area median
//! build year, not the building's). Downloaded as a state GeoPackage and
//! cut to the city bbox with DuckDB into `cache/<city>/nsi.parquet`.

use super::http::agent;
use crate::city::Ctx;
use anyhow::{bail, Context, Result};
use std::process::Command;

const URL: &str = "https://nsi.sec.usace.army.mil/downloads/nsi_2022";

pub fn fetch(ctx: &Ctx, state_fips: &str) -> Result<()> {
    let out = ctx.cache.join("nsi.parquet");
    if out.exists() {
        println!("nsi: cached {}", out.display());
        return Ok(());
    }
    let dir = ctx.cache.parent().unwrap().join("nsi");
    std::fs::create_dir_all(&dir)?;
    let zip = dir.join(format!("nsi_2022_{state_fips}.gpkg.zip"));
    if !zip.exists() {
        println!("nsi: downloading state {state_fips} (~0.2-1 GB)...");
        let r = agent().get(&format!("{URL}/nsi_2022_{state_fips}.gpkg.zip")).call()?;
        let tmp = zip.with_extension("part");
        std::io::copy(&mut r.into_reader(), &mut std::fs::File::create(&tmp)?)?;
        std::fs::rename(&tmp, &zip)?;
    }
    let gpkg = dir.join(format!("nsi_2022_{state_fips}.gpkg"));
    if !gpkg.exists() {
        let st = Command::new("unzip").arg("-o").arg(&zip).arg("-d").arg(&dir).status().context("unzip")?;
        if !st.success() || !gpkg.exists() {
            bail!("unzip of {} failed or no {}", zip.display(), gpkg.display());
        }
    }
    let [w, s, e, n] = ctx.city.bbox;
    let tmp = out.with_extension("tmp");
    let sql = format!(
        "LOAD spatial; SET enable_progress_bar=false;
         COPY (SELECT x, y, num_story, med_yr_blt, occtype FROM ST_Read('{}')
               WHERE x BETWEEN {w} AND {e} AND y BETWEEN {s} AND {n})
         TO '{}' (FORMAT parquet, COMPRESSION zstd);",
        gpkg.display(),
        tmp.display()
    );
    if !Command::new("duckdb").arg("-c").arg(&sql).status()?.success() {
        bail!("duckdb NSI extract failed");
    }
    std::fs::rename(&tmp, &out)?;
    println!("nsi: wrote {}", out.display());
    Ok(())
}
