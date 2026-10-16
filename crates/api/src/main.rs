//! `api`: one server for the map — the static app, the city data, and `/api/v1` over it.
//!
//!   cargo run --release -p api -- [--host 0.0.0.0] [--port 8123] [--web web] [--data web/data] [--db marks.sqlite]
//!                                  [--config api.json] [--quiet]
//!
//! See crates/api/README.md and crates/api/openapi.yaml.

use anyhow::Context;
use api::{build, server, Config, Options};
use std::path::PathBuf;

fn arg(args: &[String], k: &str) -> Option<String> {
    args.iter().position(|a| a == k).and_then(|i| args.get(i + 1)).cloned()
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    let base = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    let web = arg(&args, "--web").map(PathBuf::from).unwrap_or_else(|| base.join("web"));
    let data = arg(&args, "--data").map(PathBuf::from).unwrap_or_else(|| web.join("data"));
    let db = arg(&args, "--db").map(PathBuf::from).unwrap_or_else(|| base.join("marks.sqlite"));
    let port: u16 = arg(&args, "--port").unwrap_or_else(|| "8123".into()).parse().context("--port")?;
    // every interface by default, so the map can be opened from other machines on the network
    let host: std::net::IpAddr = arg(&args, "--host").unwrap_or_else(|| "0.0.0.0".into()).parse().context("--host")?;
    let config = match arg(&args, "--config").map(PathBuf::from).or_else(|| Some(base.join("api.json")).filter(|p| p.exists())) {
        Some(p) => {
            println!("config {}", p.display());
            Config::load(&p)?
        }
        None => Config::default(),
    };

    let app = build(Options { data, db: db.clone(), config, log: !args.iter().any(|a| a == "--quiet") })?;
    for (id, c) in &app.cities {
        println!("city {id}: {} buildings", c.count);
    }
    for p in app.registry.infos() {
        println!("provider {}{}", p.id, if p.writable { " (writable)" } else { "" });
    }
    let writes = if app.token.is_some() { "token required" } else { "open" };
    let router = server::router(app, Some(&web));
    let addr = std::net::SocketAddr::new(host, port);
    let listener = tokio::net::TcpListener::bind(addr).await.with_context(|| format!("listen on {addr}"))?;
    println!("serving {} on http://{addr}  (API: http://{addr}/api/v1; marks: {}, writes {writes})", web.display(), db.display());
    axum::serve(listener, router).with_graceful_shutdown(async { tokio::signal::ctrl_c().await.ok(); }).await?;
    Ok(())
}
