// A city, building by building — LAYRS-style 3D map on threers (wgpu/wasm three.js replacement).
import { MapCamera } from './map-camera.js';
import { PickIndex } from './picking.js';
import { Layers, LAYER_PALETTE_OFFSET } from './layers.js';
import { setDataVersion, dataVersion, dataUrl, binUrl, GZ } from './dataurl.js';
import { rankPacks, viewRanker } from './view.js';
import { SCHEMES, SOURCE_SLOTS, pickScheme, rememberScheme, periodColors } from './schemes.js';
import { Ground } from './ground.js';
import { landmarks } from './models.js';
import { createGfx } from './gfx.js';
import { loadTerrain } from './terrain.js';
import { U, UNIFORM_FLOATS, PALETTE_USE_OFFSET, PALETTE_SOURCE_OFFSET, PALETTE_FLOORS_OFFSET } from './shaders.js';

const Q = new URLSearchParams(location.search);
const CITY = (Q.get('city') || 'sf').replace(/[^a-z0-9_-]/gi, '') || 'sf';
const FORCE_GL = Q.get('gl') === '1';
const WORKERS = Math.min(4, Math.max(2, (navigator.hardwareConcurrency || 4) - 1));
const VERT_BUDGET = +(Q.get('budget') || 9e6);   // GPU vertices kept loaded (64 B each in threers)

// colours: ground, sky, UI and the palette of each mode (schemes.js); switchable at any time
let S = pickScheme(Q);
const MODES = [
  { id: 'period', label: 'Period' },
  { id: 'floors', label: 'Floors' },
  { id: 'use', label: 'Use' },
  { id: 'source', label: 'Sources' },
  { id: 'layers', label: 'Layers' },
];
const CITY_NAMES = { sf: 'SF', bay: 'Bay Area', nyc: 'New York', boston: 'Boston' };
// a static build (build-site.sh) says which cities it carries; it has no API server
const SITE = window.__SITE || null;
const CITIES = SITE?.cities?.map(c => c.id) || ['sf', 'bay', 'nyc', 'boston'];
const FLAG = { approx: 1, landmark: 2, parcel: 4, estHeight: 8, tract: 16 };

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = n => Math.round(n).toLocaleString('en-US');
const hex3 = h => { const v = parseInt(h.replace('#', ''), 16); return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255]; };
const log = (...a) => console.log('[city]', ...a);
const status = window.__city = { city: CITY, ready: false, errors: [], loadedPacks: 0, frames: 0 };

// ---------- manifest ----------
async function loadManifest() {
  const tries = [`data/${CITY}/index.json`, `data/${CITY}/${CITY}.json`, 'data/sf.json'];
  for (const url of tries) {
    try {
      const early = window.__manifest?.url === url ? await window.__manifest.res : null;
      const r = early || await fetch(url, { cache: 'no-cache' });
      if (r.ok) {
        const m = await r.json();
        setDataVersion(m.version || (r.headers.get('last-modified') ? Date.parse(r.headers.get('last-modified')).toString(36) : ''));
        return { m, dir: url.slice(0, url.lastIndexOf('/') + 1) };
      }
    } catch { /* next */ }
  }
  throw new Error(`no manifest for city "${CITY}" (tried ${tries.join(', ')})`);
}

function normalize(m, dir) {
  const tileSize = m.tileSize || 500;
  const fileOf = t => t.file ?? (typeof t.pack === 'number' ? m.packs[t.pack].file ?? m.packs[t.pack] : t.pack);
  const packs = new Map();
  for (const t of m.tiles) {
    const file = fileOf(t);
    const bbox = t.bbox || [t.origin[0] - tileSize, t.origin[1] - tileSize, t.origin[0] + tileSize, t.origin[1] + tileSize];
    let p = packs.get(file);
    if (!p) {
      p = { file, url: dataUrl(dir + file), tiles: [], bbox: [...bbox], nB: 0, gid0: t.gid0, region: t.region ?? 0, bytes: 0, state: 'idle' };
      packs.set(file, p);
    }
    p.tiles.push({ offset: t.offset, length: t.length, origin: t.origin });
    p.bbox[0] = Math.min(p.bbox[0], bbox[0]); p.bbox[1] = Math.min(p.bbox[1], bbox[1]);
    p.bbox[2] = Math.max(p.bbox[2], bbox[2]); p.bbox[3] = Math.max(p.bbox[3], bbox[3]);
    p.nB += t.nB; p.bytes += t.length; p.gid0 = Math.min(p.gid0, t.gid0);
  }
  for (const p of packs.values()) {
    p.tiles.sort((a, b) => a.offset - b.offset);
    p.origin = p.tiles[0].origin;
    // GPU vertices per tile byte, measured on sf: SFT5 2.86 M from 6.5 MB; SFT4 3.9 M from 29 MB
    p.estVerts = p.bytes * (m.format === 'SFT5' ? 0.44 : 0.135);
  }
  const regions = (Array.isArray(m.regions) ? m.regions : []).map(r => ({ ...r, url: r.attrs ? dataUrl(dir + r.attrs) : null }))
    .sort((a, b) => a.gid0 - b.gid0);
  const sources = (m.sources || []).map((s, i) => typeof s === 'string' ? { id: i, name: s } : { id: i, ...s });
  return {
    raw: m, dir, packs: [...packs.values()], regions, sources,
    name: m.name || CITY, title: m.title || `${m.short || CITY_NAMES[m.city || CITY] || m.name || CITY}, building by building`,
    count: m.count || m.tiles.reduce((s, t) => s + t.nB, 0),
    periods: m.periods || [], uses: m.uses || [], unknownColor: m.unknownColor || '#8c8c8c',
    yearHist: m.yearHist || {}, attribution: m.attribution || (m.sources || []).join('; '),
    bounds: m.bounds, origin: m.origin, attrsGlobal: regions.length ? null : dataUrl(dir + 'attrs.json'),
    relief: m.groundDatum && !/none/i.test(m.groundDatum) ? 1 : 0,
    attrsColumns: m.attrsColumns || ['address', 'use', 'units', 'source'],
    flags: m.flags || {},
  };
}

// the renderer (shim import, wasm, GPU device) doesn't need the manifest: start both at once.
// It runs in a worker that owns the canvas (OffscreenCanvas) where the browser can; ?inline for
// the page's own thread (gfx.js).
// Retina already draws four device pixels per CSS pixel, so 4x MSAA there can shade sixteen
// samples per CSS pixel for little visible gain. Use it only on standard-density displays unless
// ?msaa=1|4 pins the sample count.
const MSAA = Q.has('msaa') ? Math.max(1, +Q.get('msaa') || 1) : (devicePixelRatio >= 1.5 ? 1 : 4);
const SHADOWS = !Q.has('noshadow');
const gfxP = createGfx($('#scene'), { msaa: MSAA, gz: GZ, forceGl: FORCE_GL, aspect: innerWidth / innerHeight },
  { worker: !Q.has('inline') });
const { m: rawManifest, dir } = await loadManifest();
const M = normalize(rawManifest, dir);
if (M.flags.tractYear) FLAG.tract = M.flags.tractYear;
if (M.flags.tractMedianYear) FLAG.tract = M.flags.tractMedianYear;
const RELIEF = Q.has('flat') ? 0 : M.relief;
document.title = M.title;
$('#title').textContent = M.title;
$('#attribution').textContent = M.attribution;
log('manifest', M.name, M.count, 'buildings', M.packs.length, 'packs', 'relief', RELIEF);

// ---------- first view ----------
const b = M.bounds;
const spanX = b.max[0] - b.min[0], spanZ = b.max[1] - b.min[1];
const bigCity = Math.max(spanX, spanZ) > 26000;
function homeView() {
  if (rawManifest.home) return { ...rawManifest.home, azimuth: (rawManifest.home.azimuth || 0) * Math.PI / 180, elevation: (rawManifest.home.elevation || 55) * Math.PI / 180 };
  const el = 55 * Math.PI / 180;
  if (bigCity) return { x: 0, z: 0, distance: 14000, azimuth: 0, elevation: el };
  const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[1] + b.max[1]) / 2;
  const fov = 35 * Math.PI / 180, aspect = Math.max(0.6, innerWidth / innerHeight);
  const fit = Math.max(spanZ * 0.75, spanX / aspect * 0.8) / 2 / Math.tan(fov / 2);
  // the legend covers the left of the screen: shift the city right by half its width
  const visibleW = 2 * fit * Math.tan(fov / 2) * aspect;
  const shift = innerWidth > 720 ? 0.5 * (340 / innerWidth) * visibleW : 0;
  return { x: cx - shift, z: cz + spanZ * 0.04, distance: fit, azimuth: 0, elevation: el };
}
function viewFromHash() {
  const h = location.hash.slice(1).split(',').map(Number);
  if (h.length >= 5 && h.every(Number.isFinite)) {
    return { x: h[0], z: h[1], distance: h[2], azimuth: h[3] * Math.PI / 180, elevation: h[4] * Math.PI / 180 };
  }
  return null;
}
const firstView = () => viewFromHash() || homeView();
const FIXED_LOD = Q.has('lod') ? Math.max(0, Math.min(2, +Q.get('lod') || 0)) : null;
// Building geometry LOD: full extrusions nearby, simplified footprints in a district view,
// and minimally segmented roofs in a regional overview. `?lod=0|1|2` pins a level for testing.
const viewLod = v => FIXED_LOD ?? (v.distance >= (CITY === 'bay' ? 12000 : 18000) ? 2 : v.distance >= 6000 ? 1 : 0);

// ---------- pack parsing ----------
// Workers turn a pack's bytes into vertex buffers. They start with the manifest, not the
// renderer: the first packs are fetched and parsed while the wasm and the GPU device come up,
// and go to the GPU as soon as there is one.
const pool = Array.from({ length: WORKERS }, () => ({ w: new Worker('worker.js', { type: 'module' }), busy: false }));
const jobs = [];
/** Parse pack `p` in a worker, from `buf` or (without) fetched there; resolves to the worker's message. */
function parsePack(p, buf, lod) {
  p.loadingLod = lod;
  return new Promise((ok, fail) => { jobs.push({ p, buf, lod, ok, fail }); dispatch(); });
}
function dispatch() {
  for (const slot of pool) {
    if (slot.busy || !jobs.length) continue;
    const { p, buf, lod, ok, fail } = jobs.shift();
    slot.busy = true;
    slot.w.onmessage = ({ data }) => { slot.busy = false; ok(data); dispatch(); };
    slot.w.onerror = e => { slot.busy = false; fail(new Error(e.message)); dispatch(); };
    const msg = { id: p.file, url: p.url, tiles: p.tiles, origin: p.origin, gz: GZ, meshId: p.meshId, castShadow: SHADOWS, lod };
    if (buf) slot.w.postMessage({ ...msg, buf }, [buf]); else slot.w.postMessage(msg);
  }
}

// ---------- early fetches ----------
// The packs the first view shows, nearest the eye first, then a margin around it: fetched a
// few at a time (all at once would share the bandwidth and make even the nearest arrive last)
// and parsed as they land. The loader picks them up in state 'early'.
{
  const initialView = firstView(), initialLod = viewLod(initialView);
  const order = rankPacks(M.packs, initialView, innerWidth / innerHeight, { budget: VERT_BUDGET * 0.9, radius: viewRadius(initialView) })
    .map(e => e.p);
  const PARALLEL = 4;
  let started = 0;
  const startNext = () => {
    if (started >= order.length) return;
    const p = order[started++];
    p.state = 'early';
    // bytes as they come (gzipped on a static site): the worker unpacks them
    p.fetched = fetch(binUrl(p.url)).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); });
    p.parsed = p.fetched.then(buf => parsePack(p, buf, initialLod), () => parsePack(p, undefined, initialLod));
    p.fetched.catch(() => { }).finally(startNext);
  };
  for (let i = 0; i < PARALLEL; i++) startNext();
  var firstPacks = Promise.race([Promise.allSettled(order.slice(0, PARALLEL).map(p => p.fetched)), new Promise(r => setTimeout(r, 1500))]);
}
// the ground (terrain tiles, land/water/park polygons: several MB in a big city) waits until the
// buildings the first view shows are in, or a few seconds at most: buildings come first
let buildingsIn;
const buildingsFirst = Promise.race([new Promise(r => { buildingsIn = r; }), firstPacks.then(() => new Promise(r => setTimeout(r, 4000)))]);
// the tile list only: the grid, its tiles and the polygons are fetched in terrain-worker.js
const terrainP = Q.has('noterrain') ? Promise.resolve(null)
  : loadTerrain(dir, { grid: false }).catch(e => { report(`terrain: ${e}`); return null; });
const apiP = Q.has('static') || SITE?.static ? Promise.resolve(null)
  : fetch('api/v1/', { cache: 'no-store' }).then(r => r.ok ? new URL('api/v1', location.href).pathname : null).catch(() => null);

// ---------- renderer ----------
const gfx = await gfxP;
// Render on demand: frames are drawn while something changes, and for WAKE_MS after (the
// shaders' time-based animations: buildings rising, cross-fades, period fades); a still map
// costs no GPU time. Every call that changes what is drawn wakes the renderer.
const WAKE_MS = 1200;
let awakeUntil = 0;
const wake = () => { awakeUntil = performance.now() + WAKE_MS; };
for (const k of ['state', 'setStorage', 'setStorageRange', 'attrsRuns', 'addMesh', 'removeMesh', 'setVisible', 'setBackground', 'resize']) {
  const f = gfx[k];
  gfx[k] = (...a) => { wake(); return f.apply(gfx, a); };
}
const canvas = gfx.canvas;
const backend = gfx.info.backend;
Object.assign(status, { backend, msaa: gfx.info.msaa, startup: gfx.info.startup, renderMode: gfx.mode });
log('renderer', gfx.info.variant, backend, gfx.mode);
// worker mode: each parse worker gets a port to the render worker, so the packs it finishes go
// to the GPU without passing through this thread (those still in flight from before come here)
const renderPorts = gfx.mode === 'worker';
if (renderPorts) for (const slot of pool) { const port = gfx.port(); slot.w.postMessage({ op: 'port', port }, [port]); }
// the ground (terrain tiles, draped polygons) is meshed in its own worker, meshes to the renderer
const groundWorker = new Worker('terrain-worker.js', { type: 'module' });
if (renderPorts) { const port = gfx.port(); groundWorker.postMessage({ op: 'port', port }, [port]); }
const groundWaits = {};
groundWorker.onmessage = ({ data: d }) => {
  if (d.spec) gfx.addMesh(d.id, d.spec);   // inline mode: the page hands it over
  if (d.op === 'tile') { if (terrain) terrain.loaded[d.k] = 1; terrainDue = 0; }
  else if (d.op === 'mesh') { const e = terrainTiles.get(d.k); if (e && e.step === d.step) { e.pending = false; e.empty = !!d.empty; } }
  else if (d.op === 'all' || d.op === 'polys') { groundWaits[d.op]?.(d); }
};
const groundAsk = (op, msg) => new Promise(ok => { groundWaits[op === 'fetch' ? 'all' : op] = ok; groundWorker.postMessage({ op, ...msg }); });
// what MapCamera writes (position, look-at); frame() sends it to the renderer when it changed
const camera = {
  fov: 35, aspect: innerWidth / innerHeight, p: [0, 0, 0], t: [0, 0, 0], dirty: true,
  position: { set(x, y, z) { camera.p = [x, y, z]; camera.dirty = true; } },
  lookAt(x, y, z) { camera.t = [x, y, z]; camera.dirty = true; },
};

// ---------- materials ----------
const uniforms = new Float32Array(UNIFORM_FLOATS);
const lastYear = Math.max(...Object.keys(M.yearHist).map(Number).filter(y => y > 0), new Date().getFullYear());
uniforms[U.YEAR] = lastYear + 1;
uniforms[U.MODE] = 0;
uniforms[U.HOVER] = -1;
uniforms[U.SELECTED] = -1;
uniforms[U.RISE] = 0.01;
uniforms[U.MASK] = (1 << 17) - 1;
uniforms[U.RELIEF] = RELIEF;
uniforms[U.APPROX_MIX] = 0.42;
uniforms.set([-0.55, 0.55, 0.62], U.SUN);

// periods 0.., uses 16.., year sources 22.., layer categories 48.., storeys ramp 112.. (shaders.js)
const palette = new Float32Array(128 * 4);

const attrs = new Float32Array(Math.max(1, M.count) * 4);   // the page's mirror of storage0 (picking, cards)
let uniformsDirty = false;
// compared as stored (float32): a double never equals its float32 copy, and would look changed every frame
const setU = (i, v) => { v = Math.fround(v); if (uniforms[i] !== v) { uniforms[i] = v; uniformsDirty = true; } };

// occupancy layers (academia, startups, your own marks): one colour per building in slot 2
// the API server (api crate) when it runs this page; plain static hosting otherwise
const API = await apiP;
status.api = API;
log('data backend', API ? `API ${API}` : 'static files');
const layers = new Layers({
  city: CITY, dir, count: M.count, origin: M.origin, today: lastYear, api: API,
  onReload: () => { if (mode === 4) renderPanel(); if (cardGid >= 0) refreshCard(cardGid); },
  onChange: colors => { gfx.setStorage(2, colors); if (mode === 4) { setU(U.LAYER_AT, layers.layerAt ?? 0); } },
  onPalette: entries => {
    for (const [i, c] of entries) if (i < 128) palette.set(hex3(c), i * 4);
    gfx.setStorage(1, palette);
  },
  resolve: ([lon, lat]) => {
    const x = (lon - M.origin.lon) * layers.mx, z = -(lat - M.origin.lat) * layers.mz;
    const hit = pickIndex.pick({ x, y: 1e4, z }, { x: 0, y: -1, z: 0 }, () => true, RELIEF);
    return hit ? hit.gid : -1;
  },
});

// lift: [metres, metres per metre of camera distance] — see GROUND_VERTEX
// role: which scheme colour it takes ('land', 'water', 'park'; see applyScheme)
const groundMats = [];
function groundMaterial(name, role, shade, lift = [0, 0]) {
  const u = new Float32Array(20);
  u[3] = shade;
  const g = { name, u, lift, role };
  groundMats.push(g);
  return g;
}
const landM = groundMaterial('land', 'land', RELIEF ? 0.55 : 0);
landM.u[4] = 1;
// until the terrain and the water polygons are in, the plane under everything is land, not a
// city-wide lake (see the terrain chain below)
const waterM = groundMaterial('water', Q.has('noterrain') ? 'water' : 'land', 0);
const terrainM = groundMaterial('terrain', 'land', 0.6);
terrainM.u[13] = 1;
const waterPolyM = groundMaterial('waterPoly', 'water', 0, [0.2, 0.0006]);
const parkM = groundMaterial('park', 'park', 0.45, [0.3, 0.0009]);
const flatLandM = groundMaterial('flatLand', 'land', 0, [0.0, 0.0]);

// water: one big quad under everything (render-core.js). It sinks as the camera rises (see
// frame()): land and water are only metres apart, and a Depth32 buffer with a fixed near plane
// cannot keep them apart from 20 km away, so the water would win the z-fight in low-lying cities.
const WATER_Y = RELIEF ? -1.5 : -3;

// sun: a directional light that only drives the shadow map (the shaders light themselves).
// Shines from the SW toward the origin; the box follows the camera (fitView).
const SUN_DIR = [-0.55, 0.55, 0.62];
if (SHADOWS) {
  uniforms[U.SHADOW] = 0.15;
  for (const g of [landM, terrainM, parkM, flatLandM]) g.u[5] = 0.35;
}
gfx.setup({
  count: M.count, bounds: M.bounds, water: 'water', sunDir: SUN_DIR, shadows: SHADOWS, nowarm: Q.has('nowarm'),
  ground: Object.fromEntries(groundMats.map(g => [g.name, g.u])),
});

// ---------- state ----------
const periods = M.periods;
const periodTotals = periods.map(() => 0);
let histTotal = 0;
const years = Object.entries(M.yearHist).map(([y, n]) => [+y, n]).filter(([y]) => y > 0).sort((a, b) => a[0] - b[0]);
const periodOfYear = y => periods.findIndex(p => y >= p.from && y <= p.to);
for (const [y, n] of years) { const i = periodOfYear(y); if (i >= 0) periodTotals[i] += n; histTotal += n; }
const unknownTotal = Math.max(0, M.count - histTotal - (M.raw.demolished?.count || 0));
let mode = 0;
let mask = (1 << 17) - 1;
let hoverGid = -1, selectedGid = -1;
const gidChunk = new Int32Array(Math.max(1, M.count)).fill(-1);  // gid -> chunk id
// hand-built landmark models (MIT's Great Dome, …), drawn as part of their building
const landmarkModels = landmarks({
  dir, list: M.raw.models, shadows: SHADOWS,
  addMesh: (id, m) => gfx.addMesh(id, m), gidLoaded: g => g < M.count && gidChunk[g] >= 0,
});
const gidIndex = new Int32Array(Math.max(1, M.count));           // gid -> building index in chunk
const sourceCounts = new Map();

const pickIndex = new PickIndex({ cell: 40, count: M.count });
const ground = new Ground(M.bounds);
// real ground (pipeline terrain + polygons), when the city has it
// the terrain arrives in the background; until it settles the derived ground waits (rebuildGround)
let terrain = null, groundPending = true;
let polysLoaded = false;
const terrainTiles = new Map();   // tile index -> { mesh, step }
let terrainDue = 0;
function updateTerrain(now) {
  if (now < terrainDue) return;
  terrainDue = now + 250;
  const c = mapCam.positionOf(mapCam.pose);
  const fogFar = uniforms[U.FOG_FAR];
  const T = terrain, C = T.cell;
  let built = 0;
  terrain.meta.tiles.forEach((t, k) => {
    if (!T.loaded[k]) return;
    const x0 = T.x0 + t.i0 * C, z0 = T.z0 + t.j0 * C, x1 = x0 + (t.nx - 1) * C, z1 = z0 + (t.nz - 1) * C;
    const dx = Math.max(x0 - c.x, 0, c.x - x1), dz = Math.max(z0 - c.z, 0, c.z - z1);
    const d = Math.hypot(dx, dz, Math.max(0, c.y - t.max));
    const cur = terrainTiles.get(k);
    const show = on => { if (cur && cur.visible !== on) { cur.visible = on; gfx.setVisible(`terrain:${k}`, on); } };
    if (d > fogFar * 1.1) { show(false); return; }
    if (cur?.empty) return;
    // vertex spacing ~ 1/180 of the distance, in power-of-two steps of the DEM cell
    const want = Math.min(32, 2 ** Math.max(0, Math.round(Math.log2(Math.max(1, d / 180 / C)))));
    if (cur && (cur.step === want || (built > 3 && cur.step))) { show(true); return; }
    if (built > 6) return;   // spread rebuilds over frames
    built++;
    // meshed in the ground worker; same id: the renderer swaps the tile's mesh
    groundWorker.postMessage({ op: 'mesh', k, step: want, id: `terrain:${k}` });
    terrainTiles.set(k, { step: want, visible: true, pending: true });
  });
}
// water / parks (and land, where there is no DEM) polygons, draped on the terrain in the ground worker
async function loadGroundPolys() {
  await buildingsFirst;
  const tG = performance.now();
  const jobs = [
    { name: 'land', minY: -Infinity, sub: false, mat: 'flatLand' },
    { name: 'water', minY: 0.3, sub: false, mat: 'waterPoly' },
    { name: 'parks', minY: -Infinity, sub: true, mat: 'park' },
  ].map(j => ({ ...j, url: dataUrl(`${dir}${j.name}.bin`), id: `poly:${j.name}` }));
  const { found } = await groundAsk('polys', { jobs });
  if (!found.land && !found.water && !found.parks) return;
  polysLoaded = true;
  status.groundPolyMs = performance.now() - tG;
  log('ground polygons', !!found.land, !!found.water, !!found.parks, terrain ? `terrain ${terrain.nx}x${terrain.nz} @ ${terrain.cell} m` : 'no terrain', Math.round(status.groundPolyMs), 'ms');
}
// terrain tiles: what the view shows first, once the buildings are in; the polygons are draped
// when the whole grid is there
terrainP.then(async t => {
  groundWorker.postMessage({ op: 'init', meta: t?.meta, dir, version: dataVersion(), gz: GZ });
  if (!t) return;
  terrain = t;
  await buildingsFirst;
  const v = mapCam.goal, rank = viewRanker(v, camera.aspect, { top: 0 });
  const order = t.meta.tiles.map((tile, k) => ({ k, ...rank(t.tileBox(k)) })).filter(e => e.visible)
    .sort((a, b) => a.dist - b.dist).map(e => e.k);
  await groundAsk('fetch', { order });
  status.terrainAt = performance.now();
}).then(loadGroundPolys)
  .catch(e => report(`ground: ${e}`))
  .finally(() => { groundPending = false; waterM.role = 'water'; applyGroundColors(); scheduleGround(); });
let landMesh = null, groundVersionBuilt = -1, groundTimer = 0;

// ---------- camera ----------
const mapCam = new MapCamera(camera, canvas, {
  minDistance: 60, maxDistance: bigCity ? 120000 : 45000,
  bounds: { minX: b.min[0] - 2000, minZ: b.min[1] - 2000, maxX: b.max[0] + 2000, maxZ: b.max[1] + 2000 },
});
mapCam.setView(firstView(), true);
mapCam.update(0);
addEventListener('hashchange', () => { const v = viewFromHash(); if (v) mapCam.setView(v); });
let hashTimer = 0;
mapCam.onChange = () => {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    const p = mapCam.goal;
    history.replaceState(null, '', `#${p.x.toFixed(0)},${p.z.toFixed(0)},${p.distance.toFixed(0)},${(p.azimuth * 180 / Math.PI).toFixed(1)},${(p.elevation * 180 / Math.PI).toFixed(1)}`);
  }, 400);
  scheduleQueue();
};

// ---------- loading ----------
const chunks = new Map();  // id -> { pack, mesh, pick, nVert }
let nextChunkId = 1, loadedVerts = 0;
let initialSet = null, initialDone = 0;
const progressEl = $('#progress'), loadingEl = $('#loading');

function packDistance(p, x, z) {
  const dx = Math.max(p.bbox[0] - x, 0, x - p.bbox[2]);
  const dz = Math.max(p.bbox[1] - z, 0, z - p.bbox[3]);
  return Math.hypot(dx, dz);
}

// the margin around the view kept loaded, from the view's target
function viewRadius(v) { return Math.min(60000, Math.max(3500, v.distance * 2.6)); }
// what the goal view shows, nearest the eye first, then the margin; within the vertex budget
function desiredPacks() {
  const v = mapCam.goal;
  const lod = viewLod(v);
  // Budget against full-detail estimates even while a coarse mesh is loaded. Otherwise its
  // smaller actual vertex count admits many extra packs that overflow the budget when zooming in.
  return rankPacks(M.packs, v, camera.aspect || innerWidth / innerHeight, {
    budget: VERT_BUDGET, radius: viewRadius(v), vertsOf: p => p.estVerts,
  })
    .map(e => ({ ...e, lod }));
}

let queueTimer = 0;
function scheduleQueue() { if (!queueTimer) queueTimer = setTimeout(() => { queueTimer = 0; pump(); }, 250); }

function pump() {
  const ranked = desiredPacks();
  const want = ranked.map(e => e.p);
  const wantSet = new Set(want);
  const wantLod = new Map(ranked.map(e => [e.p, e.lod]));
  // Crossing an LOD boundary reparses only packs still wanted. The render worker removes the
  // old mesh immediately; picking and attributes are replaced with the new pack data.
  for (const c of [...chunks.values()]) {
    const lod = wantLod.get(c.pack);
    if (lod != null && c.pack.lod !== lod) unloadChunk(c);
  }
  // "ready" once what the first view shows is in; the margin keeps loading behind it
  if (!initialSet) { initialSet = new Set(ranked.filter(e => e.visible).map(e => e.p)); if (!initialSet.size) initialSet = new Set(want); }
  // unload what is far and not wanted when over budget
  if (loadedVerts > VERT_BUDGET * 0.85) {
    const { x, z } = mapCam.goal;
    const victims = [...chunks.values()].filter(c => !wantSet.has(c.pack))
      .sort((a, b) => packDistance(b.pack, x, z) - packDistance(a.pack, x, z));
    for (const c of victims) { if (loadedVerts <= VERT_BUDGET * 0.7) break; unloadChunk(c); }
  }
  const loaded = (p, data) => { onPack(p, data); pump(); };
  const failed = (p, e) => { p.state = 'error'; report(`${p.file}: ${e.message}`); pump(); };
  // fetched (or on the way) before the renderer was up
  for (const p of want) {
    if (p.state !== 'early') continue;
    p.state = 'loading';
    p.parsed.then(data => loaded(p, data), e => failed(p, e));
  }
  let busy = M.packs.reduce((n, q) => n + (q.state === 'loading'), 0);
  for (const p of want) {
    if (busy >= WORKERS) break;
    if (p.state !== 'idle') continue;
    if (loadedVerts + p.estVerts > VERT_BUDGET * 1.05 && chunks.size) break;
    p.state = 'loading'; busy++;
    // worker mode: the parse worker sends the mesh straight to the render worker under this id
    p.meshId = renderPorts ? `c${nextChunkId++}` : undefined;
    parsePack(p, undefined, wantLod.get(p)).then(data => loaded(p, data), e => failed(p, e));
  }
  if (!status.ready && !M.packs.some(q => q.state === 'loading')) finishInitial();
}
function finishInitial() {
  if (status.ready) return;
  loadingEl.hidden = true;
  status.ready = true;
  status.readyAt = performance.now();
  buildingsIn();
  log('initial load done', chunks.size, 'packs', loadedVerts, 'vertices', Math.round(performance.now()), 'ms');
}

function onPack(p, data) {
  if (!data.ok) { p.state = 'error'; report(`${p.file}: ${data.error}`); return; }
  // worker mode: the parse worker already sent the mesh (and its storage runs) to the renderer
  const id = data.sent ? +p.meshId.slice(1) : nextChunkId++;
  const tA = performance.now();
  const pick = { id, ...data.pick };
  // storage: contiguous gid runs
  const { gid, attr } = pick;
  const runs = [];
  let s = 0;
  for (let i = 1; i <= gid.length; i++) {
    if (i === gid.length || gid[i] !== gid[i - 1] + 1) {
      const g0 = gid[s];
      if (g0 + (i - s) <= M.count) {
        const run = attr.subarray(s * 4, i * 4);
        attrs.set(run, g0 * 4);
        if (!data.sent) runs.push([g0 * 4, run.slice()]);
      }
      s = i;
    }
  }
  if (!data.sent) {
    gfx.attrsRuns(runs);
    gfx.addMesh(`c${id}`, { mat: 'building', parts: data.parts, position: [p.origin[0], 0, p.origin[1]], castShadow: SHADOWS });
  }
  for (let i = 0; i < gid.length; i++) {
    if (gid[i] < M.count) { gidChunk[gid[i]] = id; gidIndex[gid[i]] = i; }
    const ys = (attr[i * 4 + 2] >> 8) & 255;
    sourceCounts.set(ys, (sourceCounts.get(ys) || 0) + 1);
  }
  pickIndex.add(pick);
  ground.addChunk(pick, 1);
  chunks.set(id, { id, pack: p, pick, nVert: data.nVert });
  p.state = 'loaded'; p.chunk = id; p.nVert = data.nVert; p.lod = data.lod;
  if (Q.has('debug')) log('pack', p.file, 'LOD', data.lod, data.nB, 'buildings', data.nVert, 'verts (', data.origVerts, 'before simplify,', data.roofFailed, 'roofs failed), worker', Math.round(data.ms), 'ms, main', Math.round(performance.now() - tA), 'ms');
  loadedVerts += data.nVert;
  status.loadedPacks++;
  status.loadedVerts = loadedVerts;
  if (initialSet && initialSet.has(p)) {
    initialDone++;
    const pct = Math.round(100 * initialDone / initialSet.size);
    progressEl.textContent = pct;
    if (initialDone >= initialSet.size) finishInitial();
  }
  landmarkModels.check();
  if (mode === 3) renderPanel();
  scheduleGround();
}

function unloadChunk(c) {
  gfx.removeMesh(`c${c.id}`);
  pickIndex.remove(c.id);
  ground.addChunk(c.pick, -1);
  for (let i = 0; i < c.pick.gid.length; i++) {
    const g = c.pick.gid[i];
    if (gidChunk[g] === c.id) gidChunk[g] = -1;
    const ys = (c.pick.attr[i * 4 + 2] >> 8) & 255;
    sourceCounts.set(ys, (sourceCounts.get(ys) || 1) - 1);
  }
  chunks.delete(c.id);
  c.pack.state = 'idle'; c.pack.chunk = null; c.pack.meshId = undefined;
  loadedVerts -= c.nVert;
  scheduleGround();
}

function scheduleGround() {
  if (terrain || polysLoaded || groundPending) return;   // real ground data replaces the derived surface
  clearTimeout(groundTimer);
  // rebuild the land surface once loading pauses (or every few packs while it runs)
  groundTimer = setTimeout(rebuildGround, pool.some(s => s.busy) ? 1500 : 300);
}
function rebuildGround() {
  if (ground.version === groundVersionBuilt) return;
  groundVersionBuilt = ground.version;
  const t0 = performance.now();
  const { pos, uv, nrm, idx } = ground.build(RELIEF);
  if (idx.length) { gfx.addMesh('land', { mat: 'land', pos, uv, nrm, idx }); landMesh = true; }
  else if (landMesh) { gfx.removeMesh('land'); landMesh = null; }
  log('ground', ground.nx, 'x', ground.nz, 'cells of', ground.cell, 'm,', idx.length / 6, 'land cells,', Math.round(performance.now() - t0), 'ms');
}

function report(msg) { console.error(msg); status.errors.push(msg); }
addEventListener('error', e => status.errors.push(String(e.message)));
addEventListener('unhandledrejection', e => status.errors.push(String(e.reason)));

// ---------- per-building lookup ----------
function building(gid) {
  const cid = gidChunk[gid];
  if (cid < 0) return null;
  const c = chunks.get(cid);
  if (!c) return null;
  const i = gidIndex[gid], a = c.pick.attr;
  const fl = a[i * 4 + 2], fu = a[i * 4 + 3];
  const dcode = Math.floor(fu / 2048), rest = fu - 2048 * dcode, use = Math.floor(rest / 256);
  return {
    gid, year: a[i * 4], period: a[i * 4 + 1], flags: fl & 255, yearSrc: fl >> 8, heightSrc: c.pick.hsrc[i],
    floors: rest - 256 * use, use, demolished: dcode ? 1600 + dcode : 0, height: c.pick.top[i], base: c.pick.base[i],
    bbox: c.pick.bbox.subarray(i * 4, i * 4 + 4),
  };
}
function isVisible(gid) {
  const o = gid * 4, year = attrs[o], period = attrs[o + 1];
  if (mode === 0 && !((mask >> Math.min(period, 16)) & 1)) return false;
  if (year > 0 && year > uniforms[U.YEAR] - 0.5) return false;
  const dcode = Math.floor(attrs[o + 3] / 2048);
  if (dcode && 1600 + dcode <= uniforms[U.YEAR] + 0.5) return false;
  return true;
}

// attrs rows, per region, fetched when first needed
const attrCache = new Map();
function regionOf(gid) {
  const R = M.regions;
  let lo = 0, hi = R.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (gid < R[mid].gid0) hi = mid - 1; else if (gid >= R[mid].gid0 + R[mid].nB) lo = mid + 1; else return R[mid];
  }
  return null;
}
function attrRow(gid, then) {
  let url, off;
  if (M.attrsGlobal) { url = M.attrsGlobal; off = 0; } else {
    const r = regionOf(gid); if (!r || !r.url) return null; url = r.url; off = r.gid0;
  }
  const e = attrCache.get(url);
  if (e && e.rows) return e.rows[gid - off] || null;
  if (!e) {
    const ent = { rows: null };
    attrCache.set(url, ent);
    fetch(url).then(r => r.json()).then(rows => { ent.rows = rows; then?.(); }).catch(err => report(`attrs ${url}: ${err}`));
  }
  return null;
}

// ---------- card ----------
const card = $('#card');
const NO_SOURCE = rawManifest.noSource ?? 255;
const sourceName = i => {
  if (i === undefined || i === null || i === '' || i === NO_SOURCE) return '';
  const s = M.sources[i]; return s ? (s.name || s.attribution || String(s.id)) : '';
};
const sourceShort = i => sourceName(i).replace(/\s*\(.*$/, '').replace(/ Historical Secured Property Tax Rolls/, ' Tax Rolls');
// facts some cities carry per building (attrs "extra"): listings (Bay Area), NYC energy benchmarking
function extraFacts(x) {
  const out = [], money = v => '$' + fmt(Math.round(v));
  const L = x.listings;
  if (L) {
    out.push(['Listings', `${fmt(L.n)}${L.from?.length ? ` <span class="est">${esc(L.from.join(', '))}</span>` : ''}`]);
    if (L.rent) out.push(['Asking rent', `${money(L.rent)}/mo${L.n > 1 ? ' <span class="est">median</span>' : ''}`]);
    if (L.price) out.push(['Asking price', money(L.price)]);
    if (L.sqft) out.push(['Floor area', `${fmt(L.sqft)} ft²`]);
    if (L.seen) out.push(['Last listed', esc(L.seen)]);
  }
  const E = x.ll84;
  if (E && (E.siteEUI_kBtu_ft2 != null || E.energyStar != null)) {
    const v = [E.siteEUI_kBtu_ft2 != null ? `${fmt(Math.round(E.siteEUI_kBtu_ft2))} kBtu/ft²` : '',
      E.energyStar != null ? `Energy Star ${E.energyStar}` : ''].filter(Boolean).join(' · ');
    out.push([`Energy${E.reportYear ? ` (${E.reportYear})` : ''}`, esc(v)]);
  }
  return out;
}
function cardHtml(gid, pinned) {
  const B = building(gid);
  if (!B) return '';
  const row = attrRow(gid, () => refreshCard(gid)) || [];
  const col = name => { const k = M.attrsColumns.indexOf(name); return k >= 0 ? row[k] : undefined; };
  const address = col('address') || '';
  const useDesc = col('use') || '';
  const units = col('units') || 0;
  const srcIdx = col('source');
  const ySrcIdx = col('yearSource') ?? (B.yearSrc !== NO_SOURCE ? B.yearSrc : undefined);
  const hSrcIdx = col('heightSource') ?? (B.heightSrc !== NO_SOURCE ? B.heightSrc : undefined);
  const fSrcIdx = col('footprintSource');
  const extra = col('extra?') || col('extra') || {};
  const p = B.period < periods.length ? periods[B.period] : null;
  const approx = B.flags & FLAG.approx, parcel = B.flags & FLAG.parcel, tract = B.flags & FLAG.tract;
  const yearTxt = B.year > 0 ? `${approx || tract ? 'c. ' : ''}${B.year}` : 'Year unknown';
  const yearNote = [
    parcel ? 'parcel year' : '', tract ? 'census-area median year' : (approx ? 'approximate' : ''),
    B.year > 0 ? sourceShort(ySrcIdx) : '',
  ].filter(Boolean).join(' · ');
  const facts = [
    ['Floors', B.floors ? fmt(B.floors) : '—'],
    ['Height', `${B.height.toFixed(1)} m${B.flags & FLAG.estHeight ? ' <span class="est">estimated</span>' : ''}`],
    sourceShort(hSrcIdx) ? ['Height from', esc(sourceShort(hSrcIdx))] : null,
    sourceShort(fSrcIdx) && fSrcIdx !== hSrcIdx ? ['Footprint', esc(sourceShort(fSrcIdx))] : null,
    ['Use', esc(useDesc || M.uses[B.use] || '—')],
    units ? ['Units', fmt(units)] : null,
    RELIEF ? ['Ground', `${B.base.toFixed(0)} m`] : null,
    typeof srcIdx === 'number' && sourceName(srcIdx) ? ['Source', esc(sourceName(srcIdx))] : null,
    ...extraFacts(extra),
  ].filter(Boolean);
  return `
    ${pinned ? '<button class="card-close" aria-label="Close">×</button>' : ''}
    <header class="card-head">
      <h3>${esc(address || (row.length ? 'No address on record' : 'Loading…'))}</h3>
      <div class="when"><span class="y">${esc(yearTxt)}</span>
        ${p ? `<span class="period"><i style="background:${p.color}"></i>${esc(p.name)}</span>` : ''}</div>
      ${yearNote ? `<p class="note">${esc(yearNote)}</p>` : ''}
      ${B.flags & FLAG.landmark ? '<p class="tag">Landmark</p>' : ''}
      ${B.demolished ? `<p class="tag">Demolished ${B.demolished}</p>` : ''}
    </header>
    <dl>${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
    ${layers.cardHtml(gid, pinned)}
    ${pinned ? '' : '<p class="hint">Click to keep this card open</p>'}`;
}
let cardGid = -1, cardPinned = false, cardXY = [0, 0];
function placeCard(x, y) {
  const r = card.getBoundingClientRect();
  card.style.left = Math.max(12, Math.min(x + 18, innerWidth - r.width - 12)) + 'px';
  card.style.top = Math.max(12, Math.min(y + 18, innerHeight - r.height - 12)) + 'px';
}
function showCard(gid, x, y, pinned = false) {
  if (gid < 0) { card.hidden = true; cardGid = -1; cardPinned = false; return; }
  if (gid !== cardGid || pinned !== cardPinned || card.hidden) {
    cardGid = gid; cardPinned = pinned;
    card.innerHTML = cardHtml(gid, pinned);
    card.classList.toggle('pinned', pinned);
    card.hidden = false;
    card.querySelector('.card-close')?.addEventListener('click', () => select(-1));
    if (pinned) layers.bindCard(card, gid, cardPoint(gid), () => { refreshCard(gid); if (mode === 4) renderPanel(); });
  }
  cardXY = [x, y];
  placeCard(x, y);
}
// where a mark goes: the clicked point on the building, else its footprint bbox centre
let lastHit = null;
function cardPoint(gid) {
  if (lastHit && lastHit.gid === gid) return [lastHit.point.x, lastHit.point.z];
  const B = building(gid);
  return B ? [(B.bbox[0] + B.bbox[2]) / 2, (B.bbox[1] + B.bbox[3]) / 2] : [0, 0];
}
function refreshCard(gid) {
  if (cardGid === gid && !card.hidden) { cardGid = -1; showCard(gid, ...cardXY, cardPinned); }
}
function select(gid, x, y) {
  selectedGid = gid;
  setU(U.SELECTED, gid);
  if (gid < 0) { card.hidden = true; cardGid = -1; cardPinned = false; return; }
  showCard(gid, x, y, true);
  if (!layers.loaded) layers.load().then(() => refreshCard(gid));
}
addEventListener('keydown', e => { if (e.key === 'Escape') select(-1); });

// hover / click
let pointer = null, downAt = null, pickDue = 0;
canvas.addEventListener('pointermove', e => { pointer = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerleave', () => { pointer = null; setHover(-1); if (!cardPinned) card.hidden = true; });
canvas.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY, e.button]; if (!cardPinned) card.hidden = true; });
canvas.addEventListener('pointerup', e => {
  if (!downAt || downAt[2] !== 0 || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) { downAt = null; return; }
  downAt = null;
  const hit = pickAt(e.clientX, e.clientY);
  const gid = hit ? hit.gid : -1;
  lastHit = hit;
  select(gid === selectedGid ? -1 : gid, e.clientX, e.clientY);
});
function pickAt(x, y) {
  const { origin, dir } = mapCam.ray(x, y);
  return pickIndex.pick(origin, dir, isVisible, RELIEF);
}
function setHover(gid) { hoverGid = gid; setU(U.HOVER, gid); }
function hoverTick(now) {
  if (!pointer || mapCam.interacting || now < pickDue) return;
  pickDue = now + 45;
  const hit = pickAt(pointer[0], pointer[1]);
  const gid = hit ? hit.gid : -1;
  if (gid !== hoverGid) setHover(gid);
  if (!cardPinned) showCard(gid, pointer[0], pointer[1]);
  canvas.style.cursor = gid >= 0 ? 'pointer' : '';
}

// ---------- UI: modes, legend ----------
const panel = $('#panel-body');
$('.modes').innerHTML = MODES.map((m, i) => `<button data-mode="${i}" aria-pressed="${i === mode}">${m.label}</button>`).join('');
document.querySelectorAll('.modes button').forEach(btn => btn.onclick = () => setMode(+btn.dataset.mode));
// a period toggled in the legend rises / sinks over FADE_S (shaders.js)
function setMaskAnimated(m) {
  if (m === mask) return;
  setU(U.PREV_MASK, mask); setU(U.MASK_AT, performance.now() / 1000);
  mask = m; setU(U.MASK, m);
  renderPanel(); drawHist();
}
function setMode(i) {
  // colours cross-fade from the previous mode
  if (i !== mode) { setU(U.PREV_MODE, mode); setU(U.MODE_AT, performance.now() / 1000); }
  mode = i;
  if (i === 4) { layers.layerAt = performance.now() / 1000; layers.load().then(() => { setU(U.LAYER_AT, layers.layerAt); renderPanel(); }); }
  setU(U.MODE, i);
  document.querySelectorAll('.modes button').forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.mode === i)));
  renderPanel(); drawHist();
}
function renderPanel() {
  if (mode === 0) {
    const rows = periods.map((p, i) => ({ i, color: p.color, label: p.name, range: `${p.from}–${p.to}`, n: periodTotals[i] }));
    rows.push({ i: 16, color: S.unknown, label: 'Year unknown', range: '', n: unknownTotal });
    panel.innerHTML = `<h2>Built in</h2><div class="swatches">${rows.map(r => `
      <button class="swatch" data-i="${r.i}" aria-pressed="${!!((mask >> r.i) & 1)}">
        <i style="background:${r.color}"></i><span>${esc(r.label)}<small>${r.range}</small></span><span class="n">${fmt(r.n)}</span>
      </button>`).join('')}</div>
      <p class="note">Click a period to see it alone, again to show all. Faded buildings have an approximate year.</p>`;
    panel.querySelectorAll('.swatch').forEach(btn => btn.onclick = () => {
      const i = +btn.dataset.i, all = (1 << 17) - 1;
      setMaskAnimated(mask === (1 << i) ? all : (1 << i));
    });
  } else if (mode === 1) {
    panel.innerHTML = `<h2>Floors</h2>
      <div class="ramp" style="background:linear-gradient(90deg,${S.floors.join(',')})"></div>
      <div class="ramp-scale"><span>1</span><span>3</span><span>8</span><span>20</span><span>40+</span></div>
      <p class="note">Storeys above ground, on a log scale. Where none is recorded, floors are estimated from height.</p>`;
  } else if (mode === 2) {
    panel.innerHTML = `<h2>Use</h2><div class="swatches static">${M.uses.map((u, i) => `
      <div class="swatch"><i style="background:${S.uses[i] || S.unknown}"></i><span>${esc(u[0].toUpperCase() + u.slice(1))}</span></div>`).join('')}</div>
      <p class="note">Main use from the land-use record of the parcel.</p>`;
  } else if (mode === 4) {
    layers.renderPanel(panel, renderPanel);
  } else {
    const ids = [...sourceCounts.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    const any = ids.some(([i]) => i !== NO_SOURCE);
    panel.innerHTML = `<h2>Year source</h2><div class="swatches static">${ids.map(([i, n]) => `
      <div class="swatch"><i style="background:${i === NO_SOURCE ? S.unknown : S.sources[i % SOURCE_SLOTS]}"></i><span>${esc(i === NO_SOURCE ? 'No year' : sourceName(i) || `source ${i}`)}</span><span class="n">${fmt(n)}</span></div>`).join('')}</div>
      <p class="note">${any ? 'Where each building’s year comes from (counts for the loaded area).' : 'This dataset has no per-building year source (needs SFT4 tiles).'}</p>`;
  }
}

// ---------- colour scheme ----------
function applyGroundColors() {
  for (const g of groundMats) {
    g.u.set(hex3(S[g.role]), 0); g.u.set(hex3(S.sky), 8); g.u.set(hex3(S.water), 16);
    g.sent = false;   // uploaded by frame()
  }
}
function applyScheme(s) {
  S = s;
  gfx.setBackground(parseInt(S.sky.slice(1), 16));
  uniforms.set(hex3(S.sky), U.SKY);
  uniforms.set(hex3(S.unknown), U.UNKNOWN);
  uniforms.set(hex3(S.pale), U.PALE);
  uniformsDirty = true;
  for (const p of periods) p.dataColor ??= p.color;
  periodColors(S, periods).forEach((c, i) => { if (i < 16) palette.set(hex3(c), i * 4); periods[i].color = c; });
  S.uses.forEach((c, i) => palette.set(hex3(c), (PALETTE_USE_OFFSET + i) * 4));
  S.sources.slice(0, SOURCE_SLOTS).forEach((c, i) => palette.set(hex3(c), (PALETTE_SOURCE_OFFSET + i) * 4));
  S.floors.forEach((c, i) => palette.set(hex3(c), (PALETTE_FLOORS_OFFSET + i) * 4));
  gfx.setStorage(1, palette);
  applyGroundColors();
  const root = document.documentElement;
  root.style.setProperty('--sky', S.sky);
  for (const [k, v] of Object.entries(S.ui)) root.style.setProperty(`--${k}`, v);
  root.style.colorScheme = S.id === 'night' ? 'dark' : 'light';
  root.dataset.scheme = S.id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', S.sky);
  status.scheme = S.id;
  const pick = $('#scheme');
  if (pick) pick.value = S.id;
  renderPanel(); drawHist();
  if (cardGid >= 0) refreshCard(cardGid);
}
function setScheme(id) {
  const s = SCHEMES.find(x => x.id === id);
  if (!s || s === S) return;
  rememberScheme(s);
  applyScheme(s);
}
$('#scheme').innerHTML = SCHEMES.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
$('#scheme').onchange = e => setScheme(e.target.value);

// ---------- timeline ----------
const hist = $('#hist');
// drawn in a worker on an OffscreenCanvas where possible (hist-worker.js), else here
let hctx = null, histWorker = null;
const firstYear = years.length ? years[0][0] : 1850;
// skip a sparse early tail: start where 0.2% of dated buildings exist
let cum = 0, T0 = firstYear;
for (const [y, n] of years) { cum += n; if (cum > histTotal * 0.002) { T0 = y; break; } }
T0 = Math.floor(Math.min(T0, 1850) / 10) * 10;
const T1 = lastYear + 1;
const yMax = Math.max(1, ...years.map(([, n]) => n));
const xOf = y => (y - T0) / (T1 - T0) * histW;
const yearOf = x => Math.round(T0 + x / histW * (T1 - T0));

function visibleCount() {
  const Y = uniforms[U.YEAR];
  let n = 0;
  for (const [y, c] of years) {
    if (y > Y - 0.5) break;
    const i = periodOfYear(y);
    if (mode !== 0 || i < 0 || ((mask >> i) & 1)) n += c;
  }
  if (mode !== 0 || ((mask >> 16) & 1)) n += unknownTotal;
  // demolished buildings, from when they were built (or the start, if unknown) until they came down
  for (const [b, d, c] of M.raw.demolished?.pairs || []) {
    if (d <= Y + 0.5 || (b > 0 && b > Y - 0.5)) continue;
    const i = b > 0 ? periodOfYear(b) : -1;
    if (mode !== 0 || (i < 0 ? ((mask >> 16) & 1) : ((mask >> i) & 1))) n += c;
  }
  return n;
}
// The histogram is redrawn only when something it shows changed (year, mask, mode, size, scheme):
// it was called many times a second during loading and play. Its size comes from a
// ResizeObserver, not clientWidth, which forced a layout on every call.
let histW = hist.clientWidth, histH = hist.clientHeight, histKey = '';
new ResizeObserver(([e]) => { histW = e.contentRect.width; histH = e.contentRect.height; drawHist(); }).observe(hist);
function drawHist() {
  const w = histW, h = histH, dpr = devicePixelRatio || 1;
  if (!w || !h) return;
  const key = `${uniforms[U.YEAR].toFixed(2)}|${mask}|${mode}|${w}|${h}|${dpr}|${S.id}`;
  if (key === histKey) return;
  histKey = key;
  const Y = uniforms[U.YEAR];
  const colors = { periods: periods.map(p => p.color), unknown: S.unknown, muted: S.ui.muted, ink: S.ui.ink };
  if (!histWorker && !hctx) startHist();
  if (histWorker) histWorker.postMessage({ op: 'draw', w, h, dpr, Y, mask, mode, colors });
  else drawHistHere({ w, h, dpr, Y, colors });
  $('#year').textContent = Y > lastYear ? 'Today' : Math.round(Y);
  $('#count').textContent = fmt(visibleCount());
}
function startHist() {
  if (hist.transferControlToOffscreen && !Q.has('inline')) {
    try {
      const off = hist.transferControlToOffscreen();
      histWorker = new Worker('hist-worker.js', { type: 'module' });
      histWorker.postMessage({
        op: 'init', canvas: off, years, periods: periods.map(p => ({ from: p.from, to: p.to })), T0, T1, lastYear,
        fontCss: document.querySelector('link[href*="fonts.googleapis.com/css"]')?.href,
      }, [off]);
      return;
    } catch { histWorker = null; }
  }
  hctx = hist.getContext('2d');
}
// the same drawing, on the page (no OffscreenCanvas)
function drawHistHere({ w, h, dpr, Y, colors }) {
  if (hist.width !== Math.round(w * dpr)) { hist.width = Math.round(w * dpr); hist.height = Math.round(h * dpr); }
  hctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  hctx.clearRect(0, 0, w, h);
  const plotH = h - 18, bw = Math.max(1, w / (T1 - T0));
  for (const [y, c] of years) {
    if (y < T0) continue;
    const i = periodOfYear(y);
    const on = y <= Y && (mode !== 0 || i < 0 || ((mask >> i) & 1));
    hctx.fillStyle = i >= 0 ? colors.periods[i] : colors.unknown;
    hctx.globalAlpha = on ? 1 : 0.18;
    const bh = Math.sqrt(c / yMax) * (plotH - 6);
    hctx.fillRect(xOf(y), plotH - bh, bw, bh);
  }
  hctx.globalAlpha = 1;
  hctx.fillStyle = colors.muted;
  hctx.font = '500 11px "Schibsted Grotesk", system-ui, sans-serif';
  const step = w < 500 ? 50 : 25;
  for (let y = Math.ceil(T0 / step) * step; y <= T1; y += step) {
    hctx.fillRect(xOf(y), plotH, 1, 3);
    hctx.fillText(y, Math.min(w - 28, Math.max(0, xOf(y) - 13)), h - 3);
  }
  if (Y <= lastYear) { hctx.fillStyle = colors.ink; hctx.fillRect(xOf(Y) - 1, 0, 2, plotH); }
}
let scrubbing = false;
hist.addEventListener('pointerdown', e => { hist.setPointerCapture(e.pointerId); scrubbing = true; stopPlay(); scrubTo(e.offsetX); });
hist.addEventListener('pointermove', e => { if (scrubbing) scrubTo(e.offsetX); });
hist.addEventListener('pointerup', () => { scrubbing = false; });
function scrubTo(x) {
  let y = yearOf(x);
  if (y >= lastYear) y = lastYear + 1; // the right end is "today": everything
  glideTo(Math.max(T0, y));
}
// The shown year glides toward the one asked for (a drag, a click on the timeline): buildings
// grow over as many years as the year moves in about half a second, instead of popping up.
let yearGoal = uniforms[U.YEAR], riseNow = 0.01;
function glideTo(y) { yearGoal = y; }
function showYear(y) { setU(U.YEAR, y); layers.setYear(Math.round(y)); drawHist(); if (mode === 4) renderPanel(); }
function setYear(y) { yearGoal = y; showYear(y); }
function glideStep(dt) {
  const y = uniforms[U.YEAR], d = yearGoal - y;
  if (Math.abs(d) < 0.02) {
    if (d !== 0) showYear(yearGoal);
    riseNow = Math.max(0.01, riseNow * Math.exp(-dt * 6));
  } else {
    const step = d * (1 - Math.exp(-dt * 7));
    showYear(y + step);
    riseNow = Math.max(riseNow * Math.exp(-dt * 6), Math.min(12, Math.abs(step / Math.max(dt, 1e-3)) * 0.45));
  }
  setU(U.RISE, riseNow);
}

// play: each year gets screen time by how much was built in it (square root, with a floor so
// quiet decades still pass legibly), eased in at the start and out at the end
let playing = false, playStart = 0, playFrom = 0;
const DURATION = (+Q.get('film') || 24) * 1000;
const playBtn = $('#play'), playIcon = $('#play-icon');
const playCum = (() => {
  const n = new Map(years), span = lastYear + 1 - T0;
  const w = Array.from({ length: span }, (_, i) => Math.sqrt(n.get(T0 + i) || 0));
  const top = Math.max(1e-9, ...w), c = [0];
  for (const x of w) c.push(c[c.length - 1] + 0.3 + 0.7 * x / top);
  return c.map(v => v / c[c.length - 1]);   // c[i]: share of the film done when year T0 + i starts
})();
const playYear = t => {
  // constant speed, with an acceleration over the first 6% and a deceleration over the last 6%
  const r = 0.06;
  const f = t < r ? t * t / (2 * r) : t > 1 - r ? 1 - r - (1 - t) * (1 - t) / (2 * r) : t - r / 2;
  const u = f / (1 - r);
  let lo = 0, hi = playCum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (playCum[m] <= u) lo = m; else hi = m; }
  return T0 + lo + (u - playCum[lo]) / Math.max(1e-9, playCum[hi] - playCum[lo]);
};
function startPlay() {
  playing = true;
  if (uniforms[U.YEAR] > lastYear) setYear(T0);
  playFrom = 0;
  while (playFrom < 1 && playYear(playFrom) < uniforms[U.YEAR]) playFrom += 0.001;
  playStart = performance.now();
  playIcon.setAttribute('d', 'M4 2.5h3v11H4zM9 2.5h3v11H9z');
  playBtn.setAttribute('aria-label', 'Pause');
}
function stopPlay() {
  if (!playing) return;
  playing = false;
  glideTo(Math.round(uniforms[U.YEAR]));
  playIcon.setAttribute('d', 'M4 2.5v11l9-5.5z');
  playBtn.setAttribute('aria-label', 'Play the city’s growth');
}
playBtn.onclick = () => playing ? stopPlay() : startPlay();

// ---------- city switcher, about ----------
// one button per city: the server's list (with counts) when the API runs, else the known four.
// Switching keeps the colour mode and backend flags; the camera starts at the new city's home.
function cityHref(id) {
  const q = new URLSearchParams({ city: id });
  if (mode) q.set('mode', MODES[mode].id);
  for (const k of ['gl', 'static', 'noshadow', 'flat', 'scheme']) if (Q.has(k)) q.set(k, Q.get(k) || '1');
  return `?${q}`;
}
function renderCities(list) {
  $('#city').innerHTML = list.map(c => `<a href="${cityHref(c.id)}" data-city="${esc(c.id)}" aria-current="${c.id === CITY ? 'page' : 'false'}"
      title="${esc(c.name || CITY_NAMES[c.id] || c.id)}${c.count ? ` · ${fmt(c.count)} buildings` : ''}">${esc(CITY_NAMES[c.id] || c.name || c.id)}</a>`).join('');
  // the mode can change after the buttons were drawn: fix the link at click time
  $('#city').querySelectorAll('a').forEach(a => a.onclick = e => { e.preventDefault(); location.href = cityHref(a.dataset.city); });
}
renderCities(SITE?.cities || CITIES.map(id => ({ id })));
const cityOrder = id => { const i = CITIES.indexOf(id); return i < 0 ? 99 : i; };
if (API) fetch(`${API}/cities`).then(r => r.ok ? r.json() : null)
  .then(list => { if (list?.length) renderCities(list.sort((a, b) => cityOrder(a.id) - cityOrder(b.id))); }).catch(() => {});
const about = $('#about');
$('.about-open').onclick = () => {
  const srcs = M.sources.map(s => `<li>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name || s.attribution)}</a>` : esc(s.name || s.attribution)}
    ${s.licence || s.license ? ` — ${esc(s.licence || s.license)}` : ''}${s.publishable === false ? ' <b class="local">local use only</b>' : ''}
    ${s.attribution && s.attribution !== s.name ? `<br><small>${esc(s.attribution)}</small>` : ''}</li>`).join('');
  $('#about-body').innerHTML = `<h2>About this map</h2>
    <p>${fmt(M.count)} buildings of ${esc(M.name)}, coloured by the year they were built, their height in floors, their use or the source of their date.</p>
    <p>Rendered with <b>threers</b>, a Rust/wgpu three.js replacement compiled to WebAssembly (${esc(backend)} backend). Interface after
    <a href="https://stop-token.com/lab/amsterdam/" target="_blank" rel="noopener">LAYRS: Amsterdam</a>.</p>
    <h3>Sources</h3><ul class="sources">${srcs || `<li>${esc(M.attribution)}</li>`}</ul>
    ${rawManifest.licence ? `<p><b>Licence:</b> ${esc(rawManifest.licence)}${rawManifest.publishable === false ? ' — <b class="local">contains sources for local use only</b>' : ''}</p>` : ''}
    <h3>Attribution</h3><p>${esc(M.attribution)}</p>`;
  about.showModal();
};
about.querySelector('.about-close').onclick = () => about.close();
about.addEventListener('click', e => { if (e.target === about) about.close(); });

// ---------- loop ----------
// Render resolution: the device's pixels, and on screens under 2x a supersampled canvas (1.5
// pixels per CSS pixel, filtered down by the browser) on top of the MSAA: thin and distant
// buildings crawl less. While the camera moves, use a 1x raster LOD and 1x MSAA; full quality
// returns shortly after it settles. ?ss pins the resting supersampling level.
const DPR = () => Math.min(devicePixelRatio || 1, 2);
const SS = Q.has('ss') ? Math.max(0.5, +Q.get('ss') || 1) : 0;
let renderScale = SS ? Math.min(2, DPR() * SS) : Math.max(DPR(), Math.min(2, 1.5));
let interactionQuality = false, lastLowQuality = -Infinity;
function setInteractionQuality(on) {
  if (interactionQuality === on) return;
  interactionQuality = on;
  gfx.setMsaa(on ? 1 : MSAA);
  resize(false);
  status.interactionQuality = on ? 'low' : 'full';
  status.msaa = on ? 1 : MSAA;
}
let slowWindows = 0;
function governScale(frameTimes) {
  if (SS || renderScale <= DPR() + 0.01 || !status.ready || frameTimes.length < 121) return;
  // consecutive frames only: with render on demand, the gaps while the map is still are not slow frames
  const d = [];
  for (let i = frameTimes.length - 120; i < frameTimes.length; i++) { const x = frameTimes[i] - frameTimes[i - 1]; if (x < 100) d.push(x); }
  if (d.length < 60) return;
  d.sort((a, b) => a - b);
  slowWindows = d[d.length >> 1] > 21 ? slowWindows + 1 : 0;
  if (slowWindows >= 2) {
    renderScale = Math.max(DPR(), renderScale - 0.25);
    slowWindows = 0;
    log('render scale', renderScale);
    resize();
  }
}
function resize(moveCamera = true) {
  const w = innerWidth, h = innerHeight;
  const full = SS ? renderScale : Math.max(renderScale, DPR());
  const dpr = interactionQuality ? Math.min(1, full) : full;
  status.renderScale = dpr;
  gfx.resize(Math.round(w * dpr), Math.round(h * dpr), w / h);
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  camera.aspect = w / h;
  if (moveCamera) mapCam.setView({});
  drawHist();
}
addEventListener('resize', resize);
// ?mode=period|floors|use|source|layers (kept when switching cities)
const startMode = MODES.findIndex(m => m.id === Q.get('mode'));
applyScheme(S);
if (startMode > 0) setMode(startMode);
resize();
document.fonts?.ready.then(drawHist);

const frameTimes = [];
status.frameTimes = frameTimes;
let shadowFit = 0, waterY = NaN;
// worker mode: the render worker's frame times drive the supersampling governor
gfx.onError = e => report(`render worker: ${e}`);
gfx.onStats = ({ frames, times, uploadMs, drawMs, pending, firstDraws }) => {
  status.firstDraws = firstDraws;
  Object.assign(status, { renderFrames: frames, renderFrameTimes: times });
  (status.renderStats ||= []).push([Math.round(performance.now()), +uploadMs.toFixed(1), +drawMs.toFixed(1), pending]);
  if (status.renderStats.length > 60) status.renderStats.shift();
  governScale(times);
};
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = (now - lastT) / 1000; lastT = now;
  frameTimes.push(now); if (frameTimes.length > 2000) frameTimes.splice(0, 1000);
  if (gfx.mode === 'inline' && status.frames % 120 === 0) governScale(frameTimes);
  status.frames++;
  mapCam.update(dt);
  if ((mapCam.interacting || playing) && status.ready) {
    lastLowQuality = now;
    setInteractionQuality(true);
  } else if (interactionQuality && now - lastLowQuality > 220) {
    setInteractionQuality(false);
  }
  const dist = mapCam.distance;
  setU(U.FOG_NEAR, dist * 2.2); setU(U.FOG_FAR, dist * 7 + 6000);
  // one message a frame to the renderer, with only what changed
  const st = {};
  if (camera.dirty) { st.cam = { p: camera.p, t: camera.t }; camera.dirty = false; }
  if (SHADOWS) {
    // shadow box: the view out to a few camera distances; texel-sized normal bias
    const fit = Math.min(40000, Math.max(800, dist * 1.7));
    if (Math.abs(fit - shadowFit) > fit * 0.05) { shadowFit = fit; st.shadow = { fit, normalBias: fit / 1800 }; }
  }
  const wy = Math.round((WATER_Y - dist * 0.004) * 100) / 100;
  if (wy !== waterY) { waterY = wy; st.waterY = wy; }
  for (const g of groundMats) {
    const lift = Math.fround(g.lift[0] + g.lift[1] * dist);
    if (g.u[6] !== uniforms[U.FOG_NEAR] || g.u[7] !== uniforms[U.FOG_FAR] || g.u[12] !== lift || !g.sent) {
      g.u[6] = uniforms[U.FOG_NEAR]; g.u[7] = uniforms[U.FOG_FAR]; g.u[12] = lift; g.sent = true;
      (st.ground ||= {})[g.name] = g.u.slice();
    }
  }
  if (terrain) updateTerrain(now);
  if (playing) {
    const t = Math.min(1, playFrom + (now - playStart) / DURATION);
    setU(U.YEAR, playYear(t)); layers.setYear(Math.floor(playYear(t)));
    riseNow = Math.max(1.5, playYear(Math.min(1, t + 700 / DURATION)) - playYear(t));
    setU(U.RISE, riseNow);
    yearGoal = uniforms[U.YEAR];
    drawHist();
    if (t >= 1) stopPlay();
  } else {
    glideStep(dt);
  }
  hoverTick(now);
  if (uniformsDirty) { st.uniforms = uniforms.slice(); uniformsDirty = false; }
  for (const k in st) { gfx.state(st); break; }
  // inline: draw; worker: tell it to draw (it also draws for its own pending uploads)
  if (now < awakeUntil || !status.ready) gfx.render(now / 1000);
}
requestAnimationFrame(frame);
pump();

// for tests and the console
Object.assign(status, {
  M, mapCam, homeView, gfx, renderer: gfx.core?.renderer, scene: gfx.core?.scene, setScheme, setU, U, setMode, setYear, glideTo, startPlay, stopPlay, select, pickAt, building, chunks, layers,
  showCardAt(x, y) { const h = pickAt(x, y); if (h) { setHover(h.gid); showCard(h.gid, x, y); } return h && h.gid; },
  setMask(m) { setMaskAnimated(m); },
});
