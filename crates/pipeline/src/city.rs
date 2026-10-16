//! City registry. A city = config + its own `fetch` and `join`, which must
//! write `cache/<city>/joined.bin` (common `Building` records). `years`,
//! `tiles` and `verify` are shared.
//!
//! Adding a city (e.g. nyc, boston): write `sources/<city>.rs` with
//! `fetch(&Ctx)` (download into `ctx.cache`, resumable) and `join(&Ctx)`
//! (emit Buildings with a new DATASETS entry so year cleaning stays
//! per-dataset), then add a `City` below with its origin, bbox, tile size
//! and period set (`GENERIC_PERIODS` unless the city has its own story).

use crate::model::*;
use crate::sources;
use anyhow::{bail, Result};
use std::path::PathBuf;

pub struct City {
    pub id: &'static str,
    pub name: &'static str,
    /// Projection origin (lon, lat). Bay shares SF's so the frames line up.
    pub origin: [f64; 2],
    /// Rough lon/lat bbox (w, s, e, n) used for source queries.
    pub bbox: [f64; 4],
    pub tile_m: f64,
    /// Tiles per region side; a region is the unit of packs + attrs files.
    pub region_tiles: i32,
    pub periods: &'static [Period],
    /// Write per-part ground elevation as `base`; otherwise base = 0.
    pub use_ground: bool,
    /// Attribution beyond the per-source ones (index.json joins both).
    pub attribution: &'static str,
    /// Per-field source priority (SOURCES indices): the first listed source
    /// with a valid value wins; unlisted sources are cross-checks only.
    pub year_priority: &'static [u8],
    pub height_priority: &'static [u8],
    pub floors_priority: &'static [u8],
    /// Terrain grid cell and ground-layer simplification (m).
    pub ground_cell_m: f64,
    pub ground_simplify_m: f64,
    pub fetch: fn(&Ctx) -> Result<()>,
    pub join: fn(&Ctx) -> Result<()>,
}

pub static CITIES: &[City] = &[
    City {
        id: "sf",
        name: "San Francisco",
        origin: [-122.4194, 37.7749],
        bbox: [-122.53, 37.69, -122.33, 37.84],
        tile_m: 500.0,
        region_tiles: 8,
        periods: SF_PERIODS,
        use_ground: true,
        attribution: "",
        year_priority: &[S_SF_ASSESSOR, S_NSI],
        height_priority: &[S_SF_FOOTPRINTS],
        floors_priority: &[S_SF_ASSESSOR, S_NSI],
        ground_cell_m: 10.0,
        ground_simplify_m: 2.0,
        fetch: sources::sf::fetch,
        join: sources::sf::join,
    },
    City {
        id: "bay",
        name: "San Francisco Bay Area",
        origin: [-122.4194, 37.7749],
        bbox: [-123.65, 36.85, -121.2, 38.87],
        tile_m: 1000.0,
        region_tiles: 16,
        // SF buildings keep SF-meaningful periods; the rest has no years yet.
        periods: SF_PERIODS,
        // Source ground where known (SF LiDAR, Solano), else the 3DEP DEM.
        use_ground: true,
        attribution: sources::bay::ATTRIBUTION,
        year_priority: &[
            S_SF_ASSESSOR, S_SJ_BPO, S_CUPERTINO, S_PALO_ALTO, S_SONOMA, S_NAPA, S_SOLANO_PARCELS,
            S_CONTRA_COSTA, S_ALAMEDA, S_ZONE7, S_LISTINGS, S_NSI,
        ],
        // LiDAR first, then mapped heights, FEMA above Microsoft ML (caps ~36 m).
        height_priority: &[
            S_SF_FOOTPRINTS, S_SOLANO_FP, S_SANTA_CLARA_FP, S_OVT_USGS, S_CUPERTINO, S_OVT_OSM, S_OVT_ESRI,
            S_OVT_OTHER, S_FEMA, S_OVT_MSFT,
        ],
        floors_priority: &[
            S_SF_ASSESSOR, S_CUPERTINO, S_NAPA, S_SOLANO_PARCELS, S_ALAMEDA, S_ZONE7, S_OVT_OTHER, S_NSI,
        ],
        ground_cell_m: 60.0,
        ground_simplify_m: 10.0,
        fetch: sources::bay::fetch,
        join: sources::bay::join,
    },
    City {
        id: "nyc",
        name: "New York City",
        origin: [-73.9857, 40.7484],
        bbox: [-74.26, 40.49, -73.69, 40.92],
        tile_m: 500.0,
        region_tiles: 8,
        periods: GENERIC_PERIODS,
        use_ground: true,
        attribution: "",
        // LL84 year_built is a cross-check only.
        // demolished buildings have only the historic footprints' values
        year_priority: &[S_NYC_LPC, S_NYC_FP, S_NYC_HISTORIC, S_NSI],
        height_priority: &[S_NYC_FP, S_NYC_HISTORIC],
        floors_priority: &[S_NYC_PLUTO, S_NSI],
        ground_cell_m: 15.0,
        ground_simplify_m: 2.0,
        fetch: sources::nyc::fetch,
        join: sources::nyc::join,
    },
    City {
        id: "boston",
        name: "Boston, Cambridge, Somerville & Brookline",
        origin: [-71.0589, 42.3601],
        bbox: [-71.20, 42.22, -70.98, 42.42],
        tile_m: 500.0,
        region_tiles: 8,
        periods: GENERIC_PERIODS,
        use_ground: true,
        attribution: "",
        year_priority: &[S_BOSTON_ASSESS, S_CAMBRIDGE_PROP, S_MASSGIS_L3, S_NSI],
        height_priority: &[S_BOSTON_ROOFS, S_CAMBRIDGE_FP, S_FEMA],
        floors_priority: &[S_BOSTON_ASSESS, S_CAMBRIDGE_PROP, S_MASSGIS_L3, S_NSI],
        ground_cell_m: 10.0,
        ground_simplify_m: 2.0,
        fetch: sources::boston::fetch,
        join: sources::boston::join,
    },
];

pub struct Ctx {
    pub city: &'static City,
    /// cache/<city>/
    pub cache: PathBuf,
    /// web/data/<city>/
    pub out: PathBuf,
}

impl Ctx {
    pub fn new(id: &str) -> Result<Ctx> {
        let Some(city) = CITIES.iter().find(|c| c.id == id) else {
            bail!("unknown city {id:?}; known: {}", CITIES.iter().map(|c| c.id).collect::<Vec<_>>().join(", "))
        };
        // Workspace root is two levels above crates/pipeline; SF_ROOT overrides.
        let root = std::env::var_os("SF_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../.."));
        let root = root.canonicalize().unwrap_or(root);
        let cache = root.join("cache").join(id);
        let out = root.join("web").join("data").join(id);
        std::fs::create_dir_all(&cache)?;
        std::fs::create_dir_all(&out)?;
        Ok(Ctx { city, cache, out })
    }
    /// cache/ (all cities).
    pub fn root_cache(&self) -> PathBuf {
        self.cache.parent().unwrap().to_path_buf()
    }
    pub fn joined(&self) -> PathBuf {
        self.cache.join("joined.bin")
    }
    pub fn buildings(&self) -> PathBuf {
        self.cache.join("buildings.bin")
    }
}
