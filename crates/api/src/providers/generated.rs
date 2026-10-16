//! The layers built by `pipeline <city> layers`: `layers.json` + `layers.bin` (SCHEMA.md).

use super::{Item, LayerDef, LayerProvider, LayerSet, ProviderInfo};
use crate::city::City;
use anyhow::{bail, Context, Result};
use serde_json::Value;
use std::time::UNIX_EPOCH;

pub struct Generated;

impl LayerProvider for Generated {
    fn info(&self) -> ProviderInfo {
        ProviderInfo {
            id: "generated",
            name: "Open data",
            description: "Layers built by the pipeline from Wikidata, Overture and OSM (layers/<city>/*.json).",
            writable: false,
        }
    }

    fn version(&self, city: &City) -> u64 {
        let mtime = |f: &str| {
            std::fs::metadata(city.dir.join(f))
                .and_then(|m| m.modified())
                .map(|t| t.duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0))
                .unwrap_or(0)
        };
        mtime("layers.json") ^ mtime("layers.bin").rotate_left(17)
    }

    fn load(&self, city: &City) -> Result<LayerSet> {
        let jf = city.dir.join("layers.json");
        if !jf.exists() {
            return Ok(LayerSet::default());
        }
        let j: Value = serde_json::from_slice(&std::fs::read(&jf)?).context("layers.json")?;
        let bin = std::fs::read(city.dir.join("layers.bin")).context("layers.bin")?;
        if bin.len() < 12 || &bin[..4] != b"SFL2" {
            bail!("layers.bin: not SFL2");
        }
        let u32_at = |o: usize| u32::from_le_bytes(bin[o..o + 4].try_into().unwrap());
        let (nb, nl) = (u32_at(4) as usize, u32_at(8) as usize);
        let ls = 12 + nb * 8;
        let lk = ls + (nb + 1) * 4;
        if bin.len() < lk + nl * 4 {
            bail!("layers.bin truncated");
        }

        let layers_v = j["layers"].as_array().cloned().unwrap_or_default();
        let layers: Vec<LayerDef> = layers_v.iter().map(|l| serde_json::from_value(l.clone())).collect::<Result<_, _>>()?;
        let cols: Vec<String> = serde_json::from_value(j["itemColumns"].clone())?;
        let col = |k: &str| cols.iter().position(|c| c == k);
        let (c_layer, c_cat, c_name) = (col("layer").context("layer col")?, col("category").context("category col")?, col("name").context("name col")?);
        let sources: Vec<String> = serde_json::from_value(j["sources"].clone()).unwrap_or_default();
        let s = |r: &Value, k: &str| col(k).and_then(|i| r[i].as_str().map(str::to_string));
        let n = |r: &Value, k: &str| col(k).and_then(|i| r[i].as_i64().map(|v| v as i32));

        let rows = j["items"].as_array().cloned().unwrap_or_default();
        let mut items: Vec<Item> = Vec::with_capacity(rows.len());
        for (k, r) in rows.iter().enumerate() {
            let li = r[c_layer].as_u64().unwrap_or(0) as usize;
            let ci = r[c_cat].as_u64().unwrap_or(0) as usize;
            let (Some(layer), Some(cat)) = (layers.get(li), layers.get(li).and_then(|l| l.categories.get(ci))) else { continue };
            items.push(Item {
                id: format!("gen:{k}"),
                layer: layer.id.clone(),
                category: cat.id.clone(),
                name: r[c_name].as_str().unwrap_or_default().to_string(),
                role: s(r, "role"),
                from: n(r, "from"),
                to: n(r, "to"),
                url: s(r, "url"),
                note: s(r, "note"),
                wikidata: s(r, "wikidata"),
                source: col("source").and_then(|i| r[i].as_u64()).and_then(|i| sources.get(i as usize).cloned()).unwrap_or_default(),
                tags: col("tags").and_then(|i| serde_json::from_value(r[i].clone()).ok()).unwrap_or_default(),
                gids: Vec::new(),
                lonlat: None,
                author: None,
            });
        }
        // invert the building -> items CSR. Items were pushed in order, so index k is item k as
        // long as none was skipped; map through the id to be safe.
        let pos: std::collections::HashMap<usize, usize> =
            items.iter().enumerate().map(|(p, it)| (it.id[4..].parse::<usize>().unwrap(), p)).collect();
        for g in 0..nb {
            for e in u32_at(ls + g * 4)..u32_at(ls + (g + 1) * 4) {
                let k = u32_at(lk + e as usize * 4) as usize;
                if let Some(&p) = pos.get(&k) {
                    items[p].gids.push(g as u32);
                }
            }
        }
        Ok(LayerSet { layers, items })
    }
}
