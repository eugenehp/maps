# api

One server for the map: the static app, the city data, and a JSON API under `/api/v1`.

```
cargo run --release -p api -- [--port 8123] [--web web] [--data web/data] [--db marks.sqlite] [--config api.json] [--quiet]
# or: web/serve.sh            (web/serve.sh --static for files only)
cargo test -p api             # end-to-end tests against web/data/sf
```

The spec is in [`openapi.yaml`](openapi.yaml), also served at `/api/v1/openapi.yaml`. Paths are under `/api/v1/cities/{city}`:

| Endpoint | Returns |
|---|---|
| `GET /buildings?bbox=\|near=&radius=` + `year_from`, `year_to`, `period`, `use`, `min_height`, `layer`, `category`, `demolished=true|any`, `standing=<year>`, `sort`, `format=geojson` | find buildings; GeoJSON gives footprints |
| `GET /buildings/{gid}`, `/buildings/at?lon=&lat=` | one building, decoded, with occupants (nearest within 25 m for `at`) |
| `GET /stats?by=period\|use\|decade\|year\|yearSource\|floors\|category` | counts in an area, with the same filters |
| `GET /items?layer=&category=&tag=&year=&q=&provider=&author=&bbox=\|near=` | search occupants across providers (`format=geojson` for points) |
| `GET /layers` + `/layers/links.bin` | merged layers in the compact form the map loads (ETag) |
| `GET /events` | server-sent events: `layers` after every write, so open maps refresh |
| `GET/POST /marks`, `POST /marks/batch`, `PUT/DELETE /marks/{id}` | user marks (SQLite), validated, with `X-Author` |

Speed: the first spatial or attribute query builds an in-memory index (0.9 s for the 2.6M Bay Area buildings). Queries after that take tens of milliseconds.

Writes are open by default. Set `"token"` in `api.json`, or `API_TOKEN` in the environment, to require `Authorization: Bearer <token>`. The map asks for the token once and remembers it.

## Adding a layer source

**Without code:** add a `geojson` provider to `api.json` (copy [`api.example.json`](api.example.json)). Every feature becomes an item:

- Points mark the building they fall on, or the nearest within 25 m.
- Polygons mark every building whose centroid is inside.
- Property names map to name, years, url, note and tags.
- Categories come from one property, with optional colours and a `parent`. For example, a list of AI companies with `"layer": {"id": "startups"}` and `"parent": "software"` joins the generated startups layer.

`api.json` in the workspace root is picked up automatically. Paths in it are relative to the file.

**In code:** implement `LayerProvider` ([`src/providers/mod.rs`](src/providers/mod.rs)) with three methods:

- `info`
- `version`: changes whenever the content changes.
- `load(city)`: returns `LayerDef`s and `Item`s with their `gids`.

Register the provider in `lib.rs::build`. To accept writes, also implement `ItemStore`. Layers with the same id merge across providers. Category colour slots (`bit`, 0–63) are kept if set, else assigned. The map needs no change.

Providers now:
- `generated`: the pipeline's `layers.json` + `layers.bin`.
- `geojson`: configured from `api.json`.
- `marks`: SQLite, writable, with its own layer `mine` for new categories.
