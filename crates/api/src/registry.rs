//! Merges every provider's layers into one view per city, cached until a provider's version
//! changes. Layers with the same id from different providers are one layer (marks can sit in
//! the `startups` layer next to the generated items); colour slots (bits) are assigned here.

use crate::city::City;
use crate::providers::{Category, Item, LayerDef, LayerProvider, ProviderInfo};
use crate::providers::marks::LAYER as MINE;
use anyhow::Result;
use parking_lot::Mutex;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;

pub const MAX_BITS: u32 = 64;

pub struct Merged {
    pub version: u64,
    pub layers: Vec<MergedLayer>,
    pub items: Vec<Item>,
    /// building -> item indices (CSR)
    pub link_start: Vec<u32>,
    pub link: Vec<u32>,
}

pub struct MergedLayer {
    pub def: LayerDef,
    pub provider: &'static str,
    pub writable: bool,
}

impl Merged {
    pub fn layer(&self, id: &str) -> Option<(usize, &MergedLayer)> {
        self.layers.iter().enumerate().find(|(_, l)| l.def.id == id)
    }
    pub fn items_of(&self, gid: u32) -> impl Iterator<Item = &Item> {
        let g = gid as usize;
        let r = if g + 1 < self.link_start.len() { self.link_start[g] as usize..self.link_start[g + 1] as usize } else { 0..0 };
        self.link[r].iter().map(|&k| &self.items[k as usize])
    }

    /// The compact form the map loads: items as rows, layer/category as indices.
    pub fn client_json(&self, providers: &[ProviderInfo]) -> Value {
        let cat_index: HashMap<(&str, &str), (usize, usize)> = self
            .layers
            .iter()
            .enumerate()
            .flat_map(|(li, l)| l.def.categories.iter().enumerate().map(move |(ci, c)| ((l.def.id.as_str(), c.id.as_str()), (li, ci))))
            .collect();
        let rows: Vec<Value> = self
            .items
            .iter()
            .map(|it| {
                let (li, ci) = cat_index[&(it.layer.as_str(), it.category.as_str())];
                json!([it.id, li, ci, it.name, it.role, it.from, it.to, it.url, it.note, it.wikidata, it.source, it.tags])
            })
            .collect();
        json!({
            "version": self.version.to_string(),
            "providers": providers,
            "layers": self.layers.iter().map(|l| {
                let mut v = serde_json::to_value(&l.def).unwrap();
                v["provider"] = json!(l.provider);
                v["writable"] = json!(l.writable);
                v
            }).collect::<Vec<_>>(),
            "itemColumns": ["id", "layer", "category", "name", "role", "from", "to", "url", "note", "wikidata", "source", "tags"],
            "items": rows,
            "linksUrl": "layers/links.bin",
        })
    }

    /// `SFL3`: u32 nB, u32 nLinks, linkStart u32[nB+1], link u32[nLinks] (item row indices).
    pub fn links_bin(&self) -> Vec<u8> {
        let nb = self.link_start.len().saturating_sub(1) as u32;
        let mut out = Vec::with_capacity(12 + 4 * (self.link_start.len() + self.link.len()));
        out.extend_from_slice(b"SFL3");
        out.extend_from_slice(&nb.to_le_bytes());
        out.extend_from_slice(&(self.link.len() as u32).to_le_bytes());
        for v in self.link_start.iter().chain(&self.link) {
            out.extend_from_slice(&v.to_le_bytes());
        }
        out
    }
}

pub struct Registry {
    pub providers: Vec<Arc<dyn LayerProvider>>,
    cache: Mutex<HashMap<String, Arc<Merged>>>,
}

impl Registry {
    pub fn new(providers: Vec<Arc<dyn LayerProvider>>) -> Registry {
        Registry { providers, cache: Mutex::new(HashMap::new()) }
    }

    pub fn infos(&self) -> Vec<ProviderInfo> {
        self.providers.iter().map(|p| p.info()).collect()
    }

    fn version(&self, city: &City) -> u64 {
        self.providers.iter().fold(0xcbf2_9ce4_8422_2325, |h, p| (h ^ p.version(city)).wrapping_mul(0x100_0000_01b3))
    }

    pub fn merged(&self, city: &City) -> Result<Arc<Merged>> {
        let v = self.version(city);
        if let Some(m) = self.cache.lock().get(&city.id) {
            if m.version == v {
                return Ok(m.clone());
            }
        }
        let m = Arc::new(self.merge(city, v)?);
        self.cache.lock().insert(city.id.clone(), m.clone());
        Ok(m)
    }

    fn merge(&self, city: &City, version: u64) -> Result<Merged> {
        let mut layers: Vec<MergedLayer> = Vec::new();
        let mut items: Vec<Item> = Vec::new();
        for p in &self.providers {
            let info = p.info();
            let set = p.load(city)?;
            for l in set.layers {
                match layers.iter_mut().find(|m| m.def.id == l.id) {
                    Some(m) => {
                        for c in l.categories {
                            if !m.def.categories.iter().any(|x| x.id == c.id) {
                                m.def.categories.push(c);
                            }
                        }
                        m.writable |= info.writable;
                    }
                    None => layers.push(MergedLayer { def: l, provider: info.id, writable: info.writable }),
                }
            }
            items.extend(set.items);
        }
        // an item whose category no longer exists (say a mark in a category the pipeline dropped)
        // keeps its colour in a category of its own in `mine`
        for it in items.iter_mut() {
            let ok = layers.iter().any(|l| l.def.id == it.layer && l.def.categories.iter().any(|c| c.id == it.category));
            if ok {
                continue;
            }
            let name = format!("{} › {}", it.layer, it.category);
            let li = match layers.iter().position(|l| l.def.id == MINE) {
                Some(i) => i,
                None => {
                    layers.push(MergedLayer {
                        def: LayerDef { id: MINE.into(), name: "My marks".into(), description: String::new(), licence: "yours".into(), publishable: true, categories: vec![] },
                        provider: "marks",
                        writable: true,
                    });
                    layers.len() - 1
                }
            };
            let cid = format!("{}-{}", it.layer, it.category);
            if !layers[li].def.categories.iter().any(|c| c.id == cid) {
                layers[li].def.categories.push(Category { id: cid.clone(), name, color: "#888888".into(), parent: None, bit: None, off: false });
            }
            it.layer = MINE.into();
            it.category = cid;
        }
        // colour slots: keep the providers' bits, hand out free ones to the rest
        let mut used = [false; MAX_BITS as usize];
        for c in layers.iter().flat_map(|l| &l.def.categories) {
            if let Some(b) = c.bit.filter(|&b| b < MAX_BITS) {
                used[b as usize] = true;
            }
        }
        for c in layers.iter_mut().flat_map(|l| l.def.categories.iter_mut()) {
            if c.bit.is_none() {
                if let Some(b) = used.iter().position(|u| !u) {
                    used[b] = true;
                    c.bit = Some(b as u32);
                }
            }
        }
        // building -> items
        let nb = city.count as usize;
        let mut counts = vec![0u32; nb + 1];
        for it in &items {
            for &g in &it.gids {
                if (g as usize) < nb {
                    counts[g as usize + 1] += 1;
                }
            }
        }
        for i in 1..=nb {
            counts[i] += counts[i - 1];
        }
        let link_start = counts.clone();
        let mut fill = counts;
        let mut link = vec![0u32; link_start[nb] as usize];
        for (k, it) in items.iter().enumerate() {
            for &g in &it.gids {
                if (g as usize) < nb {
                    link[fill[g as usize] as usize] = k as u32;
                    fill[g as usize] += 1;
                }
            }
        }
        Ok(Merged { version, layers, items, link_start, link })
    }
}
