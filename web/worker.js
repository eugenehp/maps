import { Earcut } from './threers/deps/Earcut.js';
import { fetchBin, gunzip } from './dataurl.js';

// Turns one pack of binary building tiles (SFT2-SFT6, see data/<city>/FORMAT.md) into
// one extruded mesh plus the footprints the main thread needs for picking.
//
// Geometry: every ring vertex becomes two vertices, one on the ground (y = 0) and one at the
// part's roof (y = height). Walls are quads between consecutive pairs, roofs are earcut
// triangles over the top vertices. Vertices are shared between walls and
// roof, so no per-face normals are stored: the fragment shader derives the face normal from
// screen-space derivatives. That keeps SF (~2 M ring vertices) at ~4 M vertices instead of
// ~10 M with flat-shaded duplicates, which matters because threers interleaves 64 bytes per
// vertex on the GPU.
//
// uv.x = global building id (index into the shared storage buffer), uv.y = ground elevation
// of the part (base, SFT3; 0 for SFT2), so the shader can optionally lift buildings onto
// the terrain.
//
// SFT6 parts may float (walls from minHeight, with an underside) and have a shaped roof: the
// walls stop at height - roofHeight and the roof is rings of the outer ring shrunk toward its
// centre, closed by an apex: a dome (quarter circle), an onion (bulging), a pyramid (straight).

const MAGIC_SFT2 = 0x32544653, MAGIC_SFT3 = 0x33544653, MAGIC_SFT4 = 0x34544653, MAGIC_SFT5 = 0x35544653;
const MAGIC_SFT6 = 0x36544653;
const ROOF_FLAT = 0, ROOF_DOME = 1, ROOF_ONION = 2, ROOF_PYRAMID = 3;
const ROOF_RINGS = 10;   // rings of a curved roof between the eave and the apex

// (inset, rise) of curved-roof ring k of n, both 0..1: inset 1 = the eave ring, 0 = the apex
function roofProfile(shape, k, n) {
  const t = k / n;
  if (shape === ROOF_PYRAMID) return [1 - t, t];
  const a = t * Math.PI / 2;
  if (shape === ROOF_ONION) return [Math.cos(a) * (1 + 0.45 * Math.sin(2 * a) ** 1.5), Math.sin(a) ** 1.6];
  return [Math.cos(a), Math.sin(a)];
}

// SFT5: counts instead of offsets, decimetre heights, varint-delta vertices, no gids/holes/
// triangles; outlines already simplified by the pipeline. Decoded into the SFT4 arrays.
// SFT6 adds a sparse list of floating / shaped-roof parts after the vertices.
function parseSft5(buf, byteOffset, v6) {
  const h = new DataView(buf, byteOffset);
  const nB = h.getUint32(4, true), nP = h.getUint32(8, true), nR = h.getUint32(12, true);
  const nV = h.getUint32(16, true), gid0 = h.getUint32(20, true);
  const t = { nB, nP, nR, nV, nTI: 0, ox: h.getFloat32(24, true), oz: h.getFloat32(28, true), simplified: true };
  const u8 = new Uint8Array(buf, byteOffset);
  let o = 32;
  const pad = n => { o += (n + 3) & ~3; };
  const i16 = n => { const a = new Int16Array(n); for (let i = 0; i < n; i++) a[i] = h.getInt16(o + 2 * i, true); pad(2 * n); return a; };
  const u16 = n => { const a = new Uint16Array(n); for (let i = 0; i < n; i++) a[i] = h.getUint16(o + 2 * i, true); pad(2 * n); return a; };
  const bytes = n => { const a = u8.slice(o, o + n); pad(n); return a; };
  const starts = c => { const s = new Uint32Array(c.length + 1); for (let i = 0; i < c.length; i++) s[i + 1] = s[i] + c[i]; return s; };
  t.gid = new Uint32Array(nB); for (let i = 0; i < nB; i++) t.gid[i] = gid0 + i;
  t.year = i16(nB);
  t.flags = bytes(nB); t.period = bytes(nB); t.floors = bytes(nB); t.use = bytes(nB);
  t.yearSrc = bytes(nB); t.heightSrc = bytes(nB);
  t.partStart = starts(u16(nB));
  t.height = Float32Array.from(u16(nP), v => v / 10);
  t.base = Float32Array.from(i16(nP), v => v / 10);
  t.ringStart = starts(u16(nP));
  t.vertStart = starts(u16(nR));
  t.hole = new Uint8Array(nR);
  for (let p = 0; p < nP; p++) for (let r = t.ringStart[p] + 1; r < t.ringStart[p + 1]; r++) t.hole[r] = 1;
  const len = h.getUint32(o, true); o += 4;
  const xz = t.xz = new Int16Array(2 * nV);
  let k = o, end = o + len, w = 0;
  const next = () => {
    let v = 0, shift = 0, c;
    do { c = u8[k++]; v |= (c & 0x7f) << shift; shift += 7; } while (c & 0x80);
    v >>>= 0;
    return (v >>> 1) ^ -(v & 1);
  };
  for (let r = 0; r < nR; r++) {
    let x = 0, z = 0;
    for (let v = t.vertStart[r]; v < t.vertStart[r + 1]; v++) { x += next(); z += next(); xz[w++] = x; xz[w++] = z; }
  }
  if (k > end) throw new Error('SFT5 vertex stream overrun');
  if (v6) {
    o = (end + 3) & ~3;
    const n = h.getUint32(o, true); o += 4;
    const part = new Uint32Array(n);
    for (let i = 0; i < n; i++) part[i] = h.getUint32(o + 4 * i, true);
    o += 4 * n;
    const mins = u16(n), roofs = u16(n), shapes = bytes(n);
    if (n) {
      t.minHeight = new Float32Array(nP); t.roofHeight = new Float32Array(nP); t.roofShape = new Uint8Array(nP);
      for (let i = 0; i < n; i++) {
        const p = part[i];
        if (p >= nP) throw new Error('SFT6 part out of range');
        t.minHeight[p] = mins[i] / 10; t.roofHeight[p] = roofs[i] / 10; t.roofShape[p] = shapes[i];
      }
    }
    // buildings no longer standing: the year each came down
    const nd = h.getUint32(o, true); o += 4;
    if (nd) {
      const bs = new Uint32Array(nd);
      for (let i = 0; i < nd; i++) bs[i] = h.getUint32(o + 4 * i, true);
      o += 4 * nd;
      const ys = i16(nd);
      t.demolished = new Int16Array(nB);
      for (let i = 0; i < nd; i++) { if (bs[i] >= nB) throw new Error('SFT6 building out of range'); t.demolished[bs[i]] = ys[i]; }
    }
  }
  return t;
}

function parseTile(buf, byteOffset) {
  const h = new DataView(buf, byteOffset, 32);
  const magic = h.getUint32(0, true);
  if (magic === MAGIC_SFT5 || magic === MAGIC_SFT6) return parseSft5(buf, byteOffset, magic === MAGIC_SFT6);
  if (magic !== MAGIC_SFT2 && magic !== MAGIC_SFT3 && magic !== MAGIC_SFT4) {
    throw new Error(`bad tile magic 0x${magic.toString(16)} at ${byteOffset}`);
  }
  const v3 = magic !== MAGIC_SFT2;   // SFT3+: per-part base
  const v4 = magic === MAGIC_SFT4;   // SFT4: per-building yearSrc, heightSrc after tri
  const nB = h.getUint32(4, true), nP = h.getUint32(8, true), nR = h.getUint32(12, true);
  const nV = h.getUint32(16, true), nTI = h.getUint32(20, true);
  const ox = h.getFloat32(24, true), oz = h.getFloat32(28, true);
  let o = byteOffset + 32;
  // Typed-array views need aligned offsets; every array is padded to 4 bytes, and packs keep
  // tiles 4-aligned, but copy defensively if a pack ever is not.
  const take = (Type, n) => {
    const bytes = n * Type.BYTES_PER_ELEMENT;
    const a = (o % Type.BYTES_PER_ELEMENT === 0)
      ? new Type(buf, o, n)
      : new Type(buf.slice(o, o + bytes));
    o += Math.ceil(bytes / 4) * 4;
    return a;
  };
  const t = { nB, nP, nR, nV, nTI, ox, oz };
  t.gid = take(Uint32Array, nB);
  t.year = take(Int16Array, nB);
  t.flags = take(Uint8Array, nB);
  t.period = take(Uint8Array, nB);
  t.floors = take(Uint8Array, nB);
  t.use = take(Uint8Array, nB);
  t.partStart = take(Uint32Array, nB + 1);
  t.height = take(Float32Array, nP);
  t.base = v3 ? take(Float32Array, nP) : null;
  t.ringStart = take(Uint32Array, nP + 1);
  t.vertStart = take(Uint32Array, nR + 1);
  t.hole = take(Uint8Array, nR);
  t.xz = take(Int16Array, 2 * nV);
  t.triStart = take(Uint32Array, nP + 1);
  t.tri = take(Uint16Array, nTI);
  t.yearSrc = v4 ? take(Uint8Array, nB) : null;
  t.heightSrc = v4 ? take(Uint8Array, nB) : null;
  return t;
}

// Douglas–Peucker on a closed ring of [x, z] points (metres). Footprints traced from LiDAR
// rasters carry 0.5 m stair-steps; extruded 100 m up they turn into shimmering stripes and
// dots on facades. Removing detail below `eps` fixes that and drops ~1/4 of the vertices.
function simplifyRing(pts, eps, maxEps = 2.0) {
  const n = pts.length;
  if (n <= 4) return pts;
  // big footprints get a coarser tolerance: a tower traced at 1 m has 1 m steps
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
  eps = Math.min(maxEps, Math.max(eps, Math.hypot(x1 - x0, z1 - z0) * 0.03));
  // split the ring at vertex 0 and the vertex farthest from it
  let far = 0, fd = -1;
  for (let i = 1; i < n; i++) {
    const d = (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2;
    if (d > fd) { fd = d; far = i; }
  }
  const keep = new Uint8Array(n);
  keep[0] = keep[far] = 1;
  const e2 = eps * eps;
  const stack = [[0, far], [far, n]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const pa = pts[a], pb = pts[b % n];
    const dx = pb[0] - pa[0], dz = pb[1] - pa[1], L2 = dx * dx + dz * dz;
    let best = -1, bd = e2;
    for (let i = a + 1; i < b; i++) {
      const qx = pts[i][0] - pa[0], qz = pts[i][1] - pa[1];
      let d;
      if (L2 < 1e-12) d = qx * qx + qz * qz;
      else { const c = qx * dz - qz * dx; d = c * c / L2; }
      if (d > bd) { bd = d; best = i; }
    }
    if (best >= 0) { keep[best] = 1; stack.push([a, best], [best, b]); }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i]);
  return out.length >= 3 ? out : pts;
}

const SIMPLIFY = 0.35; // metres

function buildPack(buf, tiles, packOrigin, lod = 0) {
  const parsed = tiles.map(tl => parseTile(buf, tl.offset));
  // Keep walls at every level. A roof-only mesh exposes bad long diagonals in a small number of
  // complex source footprints; at an oblique overview they appear as giant floating triangles.
  // The far level instead saves detail with simplified footprints and two-segment curved roofs.
  const flatLod = false;
  const roofRings = lod === 0 ? ROOF_RINGS : lod === 1 ? 4 : 2;
  let nB = 0, nP = 0, nR = 0, nV = 0;
  // shaped roofs add ROOF_RINGS - 1 rings and an apex over the outer ring; floating parts an underside
  let roofV = 0, roofI = 0, underI = 0;
  for (const t of parsed) {
    nB += t.nB; nP += t.nP; nR += t.nR; nV += t.nV;
    if (!t.roofShape) continue;
    for (let p = 0; p < t.nP; p++) {
      const r0 = t.ringStart[p], n = t.vertStart[r0 + 1] - t.vertStart[r0] + 1;
      if (!flatLod && t.roofShape[p] !== ROOF_FLAT) { roofV += n * (roofRings - 1) + 1; roofI += n * roofRings * 6; }
      if (!flatLod && t.minHeight[p] > 0) underI += (t.vertStart[t.ringStart[p + 1]] - t.vertStart[r0] + 2 * (t.ringStart[p + 1] - r0)) * 3;
    }
  }
  const maxV = nV + nR;                       // simplification only removes; odd rings gain one
  const maxG = maxV * 2 + roofV;              // GPU vertices: a foot and a top per ring vertex, + roofs
  const pos = new Float32Array(maxG * 3);
  const uv = new Float32Array(maxG * 2);
  const nrm = new Float32Array(maxG * 3);     // x: corner parity, y: 1 on roof verts, z: corner code
  const idx = new Uint32Array(maxV * 6 + (maxV + 2 * nR) * 3 + roofI + underI);
  const gid = new Uint32Array(nB);
  // year, period, flags + 256 * yearSrc, floors + 256 * use + 2048 * (year demolished - 1600, 0 = standing)
  const attr = new Float32Array(nB * 4);
  const hsrc = new Uint8Array(nB);         // height source (255 none)
  const bbox = new Float32Array(nB * 4);   // minX, minZ, maxX, maxZ (world metres)
  const top = new Float32Array(nB);        // max part height
  const baseB = new Float32Array(nB);      // min part base (ground elevation)
  const partStart = new Uint32Array(nB + 1);
  const partH = new Float32Array(nP);
  const partB = new Float32Array(nP);
  const ringStart = new Uint32Array(nP + 1);
  const vertStart = new Uint32Array(nR + 1);
  const xzW = new Float32Array(maxV * 2);

  let B = 0, P = 0, R = 0, V = 0, G = 0, k = 0, origV = 0, failed = 0;
  const bG = new Uint32Array(nB + 1), bK = new Uint32Array(nB + 1);
  const [px, pz] = packOrigin;
  for (const t of parsed) {
    const dx = t.ox - px, dz = t.oz - pz;
    for (let b = 0; b < t.nB; b++, B++) {
      bG[B] = G; bK[B] = k;   // where this building's vertices and indices start (splitMesh)
      const g = t.gid[b];
      gid[B] = g;
      attr[B * 4] = t.year[b];
      attr[B * 4 + 1] = t.period[b];
      attr[B * 4 + 2] = t.flags[b] + 256 * (t.yearSrc ? t.yearSrc[b] : 255);
      hsrc[B] = t.heightSrc ? t.heightSrc[b] : 255;
      const gone = t.demolished ? t.demolished[b] : 0;
      attr[B * 4 + 3] = t.floors[b] + 256 * t.use[b] + 2048 * (gone > 1600 ? gone - 1600 : 0);
      partStart[B] = P;
      let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity, hMax = 0, bMin = Infinity;
      for (let p = t.partStart[b]; p < t.partStart[b + 1]; p++, P++) {
        const hgt = t.height[p], base = t.base ? t.base[p] : 0;
        const shape = t.roofShape ? t.roofShape[p] : ROOF_FLAT;
        const minH = t.minHeight ? t.minHeight[p] : 0;
        // the walls stop at the eave; a shaped roof rises from there to the part's height
        const eave = shape === ROOF_FLAT ? hgt : Math.max(minH, hgt - t.roofHeight[p]);
        if (hgt > hMax) hMax = hgt;
        if (base < bMin) bMin = base;
        partH[P] = hgt; partB[P] = base; ringStart[P] = R;
        // rings, simplified; odd rings get their longest edge split so corner parity alternates
        const rings = [];
        for (let r = t.ringStart[p]; r < t.ringStart[p + 1]; r++) {
          const pts = [];
          for (let v = t.vertStart[r]; v < t.vertStart[r + 1]; v++) pts.push([t.xz[2 * v] / 10, t.xz[2 * v + 1] / 10]);
          origV += pts.length;
          // Keep both coarse levels at the district tolerance. More aggressive simplification can
          // move a hole outside its outer ring on complex waterfront footprints, making Earcut
          // bridge unrelated corners into huge triangles. LOD 2 still saves the wall vertices.
          let q = lod === 0 ? (t.simplified ? pts : simplifyRing(pts, SIMPLIFY))
            : simplifyRing(pts, 2, 8);
          if (!flatLod && q.length % 2) {
            let li = 0, ll = -1;
            for (let i = 0; i < q.length; i++) {
              const a = q[i], c = q[(i + 1) % q.length], l = (a[0] - c[0]) ** 2 + (a[1] - c[1]) ** 2;
              if (l > ll) { ll = l; li = i; }
            }
            const a = q[li], c = q[(li + 1) % q.length];
            q = q.slice(0, li + 1).concat([[(a[0] + c[0]) / 2, (a[1] + c[1]) / 2]], q.slice(li + 1));
          }
          rings.push(q);
        }
        const flat = [], holes = [];
        const partG0 = G;
        for (const q of rings) {
          if (flat.length) holes.push(flat.length / 2);
          vertStart[R++] = V;
          const n = q.length, g0 = G;
          for (let i = 0; i < n; i++, V++) {
            const [lx, lz] = q[i];
            // a real corner (turn > 40 deg, both sides >= 3.5 m) gets an edge line; collinear and
            // shallow vertices do not, nor the 1-2 m stair steps of traced outlines, nor the facets of
            // a rounded tower (short segments turning 15-35 deg), whose lines came out every other
            // vertex and read as a sawtooth
            const pa = q[(i + n - 1) % n], pc = q[(i + 1) % n];
            const ax = lx - pa[0], az = lz - pa[1], cx = pc[0] - lx, cz = pc[1] - lz;
            const la = Math.hypot(ax, az), lc = Math.hypot(cx, cz);
            const corner = Math.min(la, lc) >= 3.5 && (ax * cx + az * cz) / (la * lc) < 0.766 ? 1 : 0;
            flat.push(lx, lz);
            const x = dx + lx, z = dz + lz, vb = G;
            if (flatLod) {
              pos[vb * 3] = x; pos[vb * 3 + 1] = hgt; pos[vb * 3 + 2] = z;
              uv[vb * 2] = g; uv[vb * 2 + 1] = base;
              nrm[vb * 3 + 1] = 1;
              G++;
            } else {
              pos[vb * 3] = x; pos[vb * 3 + 1] = minH; pos[vb * 3 + 2] = z;
              pos[vb * 3 + 3] = x; pos[vb * 3 + 4] = eave; pos[vb * 3 + 5] = z;
              uv[vb * 2] = g; uv[vb * 2 + 1] = base; uv[vb * 2 + 2] = g; uv[vb * 2 + 3] = base;
              // normal = (parity, top, corner code): parity alternates round the ring so a wall
              // quad interpolates it 0→1; the code is corner * (parity ? 2 : 1), which lets the
              // fragment shader tell whether the corner at either end of the quad is a real one
              const par = i & 1, code = corner * (par ? 2 : 1);
              nrm[vb * 3] = par; nrm[vb * 3 + 1] = 0; nrm[vb * 3 + 2] = code;
              nrm[vb * 3 + 3] = par; nrm[vb * 3 + 4] = 1; nrm[vb * 3 + 5] = code;
              G += 2;
            }
            const wx = t.ox + lx, wz = t.oz + lz;
            xzW[2 * V] = wx; xzW[2 * V + 1] = wz;
            if (wx < minX) minX = wx; if (wx > maxX) maxX = wx;
            if (wz < minZ) minZ = wz; if (wz > maxZ) maxZ = wz;
          }
          for (let i = 0; !flatLod && i < n; i++) {
            const a = g0 + 2 * i, c = g0 + 2 * ((i + 1) % n);
            idx[k++] = a; idx[k++] = c; idx[k++] = c + 1;
            idx[k++] = a; idx[k++] = c + 1; idx[k++] = a + 1;
          }
        }
        const curved = !flatLod && shape !== ROOF_FLAT && rings.length === 1;
        const tri = curved && minH <= 0 ? [] : Earcut.triangulate(flat, holes.length ? holes : null, 2);
        if (!tri.length && !curved) failed++;
        if (!curved) for (let q = 0; q < tri.length; q++) idx[k++] = flatLod ? partG0 + tri[q] : partG0 + 2 * tri[q] + 1;
        // a floating part's underside (the foot vertices, reversed)
        if (minH > 0) for (let q = tri.length - 1; q >= 0; q--) idx[k++] = partG0 + 2 * tri[q];
        if (curved) {
          // the outer ring shrunk toward its centroid, ring by ring, closed by an apex. The roof
          // vertices get edge-line code 0 and up = 0.5, so no edge lines cross the roof; the eave
          // (wall tops, up = 1) keeps its line.
          const q = rings[0], n = q.length;
          let cx = 0, cz = 0, a2 = 0;
          for (let i = 0; i < n; i++) {
            const [x0, z0] = q[i], [x1, z1] = q[(i + 1) % n], c = x0 * z1 - x1 * z0;
            a2 += c; cx += (x0 + x1) * c; cz += (z0 + z1) * c;
          }
          if (Math.abs(a2) > 1e-6) { cx /= 3 * a2; cz /= 3 * a2; }
          else { cx = q.reduce((s, v) => s + v[0], 0) / n; cz = q.reduce((s, v) => s + v[1], 0) / n; }
          const put = (lx, y, lz) => {
            pos[G * 3] = dx + lx; pos[G * 3 + 1] = y; pos[G * 3 + 2] = dz + lz;
            uv[G * 2] = g; uv[G * 2 + 1] = base;
            nrm[G * 3] = 0; nrm[G * 3 + 1] = 0.5; nrm[G * 3 + 2] = 0;
            return G++;
          };
          const rise = hgt - eave;
          let prev = Array.from({ length: n }, (_, i) => partG0 + 2 * i + 1);
          for (let r = 1; r < roofRings; r++) {
            if (shape === ROOF_PYRAMID) break;
            const [s, up] = roofProfile(shape, r, roofRings);
            const ring = q.map(([lx, lz]) => put(cx + (lx - cx) * s, eave + rise * up, cz + (lz - cz) * s));
            for (let i = 0; i < n; i++) {
              const j = (i + 1) % n;
              idx[k++] = prev[i]; idx[k++] = prev[j]; idx[k++] = ring[j];
              idx[k++] = prev[i]; idx[k++] = ring[j]; idx[k++] = ring[i];
            }
            prev = ring;
          }
          const apex = put(cx, hgt, cz);
          for (let i = 0; i < n; i++) { idx[k++] = prev[i]; idx[k++] = prev[(i + 1) % n]; idx[k++] = apex; }
        }
      }
      bbox[B * 4] = minX; bbox[B * 4 + 1] = minZ; bbox[B * 4 + 2] = maxX; bbox[B * 4 + 3] = maxZ;
      top[B] = hMax;
      baseB[B] = Number.isFinite(bMin) ? bMin : 0;
    }
  }
  partStart[nB] = P; ringStart[nP] = R; vertStart[nR] = V;
  bG[nB] = G; bK[nB] = k;
  const nVert = G;
  const grid = pickGrid(bbox, nB);
  return {
    nB, nVert, origVerts: origV * 2, roofFailed: failed, lod,
    parts: splitMesh(pos, uv, nrm, idx, bG, bK, nB),
    pick: { gid, attr, hsrc, bbox, top, base: baseB, partStart, partH, partB, ringStart, vertStart, xz: xzW.slice(0, V * 2), ...grid },
  };
}

// A pack's mesh in pieces of at most PART_VERTS vertices, cut between buildings (a building's
// indices only refer to its own vertices). threers creates a mesh's GPU buffers on its first
// draw, so one big mesh would stall that frame; the renderer adds pieces a few a frame.
const PART_VERTS = 120000;
function splitMesh(pos, uv, nrm, idx, bG, bK, nB) {
  const parts = [];
  for (let b0 = 0; b0 < nB;) {
    let b1 = b0 + 1;
    while (b1 < nB && bG[b1 + 1] - bG[b0] <= PART_VERTS) b1++;
    const g0 = bG[b0], g1 = bG[b1], k0 = bK[b0], k1 = bK[b1];
    const id = idx.slice(k0, k1);
    for (let i = 0; i < id.length; i++) id[i] -= g0;
    parts.push({ pos: pos.slice(g0 * 3, g1 * 3), uv: uv.slice(g0 * 2, g1 * 2), nrm: nrm.slice(g0 * 3, g1 * 3), idx: id });
    b0 = b1;
  }
  return parts;
}

// The pick grid of one pack (picking.js): which buildings' footprint boxes touch each 40 m cell,
// as sorted cell keys with a CSR list of building indices. Built here so the page only stores it.
const PICK_CELL = 40;
function pickGrid(bbox, nB) {
  const C = PICK_CELL, key = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
  let n = 0;
  for (let b = 0; b < nB; b++) {
    n += (Math.floor(bbox[4 * b + 2] / C) - Math.floor(bbox[4 * b] / C) + 1) * (Math.floor(bbox[4 * b + 3] / C) - Math.floor(bbox[4 * b + 1] / C) + 1);
  }
  const pk = new Float64Array(n), pb = new Uint32Array(n);
  let k = 0;
  for (let b = 0; b < nB; b++) {
    const x0 = Math.floor(bbox[4 * b] / C), z0 = Math.floor(bbox[4 * b + 1] / C);
    const x1 = Math.floor(bbox[4 * b + 2] / C), z1 = Math.floor(bbox[4 * b + 3] / C);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) { pk[k] = key(cx, cz); pb[k] = b; k++; }
  }
  const order = Uint32Array.from({ length: n }, (_, i) => i).sort((i, j) => pk[i] - pk[j] || pb[i] - pb[j]);
  const keys = [], start = [], refs = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    const o = order[i];
    if (!keys.length || keys[keys.length - 1] !== pk[o]) { keys.push(pk[o]); start.push(i); }
    refs[i] = pb[o];
  }
  start.push(n);
  return { gridKeys: Float64Array.from(keys), gridStart: Uint32Array.from(start), gridRefs: refs };
}

const partBuffers = parts => parts.flatMap(q => [q.pos.buffer, q.uv.buffer, q.nrm.buffer, q.idx.buffer]);

// render worker port (gfx.js worker mode): finished meshes go straight there, not via the page
let renderPort = null;

self.onmessage = async ({ data }) => {
  if (data.op === 'port') { renderPort = data.port; return; }
  const { id, url, tiles, origin, buf: early, gz, meshId, castShadow, lod = 0 } = data;
  try {
    // prefetched by the page while the renderer started, else fetched here
    const buf = early ? await gunzip(early) : await fetchBin(url, gz);
    const t0 = performance.now();
    const m = buildPack(buf, tiles, origin, lod);
    const p = m.pick;
    const pickBufs = [
      p.gid.buffer, p.attr.buffer, p.hsrc.buffer, p.bbox.buffer, p.top.buffer, p.base.buffer, p.partStart.buffer,
      p.partH.buffer, p.partB.buffer, p.ringStart.buffer, p.vertStart.buffer, p.xz.buffer,
      p.gridKeys.buffer, p.gridStart.buffer, p.gridRefs.buffer,
    ];
    if (renderPort && meshId != null) {
      // storage-0 runs (contiguous gids) for the render worker; the page keeps its own mirror
      const runs = [];
      for (let s = 0, i = 1; i <= p.gid.length; i++) {
        if (i === p.gid.length || p.gid[i] !== p.gid[i - 1] + 1) { runs.push([p.gid[s] * 4, p.attr.slice(s * 4, i * 4)]); s = i; }
      }
      renderPort.postMessage({ op: 'attrsRuns', args: [runs] }, runs.map(r => r[1].buffer));
      renderPort.postMessage({ op: 'addMesh', args: [meshId, { mat: 'building', parts: m.parts, position: [origin[0], 0, origin[1]], castShadow }] },
        partBuffers(m.parts));
      const { parts, ...rest } = m;
      self.postMessage({ id, ok: true, sent: true, ms: performance.now() - t0, bytes: buf.byteLength, ...rest }, pickBufs);
      return;
    }
    self.postMessage({ id, ok: true, ms: performance.now() - t0, bytes: buf.byteLength, ...m }, [...partBuffers(m.parts), ...pickBufs]);
  } catch (e) {
    self.postMessage({ id, ok: false, error: String(e && e.stack || e) });
  }
};
