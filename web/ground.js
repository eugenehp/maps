// A coarse land surface derived from the buildings themselves (there are no land/water
// polygons yet): a grid marks cells holding building centroids, a morphological closing
// (dilate, then erode, by chamfer distance) turns that into a land mask with a plausible
// coastline, enclosed holes are filled, and each cell's height is the mean ground
// elevation (`base`) of its buildings, spread into empty cells and smoothed.

export class Ground {
  constructor(bounds, { cell, dilate = 450, erode = 300, margin = 1500 } = {}) {
    const w = bounds.max[0] - bounds.min[0] + 2 * margin, h = bounds.max[1] - bounds.min[1] + 2 * margin;
    this.cell = cell ?? Math.max(25, Math.ceil(Math.sqrt(w * h / 1500000)));
    this.x0 = bounds.min[0] - margin; this.z0 = bounds.min[1] - margin;
    this.nx = Math.ceil(w / this.cell); this.nz = Math.ceil(h / this.cell);
    const n = this.nx * this.nz;
    this.cnt = new Uint32Array(n);
    this.sum = new Float64Array(n);
    this.dilate = dilate; this.erode = erode;
    this.version = 0;
  }

  addChunk(ch, sign = 1) {
    const { bbox, base } = ch, C = this.cell;
    for (let b = 0; b < ch.gid.length; b++) {
      const cx = Math.floor(((bbox[4 * b] + bbox[4 * b + 2]) / 2 - this.x0) / C);
      const cz = Math.floor(((bbox[4 * b + 1] + bbox[4 * b + 3]) / 2 - this.z0) / C);
      if (cx < 0 || cz < 0 || cx >= this.nx || cz >= this.nz) continue;
      const i = cz * this.nx + cx;
      this.cnt[i] += sign; this.sum[i] += sign * base[b];
    }
    this.version++;
  }

  /** Chamfer (3-4) distance in cells from cells where `src[i]` is true. */
  _distance(src) {
    const { nx, nz } = this, n = nx * nz, INF = 1e9;
    const d = new Float32Array(n);
    for (let i = 0; i < n; i++) d[i] = src[i] ? 0 : INF;
    for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
      const i = z * nx + x; let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 3);
      if (z > 0) {
        v = Math.min(v, d[i - nx] + 3);
        if (x > 0) v = Math.min(v, d[i - nx - 1] + 4);
        if (x < nx - 1) v = Math.min(v, d[i - nx + 1] + 4);
      }
      d[i] = v;
    }
    for (let z = nz - 1; z >= 0; z--) for (let x = nx - 1; x >= 0; x--) {
      const i = z * nx + x; let v = d[i];
      if (x < nx - 1) v = Math.min(v, d[i + 1] + 3);
      if (z < nz - 1) {
        v = Math.min(v, d[i + nx] + 3);
        if (x < nx - 1) v = Math.min(v, d[i + nx + 1] + 4);
        if (x > 0) v = Math.min(v, d[i + nx - 1] + 4);
      }
      d[i] = v;
    }
    for (let i = 0; i < n; i++) d[i] = d[i] / 3 * this.cell; // metres
    return d;
  }

  /** Build land mesh arrays. relief: use elevations (else flat at y = flatY). */
  build(relief, flatY = -0.05) {
    const { nx, nz, cell: C } = this, n = nx * nz;
    const occ = new Uint8Array(n);
    for (let i = 0; i < n; i++) occ[i] = this.cnt[i] > 0 ? 1 : 0;
    const dOcc = this._distance(occ);
    const dil = new Uint8Array(n);
    for (let i = 0; i < n; i++) dil[i] = dOcc[i] <= this.dilate ? 1 : 0;
    const notDil = new Uint8Array(n);
    for (let i = 0; i < n; i++) notDil[i] = dil[i] ? 0 : 1;
    const dWater = this._distance(notDil);
    const land = new Uint8Array(n);
    for (let i = 0; i < n; i++) land[i] = (dil[i] && dWater[i] > this.erode) || occ[i] ? 1 : 0;
    // fill holes: water not connected to the border becomes land
    const reach = new Uint8Array(n), stack = [];
    const pushIf = i => { if (!land[i] && !reach[i]) { reach[i] = 1; stack.push(i); } };
    for (let x = 0; x < nx; x++) { pushIf(x); pushIf((nz - 1) * nx + x); }
    for (let z = 0; z < nz; z++) { pushIf(z * nx); pushIf(z * nx + nx - 1); }
    while (stack.length) {
      const i = stack.pop(), x = i % nx, z = (i / nx) | 0;
      if (x > 0) pushIf(i - 1); if (x < nx - 1) pushIf(i + 1);
      if (z > 0) pushIf(i - nx); if (z < nz - 1) pushIf(i + nx);
    }
    for (let i = 0; i < n; i++) if (!land[i] && !reach[i]) land[i] = 1;

    // elevation field
    let elev = null;
    if (relief) {
      elev = new Float32Array(n);
      const known = new Uint8Array(n);
      let frontier = [];
      for (let i = 0; i < n; i++) if (this.cnt[i] > 0) { elev[i] = this.sum[i] / this.cnt[i]; known[i] = 1; frontier.push(i); }
      // grow outward ring by ring: each new cell takes the mean of its known neighbours
      while (frontier.length) {
        const next = [];
        const cand = new Set();
        for (const i of frontier) {
          const x = i % nx, z = (i / nx) | 0;
          if (x > 0 && !known[i - 1]) cand.add(i - 1);
          if (x < nx - 1 && !known[i + 1]) cand.add(i + 1);
          if (z > 0 && !known[i - nx]) cand.add(i - nx);
          if (z < nz - 1 && !known[i + nx]) cand.add(i + nx);
        }
        for (const i of cand) {
          const x = i % nx, z = (i / nx) | 0;
          let s = 0, c = 0;
          if (x > 0 && known[i - 1]) { s += elev[i - 1]; c++; }
          if (x < nx - 1 && known[i + 1]) { s += elev[i + 1]; c++; }
          if (z > 0 && known[i - nx]) { s += elev[i - nx]; c++; }
          if (z < nz - 1 && known[i + nx]) { s += elev[i + nx]; c++; }
          elev[i] = c ? s / c : 0;
          next.push(i);
        }
        for (const i of next) known[i] = 1;
        frontier = next;
        if (!next.length) break;
      }
      // two passes of 3x3 smoothing
      for (let pass = 0; pass < Math.max(2, Math.round(150 / C)); pass++) {
        const e2 = new Float32Array(n);
        for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
          let s = 0, c = 0;
          for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx, zz = z + dz;
            if (xx < 0 || zz < 0 || xx >= nx || zz >= nz) continue;
            s += elev[zz * nx + xx]; c++;
          }
          e2[z * nx + x] = s / c;
        }
        elev = e2;
      }
    }
    // Mesh over land cells plus a one-cell fringe. Each corner carries its "landness" (mean of
    // the four cells around it) in uv.x; the fragment shader keeps landness >= 0.5, which turns
    // the stair-stepped cell mask into a smooth interpolated coastline.
    const vid = new Int32Array((nx + 1) * (nz + 1)).fill(-1);
    const pos = [], uv = [], idx = [], nrm = [];
    // corner heights (mean of the four cells around) and smooth normals from them
    const NX = nx + 1, NZ = nz + 1;
    let ch = null;
    if (elev) {
      ch = new Float32Array(NX * NZ);
      for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) {
        let s = 0, c = 0;
        for (const [xx, zz] of [[x - 1, z - 1], [x, z - 1], [x - 1, z], [x, z]]) {
          if (xx < 0 || zz < 0 || xx >= nx || zz >= nz) continue;
          s += elev[zz * nx + xx]; c++;
        }
        ch[z * NX + x] = Math.max(0.3, (c ? s / c : 0) - 0.5);
      }
    }
    const cellLand = (xx, zz) => (xx < 0 || zz < 0 || xx >= nx || zz >= nz) ? 0 : land[zz * nx + xx];
    const landness = (x, z) => (cellLand(x - 1, z - 1) + cellLand(x, z - 1) + cellLand(x - 1, z) + cellLand(x, z)) / 4;
    const corner = (x, z) => {
      const k = z * (nx + 1) + x;
      if (vid[k] >= 0) return vid[k];
      let y = flatY, n = [0, 1, 0];
      if (ch) {
        y = ch[z * NX + x];
        const hx = ch[z * NX + Math.min(NX - 1, x + 1)] - ch[z * NX + Math.max(0, x - 1)];
        const hz = ch[Math.min(NZ - 1, z + 1) * NX + x] - ch[Math.max(0, z - 1) * NX + x];
        const l = Math.hypot(hx, 2 * C, hz);
        n = [-hx / l, 2 * C / l, -hz / l];
      }
      vid[k] = pos.length / 3;
      pos.push(this.x0 + x * C, y, this.z0 + z * C);
      nrm.push(n[0], n[1], n[2]);
      uv.push(landness(x, z), 0);
      return vid[k];
    };
    for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
      let near = 0;
      for (let dz = -1; dz <= 1 && !near; dz++) for (let dx = -1; dx <= 1; dx++) if (cellLand(x + dx, z + dz)) { near = 1; break; }
      if (!near) continue;
      const a = corner(x, z), b = corner(x + 1, z), c = corner(x + 1, z + 1), d = corner(x, z + 1);
      // split along the diagonal that agrees with the mask, so lone corners stay rounded
      if (uv[2 * a] + uv[2 * c] >= uv[2 * b] + uv[2 * d]) idx.push(a, d, c, a, c, b);
      else idx.push(a, d, b, b, d, c);
    }
    return { pos: new Float32Array(pos), uv: new Float32Array(uv), nrm: new Float32Array(nrm), idx: new Uint32Array(idx), land, elev };
  }
}
