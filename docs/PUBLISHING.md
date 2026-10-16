# Publishing on GitHub Pages

The map runs as a static site: no API server, layers from `layers.json`/`layers.bin`, your marks
in the browser (IndexedDB, with export/import).

```sh
cargo run --release -p pipeline -- site            # -> site/ (publishable cities only)
cargo run --release -p pipeline -- site --cities sf,nyc --out /tmp/site
```

`pipeline site` assembles `site/` from `web/`. It deletes and rebuilds only a directory it made itself.

- **Binaries:** GitHub Pages gzips HTML, JS and JSON but sends `.bin` and `.wasm` as they are. So
  the site carries them as `*.gz`, and the browser unpacks them (`DecompressionStream`, see
  `web/dataurl.js`). It reuses the `.gz` files from `pipeline <city> compress` when they're up to date.
- **Versions:** every city's `index.json` gets a content `version`, which becomes the `?v=` of
  its data URLs. `sw.js` (the service worker) keeps those for good, so a second visit loads from
  disk and works offline. A new build only invalidates what changed.
- **Static mode:** `index.html` gets `window.__SITE` with the city list. With it, the page
  doesn't look for the API and registers the service worker.
- **Licensing:** cities with `"publishable": false` are left out. The Bay Area uses county
  sources for local use only, and the site is public. `--include-local` overrides this; only use
  it once you have permission for those sources.
- **Limits:** the step fails on a file over 100 MB (GitHub's limit), and warns when the site
  is over 1 GB (the Pages guideline). Currently SF + NYC + Boston come to about 116 MB.

`site/` is a copy: rerun `pipeline site` after changing anything in `web/` (the app, `schemes.js`,
`styles.css`) or rebuilding a city, then deploy again.

### GitHub Actions

The repository includes `.github/workflows/pages.yml`. It builds `site/` from source and deploys
the artifact whenever `main` is pushed; it can also be run manually from the Actions tab.

In the repository settings, set Pages → Source to **GitHub Actions**. Commit the source repository,
not `site/` (which is ignored). The generated Bay Area data is also ignored and excluded from the
public build because its manifest contains local-use-only sources.

### Deployment branch alternative

To deploy without Actions, commit `site/` to an orphan `gh-pages` branch replaced on each deploy,
so that the data doesn't pile up in history:

```sh
cd site && git init -b gh-pages && git add -A && git commit -m "site" \
  && git push -f git@github.com:<you>/<repo>.git gh-pages
```

In the repository settings, set Pages → Source to "Deploy from a branch", `gh-pages`, `/`.
The site works under a project path (`https://<you>.github.io/<repo>/`): all its URLs are relative.

To try it locally, serve `site/` from any static server under a subpath, e.g.
`mkdir -p /tmp/p && ln -s "$PWD/site" /tmp/p/map && (cd /tmp/p && python3 -m http.server 8124)`,
then open http://localhost:8124/map/. Service workers need https or localhost.
