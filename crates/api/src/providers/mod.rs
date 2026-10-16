//! Occupancy-layer providers: the extension point of the API.
//!
//! A provider contributes layers (with category trees) and items (an occupant of one or more
//! buildings, with years) for a city. The registry merges every provider into one view per
//! city, which is what the map and `/items` serve. To add a source — another dataset, a live
//! service, a team's shared marks — implement [`LayerProvider`] and register it in `main.rs`.
//! Providers that accept writes also implement [`ItemStore`].

pub mod generated;
pub mod geojson;
pub mod marks;

use crate::city::City;
use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub color: String,
    #[serde(default)]
    pub parent: Option<String>,
    /// Colour slot 0..63 in the map; assigned by the registry when a provider leaves it out.
    #[serde(default)]
    pub bit: Option<u32>,    /// Off in the map until the user turns it on.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub off: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LayerDef {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub licence: String,
    #[serde(default = "yes")]
    pub publishable: bool,
    pub categories: Vec<Category>,
}
fn yes() -> bool {
    true
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Item {
    /// Unique across providers, e.g. `gen:1234` or `mark:7`.
    pub id: String,
    pub layer: String,
    pub category: String,
    pub name: String,
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub from: Option<i32>,
    #[serde(default)]
    pub to: Option<i32>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub note: Option<String>,
    #[serde(default)]
    pub wikidata: Option<String>,
    #[serde(default)]
    pub source: String,
    #[serde(default)]
    pub tags: Vec<String>,
    /// Buildings this item occupies.
    pub gids: Vec<u32>,
    /// Where the item was placed, when the provider knows (marks do).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lonlat: Option<[f64; 2]>,
    /// Who made it, for items written through the API.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
}

#[derive(Default)]
pub struct LayerSet {
    pub layers: Vec<LayerDef>,
    pub items: Vec<Item>,
}

#[derive(Clone, Serialize)]
pub struct ProviderInfo {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub writable: bool,
}

pub trait LayerProvider: Send + Sync {
    fn info(&self) -> ProviderInfo;
    /// Changes whenever `load` would return something different (cache key).
    fn version(&self, city: &City) -> u64;
    fn load(&self, city: &City) -> Result<LayerSet>;
}

/// A new or edited item from a client. `layer`/`category` may name an existing layer's
/// category, or a new category (created in the store's own layer) via `categoryName`.
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemInput {
    #[serde(default)]
    pub layer: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub category_name: Option<String>,
    #[serde(default)]
    pub category_color: Option<String>,
    pub name: String,
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub from: Option<i32>,
    #[serde(default)]
    pub to: Option<i32>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub note: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub gid: Option<u32>,
    #[serde(default)]
    pub lonlat: Option<[f64; 2]>,
    /// set by the server from the request (X-Author header), not trusted from the body
    #[serde(skip)]
    pub author: Option<String>,
}

/// Writes for providers that accept them. Ids are the provider-local part of `Item::id`.
pub trait ItemStore: Send + Sync {
    fn list(&self, city: &str) -> Result<Vec<Item>>;
    fn create(&self, city: &str, input: ItemInput, gid: u32) -> Result<Item>;
    fn update(&self, city: &str, id: i64, input: ItemInput, gid: u32) -> Result<Option<Item>>;
    fn delete(&self, city: &str, id: i64) -> Result<bool>;
}
