//! HTTP API over the city data: buildings, occupancy layers from pluggable providers, and
//! user marks. `main.rs` is the server binary; tests build the same router in-process.

pub mod city;
pub mod providers;
pub mod registry;
pub mod server;
pub mod spatial;

use anyhow::{Context, Result};
use providers::{generated::Generated, geojson::{GeoJson, GeoJsonConf}, marks::Marks, LayerProvider};
use serde::Deserialize;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

/// `api.json`: optional; everything has a default.
#[derive(Deserialize, Default)]
#[serde(deny_unknown_fields)]
pub struct Config {
    /// extra providers, merged after the generated layers and before marks
    #[serde(default)]
    pub providers: Vec<ProviderConf>,
    /// writes need `Authorization: Bearer <token>` (also `API_TOKEN` in the environment)
    #[serde(default)]
    pub token: Option<String>,
}

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum ProviderConf {
    Geojson(GeoJsonConf),
}

impl Config {
    /// Read `path`; paths inside are relative to the file's directory.
    pub fn load(path: &Path) -> Result<Config> {
        let mut c: Config = serde_json::from_slice(&std::fs::read(path)?).with_context(|| format!("{}", path.display()))?;
        let base = path.parent().unwrap_or(Path::new("."));
        for p in &mut c.providers {
            let ProviderConf::Geojson(g) = p;
            if g.path.is_relative() {
                g.path = base.join(&g.path);
            }
        }
        Ok(c)
    }
}

pub struct Options {
    pub data: PathBuf,
    pub db: PathBuf,
    pub config: Config,
    pub log: bool,
}

/// Open every city under `data`, the providers, and the marks database.
pub fn build(o: Options) -> Result<Arc<server::App>> {
    let mut cities = BTreeMap::new();
    for e in std::fs::read_dir(&o.data).with_context(|| format!("{}", o.data.display()))? {
        let p = e?.path();
        if p.join("index.json").exists() {
            let id = p.file_name().unwrap().to_string_lossy().to_string();
            match city::City::open(&id, &p) {
                Ok(c) => {
                    cities.insert(id, Arc::new(c));
                }
                Err(e) => eprintln!("skip {id}: {e:#}"),
            }
        }
    }
    let marks = Arc::new(Marks::open(&o.db)?);
    // order matters: a later provider's layer with an existing id joins that layer
    let mut providers: Vec<Arc<dyn LayerProvider>> = vec![Arc::new(Generated)];
    for p in o.config.providers {
        match p {
            ProviderConf::Geojson(g) => {
                if !cities.contains_key(&g.city) {
                    eprintln!("provider {}: no city '{}', skipped", g.id, g.city);
                    continue;
                }
                providers.push(Arc::new(GeoJson::new(g)));
            }
        }
    }
    providers.push(marks.clone());
    let token = o.config.token.or_else(|| std::env::var("API_TOKEN").ok()).filter(|t| !t.is_empty());
    let (events, _) = tokio::sync::broadcast::channel(64);
    Ok(Arc::new(server::App { cities, registry: registry::Registry::new(providers), marks, token, events, log: o.log }))
}
