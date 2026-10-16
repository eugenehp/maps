// CPU picking: a uniform 2D grid over building footprint bounding boxes, and a ray march
// through it (Amanatides–Woo DDA in xz) that tests the extruded footprints exactly
// (roof polygon + wall segments) and returns the nearest visible hit.
//
// A chunk is the pick data of one loaded pack (see worker.js `pick`), plus `id`.

export class PickIndex {
  constructor({ cell = 40, count = 0 } = {}) {
    this.cell = cell;
    this.chunks = new Map();         // id -> chunk (with its own grid: gridKeys/gridStart/gridRefs, worker.js)
    this.stamp = new Uint32Array(Math.max(1, count));
    this.stampN = 0;
    this.maxTop = 0;
    this.minBase = 0;
    this.maxBase = 0;
  }

  _key(cx, cz) { return (cx + 32768) * 65536 + (cz + 32768); }

  // Each chunk brings its pick grid (built in the parse worker), so adding one is O(buildings) for
  // the height range only, and removing it is a Map delete.
  add(chunk) {
    this.chunks.set(chunk.id, chunk);
    const n = chunk.gid.length;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let b = 0; b < n; b++) {
      const top = chunk.top[b], base = chunk.base[b];
      if (top + Math.max(0, base) > this.maxTop) this.maxTop = top + Math.max(0, base);
      if (base < this.minBase) this.minBase = base;
      if (base > this.maxBase) this.maxBase = base;
      const bb = chunk.bbox;
      if (bb[4 * b] < x0) x0 = bb[4 * b]; if (bb[4 * b + 1] < z0) z0 = bb[4 * b + 1];
      if (bb[4 * b + 2] > x1) x1 = bb[4 * b + 2]; if (bb[4 * b + 3] > z1) z1 = bb[4 * b + 3];
    }
    chunk.extent = [x0, z0, x1, z1];
  }

  remove(id) { this.chunks.delete(id); }

  /** Building indices of `chunk` in cell key k (a subarray of its CSR list), or null. */
  _cell(ch, k) {
    const K = ch.gridKeys;
    let lo = 0, hi = K.length - 1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (K[m] < k) lo = m + 1; else if (K[m] > k) hi = m - 1;
      else return ch.gridRefs.subarray(ch.gridStart[m], ch.gridStart[m + 1]);
    }
    return null;
  }

  /**
   * Nearest building hit by the ray, or null.
   * visible(gid) -> bool; relief: 0 flat, 1 buildings stand on `base`.
   * Returns { gid, chunk, b, t, point }.
   */
  pick(origin, dir, visible, relief = 0) {
    const o = origin, d = dir;
    const C = this.cell;
    const yTop = this.maxTop + 1;
    const yBot = relief ? this.minBase - 16 : -1;
    // the slab of y where buildings can be
    let t0 = 0, t1 = 1e6;
    if (Math.abs(d.y) > 1e-9) {
      const ta = (yTop - o.y) / d.y, tb = (yBot - o.y) / d.y;
      t0 = Math.max(0, Math.min(ta, tb)); t1 = Math.max(ta, tb);
    } else if (o.y > yTop || o.y < yBot) return null;
    if (t1 <= t0) return null;
    const horiz = Math.hypot(d.x, d.z);
    if (horiz < 1e-9) t1 = t0 + 1; // looking straight down: one cell
    // never march more than ~3000 cells
    t1 = Math.min(t1, t0 + (3000 * C) / Math.max(horiz, 1e-3));

    this.stampN = (this.stampN + 1) >>> 0;
    if (this.stampN === 0) { this.stamp.fill(0); this.stampN = 1; }
    const stamp = this.stamp, sn = this.stampN;

    let px = o.x + d.x * t0, pz = o.z + d.z * t0;
    let cx = Math.floor(px / C), cz = Math.floor(pz / C);
    const sx = d.x > 0 ? 1 : -1, sz = d.z > 0 ? 1 : -1;
    const tdx = Math.abs(d.x) > 1e-12 ? C / Math.abs(d.x) : Infinity;
    const tdz = Math.abs(d.z) > 1e-12 ? C / Math.abs(d.z) : Infinity;
    let tmx = Math.abs(d.x) > 1e-12 ? t0 + ((cx + (sx > 0 ? 1 : 0)) * C - px) / d.x : Infinity;
    let tmz = Math.abs(d.z) > 1e-12 ? t0 + ((cz + (sz > 0 ? 1 : 0)) * C - pz) / d.z : Infinity;

    // the chunks the ray's ground track can cross at all
    const ex = o.x + d.x * t1, ez = o.z + d.z * t1;
    const rx0 = Math.min(px, ex) - C, rx1 = Math.max(px, ex) + C, rz0 = Math.min(pz, ez) - C, rz1 = Math.max(pz, ez) + C;
    const cand = [];
    for (const ch of this.chunks.values()) {
      const e = ch.extent;
      if (ch.gridKeys && e && e[0] <= rx1 && e[2] >= rx0 && e[1] <= rz1 && e[3] >= rz0) cand.push(ch);
    }
    let best = null, bestT = Infinity;
    for (let guard = 0; guard < 4000; guard++) {
      const k = this._key(cx, cz), x = (cx + 0.5) * C, z = (cz + 0.5) * C;
      for (const ch of cand) {
        const e = ch.extent;
        if (x < e[0] - C || x > e[2] + C || z < e[1] - C || z > e[3] + C) continue;
        const a = this._cell(ch, k);
        if (!a) continue;
        for (let i = 0; i < a.length; i++) {
          const b = a[i];
          const gid = ch.gid[b];
          if (gid < stamp.length) { if (stamp[gid] === sn) continue; stamp[gid] = sn; }
          if (!visible(gid)) continue;
          const t = hitBuilding(ch, b, o, d, relief, bestT);
          if (t < bestT) { bestT = t; best = { gid, chunk: ch, b, t }; }
        }
      }
      const exit = Math.min(tmx, tmz);
      if (bestT <= exit || exit > t1) break;
      if (tmx < tmz) { cx += sx; tmx += tdx; } else { cz += sz; tmz += tdz; }
    }
    if (best) best.point = { x: o.x + d.x * bestT, y: o.y + d.y * bestT, z: o.z + d.z * bestT };
    return best;
  }
}

/** Ray parameter of the nearest hit with building b of chunk ch, or Infinity. */
function hitBuilding(ch, b, o, d, relief, tMax) {
  let best = tMax;
  const { partStart, partH, partB, ringStart, vertStart, xz } = ch;
  for (let p = partStart[b]; p < partStart[b + 1]; p++) {
    const y0 = relief ? partB[p] - 15 : 0;
    const y1 = (relief ? partB[p] : 0) + partH[p];
    // roof
    if (d.y < -1e-9 && o.y > y1) {
      const t = (y1 - o.y) / d.y;
      if (t < best && insidePart(ch, p, o.x + d.x * t, o.z + d.z * t)) best = t;
    }
    // walls
    for (let r = ringStart[p]; r < ringStart[p + 1]; r++) {
      const s = vertStart[r], e = vertStart[r + 1];
      for (let i = s; i < e; i++) {
        const j = i + 1 < e ? i + 1 : s;
        const ax = xz[2 * i], az = xz[2 * i + 1];
        const ex = xz[2 * j] - ax, ez = xz[2 * j + 1] - az;
        const den = d.x * ez - d.z * ex;
        if (Math.abs(den) < 1e-12) continue;
        const qx = ax - o.x, qz = az - o.z;
        const t = (qx * ez - qz * ex) / den;
        if (t <= 0 || t >= best) continue;
        const u = (qx * d.z - qz * d.x) / den;
        if (u < 0 || u > 1) continue;
        const y = o.y + d.y * t;
        if (y >= y0 && y <= y1) best = t;
      }
    }
  }
  return best;
}

/** Even-odd point in polygon over all rings of part p. */
function insidePart(ch, p, x, z) {
  const { ringStart, vertStart, xz } = ch;
  let inside = false;
  for (let r = ringStart[p]; r < ringStart[p + 1]; r++) {
    const s = vertStart[r], e = vertStart[r + 1];
    for (let i = s, j = e - 1; i < e; j = i++) {
      const xi = xz[2 * i], zi = xz[2 * i + 1], xj = xz[2 * j], zj = xz[2 * j + 1];
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
    }
  }
  return inside;
}
