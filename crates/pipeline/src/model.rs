//! Common building record shared by every city source and the generic
//! `years` / `tiles` / `verify` steps.

use serde::{Deserialize, Serialize};

/// lon/lat polygon parts; each part is a list of rings, the first one outer.
pub type Parts = Vec<Vec<Vec<[f64; 2]>>>;

/// How a source's build years are cleaned (see `years`).
#[derive(Clone, Copy)]
pub struct YearPolicy {
    /// Histogram spikes at least this many times their neighbourhood are
    /// placeholders and get re-estimated; weaker spikes are rounding and
    /// only flagged approximate. INFINITY = never re-estimate.
    pub reestimate_ratio: f64,
    /// Neighbour search radii (m) for buildings whose fill group is this
    /// source, tried in order; empty = never estimate.
    pub radii: &'static [f64],
    /// Earliest plausible year; older (or future) values are dropped.
    pub min_year: i16,
    /// Curated values: no spike handling.
    pub curated: bool,
    /// Area statistic, not a building's own year: used only after
    /// neighbour estimates fail, and flagged F_TRACT_YEAR.
    pub last_resort: bool,
}

const P_CA: YearPolicy = YearPolicy { reestimate_ratio: 10.0, radii: &[150.0], min_year: 1776, curated: false, last_resort: false };
const P_EAST: YearPolicy = YearPolicy { reestimate_ratio: f64::INFINITY, radii: &[150.0], min_year: 1600, curated: false, last_resort: false };
const P_NONE: YearPolicy = YearPolicy { reestimate_ratio: f64::INFINITY, radii: &[], min_year: 1776, curated: false, last_resort: false };

/// A data source. Buildings record, per value, which source it came from
/// (indices into SOURCES); index.json lists the ones a city uses.
pub struct Source {
    pub id: &'static str,
    pub name: &'static str,
    pub url: &'static str,
    pub licence: &'static str,
    pub attribution: &'static str,
    pub publishable: bool,
    pub year: YearPolicy,
}

const UNSTATED: &str = "unstated — local use only, confirm before publishing";

macro_rules! src {
    ($id:expr, $name:expr, $url:expr, $lic:expr, $attr:expr, $pub_:expr, $pol:expr) => {
        Source { id: $id, name: $name, url: $url, licence: $lic, attribution: $attr, publishable: $pub_, year: $pol }
    };
}

/// Indexed by the S_* constants below; append only.
pub const SOURCES: &[Source] = &[
    // 1900 (66x) and 1890 (29x) are defaults on the SF roll.
    src!("sf_assessor", "SF Assessor Historical Secured Property Tax Rolls", "https://data.sfgov.org/d/wv5m-vpq2",
        "ODC-PDDL", "DataSF, City and County of San Francisco", true,
        YearPolicy { reestimate_ratio: 10.0, radii: &[150.0, 600.0], min_year: 1776, curated: false, last_resort: false }),
    src!("sf_footprints", "SF Building Footprints (2010 LiDAR heights, ground)", "https://data.sfgov.org/d/ynuv-fyni",
        "ODC-PDDL", "DataSF, City and County of San Francisco", true, P_NONE),
    src!("overture_osm", "OpenStreetMap via Overture Maps", "https://overturemaps.org", "ODbL 1.0",
        "© OpenStreetMap contributors, Overture Maps Foundation", true, P_NONE),
    src!("overture_msft", "Microsoft ML Buildings via Overture Maps", "https://overturemaps.org", "ODbL 1.0",
        "Microsoft, Overture Maps Foundation", true, P_NONE),
    src!("overture_esri", "Esri Community Maps via Overture Maps", "https://overturemaps.org", "CC BY 4.0",
        "Esri Community Maps contributors, Overture Maps Foundation", true, P_NONE),
    src!("overture_usgs", "USGS 3DEP LiDAR heights via Overture Maps", "https://overturemaps.org", "Public domain (USGS)",
        "USGS, Overture Maps Foundation", true, P_NONE),
    src!("overture_other", "Overture Maps (record-level, unattributed)", "https://overturemaps.org", "ODbL 1.0",
        "Overture Maps Foundation", true, P_NONE),
    src!("sonoma_parcels", "Sonoma County One Stop parcels (YearBuilt)",
        "https://socogis.sonomacounty.ca.gov/map/rest/services/OneStopMapPublic/One_Stop_Parcels/FeatureServer/0",
        "County of Sonoma public GIS data", "County of Sonoma", true, P_CA),
    src!("napa_parcels", "Napa County public parcels (YearBuilt)",
        "https://services1.arcgis.com/Ko5rxt00spOfjMqj/arcgis/rest/services/Napa_County_Public_Parcels/FeatureServer/1",
        "ODC-PDDL", "Napa County", true, P_CA),
    src!("solano_parcels", "Solano County parcels (yrbuilt)",
        "https://services2.arcgis.com/SCn6czzcqKAFwdGU/arcgis/rest/services/Parcels_Public_Aumentum/FeatureServer/0",
        "Solano County public GIS data", "Solano County", true, P_CA),
    src!("solano_footprints", "Solano County 2024 LiDAR building footprints",
        "https://services2.arcgis.com/SCn6czzcqKAFwdGU/arcgis/rest/services/Building_Footprints_2024/FeatureServer/0",
        "Solano County public GIS data", "Solano County", true, P_NONE),
    src!("contra_costa_assessor", "Contra Costa County assessment parcels (YR_HS_BLT / YR_BUILT)",
        "https://gis.cccounty.us/arcgis/rest/services/CCMAP/Assessment_Parcels_ArcPro/MapServer/0",
        UNSTATED, "Contra Costa County", false, P_CA),
    src!("alameda_parcels_2020", "Alameda County parcels 2020 re-host (SHP_BLDG_YEARBUILT)",
        "https://services.arcgis.com/9tC74aDHuml0x5Yz/arcgis/rest/services/AC_Parcels2020/FeatureServer/0",
        UNSTATED, "Alameda County (re-hosted)", false, P_CA),
    src!("zone7_parcels", "Zone 7 Water Agency parcels (YrBuilt)",
        "https://services6.arcgis.com/yGWezgaq4oIlwApY/arcgis/rest/services/Parcels_LayFH/FeatureServer/0",
        UNSTATED, "Zone 7 Water Agency / Alameda County", false, P_CA),
    src!("santa_clara_footprints", "Santa Clara County building footprints (LiDAR heights, ft)",
        "https://data.sccgov.org/d/e8m9-vdfi", UNSTATED, "County of Santa Clara", false, P_NONE),
    src!("palo_alto_parcels", "City of Palo Alto parcel report (YEARBUILT)",
        "https://gis.cityofpaloalto.org/server/rest/services/Parcel/ParcelReport/MapServer/16",
        UNSTATED, "City of Palo Alto", false, P_CA),
    src!("cupertino_buildings", "City of Cupertino building footprints (Year_Built, BLDG_HEIGHT)",
        "https://gis.cupertino.org/cupgis/rest/services/Public/PropertyFeatures/MapServer/9",
        UNSTATED, "City of Cupertino", false, P_CA),
    src!("san_jose_bpo", "San Jose Building Performance Ordinance 2024 (YEAR BUILT)",
        "https://data.sanjoseca.gov/dataset/building-performance-ordinance", "CC0 1.0", "City of San José", true,
        YearPolicy { curated: true, ..P_CA }),
    src!("fema_usa_structures", "FEMA / ORNL USA Structures (HEIGHT, OCC_CLS)",
        "https://gis-fema.hub.arcgis.com/pages/usa-structures", "CC BY 4.0", "FEMA, Oak Ridge National Laboratory", true, P_NONE),
    src!("usace_nsi", "USACE National Structure Inventory 2022 (num_story, med_yr_blt)",
        "https://www.hec.usace.army.mil/confluence/nsi", "Public domain (US Government)", "US Army Corps of Engineers", true,
        YearPolicy { last_resort: true, ..P_EAST }),
    src!("nyc_footprints", "NYC Building Footprints (height_roof, construction_year)", "https://data.cityofnewyork.us/d/5zhs-2jue",
        "NYC Open Data terms of use", "NYC Office of Technology and Innovation", true,
        // NYC footprint years are rounded (multiples of 5/10), not placeholders.
        P_EAST),
    src!("nyc_pluto", "NYC DCP PLUTO 26v2", "https://data.cityofnewyork.us/d/64uk-42ks", "NYC Open Data terms of use",
        "NYC Department of City Planning (PLUTO)", true, P_EAST),
    src!("nyc_lpc", "NYC LPC Individual Landmark & Historic District Building Database", "https://data.cityofnewyork.us/d/gpmc-yuvp",
        "NYC Open Data terms of use", "NYC Landmarks Preservation Commission", true, YearPolicy { curated: true, ..P_EAST }),
    src!("nyc_ll84", "NYC Local Law 84 energy benchmarking", "https://data.cityofnewyork.us/d/5zyy-y8am",
        "NYC Open Data terms of use", "NYC Mayor's Office of Climate & Environmental Justice", true, P_EAST),
    src!("boston_roofs", "Boston Buildings with Roof Breaks (BPDA 2010 LiDAR)",
        "https://data.boston.gov/dataset/boston-buildings-with-roof-breaks", "ODC-PDDL", "City of Boston / Analyze Boston", true, P_NONE),
    // Boston assessor years are "circa" values on round years, not defaults.
    src!("boston_assessment", "Boston Property Assessment FY2026", "https://data.boston.gov/dataset/property-assessment",
        "ODC-PDDL", "City of Boston / Analyze Boston", true, P_EAST),
    src!("cambridge_footprints", "Cambridge GIS basemap buildings (TOP_GL, BASE_ELEV)",
        "https://github.com/cambridgegis/cambridgegis_data", "ODC-PDDL", "City of Cambridge GIS", true, P_NONE),
    src!("cambridge_property", "Cambridge property database (condition_yearbuilt)", "https://data.cambridgema.gov/d/eey2-rv59",
        "ODC-PDDL", "City of Cambridge", true, P_EAST),
    src!("massgis_l3", "MassGIS Standardized Assessors' Parcels (L3, YEAR_BUILT)",
        "https://www.mass.gov/info-details/massgis-data-property-tax-parcels", "MassGIS public data (free, attribution requested)",
        "MassGIS (Bureau of Geographic Information)", true, P_EAST),
    src!("massgis_structures", "MassGIS Building Structures (2-D)", "https://www.mass.gov/info-details/massgis-data-building-structures-2-d",
        "MassGIS public data (free, attribution requested)", "MassGIS (Bureau of Geographic Information)", true, P_NONE),
    src!("neighbour_estimate", "Estimated: median of nearby dated buildings", "", "derived", "", true, P_NONE),
    src!("model_default", "Default height for the building type", "", "derived", "", true, P_NONE),
    src!("listings", "Real-estate listings (Zillow, Redfin, Compass), collected locally (../zillow)", "",
        "scraped listings, personal research use only — not for publication", "Zillow, Redfin, Compass listings", false, P_CA),
    // footprints DoITT retired when a building came down (1996 on), with both years
    src!("nyc_footprints_historic", "NYC Building Footprints Historic (demolished buildings)", "https://data.cityofnewyork.us/d/ipkp-snf6",
        "NYC Open Data terms of use", "NYC Office of Technology and Innovation", true,
        YearPolicy { reestimate_ratio: f64::INFINITY, radii: &[], min_year: 1600, curated: false, last_resort: false }),
];
pub const S_SF_ASSESSOR: u8 = 0;
pub const S_SF_FOOTPRINTS: u8 = 1;
pub const S_OVT_OSM: u8 = 2;
pub const S_OVT_MSFT: u8 = 3;
pub const S_OVT_ESRI: u8 = 4;
pub const S_OVT_USGS: u8 = 5;
pub const S_OVT_OTHER: u8 = 6;
pub const S_SONOMA: u8 = 7;
pub const S_NAPA: u8 = 8;
pub const S_SOLANO_PARCELS: u8 = 9;
pub const S_SOLANO_FP: u8 = 10;
pub const S_CONTRA_COSTA: u8 = 11;
pub const S_ALAMEDA: u8 = 12;
pub const S_ZONE7: u8 = 13;
pub const S_SANTA_CLARA_FP: u8 = 14;
pub const S_PALO_ALTO: u8 = 15;
pub const S_CUPERTINO: u8 = 16;
pub const S_SJ_BPO: u8 = 17;
pub const S_FEMA: u8 = 18;
pub const S_NSI: u8 = 19;
pub const S_NYC_FP: u8 = 20;
pub const S_NYC_PLUTO: u8 = 21;
pub const S_NYC_LPC: u8 = 22;
pub const S_NYC_LL84: u8 = 23;
pub const S_BOSTON_ROOFS: u8 = 24;
pub const S_BOSTON_ASSESS: u8 = 25;
pub const S_CAMBRIDGE_FP: u8 = 26;
pub const S_CAMBRIDGE_PROP: u8 = 27;
pub const S_MASSGIS_L3: u8 = 28;
pub const S_MASSGIS_STRUCT: u8 = 29;
pub const S_NEIGHBOURS: u8 = 30;
pub const S_DEFAULT: u8 = 31;
pub const S_LISTINGS: u8 = 32;
pub const S_NYC_HISTORIC: u8 = 33;
pub const S_NONE: u8 = 255;

/// How the final height was obtained.
pub const H_MEASURED: u8 = 0; // source height (LiDAR, OSM, ML estimate, ...)
pub const H_FLOORS: u8 = 1; // storeys * STOREY_M
pub const H_DEFAULT: u8 = 2; // per-type default

/// Tile flag bits.
pub const F_APPROX_YEAR: u8 = 1;
pub const F_LANDMARK: u8 = 2; // designated landmark / in a landmarks database
pub const F_PARCEL_SHARED: u8 = 4; // year comes from a parcel shared with other footprints
pub const F_HEIGHT_EST: u8 = 8; // height not measured (floors or default)
pub const F_TRACT_YEAR: u8 = 16; // year is a census-area median (NSI), not the building's

/// Candidate build years from one source.
#[derive(Serialize, Deserialize, Clone, Default)]
pub struct YearCand {
    pub src: u8,
    /// Distinct, sorted, > 0 (plausibility is checked in `years`).
    pub years: Vec<i16>,
    /// The source itself says "circa" / a date range.
    pub circa: bool,
    /// Taken from a parcel/record shared with other footprints.
    pub shared: bool,
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Building {
    // Filled in by a city's `join`.
    /// Neighbour-fill group (a source id): missing years are estimated
    /// only from buildings of the same group, with its radii.
    pub dataset: u8,
    pub src_id: String,
    pub parts: Parts,
    pub footprint_src: u8,
    pub year_c: Vec<YearCand>,
    /// Measured/source heights above ground (m).
    pub height_c: Vec<(u8, f32)>,
    pub floors_c: Vec<(u8, f32)>,
    /// Used when there is neither a usable height nor a storey count.
    pub height_default: f32,
    /// Ground elevation (m above the city datum), if known.
    pub ground_m: Option<f32>,
    pub use_class: u8,
    pub use_def: String,
    pub units: u32,
    pub addr: String,
    /// Sub-area for reporting (county, borough, ...).
    pub area: String,
    pub landmark: bool,
    /// Per-part measured heights (roof breaks); empty = building height.
    pub part_heights: Vec<f32>,
    /// Extra attrs (JSON object text), e.g. NYC energy benchmarking.
    pub extra: String,
    /// Year the building was demolished; 0 = still standing.
    pub demolished: i16,

    // Filled in by `years`.
    pub year: i16, // 0 = unknown
    pub approx: bool,
    pub tract_year: bool,
    pub parcel_shared: bool,
    pub year_src: u8,
    pub height: f32,
    pub height_src: u8, // H_*
    pub height_from: u8, // source id
    pub floors: u8,
    pub period: u8, // PERIOD_UNKNOWN if year == 0
}

impl Building {
    pub fn year(&mut self, src: u8, years: impl IntoIterator<Item = i16>, circa: bool, shared: bool) {
        let mut v: Vec<i16> = years.into_iter().filter(|&y| y > 0).collect();
        v.sort_unstable();
        v.dedup();
        if !v.is_empty() {
            self.year_c.push(YearCand { src, years: v, circa, shared });
        }
    }
    pub fn height(&mut self, src: u8, h: Option<f32>) {
        if let Some(h) = h.filter(|h| h.is_finite() && *h > 0.0) {
            self.height_c.push((src, h));
        }
    }
    pub fn floors(&mut self, src: u8, f: Option<f32>) {
        if let Some(f) = f.filter(|f| f.is_finite() && *f > 0.0) {
            self.floors_c.push((src, f));
        }
    }
    pub fn flags(&self) -> u8 {
        let mut f = 0;
        if self.approx {
            f |= F_APPROX_YEAR;
        }
        if self.landmark {
            f |= F_LANDMARK;
        }
        if self.parcel_shared && self.year > 0 && !self.approx {
            f |= F_PARCEL_SHARED;
        }
        if self.height_src != H_MEASURED {
            f |= F_HEIGHT_EST;
        }
        if self.tract_year {
            f |= F_TRACT_YEAR;
        }
        f
    }
}

pub struct Period {
    pub name: &'static str,
    pub from: i16,
    pub to: i16, // inclusive; 9999 = open-ended
    pub color: &'static str,
}

/// San Francisco periods. Colours run warm (old) to cool (new).
pub const SF_PERIODS: &[Period] = &[
    Period { name: "Before the 1906 quake", from: 1776, to: 1905, color: "#7f1d3f" },
    Period { name: "Post-quake rebuild", from: 1906, to: 1915, color: "#c0392b" },
    Period { name: "Boom twenties", from: 1916, to: 1929, color: "#e8743b" },
    Period { name: "Depression & war", from: 1930, to: 1945, color: "#f2b134" },
    Period { name: "Postwar suburbs", from: 1946, to: 1965, color: "#d9d56a" },
    Period { name: "Manhattanization", from: 1966, to: 1980, color: "#7cc49a" },
    Period { name: "Late century", from: 1981, to: 2000, color: "#3c9dbb" },
    Period { name: "Tech era", from: 2001, to: 9999, color: "#3b5ba9" },
];

/// Generic US-city periods, same palette (nyc, boston).
pub const GENERIC_PERIODS: &[Period] = &[
    Period { name: "Before 1900", from: 1600, to: 1899, color: "#7f1d3f" },
    Period { name: "1900-1919", from: 1900, to: 1919, color: "#c0392b" },
    Period { name: "1920-1939", from: 1920, to: 1939, color: "#e8743b" },
    Period { name: "1940-1959", from: 1940, to: 1959, color: "#f2b134" },
    Period { name: "1960-1979", from: 1960, to: 1979, color: "#d9d56a" },
    Period { name: "1980-1999", from: 1980, to: 1999, color: "#7cc49a" },
    Period { name: "2000-2009", from: 2000, to: 2009, color: "#3c9dbb" },
    Period { name: "2010-present", from: 2010, to: 9999, color: "#3b5ba9" },
];

pub const PERIOD_UNKNOWN: u8 = 255;
pub const UNKNOWN_COLOR: &str = "#8c8c8c";

/// Period index; years before the first period count as the first one
/// (only 0 is unknown).
pub fn period_of(periods: &[Period], year: i16) -> u8 {
    if year <= 0 {
        return PERIOD_UNKNOWN;
    }
    periods.iter().position(|p| year <= p.to).unwrap_or(periods.len() - 1) as u8
}

pub const USE_CLASSES: &[&str] = &["residential", "commercial", "industrial", "civic", "mixed", "other"];
pub const USE_RESIDENTIAL: u8 = 0;
pub const USE_COMMERCIAL: u8 = 1;
pub const USE_INDUSTRIAL: u8 = 2;
pub const USE_CIVIC: u8 = 3;
pub const USE_MIXED: u8 = 4;
pub const USE_OTHER: u8 = 5;

/// Coarse use class from free-text land-use descriptions.
pub fn use_from_text(s: &str) -> u8 {
    let s = s.to_ascii_uppercase();
    let has = |k: &[&str]| k.iter().any(|k| s.contains(k));
    if s.is_empty() {
        USE_OTHER
    } else if has(&["MIXED"]) {
        USE_MIXED
    } else if has(&["RESID", "SINGLE", "CONDO", "DWELL", "MOBILE", "APART", "DUPLEX", "TRIPLEX", "FAMILY"]) {
        USE_RESIDENTIAL
    } else if has(&["COMM", "OFFICE", "RETAIL", "HOTEL", "MOTEL", "STORE", "SHOP", "RESTAUR", "BANK"]) {
        USE_COMMERCIAL
    } else if has(&["INDUS", "WAREH", "MANUF", "STORAGE"]) {
        USE_INDUSTRIAL
    } else if has(&["GOVERN", "SCHOOL", "CHURCH", "PUBLIC", "HOSPITAL", "INSTITU", "EXEMPT"]) {
        USE_CIVIC
    } else {
        USE_OTHER
    }
}

pub fn current_year() -> i16 {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_secs());
    (1970 + secs / 31_556_952) as i16
}
