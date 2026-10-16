//! Per-city data sources. Each exposes `fetch(&Ctx)` and `join(&Ctx)`.

pub mod arcgis;
pub mod attach;
pub mod bay;
pub mod boston;
pub mod fema;
pub mod nsi;
pub mod http;
pub mod listings;
pub mod nyc;
pub mod pq;
pub mod sf;
pub mod wikidata;
