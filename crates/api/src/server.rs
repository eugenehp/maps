//! Routes and handlers for `/api/v1` (spec: crates/api/openapi.yaml).

use crate::city::City;
use crate::providers::{marks::Marks, Item, ItemInput, ItemStore};
use crate::registry::{Merged, Registry};
use crate::spatial::Index;
use axum::{
    body::Bytes,
    extract::{Path, Query, Request, State},
    http::{header, HeaderMap, HeaderValue, Method, StatusCode},
    middleware::{self, Next},
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse, Response,
    },
    routing::{get, post, put},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::sync::Arc;
use tokio::sync::broadcast;

const OPENAPI: &str = include_str!("../openapi.yaml");

pub struct App {
    pub cities: BTreeMap<String, Arc<City>>,
    pub registry: Registry,
    pub marks: Arc<Marks>,
    /// writes need `Authorization: Bearer <token>` when set
    pub token: Option<String>,
    /// change notifications: (city, what)
    pub events: broadcast::Sender<(String, &'static str)>,
    pub log: bool,
}
type S = State<Arc<App>>;

// ---------- errors ----------
pub enum ApiError {
    NotFound(String),
    Bad(String),
    Unauthorized,
    Internal(anyhow::Error),
}
impl From<anyhow::Error> for ApiError {
    fn from(e: anyhow::Error) -> Self {
        ApiError::Internal(e)
    }
}
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (code, msg) = match self {
            ApiError::NotFound(m) => (StatusCode::NOT_FOUND, m),
            ApiError::Bad(m) => (StatusCode::BAD_REQUEST, m),
            ApiError::Unauthorized => (StatusCode::UNAUTHORIZED, "this server needs a token for writes (Authorization: Bearer …)".into()),
            ApiError::Internal(e) => {
                eprintln!("error: {e:#}");
                (StatusCode::INTERNAL_SERVER_ERROR, format!("{e:#}"))
            }
        };
        (code, Json(json!({ "error": msg }))).into_response()
    }
}
type R<T> = Result<T, ApiError>;
fn bad(m: impl Into<String>) -> ApiError {
    ApiError::Bad(m.into())
}

/// Run blocking work (tile reads, index builds, SQLite) off the async threads.
async fn blocking<T: Send + 'static>(f: impl FnOnce() -> anyhow::Result<T> + Send + 'static) -> R<T> {
    Ok(tokio::task::spawn_blocking(f).await.map_err(|e| anyhow::anyhow!(e))??)
}

/// Same, for work that returns API errors (validation inside the blocking part).
async fn blocking_r<T: Send + 'static>(f: impl FnOnce() -> R<T> + Send + 'static) -> R<T> {
    tokio::task::spawn_blocking(f).await.map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
}

fn city(app: &App, id: &str) -> R<Arc<City>> {
    app.cities.get(id).cloned().ok_or_else(|| ApiError::NotFound(format!("no city '{id}'")))
}

async fn merged(app: &Arc<App>, id: &str) -> R<(Arc<City>, Arc<Merged>)> {
    let c = city(app, id)?;
    let (a, c2) = (app.clone(), c.clone());
    let m = blocking(move || a.registry.merged(&c2)).await?;
    Ok((c, m))
}

async fn index(c: &Arc<City>) -> R<Arc<Index>> {
    let c = c.clone();
    blocking(move || c.index()).await
}

// ---------- shared query parts ----------
/// Where: `bbox=lon0,lat0,lon1,lat1`, or `near=lon,lat` with `radius` metres (default 250).
#[derive(Deserialize, Default)]
pub struct Area {
    bbox: Option<String>,
    near: Option<String>,
    radius: Option<f32>,
}

enum Where {
    All,
    Box([f32; 4]),
    Near(f32, f32, f32),
}

fn floats(s: &str, n: usize, what: &str) -> R<Vec<f64>> {
    let v: Vec<f64> = s.split(',').map(|t| t.trim().parse::<f64>()).collect::<Result<_, _>>().map_err(|_| bad(format!("{what}: numbers expected")))?;
    if v.len() != n {
        return Err(bad(format!("{what}: {n} numbers expected")));
    }
    Ok(v)
}

impl Area {
    fn resolve(&self, c: &City) -> R<Where> {
        if let Some(b) = &self.bbox {
            let v = floats(b, 4, "bbox")?;
            let (ax, az) = c.to_xz(v[0].min(v[2]), v[1].max(v[3]));
            let (bx, bz) = c.to_xz(v[0].max(v[2]), v[1].min(v[3]));
            return Ok(Where::Box([ax as f32, az as f32, bx as f32, bz as f32]));
        }
        if let Some(n) = &self.near {
            let v = floats(n, 2, "near")?;
            let (x, z) = c.to_xz(v[0], v[1]);
            let r = self.radius.unwrap_or(250.0);
            if !(r > 0.0 && r <= 20_000.0) {
                return Err(bad("radius: 0 < radius ≤ 20000 m"));
            }
            return Ok(Where::Near(x as f32, z as f32, r));
        }
        Ok(Where::All)
    }
}

impl Where {
    /// gids in the area (nearest first for `near`), or None for "everywhere".
    fn gids(&self, ix: &Index) -> Option<Vec<u32>> {
        match *self {
            Where::All => None,
            Where::Box([x0, z0, x1, z1]) => Some(ix.in_box(x0, z0, x1, z1)),
            Where::Near(x, z, r) => Some(ix.near(x, z, r).into_iter().map(|(_, g)| g).collect()),
        }
    }
    fn contains(&self, ix: &Index, g: u32) -> bool {
        let (x, z) = (ix.cx[g as usize], ix.cz[g as usize]);
        match *self {
            Where::All => true,
            Where::Box([x0, z0, x1, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1,
            Where::Near(cx, cz, r) => (x - cx).powi(2) + (z - cz).powi(2) <= r * r,
        }
    }
}

#[derive(Deserialize, Default, PartialEq, Clone, Copy)]
#[serde(rename_all = "lowercase")]
enum Format {
    #[default]
    Json,
    Geojson,
}

fn round7(v: f64) -> f64 {
    (v * 1e7).round() / 1e7
}
fn centroid_lonlat(c: &City, ix: &Index, g: u32) -> [f64; 2] {
    let (lon, lat) = c.to_lonlat(ix.cx[g as usize] as f64, ix.cz[g as usize] as f64);
    [round7(lon), round7(lat)]
}

// ---------- handlers: service ----------
async fn root(State(app): S) -> Json<Value> {
    Json(json!({
        "name": "city building-by-building API", "version": "v1",
        "cities": app.cities.keys().collect::<Vec<_>>(),
        "providers": app.registry.infos(),
        "writes": if app.token.is_some() { "token" } else { "open" },
        "docs": "/api/v1/openapi.yaml",
    }))
}

async fn openapi() -> impl IntoResponse {
    ([(header::CONTENT_TYPE, "application/yaml")], OPENAPI)
}

async fn cities(State(app): S) -> Json<Value> {
    Json(json!(app.cities.values().map(|c| c.summary()).collect::<Vec<_>>()))
}

async fn city_info(State(app): S, Path(id): Path<String>) -> R<Json<Value>> {
    let c = city(&app, &id)?;
    let mut v = c.summary();
    v["links"] = json!({
        "manifest": format!("/data/{id}/index.json"),
        "buildings": format!("/api/v1/cities/{id}/buildings"),
        "layers": format!("/api/v1/cities/{id}/layers"),
        "items": format!("/api/v1/cities/{id}/items"),
        "stats": format!("/api/v1/cities/{id}/stats"),
        "marks": format!("/api/v1/cities/{id}/marks"),
        "events": format!("/api/v1/cities/{id}/events"),
    });
    Ok(Json(v))
}

// ---------- handlers: buildings ----------
fn occupant(it: &Item) -> Value {
    let mut v = json!({ "id": it.id, "layer": it.layer, "category": it.category, "name": it.name, "role": it.role,
            "from": it.from, "to": it.to, "url": it.url, "note": it.note, "wikidata": it.wikidata,
            "source": it.source, "tags": it.tags });
    if let Some(a) = &it.author {
        v["author"] = json!(a);
    }
    v
}

#[derive(Deserialize, Default)]
struct One {
    #[serde(default)]
    format: Format,
}

fn feature(c: &City, gid: u32, props: Value) -> anyhow::Result<Value> {
    let fp = c.footprint(gid)?.unwrap_or_default();
    Ok(json!({ "type": "Feature", "id": gid, "geometry": { "type": "MultiPolygon", "coordinates": fp }, "properties": props }))
}

async fn building(State(app): S, Path((id, gid)): Path<(String, u32)>, Query(q): Query<One>) -> R<Json<Value>> {
    let (c, m) = merged(&app, &id).await?;
    let v = blocking(move || -> anyhow::Result<Option<Value>> {
        let Some(mut b) = c.building(gid)? else { return Ok(None) };
        b["occupants"] = json!(m.items_of(gid).map(occupant).collect::<Vec<_>>());
        Ok(Some(if q.format == Format::Geojson { feature(&c, gid, b)? } else { b }))
    })
    .await?;
    v.map(Json).ok_or_else(|| ApiError::NotFound(format!("no building {gid}")))
}

#[derive(Deserialize)]
struct At {
    lon: f64,
    lat: f64,
    #[serde(default)]
    format: Format,
}
async fn building_at(State(app): S, Path(id): Path<String>, Query(q): Query<At>) -> R<Json<Value>> {
    let c = city(&app, &id)?;
    let gid = blocking(move || c.building_at(q.lon, q.lat)).await?;
    match gid {
        Some(g) => building(State(app), Path((id, g)), Query(One { format: q.format })).await,
        None => Err(ApiError::NotFound("no building at or within 25 m of that point".into())),
    }
}

/// Filters on the indexed attributes.
#[derive(Deserialize, Default)]
struct BuildingFilter {
    year_from: Option<i16>,
    year_to: Option<i16>,
    /// include buildings whose year is unknown (default: only when no year filter is given)
    unknown_year: Option<bool>,
    /// only exact (not approximate) years
    exact_year: Option<bool>,
    /// period index or name
    period: Option<String>,
    /// use name (residential, commercial, …) or index
    #[serde(rename = "use")]
    use_: Option<String>,
    min_height: Option<f32>,
    max_height: Option<f32>,
    min_floors: Option<u8>,
    landmark: Option<bool>,
    /// buildings that have been demolished: left out by default; `true` for those only, `any` for both;
    /// or `standing=<year>`: the buildings standing in that year (built by then, not yet demolished)
    demolished: Option<String>,
    standing: Option<i16>,
    /// buildings with an occupant in this layer / category (any provider)
    layer: Option<String>,
    category: Option<String>,
}

fn name_or_index(v: &str, names: &Value) -> Option<u8> {
    v.parse::<u8>().ok().or_else(|| {
        names.as_array()?.iter().position(|n| {
            let s = n.as_str().or_else(|| n["name"].as_str()).unwrap_or_default();
            s.eq_ignore_ascii_case(v)
        }).map(|i| i as u8)
    })
}

struct Compiled {
    f: BuildingFilter,
    period: Option<u8>,
    use_: Option<u8>,
    occ: Option<Vec<bool>>,
}

impl Compiled {
    fn new(f: BuildingFilter, c: &City, m: &Merged) -> R<Compiled> {
        let period = f.period.as_deref().map(|p| name_or_index(p, &c.manifest["periods"]).ok_or_else(|| bad(format!("unknown period '{p}'")))).transpose()?;
        let use_ = f.use_.as_deref().map(|u| name_or_index(u, &c.manifest["uses"]).ok_or_else(|| bad(format!("unknown use '{u}'")))).transpose()?;
        let occ = if f.layer.is_some() || f.category.is_some() {
            let mut v = vec![false; c.count as usize];
            for it in &m.items {
                if f.layer.as_ref().is_some_and(|l| &it.layer != l) {
                    continue;
                }
                if let Some(cat) = &f.category {
                    if !category_matches(m, it, cat) {
                        continue;
                    }
                }
                for &g in &it.gids {
                    if let Some(x) = v.get_mut(g as usize) {
                        *x = true;
                    }
                }
            }
            Some(v)
        } else {
            None
        };
        Ok(Compiled { f, period, use_, occ })
    }

    fn test(&self, ix: &Index, g: u32) -> bool {
        let (i, f) = (g as usize, &self.f);
        let y = ix.year[i];
        let gone = ix.demolished.get(i).copied().unwrap_or(0);
        if let Some(at) = f.standing {
            if (y > 0 && y > at) || (gone != 0 && gone <= at) {
                return false;
            }
        } else {
            match f.demolished.as_deref() {
                Some("any") => {}
                Some("true") | Some("only") => {
                    if gone == 0 {
                        return false;
                    }
                }
                _ => {
                    if gone != 0 {
                        return false;
                    }
                }
            }
        }
        let year_filter = f.year_from.is_some() || f.year_to.is_some();
        if y <= 0 {
            if !f.unknown_year.unwrap_or(!year_filter) {
                return false;
            }
        } else {
            if f.year_from.is_some_and(|a| y < a) || f.year_to.is_some_and(|b| y > b) {
                return false;
            }
            if f.exact_year == Some(true) && ix.flags[i] & 1 != 0 {
                return false;
            }
        }
        if self.period.is_some_and(|p| ix.period[i] != p) || self.use_.is_some_and(|u| ix.use_[i] != u) {
            return false;
        }
        if f.min_height.is_some_and(|h| ix.height[i] < h) || f.max_height.is_some_and(|h| ix.height[i] > h) {
            return false;
        }
        if f.min_floors.is_some_and(|n| ix.floors[i] < n) {
            return false;
        }
        if f.landmark.is_some_and(|l| (ix.flags[i] & 2 != 0) != l) {
            return false;
        }
        if let Some(o) = &self.occ {
            if !o[i] {
                return false;
            }
        }
        true
    }
}

fn category_matches(m: &Merged, it: &Item, want: &str) -> bool {
    if it.category == want {
        return true;
    }
    m.layer(&it.layer)
        .and_then(|(_, l)| l.def.categories.iter().find(|c| c.id == it.category))
        .is_some_and(|c| c.parent.as_deref() == Some(want))
}

#[derive(Deserialize, Default, Clone, Copy, PartialEq)]
#[serde(rename_all = "lowercase")]
enum Sort {
    #[default]
    Gid,
    Near,
    Year,
    Height,
}

#[derive(Deserialize)]
struct Page {
    #[serde(default)]
    format: Format,
    #[serde(default)]
    sort: Sort,
    /// descending
    #[serde(default)]
    desc: bool,
    limit: Option<usize>,
    #[serde(default)]
    offset: usize,
}

async fn buildings(State(app): S, Path(id): Path<String>, Query(area): Query<Area>, Query(f): Query<BuildingFilter>, Query(p): Query<Page>) -> R<Json<Value>> {
    let (c, m) = merged(&app, &id).await?;
    let ix = index(&c).await?;
    let wh = area.resolve(&c)?;
    let filt = Compiled::new(f, &c, &m)?;
    let max = if p.format == Format::Geojson { 2000 } else { 10_000 };
    let limit = p.limit.unwrap_or(100).min(max);
    blocking(move || {
        let mut hits: Vec<u32> = match wh.gids(&ix) {
            Some(v) => v.into_iter().filter(|&g| filt.test(&ix, g)).collect(),
            None => (0..ix.len() as u32).filter(|&g| filt.test(&ix, g)).collect(),
        };
        match p.sort {
            Sort::Gid => {}
            Sort::Near => {
                if !matches!(wh, Where::Near(..)) {
                    anyhow::bail!("sort=near needs near=lon,lat");
                }
            }
            Sort::Year => hits.sort_by_key(|&g| ix.year[g as usize]),
            Sort::Height => hits.sort_by(|&a, &b| ix.height[a as usize].total_cmp(&ix.height[b as usize])),
        }
        if p.desc {
            hits.reverse();
        }
        let total = hits.len();
        let page: Vec<u32> = hits.into_iter().skip(p.offset).take(limit).collect();
        let row = |g: u32| {
            let i = g as usize;
            json!({
                "gid": g, "year": (ix.year[i] > 0).then_some(ix.year[i]), "approximateYear": ix.flags[i] & 1 != 0,
                "period": c.manifest["periods"].get(ix.period[i] as usize).map(|p| p["name"].clone()),
                "use": c.manifest["uses"].get(ix.use_[i] as usize), "floors": ix.floors[i],
                "height": (ix.height[i] as f64 * 10.0).round() / 10.0, "lonlat": centroid_lonlat(&c, &ix, g),
            })
        };
        let next = (p.offset + page.len() < total).then(|| p.offset + page.len());
        if p.format == Format::Geojson {
            let features = page.iter().map(|&g| feature(&c, g, row(g))).collect::<anyhow::Result<Vec<_>>>()?;
            Ok(json!({ "type": "FeatureCollection", "total": total, "next": next, "features": features }))
        } else {
            Ok(json!({ "total": total, "offset": p.offset, "next": next, "items": page.into_iter().map(row).collect::<Vec<_>>() }))
        }
    })
    .await
    .map(Json)
    .map_err(|e| match e {
        ApiError::Internal(e) if e.to_string().starts_with("sort=") => bad(e.to_string()),
        e => e,
    })
}

// ---------- handlers: layers ----------
/// ETag on the merged version: the map revalidates instead of downloading again.
fn etagged(headers: &HeaderMap, version: u64, body: impl IntoResponse) -> Response {
    let tag = format!("\"{version:x}\"");
    if headers.get(header::IF_NONE_MATCH).and_then(|v| v.to_str().ok()) == Some(tag.as_str()) {
        return StatusCode::NOT_MODIFIED.into_response();
    }
    let mut r = body.into_response();
    r.headers_mut().insert(header::ETAG, HeaderValue::from_str(&tag).unwrap());
    r.headers_mut().insert(header::CACHE_CONTROL, HeaderValue::from_static("no-cache"));
    r
}

async fn layers(State(app): S, Path(id): Path<String>, headers: HeaderMap) -> R<Response> {
    let (_, m) = merged(&app, &id).await?;
    Ok(etagged(&headers, m.version, Json(m.client_json(&app.registry.infos()))))
}

async fn links(State(app): S, Path(id): Path<String>, headers: HeaderMap) -> R<Response> {
    let (_, m) = merged(&app, &id).await?;
    let body = ([(header::CONTENT_TYPE, "application/octet-stream")], Bytes::from(m.links_bin()));
    Ok(etagged(&headers, m.version, body))
}

#[derive(Deserialize)]
struct ItemQuery {
    layer: Option<String>,
    /// a category id; includes its child categories
    category: Option<String>,
    tag: Option<String>,
    /// occupants active in this year
    year: Option<i32>,
    /// case-insensitive substring of the name
    q: Option<String>,
    provider: Option<String>,
    author: Option<String>,
    #[serde(default)]
    format: Format,
    #[serde(default = "default_limit")]
    limit: usize,
    #[serde(default)]
    offset: usize,
}
fn default_limit() -> usize {
    100
}

fn provider_of(it: &Item) -> &str {
    it.id.split(':').next().map(|p| if p == "gen" { "generated" } else if p == "mark" { "marks" } else { p }).unwrap_or("")
}

async fn items(State(app): S, Path(id): Path<String>, Query(q): Query<ItemQuery>, Query(area): Query<Area>) -> R<Json<Value>> {
    let (c, m) = merged(&app, &id).await?;
    let wh = area.resolve(&c)?;
    let ix = if matches!(wh, Where::All) && q.format == Format::Json { None } else { Some(index(&c).await?) };
    let v = blocking(move || {
        let needle = q.q.as_ref().map(|s| s.to_lowercase());
        let hits: Vec<&Item> = m
            .items
            .iter()
            .filter(|it| q.layer.as_ref().is_none_or(|l| &it.layer == l))
            .filter(|it| q.category.as_ref().is_none_or(|cat| category_matches(&m, it, cat)))
            .filter(|it| q.tag.as_ref().is_none_or(|t| it.tags.contains(t)))
            .filter(|it| q.year.is_none_or(|y| it.from.is_none_or(|f| f <= y) && it.to.is_none_or(|t| t >= y)))
            .filter(|it| needle.as_ref().is_none_or(|n| it.name.to_lowercase().contains(n)))
            .filter(|it| q.provider.as_ref().is_none_or(|p| provider_of(it) == p))
            .filter(|it| q.author.as_ref().is_none_or(|a| it.author.as_ref() == Some(a)))
            .filter(|it| ix.as_ref().is_none_or(|ix| it.gids.iter().any(|&g| (g as usize) < ix.len() && wh.contains(ix, g))))
            .collect();
        let total = hits.len();
        let page: Vec<Value> = hits
            .iter()
            .skip(q.offset)
            .take(q.limit.min(1000))
            .map(|it| {
                let mut v = occupant(it);
                v["gids"] = json!(it.gids);
                v["provider"] = json!(provider_of(it));
                if let (Some(ix), Some(&g)) = (&ix, it.gids.first()) {
                    v["lonlat"] = json!(it.lonlat.unwrap_or_else(|| centroid_lonlat(&c, ix, g)));
                }
                v
            })
            .collect();
        let next = (q.offset + page.len() < total).then(|| q.offset + page.len());
        Ok(if q.format == Format::Geojson {
            let features: Vec<Value> = page
                .into_iter()
                .map(|v| json!({ "type": "Feature", "id": v["id"], "geometry": { "type": "Point", "coordinates": v["lonlat"] }, "properties": v }))
                .collect();
            json!({ "type": "FeatureCollection", "total": total, "next": next, "features": features })
        } else {
            json!({ "total": total, "offset": q.offset, "next": next, "items": page })
        })
    })
    .await?;
    Ok(Json(v))
}

// ---------- handlers: stats ----------
#[derive(Deserialize, Clone, Copy, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
enum By {
    #[default]
    Period,
    Use,
    Decade,
    Year,
    YearSource,
    Category,
    Floors,
}

#[derive(Deserialize)]
struct StatsQuery {
    #[serde(default)]
    by: By,
    layer: Option<String>,
}

async fn stats(State(app): S, Path(id): Path<String>, Query(area): Query<Area>, Query(f): Query<BuildingFilter>, Query(q): Query<StatsQuery>) -> R<Json<Value>> {
    let (c, m) = merged(&app, &id).await?;
    let ix = index(&c).await?;
    let wh = area.resolve(&c)?;
    let filt = Compiled::new(f, &c, &m)?;
    let v = blocking(move || {
        let gids: Vec<u32> = match wh.gids(&ix) {
            Some(v) => v,
            None => (0..ix.len() as u32).collect(),
        };
        let gids: Vec<u32> = gids.into_iter().filter(|&g| filt.test(&ix, g)).collect();
        let mut groups: BTreeMap<String, (Value, usize)> = BTreeMap::new();
        let mut bump = |key: String, label: Value| groups.entry(key).or_insert((label, 0)).1 += 1;
        let man = &c.manifest;
        let no_src = man["noSource"].as_u64().unwrap_or(255) as u8;
        for &g in &gids {
            let i = g as usize;
            match q.by {
                By::Period => {
                    let p = ix.period[i];
                    let label = man["periods"].get(p as usize).map(|x| x["name"].clone()).unwrap_or(json!("Year unknown"));
                    bump(format!("{p:03}"), label);
                }
                By::Use => bump(format!("{:03}", ix.use_[i]), man["uses"].get(ix.use_[i] as usize).cloned().unwrap_or(Value::Null)),
                By::Decade => {
                    let y = ix.year[i];
                    if y > 0 { bump(format!("{}", y / 10 * 10), json!(format!("{}s", y / 10 * 10))) } else { bump("unknown".into(), json!("Year unknown")) }
                }
                By::Year => {
                    let y = ix.year[i];
                    if y > 0 { bump(format!("{y}"), json!(y)) } else { bump("unknown".into(), json!("Year unknown")) }
                }
                By::YearSource => {
                    let s = ix.year_src[i];
                    let label = if s == no_src { json!("No year") } else { man["sources"][s as usize]["name"].clone() };
                    bump(format!("{s:03}"), label);
                }
                By::Floors => {
                    let f = ix.floors[i];
                    let b = match f { 0..=1 => "1", 2 => "2", 3 => "3", 4..=5 => "4–5", 6..=10 => "6–10", 11..=20 => "11–20", 21..=40 => "21–40", _ => "40+" };
                    bump(format!("{:03}", f.min(41)), json!(b));
                }
                By::Category => {
                    let mut seen = std::collections::HashSet::new();
                    for it in m.items_of(g) {
                        if q.layer.as_ref().is_some_and(|l| &it.layer != l) {
                            continue;
                        }
                        let key = format!("{}/{}", it.layer, it.category);
                        if seen.insert(key.clone()) {
                            let name = m.layer(&it.layer).and_then(|(_, l)| l.def.categories.iter().find(|c| c.id == it.category)).map(|c| c.name.clone());
                            bump(key, json!(name));
                        }
                    }
                }
            }
        }
        // floors buckets share a label; fold them
        let mut out: Vec<Value> = Vec::new();
        for (k, (label, n)) in groups {
            if q.by == By::Floors {
                if let Some(last) = out.last_mut() {
                    if last["label"] == label {
                        last["count"] = json!(last["count"].as_u64().unwrap() + n as u64);
                        continue;
                    }
                }
            }
            out.push(json!({ "key": k, "label": label, "count": n }));
        }
        Ok(json!({ "total": gids.len(), "groups": out }))
    })
    .await?;
    Ok(Json(v))
}

// ---------- handlers: marks ----------
fn author(headers: &HeaderMap) -> Option<String> {
    headers.get("x-author").and_then(|v| v.to_str().ok()).map(|s| s.trim().chars().take(80).collect::<String>()).filter(|s| !s.is_empty())
}

fn check_token(app: &App, headers: &HeaderMap) -> R<()> {
    let Some(t) = &app.token else { return Ok(()) };
    let got = headers.get(header::AUTHORIZATION).and_then(|v| v.to_str().ok()).and_then(|v| v.strip_prefix("Bearer "));
    if got == Some(t.as_str()) { Ok(()) } else { Err(ApiError::Unauthorized) }
}

/// Field checks, and that a named layer/category exists.
fn validate(input: &ItemInput, m: &Merged) -> R<()> {
    let name = input.name.trim();
    if name.is_empty() || name.chars().count() > 200 {
        return Err(bad("name: 1–200 characters"));
    }
    for (k, y) in [("from", input.from), ("to", input.to)] {
        if y.is_some_and(|y| !(1600..=2100).contains(&y)) {
            return Err(bad(format!("{k}: a year between 1600 and 2100")));
        }
    }
    if let (Some(a), Some(b)) = (input.from, input.to) {
        if a > b {
            return Err(bad("from is after to"));
        }
    }
    if input.url.as_ref().is_some_and(|u| !(u.starts_with("https://") || u.starts_with("http://"))) {
        return Err(bad("url: http(s) only"));
    }
    if input.tags.len() > 20 || input.tags.iter().any(|t| t.is_empty() || t.chars().count() > 40) {
        return Err(bad("tags: up to 20, each 1–40 characters"));
    }
    if let Some(r) = &input.role {
        if !["founded", "hq", "office", "lab", "campus", "dorm", "other"].contains(&r.as_str()) {
            return Err(bad("role: founded | hq | office | lab | campus | dorm | other"));
        }
    }
    match (&input.layer, &input.category) {
        (Some(l), Some(c)) if l != crate::providers::marks::LAYER => {
            let ok = m.layer(l).is_some_and(|(_, ml)| ml.def.categories.iter().any(|x| &x.id == c));
            if !ok {
                return Err(bad(format!("no category '{c}' in layer '{l}' (or give categoryName for a new one)")));
            }
        }
        _ => {
            if input.category_name.as_ref().or(input.category.as_ref()).is_none_or(|s| s.trim().is_empty()) {
                return Err(bad("a mark needs layer+category, or categoryName"));
            }
        }
    }
    Ok(())
}

fn resolve_gid(c: &City, input: &ItemInput) -> R<u32> {
    if let Some(g) = input.gid {
        if g < c.count {
            return Ok(g);
        }
        return Err(bad(format!("gid {g} out of range")));
    }
    let Some([lon, lat]) = input.lonlat else { return Err(bad("a mark needs gid or lonlat")) };
    c.building_at(lon, lat)?.ok_or_else(|| bad("no building at or within 25 m of lonlat"))
}

async fn marks_list(State(app): S, Path(id): Path<String>) -> R<Json<Value>> {
    city(&app, &id)?;
    let (a, i) = (app.clone(), id.clone());
    Ok(Json(json!(blocking(move || a.marks.list(&i)).await?)))
}

fn create_one(app: &App, c: &City, m: &Merged, mut input: ItemInput, who: Option<String>) -> R<Item> {
    validate(&input, m)?;
    let gid = resolve_gid(c, &input)?;
    input.author = who;
    app.marks.create(&c.id, input, gid).map_err(|e| bad(format!("{e:#}")))
}

async fn marks_create(State(app): S, Path(id): Path<String>, headers: HeaderMap, Json(input): Json<ItemInput>) -> R<Response> {
    check_token(&app, &headers)?;
    let (c, m) = merged(&app, &id).await?;
    let a = app.clone();
    let who = author(&headers);
    let it = blocking_r(move || create_one(&a, &c, &m, input, who)).await?;
    let _ = app.events.send((id, "marks"));
    Ok((StatusCode::CREATED, Json(json!(it))).into_response())
}

#[derive(Deserialize)]
struct Batch {
    items: Vec<ItemInput>,
}
async fn marks_batch(State(app): S, Path(id): Path<String>, headers: HeaderMap, Json(b): Json<Batch>) -> R<Json<Value>> {
    check_token(&app, &headers)?;
    if b.items.len() > 5000 {
        return Err(bad("at most 5000 items per batch"));
    }
    let (c, m) = merged(&app, &id).await?;
    let a = app.clone();
    let who = author(&headers);
    let (created, errors) = tokio::task::spawn_blocking(move || {
        let (mut ok, mut err) = (Vec::new(), Vec::new());
        for (i, input) in b.items.into_iter().enumerate() {
            match create_one(&a, &c, &m, input, who.clone()) {
                Ok(it) => ok.push(json!(it)),
                Err(ApiError::Bad(e)) => err.push(json!({ "index": i, "error": e })),
                Err(ApiError::Internal(e)) => err.push(json!({ "index": i, "error": format!("{e:#}") })),
                Err(_) => err.push(json!({ "index": i, "error": "failed" })),
            }
        }
        (ok, err)
    })
    .await
    .map_err(|e| anyhow::anyhow!(e))?;
    if !created.is_empty() {
        let _ = app.events.send((id, "marks"));
    }
    Ok(Json(json!({ "created": created, "errors": errors })))
}

fn mark_id(s: &str) -> R<i64> {
    s.trim_start_matches("mark:").parse().map_err(|_| bad(format!("bad mark id '{s}'")))
}

async fn marks_update(State(app): S, Path((id, mid)): Path<(String, String)>, headers: HeaderMap, Json(input): Json<ItemInput>) -> R<Json<Value>> {
    check_token(&app, &headers)?;
    let (c, m) = merged(&app, &id).await?;
    validate(&input, &m)?;
    let n = mark_id(&mid)?;
    let a = app.clone();
    let it = blocking_r(move || {
        let gid = resolve_gid(&c, &input)?;
        Ok(a.marks.update(&c.id, n, input, gid)?)
    })
    .await?;
    let _ = app.events.send((id, "marks"));
    it.map(|i| Json(json!(i))).ok_or_else(|| ApiError::NotFound(format!("no mark {mid}")))
}

async fn marks_delete(State(app): S, Path((id, mid)): Path<(String, String)>, headers: HeaderMap) -> R<StatusCode> {
    check_token(&app, &headers)?;
    city(&app, &id)?;
    let n = mark_id(&mid)?;
    let (a, i) = (app.clone(), id.clone());
    if blocking(move || a.marks.delete(&i, n)).await? {
        let _ = app.events.send((id, "marks"));
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(ApiError::NotFound(format!("no mark {mid}")))
    }
}

// ---------- handlers: events ----------
/// Server-sent events: `layers` whenever a write changes the merged layers of the city.
async fn events(State(app): S, Path(id): Path<String>) -> R<impl IntoResponse> {
    city(&app, &id)?;
    let mut rx = app.events.subscribe();
    let stream = async_stream(move |tx| async move {
        loop {
            match rx.recv().await {
                Ok((c, what)) if c == id => {
                    if tx.send(Event::default().event("layers").data(json!({ "city": c, "change": what }).to_string())).await.is_err() {
                        break;
                    }
                }
                Ok(_) | Err(broadcast::error::RecvError::Lagged(_)) => {}
                Err(_) => break,
            }
        }
    });
    Ok(Sse::new(stream).keep_alive(KeepAlive::default()))
}

/// A tiny channel-backed stream (avoids pulling in async-stream / tokio-stream).
fn async_stream<F, Fut>(f: F) -> impl futures_core::Stream<Item = Result<Event, std::convert::Infallible>>
where
    F: FnOnce(tokio::sync::mpsc::Sender<Event>) -> Fut,
    Fut: std::future::Future<Output = ()> + Send + 'static,
{
    let (tx, rx) = tokio::sync::mpsc::channel(16);
    tokio::spawn(f(tx));
    RxStream(rx)
}
struct RxStream(tokio::sync::mpsc::Receiver<Event>);
impl futures_core::Stream for RxStream {
    type Item = Result<Event, std::convert::Infallible>;
    fn poll_next(mut self: std::pin::Pin<&mut Self>, cx: &mut std::task::Context<'_>) -> std::task::Poll<Option<Self::Item>> {
        self.0.poll_recv(cx).map(|o| o.map(Ok))
    }
}

// ---------- router ----------
async fn access_log(State(app): S, req: Request, next: Next) -> Response {
    if !app.log {
        return next.run(req).await;
    }
    let (m, uri) = (req.method().clone(), req.uri().clone());
    let t0 = std::time::Instant::now();
    let r = next.run(req).await;
    if uri.path().starts_with("/api/") || r.status().is_client_error() || r.status().is_server_error() || m != Method::GET {
        eprintln!("{} {} {} {:.1} ms", m, uri, r.status().as_u16(), t0.elapsed().as_secs_f64() * 1e3);
    }
    r
}

/// City data requested with the build version (`?v=…`, see web/dataurl.js) never changes under
/// that URL: cache it for a year. Everything else revalidates (ETag / Last-Modified).
async fn cache_policy(req: Request, next: Next) -> Response {
    let versioned = req.uri().path().starts_with("/data/") && req.uri().query().is_some_and(|q| q.split('&').any(|kv| kv.starts_with("v=")));
    let mut r = next.run(req).await;
    if versioned && r.status().is_success() {
        r.headers_mut().insert(header::CACHE_CONTROL, HeaderValue::from_static("public, max-age=31536000, immutable"));
    }
    r
}

pub fn api_router(app: Arc<App>) -> Router {
    Router::new()
        .route("/", get(root))
        .route("/openapi.yaml", get(openapi))
        .route("/cities", get(cities))
        .route("/cities/{city}", get(city_info))
        .route("/cities/{city}/buildings", get(buildings))
        .route("/cities/{city}/buildings/at", get(building_at))
        .route("/cities/{city}/buildings/{gid}", get(building))
        .route("/cities/{city}/stats", get(stats))
        .route("/cities/{city}/layers", get(layers))
        .route("/cities/{city}/layers/links.bin", get(links))
        .route("/cities/{city}/items", get(items))
        .route("/cities/{city}/events", get(events))
        .route("/cities/{city}/marks", get(marks_list).post(marks_create))
        .route("/cities/{city}/marks/batch", post(marks_batch))
        .route("/cities/{city}/marks/{id}", put(marks_update).delete(marks_delete))
        .with_state(app)
}

/// The whole site: `/api/v1`, plus static files from `web` (the map) when given.
pub fn router(app: Arc<App>, web: Option<&std::path::Path>) -> Router {
    use tower_http::{compression::CompressionLayer, cors::CorsLayer, services::ServeDir, set_header::SetResponseHeaderLayer};
    let api_root = Router::new().route("/api/v1/", get(root)).with_state(app.clone());
    let mut r = Router::new().nest("/api/v1", api_router(app.clone())).merge(api_root);
    if let Some(web) = web {
        // `.br` / `.gz` written by `pipeline <city> compress` are sent as they are
        r = r.fallback_service(ServeDir::new(web).append_index_html_on_directories(true).precompressed_br().precompressed_gzip());
    }
    r.layer(middleware::from_fn_with_state(app.clone(), access_log))
        .layer(middleware::from_fn(cache_policy))
        .layer(SetResponseHeaderLayer::if_not_present(header::CACHE_CONTROL, HeaderValue::from_static("no-cache")))
        .layer(CompressionLayer::new())
        .layer(CorsLayer::permissive())
}
