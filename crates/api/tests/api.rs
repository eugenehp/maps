//! End-to-end tests of /api/v1 against the real SF pipeline output (skipped when it is absent),
//! with a fresh marks database per test.

use api::{build, server, Config, Options};
use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::Arc;
use tower::ServiceExt;

fn sf_data() -> Option<PathBuf> {
    let d = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../web/data/sf");
    d.join("index.json").exists().then_some(d)
}

struct T {
    app: Arc<server::App>,
    _dir: TempDir,
}

struct TempDir(PathBuf);
impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn setup(config: Config) -> Option<T> {
    let sf = sf_data()?;
    static N: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
    let n = N.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let dir = std::env::temp_dir().join(format!("api-test-{}-{n}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(dir.join("data")).unwrap();
    std::os::unix::fs::symlink(&sf, dir.join("data/sf")).unwrap();
    let app = build(Options { data: dir.join("data"), db: dir.join("marks.sqlite"), config, log: false }).unwrap();
    Some(T { app, _dir: TempDir(dir) })
}

macro_rules! need {
    ($e:expr) => {
        match $e {
            Some(t) => t,
            None => {
                eprintln!("skipped: no web/data/sf");
                return;
            }
        }
    };
}

async fn call(t: &T, method: &str, uri: &str, body: Option<Value>, headers: &[(&str, &str)]) -> (StatusCode, Value) {
    let mut req = Request::builder().method(method).uri(format!("/api/v1{uri}"));
    for (k, v) in headers {
        req = req.header(*k, *v);
    }
    let req = match body {
        Some(b) => req.header("content-type", "application/json").body(Body::from(b.to_string())).unwrap(),
        None => req.body(Body::empty()).unwrap(),
    };
    let r = server::router(t.app.clone(), None).oneshot(req).await.unwrap();
    let status = r.status();
    let bytes = r.into_body().collect().await.unwrap().to_bytes();
    (status, serde_json::from_slice(&bytes).unwrap_or(Value::Null))
}
async fn get(t: &T, uri: &str) -> Value {
    let (s, v) = call(t, "GET", uri, None, &[]).await;
    assert_eq!(s, StatusCode::OK, "GET {uri}: {v}");
    v
}

// 360 3rd St, SF: a building with generated occupants (SquareTrade HQ, offices). Its gid
// depends on the build, so tests look it up by location.
const AT: &str = "lon=-122.3983424&lat=37.7827026";
async fn gid_360_3rd(t: &T) -> u32 {
    get(t, &format!("/cities/sf/buildings/at?{AT}")).await["gid"].as_u64().unwrap() as u32
}

#[tokio::test]
async fn service_and_cities() {
    let t = need!(setup(Config::default()));
    let v = get(&t, "/").await;
    assert_eq!(v["cities"], json!(["sf"]));
    assert!(v["providers"].as_array().unwrap().iter().any(|p| p["id"] == "marks" && p["writable"] == true));
    let c = get(&t, "/cities/sf").await;
    assert!(c["count"].as_u64().unwrap() > 170_000);
    let (s, _) = call(&t, "GET", "/cities/atlantis", None, &[]).await;
    assert_eq!(s, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn building_json_geojson_and_lookup() {
    let t = need!(setup(Config::default()));
    #[allow(non_snake_case)]
    let GID = gid_360_3rd(&t).await;
    let b = get(&t, &format!("/cities/sf/buildings/{GID}")).await;
    assert_eq!(b["address"], "360 3rd St");
    assert!(b["occupants"].as_array().unwrap().iter().any(|o| o["name"] == "SquareTrade"));
    let f = get(&t, &format!("/cities/sf/buildings/{GID}?format=geojson")).await;
    assert_eq!(f["type"], "Feature");
    let ring = &f["geometry"]["coordinates"][0][0];
    let n = ring.as_array().unwrap().len();
    assert!(n >= 4 && ring[0] == ring[n - 1], "closed ring");
    // outer ring counter-clockwise in lon/lat (RFC 7946): positive shoelace
    let pts: Vec<(f64, f64)> = ring.as_array().unwrap().iter().map(|p| (p[0].as_f64().unwrap(), p[1].as_f64().unwrap())).collect();
    let area: f64 = pts.windows(2).map(|w| w[0].0 * w[1].1 - w[1].0 * w[0].1).sum();
    assert!(area > 0.0, "outer ring should be CCW");
    // a point just outside the wall still finds it (nearest within 25 m), the centroid exactly
    let ll = &b["lonlat"];
    let at = get(&t, &format!("/cities/sf/buildings/at?lon={}&lat={}", ll[0], ll[1])).await;
    assert_eq!(at["gid"], GID, "centroid lookup");
    let near = get(&t, "/cities/sf/buildings/at?lon=-122.3977481&lat=37.7824983").await;
    assert_eq!(near["gid"], GID);
    let (s, _) = call(&t, "GET", "/cities/sf/buildings/at?lon=-122.6&lat=37.5", None, &[]).await;
    assert_eq!(s, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn building_queries() {
    let t = need!(setup(Config::default()));
    let v = get(&t, "/cities/sf/buildings?near=-122.3983,37.7827&radius=300&year_from=1906&year_to=1915&sort=near&limit=20").await;
    let total = v["total"].as_u64().unwrap();
    assert!(total > 0);
    for b in v["items"].as_array().unwrap() {
        let y = b["year"].as_i64().unwrap();
        assert!((1906..=1915).contains(&y), "{b}");
    }
    if total > 20 {
        assert_eq!(v["next"], 20);
    }
    let tall = get(&t, "/cities/sf/buildings?min_height=150&sort=height&desc=true&limit=3").await;
    let h: Vec<f64> = tall["items"].as_array().unwrap().iter().map(|b| b["height"].as_f64().unwrap()).collect();
    assert!(h.len() == 3 && h[0] >= h[1] && h[1] >= h[2] && h[2] >= 150.0, "{h:?}");
    let g = get(&t, "/cities/sf/buildings?bbox=-122.40,37.78,-122.39,37.79&format=geojson&limit=5").await;
    assert_eq!(g["type"], "FeatureCollection");
    assert_eq!(g["features"].as_array().unwrap().len(), 5);
    let occ = get(&t, "/cities/sf/buildings?layer=academia&category=university&limit=1").await;
    assert!(occ["total"].as_u64().unwrap() > 100);
    let (s, e) = call(&t, "GET", "/cities/sf/buildings?period=nonsense", None, &[]).await;
    assert_eq!(s, StatusCode::BAD_REQUEST, "{e}");
    let (s, _) = call(&t, "GET", "/cities/sf/buildings?sort=near", None, &[]).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn stats_add_up() {
    let t = need!(setup(Config::default()));
    for by in ["period", "use", "decade", "yearSource", "floors"] {
        let v = get(&t, &format!("/cities/sf/stats?by={by}&bbox=-122.42,37.77,-122.39,37.80")).await;
        let sum: u64 = v["groups"].as_array().unwrap().iter().map(|g| g["count"].as_u64().unwrap()).sum();
        assert_eq!(sum, v["total"].as_u64().unwrap(), "by={by}");
    }
    let all = get(&t, "/cities/sf/stats?by=period").await;
    assert_eq!(all["total"], get(&t, "/cities/sf").await["count"]);
    let cats = get(&t, "/cities/sf/stats?by=category&layer=academia").await;
    assert!(cats["groups"].as_array().unwrap().iter().any(|g| g["key"] == "academia/university"));
}

#[tokio::test]
async fn items_search() {
    let t = need!(setup(Config::default()));
    let v = get(&t, "/cities/sf/items?layer=startups&category=software&year=2005&limit=5").await;
    assert!(v["total"].as_u64().unwrap() > 100);
    for it in v["items"].as_array().unwrap() {
        assert!(it["from"].as_i64().is_none_or(|f| f <= 2005) && it["to"].as_i64().is_none_or(|x| x >= 2005));
    }
    let g = get(&t, "/cities/sf/items?q=squaretrade&format=geojson").await;
    assert_eq!(g["features"][0]["geometry"]["type"], "Point");
    let near = get(&t, "/cities/sf/items?near=-122.3983,37.7827&radius=60").await;
    assert!(near["items"].as_array().unwrap().iter().any(|i| i["name"] == "SquareTrade"));
}

#[tokio::test]
async fn marks_validation_crud_and_events() {
    let t = need!(setup(Config::default()));
    #[allow(non_snake_case)]
    let GID = gid_360_3rd(&t).await;
    let mut rx = t.app.events.subscribe();
    let post = |b: Value| call(&t, "POST", "/cities/sf/marks", Some(b), &[("x-author", "tester")]);
    for (b, why) in [
        (json!({"layer":"startups","category":"ai","name":"X","gid":GID,"from":1200}), "year"),
        (json!({"layer":"startups","category":"ai","name":"X","gid":GID,"url":"javascript:alert(1)"}), "url"),
        (json!({"layer":"startups","category":"nope","name":"X","gid":GID}), "category"),
        (json!({"layer":"startups","category":"ai","name":"X"}), "no place"),
        (json!({"layer":"startups","category":"ai","name":" ","gid":GID}), "name"),
        (json!({"layer":"startups","category":"ai","name":"X","gid":GID,"from":2020,"to":2010}), "order"),
        (json!({"layer":"startups","category":"ai","name":"X","gid":GID,"role":"overlord"}), "role"),
    ] {
        let (s, e) = post(b).await;
        assert_eq!(s, StatusCode::BAD_REQUEST, "{why}: {e}");
    }
    let (s, a) = post(json!({"layer":"startups","category":"ai","name":"Test AI","role":"founded","from":2021,"tags":["t"],"lonlat":[-122.3977481,37.7824983]})).await;
    assert_eq!(s, StatusCode::CREATED, "{a}");
    assert_eq!(a["gids"], json!([GID]));
    assert_eq!(a["author"], "tester");
    assert_eq!(rx.try_recv().unwrap(), ("sf".to_string(), "marks"));
    let (s, b) = post(json!({"categoryName":"MIT spinouts","name":"Test Robotics","gid":GID})).await;
    assert_eq!(s, StatusCode::CREATED);
    assert_eq!(b["layer"], "mine");

    // visible everywhere
    let occ = get(&t, &format!("/cities/sf/buildings/{GID}")).await;
    let names: Vec<&str> = occ["occupants"].as_array().unwrap().iter().filter_map(|o| o["name"].as_str()).collect();
    assert!(names.contains(&"Test AI") && names.contains(&"Test Robotics"));
    let mine = get(&t, "/cities/sf/items?provider=marks&author=tester").await;
    assert_eq!(mine["total"], 2);
    let layers = get(&t, "/cities/sf/layers").await;
    let l = layers["layers"].as_array().unwrap();
    assert!(l.iter().any(|x| x["id"] == "mine" && x["writable"] == true));

    // update, batch (one bad row), delete
    let id = a["id"].as_str().unwrap();
    let (s, u) = call(&t, "PUT", &format!("/cities/sf/marks/{id}"), Some(json!({"layer":"startups","category":"ai","name":"Test AI 2","gid":GID,"from":2020,"to":2024})), &[]).await;
    assert_eq!(s, StatusCode::OK, "{u}");
    assert_eq!(u["to"], 2024);
    let (s, bt) = call(&t, "POST", "/cities/sf/marks/batch", Some(json!({"items":[
        {"categoryName":"Batch","name":"A","gid":GID}, {"categoryName":"Batch","name":"B"}, {"categoryName":"Batch","name":"C","gid":1}
    ]})), &[]).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(bt["created"].as_array().unwrap().len(), 2);
    assert_eq!(bt["errors"][0]["index"], 1);
    let (s, _) = call(&t, "DELETE", &format!("/cities/sf/marks/{id}"), None, &[]).await;
    assert_eq!(s, StatusCode::NO_CONTENT);
    let (s, _) = call(&t, "DELETE", &format!("/cities/sf/marks/{id}"), None, &[]).await;
    assert_eq!(s, StatusCode::NOT_FOUND);
    assert_eq!(get(&t, "/cities/sf/marks").await.as_array().unwrap().len(), 3);
}

#[tokio::test]
async fn token_guards_writes() {
    let t = need!(setup(Config { token: Some("s3cret".into()), ..Config::default() }));
    #[allow(non_snake_case)]
    let GID = gid_360_3rd(&t).await;
    let body = json!({"categoryName":"X","name":"Y","gid":GID});
    let (s, _) = call(&t, "POST", "/cities/sf/marks", Some(body.clone()), &[]).await;
    assert_eq!(s, StatusCode::UNAUTHORIZED);
    let (s, _) = call(&t, "POST", "/cities/sf/marks", Some(body.clone()), &[("authorization", "Bearer wrong")]).await;
    assert_eq!(s, StatusCode::UNAUTHORIZED);
    let (s, _) = call(&t, "POST", "/cities/sf/marks", Some(body), &[("authorization", "Bearer s3cret")]).await;
    assert_eq!(s, StatusCode::CREATED);
    // reads stay open
    get(&t, "/cities/sf/marks").await;
}

#[tokio::test]
async fn geojson_provider_from_config() {
    let Some(sf) = sf_data() else { return };
    let _ = sf;
    let dir = std::env::temp_dir().join(format!("api-geojson-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let file = dir.join("murals.geojson");
    std::fs::write(&file, json!({ "type": "FeatureCollection", "features": [
        { "type": "Feature", "properties": { "title": "Test mural", "style": "Mission", "year": "1994-05-01", "tags": "art, test" },
          "geometry": { "type": "Point", "coordinates": [-122.3977481, 37.7824983] } },
        { "type": "Feature", "properties": { "title": "Block party", "style": "Event" },
          "geometry": { "type": "Polygon", "coordinates": [[[-122.3995,37.7820],[-122.3970,37.7820],[-122.3970,37.7835],[-122.3995,37.7835],[-122.3995,37.7820]]] } },
        { "type": "Feature", "properties": { "title": "In the bay" }, "geometry": { "type": "Point", "coordinates": [-122.30, 37.80] } }
    ]}).to_string()).unwrap();
    let conf: Config = serde_json::from_value(json!({ "providers": [{
        "type": "geojson", "id": "murals", "city": "sf", "path": file,
        "layer": { "id": "murals", "name": "Murals", "licence": "CC0" },
        "category": { "property": "style", "colors": { "Mission": "#e4572e" } },
        "properties": { "name": "title", "from": "year", "tags": "tags" }
    }]})).unwrap();
    let t = need!(setup(conf));
    #[allow(non_snake_case)]
    let GID = gid_360_3rd(&t).await;
    let layers = get(&t, "/cities/sf/layers").await;
    let m = layers["layers"].as_array().unwrap().iter().find(|l| l["id"] == "murals").expect("murals layer").clone();
    assert_eq!(m["provider"], "murals");
    assert_eq!(m["categories"].as_array().unwrap().len(), 2);
    let b = get(&t, &format!("/cities/sf/buildings/{GID}")).await;
    let mural = b["occupants"].as_array().unwrap().iter().find(|o| o["name"] == "Test mural").expect("mural on the building").clone();
    assert_eq!(mural["from"], 1994);
    assert_eq!(mural["tags"], json!(["art", "test"]));
    let party = get(&t, "/cities/sf/items?layer=murals&q=block").await;
    assert!(party["items"][0]["gids"].as_array().unwrap().len() > 3, "polygon covers several buildings");
    let _ = std::fs::remove_dir_all(&dir);
}
