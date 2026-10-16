//! Bay Area (nine counties, clipped with US Census TIGER county polygons).
//!
//! Footprints: SF city buildings inside San Francisco, Solano County's 2024
//! LiDAR footprints in Solano, Overture Maps buildings elsewhere.
//! Values are attached per source with provenance (see `model::SOURCES`;
//! priorities in `city.rs`):
//! - parcel layers (centroid in parcel; stacked condo parcels merge):
//!   Sonoma, Napa, Solano, Contra Costa, Alameda 2020 re-host, Zone 7,
//!   Palo Alto, and San Jose BPO years via Santa Clara County parcels;
//! - footprint layers matched by mutual centroid containment: Santa Clara
//!   County LiDAR heights, Cupertino buildings, FEMA USA Structures;
//! - NSI points: floors and the last-resort census-area median year.
//! Sources with an unstated licence are `publishable: false`.
//!
//! Overture GeoParquet is filtered by its `bbox` column with DuckDB into
//! one local parquet file, read here with the arrow parquet reader.

use super::arcgis::{fetch_layer, num, read_layer, text};
use super::attach::{mark_shared, parcels_inline, Enricher, Lot, ParcelSource, Polys};
use super::http::{agent, fetch_paged, get, get_cached};
use super::pq::{bins, f64s, i64s, strs};
use crate::city::Ctx;
use crate::geom::{centroid, PolyIndex};
use crate::model::*;
use crate::store::{for_each_chunk, Writer};
use anyhow::{bail, Context, Result};
use arrow_array::RecordBatch;
use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;
use rayon::prelude::*;
use serde_json::Value;
use std::collections::{BTreeMap, HashMap};
use std::path::PathBuf;
use std::process::Command;

const STAC: &str = "https://stac.overturemaps.org/catalog.json";
const S3: &str = "s3://overturemaps-us-west-2/release";
/// California (06): Alameda, Contra Costa, Marin, Napa, San Francisco,
/// San Mateo, Santa Clara, Solano, Sonoma.
const COUNTIES: &[&str] = &["001", "013", "041", "055", "075", "081", "085", "095", "097"];
const SF_COUNTY: &str = "075";
const TIGER: &str = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query";
pub const ATTRIBUTION: &str = "US Census TIGER (county boundaries). Overture buildings are ODbL: a published \
database derived from them (tiles + attrs) is share-alike.";
const FT: f32 = 0.3048;

/// A parcel layer with years: (source, county FIPS, layer, fields, id field, page size).
struct ParcelLayer {
    src: u8,
    fips: &'static str,
    layer: &'static str,
    fields: &'static str,
    id: &'static str,
    page: usize,
    parse: fn(&Value) -> Lot,
}

fn years_of(p: &Value, keys: &[&str]) -> Vec<i16> {
    let mut v: Vec<i16> = keys.iter().filter_map(|k| num(p, k)).filter(|&y| y > 0.0 && y < 3000.0).map(|y| y as i16).collect();
    v.sort_unstable();
    v.dedup();
    v
}

fn pos(p: &Value, k: &str) -> Option<f32> {
    num(p, k).filter(|&x| x > 0.0).map(|x| x as f32)
}

const PARCEL_LAYERS: &[ParcelLayer] = &[
    ParcelLayer {
        src: S_SONOMA,
        fips: "097",
        layer: "https://socogis.sonomacounty.ca.gov/map/rest/services/OneStopMapPublic/One_Stop_Parcels/FeatureServer/0",
        fields: "OBJECTID,APN,SitusAddress,Description,YearBuilt",
        id: "APN",
        page: 2000,
        parse: |p| Lot {
            years: years_of(p, &["YearBuilt"]),
            addr: title_case(text(p, "SitusAddress")),
            use_def: text(p, "Description").into(),
            ..Default::default()
        },
    },
    ParcelLayer {
        src: S_NAPA,
        fips: "055",
        layer: "https://services1.arcgis.com/Ko5rxt00spOfjMqj/arcgis/rest/services/Napa_County_Public_Parcels/FeatureServer/1",
        fields: "OBJECTID,ASMT,StreetAddr,LandUseDescription,YearBuilt,AllStructures_YearsBuilt,BuildingFloorCount,UnitCount",
        id: "ASMT",
        page: 2000,
        parse: |p| {
            // AllStructures_YearsBuilt lists every structure's year.
            let mut years: Vec<i16> = text(p, "AllStructures_YearsBuilt")
                .split(|c: char| !c.is_ascii_digit())
                .filter_map(|t| t.parse::<i16>().ok())
                .chain(years_of(p, &["YearBuilt"]))
                .filter(|&y| y > 0)
                .collect();
            years.sort_unstable();
            years.dedup();
            Lot {
                years,
                floors: pos(p, "BuildingFloorCount"),
                units: pos(p, "UnitCount").map_or(0, |u| u as u32),
                addr: title_case(text(p, "StreetAddr")),
                use_def: text(p, "LandUseDescription").into(),
                use_class: None,
            }
        },
    },
    ParcelLayer {
        src: S_SOLANO_PARCELS,
        fips: "095",
        layer: "https://services2.arcgis.com/SCn6czzcqKAFwdGU/arcgis/rest/services/Parcels_Public_Aumentum/FeatureServer/0",
        fields: "objectid,parcelid,p_address,use_desc,yrbuilt,stories",
        id: "parcelid",
        page: 2000,
        parse: |p| Lot {
            years: years_of(p, &["yrbuilt"]),
            floors: pos(p, "stories"),
            addr: title_case(text(p, "p_address")),
            use_def: text(p, "use_desc").into(),
            ..Default::default()
        },
    },
    ParcelLayer {
        src: S_CONTRA_COSTA,
        fips: "013",
        layer: "https://gis.cccounty.us/arcgis/rest/services/CCMAP/Assessment_Parcels_ArcPro/MapServer/0",
        fields: "OBJECTID,APN,YR_BUILT,YR_HS_BLT,Description,full_address_display",
        id: "APN",
        page: 2000,
        // YR_HS_BLT (residential) is the useful one; YR_BUILT is often "0".
        parse: |p| Lot {
            years: years_of(p, &["YR_HS_BLT", "YR_BUILT"]),
            addr: title_case(text(p, "full_address_display")),
            use_def: text(p, "Description").into(),
            ..Default::default()
        },
    },
    ParcelLayer {
        src: S_ALAMEDA,
        fips: "001",
        layer: "https://services.arcgis.com/9tC74aDHuml0x5Yz/arcgis/rest/services/AC_Parcels2020/FeatureServer/0",
        fields: "OBJECTID,APN_AIR,SHP_BLDG_YEARBUILT,SHP_NO_STORIES,SHP_NO_UNITS,FULL_SITUSADDRESS,SHP_USECODE",
        // Condos are stacked duplicate parcels: one lot per polygon, merged at lookup.
        id: "OBJECTID",
        page: 1000,
        parse: |p| Lot {
            years: years_of(p, &["SHP_BLDG_YEARBUILT"]),
            floors: pos(p, "SHP_NO_STORIES"),
            units: pos(p, "SHP_NO_UNITS").map_or(0, |u| u as u32),
            addr: title_case(text(p, "FULL_SITUSADDRESS")),
            ..Default::default()
        },
    },
    ParcelLayer {
        src: S_ZONE7,
        fips: "001",
        layer: "https://services6.arcgis.com/yGWezgaq4oIlwApY/arcgis/rest/services/Parcels_LayFH/FeatureServer/0",
        fields: "OBJECTID,APN,YrBuilt,Stories,NumUnits,SitusAddress,UseCodeCountyDescription",
        id: "OBJECTID",
        page: 2000,
        parse: |p| Lot {
            years: years_of(p, &["YrBuilt"]),
            floors: pos(p, "Stories"),
            units: pos(p, "NumUnits").map_or(0, |u| u as u32),
            addr: title_case(text(p, "SitusAddress")),
            use_def: text(p, "UseCodeCountyDescription").into(),
            use_class: None,
        },
    },
    ParcelLayer {
        src: S_PALO_ALTO,
        fips: "085",
        layer: "https://gis.cityofpaloalto.org/server/rest/services/Parcel/ParcelReport/MapServer/16",
        fields: "OBJECTID,APN,YEARBUILT,ADDRESSNUMBER,STREET,LANDUSEGIS",
        id: "APN",
        page: 1000,
        parse: |p| Lot {
            years: years_of(p, &["YEARBUILT"]),
            addr: title_case(&format!("{} {}", text(p, "ADDRESSNUMBER"), text(p, "STREET"))),
            use_def: text(p, "LANDUSEGIS").into(),
            ..Default::default()
        },
    },
];

const SOLANO_FOOTPRINTS: &str =
    "https://services2.arcgis.com/SCn6czzcqKAFwdGU/arcgis/rest/services/Building_Footprints_2024/FeatureServer/0";
const SANTA_CLARA_FP: &str = "https://data.sccgov.org/resource/e8m9-vdfi.json";
const SCC_PARCELS: &str = "https://data.sccgov.org/resource/ubcd-cewv.json";
const CUPERTINO: &str = "https://gis.cupertino.org/cupgis/rest/services/Public/PropertyFeatures/MapServer/9";
const SJ_BPO: &str = "https://data.sanjoseca.gov/dataset/ee0e571c-5007-4330-b3df-01ee5bdc91d3/resource/f7723c73-8ee3-43cd-9a3e-a8761cc29905/download/cy-2024-public-data.csv";
/// FEMA USA Structures for the counties without LiDAR footprints.
const FEMA_FIPS: &[&str] = &["06001", "06081", "06013", "06041"];

pub fn fetch(ctx: &Ctx) -> Result<()> {
    let agent = agent();
    let c = &ctx.cache;
    // SF city data is reused inside the city line.
    super::sf::fetch(&Ctx::new("sf")?)?;

    let url = format!(
        "{TIGER}?where=STATE%3D%2706%27+AND+COUNTY+IN+({})&outFields=NAME,COUNTY,GEOID&outSR=4326&f=geojson",
        COUNTIES.iter().map(|c| format!("%27{c}%27")).collect::<Vec<_>>().join(",")
    );
    let counties: Value = serde_json::from_str(&get_cached(&agent, &url, &c.join("counties.geojson"))?)?;
    println!("counties: {}", counties["features"].as_array().map_or(0, Vec::len));

    // Palo Alto's server takes minutes per page: fetch it last.
    let (slow, fast): (Vec<&ParcelLayer>, Vec<&ParcelLayer>) = PARCEL_LAYERS.iter().partition(|l| l.src == S_PALO_ALTO);
    for l in &fast {
        fetch_layer(&agent, l.layer, l.fields, &c.join(format!("parcels_{}", SOURCES[l.src as usize].id)), l.page)?;
    }
    fetch_layer(&agent, SOLANO_FOOTPRINTS, "objectid,apn,building_height,ground_elevation", &c.join("solano_footprints"), 2000)?;
    fetch_layer(&agent, CUPERTINO, "OBJECTID,LEVEL_DESC,Year_Built,BLDG_HEIGHT,FloorNumbe", &c.join("cupertino"), 2000)?;
    fetch_paged(
        &agent,
        &c.join("santa_clara_footprints"),
        &format!("{SANTA_CLARA_FP}?$select=objectid,building_h,base_heigh,the_geom&$order=:id"),
        50_000,
    )?;

    // San Jose BPO years -> APNs -> county parcel polygons.
    let csv = get_cached(&agent, SJ_BPO, &c.join("sj_bpo_2024.csv"))?;
    let apns: Vec<String> = parse_csv(&csv).iter().skip(1).filter_map(|r| r.get(5)).map(|a| apn8(a)).filter(|a| !a.is_empty()).collect();
    let dir = c.join("sj_parcels");
    std::fs::create_dir_all(&dir)?;
    for (i, chunk) in apns.chunks(150).enumerate() {
        let list = chunk.iter().map(|a| format!("%27{a}%27")).collect::<Vec<_>>().join(",");
        get_cached(&agent, &format!("{SCC_PARCELS}?$select=apn,the_geom&$where=apn%20in({list})&$limit=5000"), &dir.join(format!("page_{i:03}.json")))?;
    }
    println!("san jose BPO: {} APNs", apns.len());

    super::fema::fetch_counties(&c.join("fema"), FEMA_FIPS)?;
    super::nsi::fetch(ctx, "06")?;

    let release = latest_release(&agent, ctx)?;
    let out = overture_path(ctx, &release);
    if out.exists() {
        println!("overture {release}: cached {}", out.display());
        return fetch_slow(&agent, ctx, &slow);
    }
    if Command::new("duckdb").arg("--version").output().is_err() {
        bail!("duckdb CLI not found on PATH (brew install duckdb, or put a binary on PATH)");
    }
    let [w, s, e, n] = ctx.city.bbox;
    let tmp = out.with_extension("tmp");
    // Only buildings wholly inside the bbox; the county clip happens in join.
    // Height and footprint provenance come from sources[].property.
    let sql = format!(
        "INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial;
         SET s3_region='us-west-2'; SET enable_progress_bar=false;
         COPY (
           SELECT id, ST_AsWKB(geometry) AS wkb, height, num_floors, roof_shape, class, subtype,
                  list_filter(sources, lambda s: s.property = '/properties/height')[1].dataset AS hsrc,
                  list_filter(sources, lambda s: s.property = '')[1].dataset AS fsrc
           FROM read_parquet('{S3}/{release}/theme=buildings/type=building/*.parquet')
           WHERE bbox.xmin >= {w} AND bbox.xmax <= {e} AND bbox.ymin >= {s} AND bbox.ymax <= {n}
             AND coalesce(is_underground, false) = false
         ) TO '{}' (FORMAT parquet, COMPRESSION zstd, ROW_GROUP_SIZE 100000);",
        tmp.display()
    );
    println!("overture {release}: querying S3 with duckdb (a few minutes)...");
    if !Command::new("duckdb").arg("-c").arg(&sql).status()?.success() {
        bail!("duckdb failed");
    }
    std::fs::rename(&tmp, &out)?;
    println!("wrote {} ({:.0} MB)", out.display(), std::fs::metadata(&out)?.len() as f64 / 1e6);
    fetch_slow(&agent, ctx, &slow)
}

fn fetch_slow(agent: &ureq::Agent, ctx: &Ctx, slow: &[&ParcelLayer]) -> Result<()> {
    for l in slow {
        fetch_layer(agent, l.layer, l.fields, &ctx.cache.join(format!("parcels_{}", SOURCES[l.src as usize].id)), l.page)?;
    }
    Ok(())
}

fn overture_path(ctx: &Ctx, release: &str) -> PathBuf {
    ctx.cache.join(format!("overture_{release}_v2.parquet"))
}

/// Latest release name from the Overture STAC catalog, remembered in cache.
fn latest_release(agent: &ureq::Agent, ctx: &Ctx) -> Result<String> {
    let f = ctx.cache.join("overture_release.txt");
    if let Ok(s) = std::fs::read_to_string(&f) {
        return Ok(s.trim().to_string());
    }
    let v: Value = serde_json::from_str(&get(agent, STAC)?)?;
    let r = v["latest"].as_str().context("STAC catalog has no 'latest'")?.to_string();
    std::fs::write(f, &r)?;
    Ok(r)
}

/// Santa Clara APNs are 8 digits; the BPO file drops leading zeros.
fn apn8(s: &str) -> String {
    let d: String = s.chars().filter(|c| c.is_ascii_digit()).collect();
    if d.is_empty() || d.len() > 8 { d } else { format!("{d:0>8}") }
}

/// Minimal RFC 4180 CSV (quoted fields, doubled quotes).
fn parse_csv(s: &str) -> Vec<Vec<String>> {
    let mut rows = Vec::new();
    let (mut row, mut field, mut quoted) = (Vec::new(), String::new(), false);
    let mut it = s.chars().peekable();
    while let Some(ch) = it.next() {
        match (ch, quoted) {
            ('"', true) if it.peek() == Some(&'"') => {
                field.push('"');
                it.next();
            }
            ('"', _) => quoted = !quoted,
            (',', false) => row.push(std::mem::take(&mut field)),
            ('\n', false) => {
                row.push(std::mem::take(&mut field));
                rows.push(std::mem::take(&mut row));
            }
            ('\r', false) => {}
            (c, _) => field.push(c),
        }
    }
    if !field.is_empty() || !row.is_empty() {
        row.push(field);
        rows.push(row);
    }
    rows
}

struct County {
    fips: String,
    name: String,
    idx: PolyIndex,
}

/// Cupertino building record.
struct Cup {
    year: Option<i16>,
    height: Option<f32>,
    floors: Option<f32>,
}

pub fn join(ctx: &Ctx) -> Result<()> {
    let c = &ctx.cache;
    let release = std::fs::read_to_string(c.join("overture_release.txt")).context("run fetch first")?;
    let geo: Value = serde_json::from_slice(&std::fs::read(c.join("counties.geojson"))?)?;
    let counties: Vec<County> = geo["features"]
        .as_array()
        .context("counties")?
        .iter()
        .map(|f| County {
            fips: text(&f["properties"], "COUNTY").into(),
            name: text(&f["properties"], "NAME").trim_end_matches(" County").into(),
            idx: PolyIndex::new(&geojson_rings(&f["geometry"])),
        })
        .collect();
    let county_of = |p: [f64; 2]| counties.iter().position(|k| k.idx.contains(p));
    let fips_of = |k: usize| counties[k].fips.as_str();

    // Value layers.
    println!("loading parcel layers...");
    let parcels: Vec<(&'static str, ParcelSource)> = PARCEL_LAYERS
        .par_iter()
        .map(|l| Ok((l.fips, parcels_inline(l.src, &c.join(format!("parcels_{}", SOURCES[l.src as usize].id)), l.id, l.parse)?)))
        .collect::<Result<_>>()?;
    let sj = {
        let rows = parse_csv(&std::fs::read_to_string(c.join("sj_bpo_2024.csv"))?);
        let mut lots: HashMap<String, Lot> = HashMap::new();
        for r in rows.iter().skip(1) {
            let (Some(apn), Some(y)) = (r.get(5), r.get(6).and_then(|y| y.trim().parse::<i16>().ok())) else { continue };
            let lot = Lot { years: vec![y], use_def: r.get(7).cloned().unwrap_or_default(), ..Default::default() };
            lots.entry(apn8(apn)).and_modify(|l| l.merge(&lot)).or_insert(lot);
        }
        let items: Vec<(String, Parts)> =
            read_layer(&c.join("sj_parcels"))?.into_iter().map(|(p, parts)| (text(&p, "apn").to_string(), parts)).collect();
        println!("  san_jose_bpo: {} BPO records, {} parcel polygons", lots.len(), items.len());
        ParcelSource::new(S_SJ_BPO, items, lots)
    };
    let santa_clara: Polys<f32> = Polys::new(
        read_layer(&c.join("santa_clara_footprints"))?
            .into_iter()
            .filter_map(|(p, parts)| Some((num(&p, "building_h").filter(|&h| h > 0.0)? as f32 * FT, parts)))
            .collect(),
    );
    println!("  santa clara footprints with height: {}", santa_clara.len());
    let cupertino: Polys<Cup> = Polys::new(
        read_layer(&c.join("cupertino"))?
            .into_iter()
            .filter(|(p, _)| text(p, "LEVEL_DESC") == "Building Footprint")
            .map(|(p, parts)| {
                let floors = pos(&p, "FloorNumbe");
                // BLDG_HEIGHT is feet; drop values impossible for the floor count.
                let height = pos(&p, "BLDG_HEIGHT").filter(|h| floors.is_none_or(|f| h / f <= 25.0)).map(|h| h * FT);
                let year = num(&p, "Year_Built").map(|ms| (1970.0 + ms / 31_556_952_000.0) as i16);
                (Cup { year, height, floors }, parts)
            })
            .collect(),
    );
    println!("  cupertino buildings: {}", cupertino.len());
    let enrich = Enricher::load(ctx)?;

    // Footprints.
    let mut bs: Vec<Building> = Vec::new();
    let sf_ctx = Ctx::new("sf")?;
    if !sf_ctx.joined().exists() {
        (sf_ctx.city.join)(&sf_ctx)?;
    }
    for_each_chunk(&sf_ctx.joined(), |ch| {
        bs.extend(ch);
        Ok(())
    })?;
    let n_sf = bs.len();
    let solano = counties.iter().position(|k| k.fips == "095");
    if let Some(si) = solano {
        let fps = read_layer(&c.join("solano_footprints"))?;
        bs.par_extend(fps.into_par_iter().filter_map(|(p, parts)| {
            (county_of(centroid(&parts)) == Some(si)).then(|| {
                let mut b = Building {
                    // APN kept for the parcel fallback below.
                    src_id: format!("solano:{}:{}", num(&p, "objectid").unwrap_or(0.0), text(&p, "apn")),
                    parts,
                    footprint_src: S_SOLANO_FP,
                    height_default: 5.0,
                    ground_m: num(&p, "ground_elevation").map(|g| g as f32 * FT),
                    use_class: USE_OTHER,
                    ..Default::default()
                };
                b.height(S_SOLANO_FP, pos(&p, "building_height").map(|h| h * FT));
                b
            })
        }));
    }
    let n_solano = bs.len() - n_sf;
    let reader = ParquetRecordBatchReaderBuilder::try_new(std::fs::File::open(overture_path(ctx, release.trim()))?)?
        .with_batch_size(100_000)
        .build()?;
    let (mut rows, mut outside, mut replaced) = (0usize, 0usize, 0usize);
    for batch in reader {
        let batch = batch?;
        rows += batch.num_rows();
        let cols = Cols::new(&batch)?;
        let out: Vec<Option<Building>> = (0..batch.num_rows())
            .into_par_iter()
            .map(|i| {
                let parts = cols.wkb[i].and_then(parse_wkb)?;
                let k = county_of(centroid(&parts));
                match k {
                    Some(k) if fips_of(k) != SF_COUNTY && Some(k) != solano => Some(cols.building(i, parts)),
                    Some(_) => Some(Building { src_id: String::new(), ..Default::default() }), // replaced
                    None => None,
                }
            })
            .collect();
        for b in out {
            match b {
                Some(b) if b.src_id.is_empty() => replaced += 1,
                Some(b) => bs.push(b),
                None => outside += 1,
            }
        }
    }
    println!(
        "footprints: SF {n_sf}, Solano LiDAR {n_solano}, Overture {} (of {rows} in the bbox; {outside} outside the counties, {replaced} replaced in SF/Solano)",
        bs.len() - n_sf - n_solano
    );

    // Attach values (SF buildings already carry theirs).
    let used: Vec<Vec<(u8, u32)>> = bs[n_sf..]
        .par_iter_mut()
        .map(|b| {
            let cen = centroid(&b.parts);
            let Some(k) = county_of(cen) else { return vec![] };
            b.area = counties[k].name.clone();
            let fips = fips_of(k);
            // Neighbour-fill group: the county's main year source.
            b.dataset = match fips {
                "097" => S_SONOMA,
                "055" => S_NAPA,
                "095" => S_SOLANO_PARCELS,
                "013" => S_CONTRA_COSTA,
                "001" => S_ALAMEDA,
                "085" => S_CUPERTINO,
                _ => S_OVT_OTHER,
            };
            let mut used = Vec::new();
            for (f, ps) in &parcels {
                if *f == fips {
                    // Solano LiDAR footprints carry their parcel's APN: try it first.
                    let mut hit = None;
                    if b.footprint_src == S_SOLANO_FP {
                        let apn = b.src_id.rsplit(':').next().unwrap_or("").to_string();
                        hit = ps.apply_id(b, &apn);
                    }
                    if hit.is_none() {
                        hit = ps.apply(b);
                    }
                    if let Some(p) = hit {
                        used.push((ps.src, p));
                    }
                }
            }
            if fips == "085" {
                if let Some(h) = santa_clara.matching(&b.parts) {
                    b.height(S_SANTA_CLARA_FP, Some(*h));
                }
                if let Some(cu) = cupertino.matching(&b.parts) {
                    b.year(S_CUPERTINO, cu.year, false, false);
                    b.height(S_CUPERTINO, cu.height);
                    b.floors(S_CUPERTINO, cu.floors);
                }
                if let Some(p) = sj.apply(b) {
                    used.push((S_SJ_BPO, p));
                }
            }
            enrich.apply(b);
            used
        })
        .collect();
    // Listings (../zillow): years outside SF, where the assessor has them all; facts everywhere.
    if let Some(l) = super::listings::Listings::load(ctx)? {
        let hit: usize = bs.par_iter_mut().enumerate().map(|(i, b)| l.apply(b, i >= n_sf) as usize).sum();
        println!("buildings with a listing: {hit}");
    }
    let mut used_all = vec![Vec::new(); n_sf];
    used_all.extend(used);
    let shared = mark_shared(&mut bs, &used_all);
    println!("buildings with a year from a parcel shared with other buildings: {shared}");

    // Coverage by county and source (any candidate, before cleaning).
    let mut cov: BTreeMap<(String, u8), usize> = BTreeMap::new();
    let mut tot: BTreeMap<String, usize> = BTreeMap::new();
    for b in &bs {
        *tot.entry(b.area.clone()).or_default() += 1;
        for yc in &b.year_c {
            *cov.entry((b.area.clone(), yc.src)).or_default() += 1;
        }
    }
    println!("year candidates by county (% of the county's buildings):");
    for (a, t) in &tot {
        let list: Vec<String> = cov
            .iter()
            .filter(|((ca, _), _)| ca == a)
            .map(|((_, s), n)| format!("{} {:.1}%", SOURCES[*s as usize].id, 100.0 * *n as f64 / *t as f64))
            .collect();
        println!("  {a:<14} {t:>8}: {}", list.join(", "));
    }

    let mut w = Writer::create(&ctx.joined())?;
    w.extend(bs)?;
    let n = w.finish()?;
    println!("wrote {n} buildings to {}", ctx.joined().display());
    Ok(())
}

/// "721 CLOVERDALE BLVD N" -> "721 Cloverdale Blvd N".
fn title_case(s: &str) -> String {
    super::nyc::title_case(s)
}

fn overture_src(dataset: &str) -> u8 {
    match dataset {
        "OpenStreetMap" => S_OVT_OSM,
        "Microsoft ML Buildings" => S_OVT_MSFT,
        "Esri Community Maps" => S_OVT_ESRI,
        "USGS Lidar" => S_OVT_USGS,
        _ => S_OVT_OTHER,
    }
}

/// Typed views of one record batch.
struct Cols<'a> {
    id: Vec<Option<&'a str>>,
    wkb: Vec<Option<&'a [u8]>>,
    height: Vec<Option<f64>>,
    floors: Vec<Option<i64>>,
    class: Vec<Option<&'a str>>,
    subtype: Vec<Option<&'a str>>,
    hsrc: Vec<Option<&'a str>>,
    fsrc: Vec<Option<&'a str>>,
}

impl<'a> Cols<'a> {
    fn new(b: &'a RecordBatch) -> Result<Self> {
        let col = |n: &str| b.column_by_name(n).with_context(|| format!("column {n}"));
        Ok(Cols {
            id: strs(col("id")?)?,
            wkb: bins(col("wkb")?)?,
            height: f64s(col("height")?)?,
            floors: i64s(col("num_floors")?)?,
            class: strs(col("class")?)?,
            subtype: strs(col("subtype")?)?,
            hsrc: strs(col("hsrc")?)?,
            fsrc: strs(col("fsrc")?)?,
        })
    }
    fn building(&self, i: usize, parts: Parts) -> Building {
        let class = self.class[i].unwrap_or("");
        let subtype = self.subtype[i].unwrap_or("");
        let mut b = Building {
            dataset: S_OVT_OTHER,
            src_id: self.id[i].unwrap_or("").to_string(),
            parts,
            footprint_src: overture_src(self.fsrc[i].unwrap_or("")),
            height_default: default_height(class, subtype),
            use_class: overture_use(class, subtype),
            use_def: match (class, subtype) {
                ("", "") => String::new(),
                ("", s) => s.replace('_', " "),
                (c, _) => c.replace('_', " "),
            },
            ..Default::default()
        };
        b.height(overture_src(self.hsrc[i].unwrap_or("")), self.height[i].map(|h| h as f32));
        b.floors(S_OVT_OTHER, self.floors[i].map(|f| f as f32));
        b
    }
}

fn overture_use(class: &str, subtype: &str) -> u8 {
    match subtype {
        "residential" => return USE_RESIDENTIAL,
        "commercial" => return USE_COMMERCIAL,
        "industrial" => return USE_INDUSTRIAL,
        "civic" | "education" | "medical" | "religious" | "transportation" | "service" | "entertainment"
        | "military" => return USE_CIVIC,
        "outbuilding" | "agricultural" => return USE_OTHER,
        _ => {}
    }
    match class {
        "house" | "detached" | "residential" | "apartments" | "semidetached_house" | "terrace" | "bungalow"
        | "static_caravan" | "dormitory" | "cabin" => USE_RESIDENTIAL,
        "commercial" | "retail" | "office" | "hotel" | "supermarket" => USE_COMMERCIAL,
        "industrial" | "warehouse" | "factory" | "manufacture" => USE_INDUSTRIAL,
        "school" | "university" | "college" | "church" | "hospital" | "civic" | "government" | "public"
        | "fire_station" | "library" | "train_station" => USE_CIVIC,
        _ => USE_OTHER,
    }
}

/// Height when Overture has neither height nor floors.
fn default_height(class: &str, subtype: &str) -> f32 {
    match class {
        "shed" | "garage" | "garages" | "carport" | "hut" | "kiosk" | "shelter" | "roof" | "static_caravan"
        | "greenhouse" | "toilets" | "parking" => 3.0,
        "house" | "detached" | "semidetached_house" | "bungalow" | "terrace" | "cabin" | "residential" => 6.0,
        "apartments" | "dormitory" | "hotel" => 10.0,
        "" if subtype == "outbuilding" => 3.0,
        "" => 5.0, // unclassified: mostly single-storey ML footprints
        _ => 8.0,
    }
}

fn geojson_rings(g: &Value) -> Vec<Vec<[f64; 2]>> {
    let ring = |r: &Value| -> Vec<[f64; 2]> {
        r.as_array().into_iter().flatten().filter_map(|c| Some([c[0].as_f64()?, c[1].as_f64()?])).collect()
    };
    let c = &g["coordinates"];
    match g["type"].as_str() {
        Some("Polygon") => c.as_array().into_iter().flatten().map(ring).collect(),
        Some("MultiPolygon") => c.as_array().into_iter().flatten().flat_map(|p| p.as_array().into_iter().flatten().map(ring)).collect(),
        _ => vec![],
    }
}

/// Minimal WKB reader: Polygon / MultiPolygon, 2D (Z/M ordinates dropped).
pub fn parse_wkb(b: &[u8]) -> Option<Parts> {
    let mut r = Wkb { b, pos: 0 };
    let (le, ty, dims) = r.header()?;
    let parts = match ty {
        3 => vec![r.polygon(le, dims)?],
        6 => {
            let n = r.u32(le)?;
            (0..n)
                .map(|_| {
                    let (le, ty, dims) = r.header()?;
                    (ty == 3).then_some(())?;
                    r.polygon(le, dims)
                })
                .collect::<Option<Vec<_>>>()?
        }
        _ => return None,
    };
    let parts: Parts = parts.into_iter().filter(|p| p.first().is_some_and(|r| r.len() >= 4)).collect();
    (!parts.is_empty()).then_some(parts)
}

struct Wkb<'a> {
    b: &'a [u8],
    pos: usize,
}

impl Wkb<'_> {
    fn bytes<const N: usize>(&mut self) -> Option<[u8; N]> {
        let s = self.b.get(self.pos..self.pos + N)?;
        self.pos += N;
        s.try_into().ok()
    }
    fn u32(&mut self, le: bool) -> Option<u32> {
        let b = self.bytes::<4>()?;
        Some(if le { u32::from_le_bytes(b) } else { u32::from_be_bytes(b) })
    }
    fn f64(&mut self, le: bool) -> Option<f64> {
        let b = self.bytes::<8>()?;
        Some(if le { f64::from_le_bytes(b) } else { f64::from_be_bytes(b) })
    }
    /// (little endian, base type, ordinates per point); ISO and EWKB Z/M.
    fn header(&mut self) -> Option<(bool, u32, usize)> {
        let le = self.bytes::<1>()?[0] == 1;
        let t = self.u32(le)?;
        let (z, m) = (t & 0x8000_0000 != 0 || (t % 10000) / 1000 == 1 || (t % 10000) / 1000 == 3, t & 0x4000_0000 != 0 || (t % 10000) / 1000 >= 2);
        if t & 0x2000_0000 != 0 {
            self.u32(le)?; // EWKB SRID
        }
        Some((le, (t & 0x0fff_ffff) % 1000, 2 + z as usize + m as usize))
    }
    fn polygon(&mut self, le: bool, dims: usize) -> Option<Vec<Vec<[f64; 2]>>> {
        let nr = self.u32(le)?;
        (0..nr)
            .map(|_| {
                let np = self.u32(le)? as usize;
                (np <= (self.b.len() - self.pos) / (8 * dims)).then_some(())?;
                (0..np)
                    .map(|_| {
                        let x = self.f64(le)?;
                        let y = self.f64(le)?;
                        for _ in 2..dims {
                            self.f64(le)?;
                        }
                        Some([x, y])
                    })
                    .collect()
            })
            .collect()
    }
}
