// The ground, off the page: holds the terrain grid, fetches and decodes its tiles, meshes a tile
// at the detail the page asks for, and drapes the land / water / park polygons on it. Meshes go
// straight to the render worker when there is a port to it (gfx.js worker mode), else back to the
// page. The page keeps only the tile list and which tiles are in (for its level-of-detail choice).
//
//   { op: 'init', meta?, dir, version, gz }      meta: terrain.json, or none (polygons only)
//   { op: 'fetch', order }                        -> { op: 'tile', k } per tile, then { op: 'all' }
//   { op: 'mesh', k, step, id }                   -> { op: 'mesh', id, k, step, empty, spec? }
//   { op: 'polys', jobs: [{ name, url, minY, sub, mat, id }] } -> { op: 'polys', found, ms, specs? }
//   { op: 'port', port }

import { Terrain, drape, subdivide, loadPolys } from './terrain.js';
import { setDataVersion } from './dataurl.js';

let T = null, port = null, gz = false;
const PART_VERTS = 100000;

const buffersOf = spec => (spec.parts || [spec]).flatMap(q => [q.pos.buffer, q.nrm.buffer, q.idx.buffer]);
/** Hand a finished mesh to the renderer: straight to the render worker, or back to the page. */
function send(id, spec, reply) {
  if (port) { port.postMessage({ op: 'addMesh', args: [id, spec] }, buffersOf(spec)); postMessage(reply); }
  else postMessage({ ...reply, spec }, buffersOf(spec));
}

self.onmessage = async ({ data: d }) => {
  if (d.op === 'port') { port = d.port; return; }
  if (d.op === 'init') {
    setDataVersion(d.version); gz = d.gz;
    if (d.meta) {
      T = new Terrain(d.meta, new Uint16Array(d.meta.nx * d.meta.nz).fill(d.meta.nodata));
      T.dir = d.dir; T.gz = gz;
      T.onTile = k => postMessage({ op: 'tile', k });
    }
    return;
  }
  if (d.op === 'fetch') { await T.fetchTiles(d.order); postMessage({ op: 'all' }); return; }
  if (d.op === 'mesh') {
    const m = T.tileMesh(T.meta.tiles[d.k], d.step);
    if (!m.idx.length) { postMessage({ op: 'mesh', id: d.id, k: d.k, step: d.step, empty: true }); return; }
    send(d.id, { mat: 'terrain', pos: m.pos, nrm: m.nrm, idx: m.idx, position: [m.origin[0], 0, m.origin[1]] },
      { op: 'mesh', id: d.id, k: d.k, step: d.step });
    return;
  }
  if (d.op === 'polys') {
    const t0 = performance.now(), found = {};
    for (const j of d.jobs) {
      let poly = null;
      try { poly = await loadPolys(j.url, gz); } catch { }
      found[j.name] = !!poly;
      if (!poly?.idx.length || (j.name === 'land' && T)) continue;   // land only where there is no DEM
      const p = j.sub && T ? subdivide(poly.xz, poly.idx, T.cell * 4) : poly;
      const m = drape(p, T, 0, j.minY);
      send(j.id, { mat: j.mat, parts: splitIndexed(m.pos, m.nrm, m.idx) }, { op: 'part', id: j.id });
    }
    postMessage({ op: 'polys', found, ms: performance.now() - t0 });
  }
};

/**
 * An indexed mesh in pieces of at most PART_VERTS vertices (triangles in order, each piece with
 * the vertices it uses): the renderer adds pieces a few a frame (render-core.js).
 */
function splitIndexed(pos, nrm, idx) {
  const parts = [], map = new Int32Array(pos.length / 3).fill(-1);
  let tri = 0;
  while (tri * 3 < idx.length) {
    const used = [], out = [];
    for (; tri * 3 < idx.length; tri++) {
      let fresh = 0;
      for (let c = 0; c < 3; c++) if (map[idx[tri * 3 + c]] < 0) fresh++;
      if (used.length + fresh > PART_VERTS && out.length) break;
      for (let c = 0; c < 3; c++) {
        const v = idx[tri * 3 + c];
        if (map[v] < 0) { map[v] = used.length; used.push(v); }
        out.push(map[v]);
      }
    }
    const P = new Float32Array(used.length * 3), N = new Float32Array(used.length * 3);
    used.forEach((v, i) => { P.set(pos.subarray(v * 3, v * 3 + 3), i * 3); N.set(nrm.subarray(v * 3, v * 3 + 3), i * 3); map[v] = -1; });
    parts.push({ pos: P, nrm: N, idx: Uint32Array.from(out) });
  }
  return parts;
}
