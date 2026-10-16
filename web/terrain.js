// Real ground from the pipeline (data/<city>/terrain.json + terrain/*.bin, land/water/parks.bin;
// see pipeline FORMAT.md "Ground"): a DEM drawn as per-tile meshes whose resolution follows
// the camera, with skirts hiding the cracks between tiles of different detail, plus the water
// and park polygons draped onto it (in ground-worker.js, off the main thread).
import { dataUrl, fetchBin } from './dataurl.js';

/**
 * The terrain's metadata and an empty grid; `terrain.fetchTiles(order)` then fills it tile by
 * tile, `order` first (tile indices, e.g. what the camera sees), a few requests at a time so
 * the terrain never starves the building packs of bandwidth.
 */
export async function loadTerrain(dir, { grid = true } = {}) {
  const r = await fetch(dataUrl(dir + 'terrain.json'));
  if (!r.ok) return null;
  const meta = await r.json();
  // the page keeps only the tile list (the grid lives in terrain-worker.js): grid = false
  const t = new Terrain(meta, grid ? new Uint16Array(meta.nx * meta.nz).fill(meta.nodata) : null);
  t.dir = dir;
  return t;
}

function decodeTile(meta, t, buf) {
  if (meta.encoding !== 'delta-shuffle') return new Uint16Array(buf);
  // low bytes, then high bytes, of each row's differences from the cell to its west
  const b = new Uint8Array(buf), n = b.length >> 1;
  const v = new Uint16Array(n);
  for (let j = 0; j < t.nz; j++) {
    let prev = 0;
    for (let i = 0, k = j * t.nx; i < t.nx; i++, k++) { prev = (prev + (b[k] | (b[n + k] << 8))) & 0xffff; v[k] = prev; }
  }
  return v;
}

export class Terrain {
  constructor(meta, grid) {
    Object.assign(this, { meta, grid });
    this.nx = meta.nx; this.nz = meta.nz; this.cell = meta.cell;
    this.x0 = meta.x0; this.z0 = meta.z0;
    this.offset = meta.offset; this.scale = meta.scale; this.nodata = meta.nodata;
    this.loaded = new Uint8Array(meta.tiles.length);
    this.onTile = null;   // (tile index) => void, as each tile lands in the grid
  }
  /** Fetch every tile, the indices in `first` before the rest; resolves when all are in. */
  fetchTiles(first = [], parallel = 6) {
    if (this._all) return this._all;
    const seen = new Set(first), queue = [...first];
    this.meta.tiles.forEach((_, k) => { if (!seen.has(k)) queue.push(k); });
    const one = async k => {
      const t = this.meta.tiles[k];
      try {
        const v = decodeTile(this.meta, t, await fetchBin(dataUrl(this.dir + t.file), this.gz));
        for (let j = 0; j < t.nz; j++) {
          const gj = t.j0 + j;
          if (gj >= this.nz) break;
          const row = v.subarray(j * t.nx, (j + 1) * t.nx);
          const n = Math.min(t.nx, this.nx - t.i0);
          this.grid.set(n === t.nx ? row : row.subarray(0, n), gj * this.nx + t.i0);
        }
        this.loaded[k] = 1;
        this.onTile?.(k);
      } catch { /* a missing tile stays nodata */ }
    };
    const lane = async () => { while (queue.length) await one(queue.shift()); };
    this._all = Promise.all(Array.from({ length: parallel }, lane)).then(() => this);
    return this._all;
  }
  /** Ground box [minX, minZ, maxX, maxZ] of tile `k`. */
  tileBox(k) {
    const t = this.meta.tiles[k], C = this.cell;
    const x0 = this.x0 + t.i0 * C, z0 = this.z0 + t.j0 * C;
    return [x0, z0, x0 + (t.nx - 1) * C, z0 + (t.nz - 1) * C];
  }
  /** Height at grid cell (i, j), or NaN for no data. Bathymetry is clamped a little below 0. */
  at(i, j) {
    if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return NaN;
    const v = this.grid[j * this.nx + i];
    if (v === this.nodata) return NaN;
    return Math.max(-6, this.offset + v * this.scale);
  }
  /** Bilinear height at world (x, z); NaN outside the data. */
  sample(x, z) {
    const fx = (x - this.x0) / this.cell, fz = (z - this.z0) / this.cell;
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const a = this.at(i, j), b = this.at(i + 1, j), c = this.at(i, j + 1), d = this.at(i + 1, j + 1);
    if ([a, b, c, d].some(Number.isNaN)) {
      const ok = [a, b, c, d].filter(h => !Number.isNaN(h));
      return ok.length ? ok.reduce((s, h) => s + h, 0) / ok.length : NaN;
    }
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }

  /**
   * Mesh for terrain tile `t` (from meta.tiles) at grid step `step` (1, 2, 4, ...).
   * Positions are relative to the tile origin (returned), normals smooth, plus a skirt.
   */
  tileMesh(t, step) {
    const { cell } = this;
    const ox = this.x0 + t.i0 * cell, oz = this.z0 + t.j0 * cell;
    const ci = Math.ceil((t.nx - 1) / step) + 1, cj = Math.ceil((t.nz - 1) / step) + 1;
    const H = new Float32Array(ci * cj);
    for (let b = 0; b < cj; b++) for (let a = 0; a < ci; a++) {
      const i = t.i0 + Math.min(a * step, t.nx - 1), j = t.j0 + Math.min(b * step, t.nz - 1);
      H[b * ci + a] = this.at(i, j);
    }
    const pos = [], nrm = [], idx = [];
    const vid = new Int32Array(ci * cj).fill(-1);
    const hAt = (a, b) => H[Math.max(0, Math.min(cj - 1, b)) * ci + Math.max(0, Math.min(ci - 1, a))];
    const lx = a => Math.min(a * step, t.nx - 1) * cell, lz = b => Math.min(b * step, t.nz - 1) * cell;
    const vert = (a, b) => {
      const k = b * ci + a;
      if (vid[k] >= 0) return vid[k];
      const h = H[k];
      let hx = hAt(a + 1, b) - hAt(a - 1, b), hz = hAt(a, b + 1) - hAt(a, b - 1);
      if (Number.isNaN(hx)) hx = 0; if (Number.isNaN(hz)) hz = 0;
      const s = 2 * step * cell, l = Math.hypot(hx, s, hz);
      vid[k] = pos.length / 3;
      pos.push(lx(a), h, lz(b));
      nrm.push(-hx / l, s / l, -hz / l);
      return vid[k];
    };
    for (let b = 0; b < cj - 1; b++) for (let a = 0; a < ci - 1; a++) {
      const h00 = H[b * ci + a], h10 = H[b * ci + a + 1], h01 = H[(b + 1) * ci + a], h11 = H[(b + 1) * ci + a + 1];
      if (Number.isNaN(h00) || Number.isNaN(h10) || Number.isNaN(h01) || Number.isNaN(h11)) continue;
      const v00 = vert(a, b), v10 = vert(a + 1, b), v01 = vert(a, b + 1), v11 = vert(a + 1, b + 1);
      idx.push(v00, v01, v11, v00, v11, v10);
    }
    // skirts round the tile edge, 25 m down, so neighbours at another level of detail show no gap
    const skirt = (a0, b0, a1, b1) => {
      const n = Math.max(Math.abs(a1 - a0), Math.abs(b1 - b0));
      for (let s = 0; s < n; s++) {
        const a = a0 + Math.sign(a1 - a0) * s, b = b0 + Math.sign(b1 - b0) * s;
        const a2 = a0 + Math.sign(a1 - a0) * (s + 1), b2 = b0 + Math.sign(b1 - b0) * (s + 1);
        if (Number.isNaN(H[b * ci + a]) || Number.isNaN(H[b2 * ci + a2])) continue;
        const p = vert(a, b), q = vert(a2, b2);
        const base = pos.length / 3;
        pos.push(pos[p * 3], pos[p * 3 + 1] - 25, pos[p * 3 + 2], pos[q * 3], pos[q * 3 + 1] - 25, pos[q * 3 + 2]);
        nrm.push(nrm[p * 3], nrm[p * 3 + 1], nrm[p * 3 + 2], nrm[q * 3], nrm[q * 3 + 1], nrm[q * 3 + 2]);
        idx.push(p, q, base + 1, p, base + 1, base);
      }
    };
    skirt(0, 0, ci - 1, 0); skirt(ci - 1, 0, ci - 1, cj - 1); skirt(ci - 1, cj - 1, 0, cj - 1); skirt(0, cj - 1, 0, 0);
    return { origin: [ox, oz], pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint32Array(idx) };
  }
}

/**
 * Split triangles until no edge is longer than L, sharing midpoints, so a draped polygon
 * follows the terrain instead of cutting through hills.
 */
export function subdivide(xz, idx, L) {
  const P = Array.from(xz), out = [], mid = new Map();
  const midpoint = (a, b) => {
    const k = a < b ? a * 4194304 + b : b * 4194304 + a;
    let m = mid.get(k);
    if (m === undefined) { m = P.length / 2; P.push((P[2 * a] + P[2 * b]) / 2, (P[2 * a + 1] + P[2 * b + 1]) / 2); mid.set(k, m); }
    return m;
  };
  const len2 = (a, b) => (P[2 * a] - P[2 * b]) ** 2 + (P[2 * a + 1] - P[2 * b + 1]) ** 2;
  const stack = [];
  for (let i = 0; i < idx.length; i += 3) stack.push([idx[i], idx[i + 1], idx[i + 2], 0]);
  while (stack.length) {
    const [a, b, c, depth] = stack.pop();
    if (depth >= 10 || Math.max(len2(a, b), len2(b, c), len2(c, a)) <= L * L) { out.push(a, b, c); continue; }
    const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
    stack.push([a, ab, ca, depth + 1], [ab, b, bc, depth + 1], [ca, bc, c, depth + 1], [ab, bc, ca, depth + 1]);
  }
  return { xz: new Float32Array(P), idx: new Uint32Array(out) };
}

/** Parse an 'SFL1' polygon mesh (land/water/parks.bin). */
export async function loadPolys(url, gz) {
  const buf = await fetchBin(url, gz);
  const h = new DataView(buf);
  if (h.getUint32(0, true) !== 0x314c4653) return null;
  const nV = h.getUint32(4, true), nI = h.getUint32(8, true);
  return { xz: new Float32Array(buf, 12, nV * 2), idx: new Uint32Array(buf, 12 + nV * 8, nI) };
}

/**
 * Drape a polygon mesh on the terrain: vertex y = terrain height (or `flatY`). Big triangles
 * stay flat between vertices — right for water, which is flat — and a polygon is lifted by
 * the shader (see GROUND_VERTEX) so it wins against the surface beneath it.
 */
export function drape(poly, terrain, flatY = 0, minY = -Infinity) {
  const n = poly.xz.length / 2;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3);
  const e = terrain ? terrain.cell : 1;
  for (let k = 0; k < n; k++) {
    const x = poly.xz[2 * k], z = poly.xz[2 * k + 1];
    let y = terrain ? terrain.sample(x, z) : flatY;
    if (Number.isNaN(y)) y = flatY;
    pos[3 * k] = x; pos[3 * k + 1] = Math.max(minY, y); pos[3 * k + 2] = z;
    let hx = 0, hz = 0;
    if (terrain) {
      hx = terrain.sample(x + e, z) - terrain.sample(x - e, z);
      hz = terrain.sample(x, z + e) - terrain.sample(x, z - e);
      if (!Number.isFinite(hx)) hx = 0; if (!Number.isFinite(hz)) hz = 0;
    }
    const l = Math.hypot(hx, 2 * e, hz);
    nrm[3 * k] = -hx / l; nrm[3 * k + 1] = 2 * e / l; nrm[3 * k + 2] = -hz / l;
  }
  return { pos, nrm, idx: poly.idx };
}
