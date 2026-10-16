// Landmark models (index.json `models`, see landmarks/README.md): a glTF binary per landmark,
// drawn with the building material as part of the building it stands in, so it takes that
// building's colour in every mode, its card, its shadow and the timeline. Loaded once the
// building's pack is in (its colour is in the storage buffer by then).
//
// Vertex attributes follow worker.js: uv = (gid, ground elevation), normal = edge-line inputs
// (0, 0.5, 0: no edge lines across a curved surface; the shader shades by face normal).

import { fetchBin, dataUrl } from './dataurl.js';

/** Positions and indices of every triangle primitive in a .glb (node transforms applied). */
export function parseGlb(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a glb');
  const jsonLen = dv.getUint32(12, true);
  const doc = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
  const binOff = 20 + jsonLen + 8;
  const view = (acc, Ctor, comps) => {
    const a = doc.accessors[acc], bv = doc.bufferViews[a.bufferView];
    const off = binOff + (bv.byteOffset || 0) + (a.byteOffset || 0);
    const n = a.count * comps, stride = bv.byteStride || 0, size = Ctor.BYTES_PER_ELEMENT * comps;
    if (!stride || stride === size) return new Ctor(buf.slice(off, off + n * Ctor.BYTES_PER_ELEMENT));
    const out = new Ctor(n), src = new DataView(buf);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < comps; c++) {
      const o = off + i * stride + c * Ctor.BYTES_PER_ELEMENT;
      out[i * comps + c] = Ctor === Float32Array ? src.getFloat32(o, true) : Ctor === Uint32Array ? src.getUint32(o, true) : src.getUint16(o, true);
    }
    return out;
  };
  const pos = [], idx = [];
  let nv = 0;
  const mul = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
  const mat = n => {
    if (n.matrix) return n.matrix;
    const [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1], [tx, ty, tz] = n.translation || [0, 0, 0];
    return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
      2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
      2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
  };
  const times = (a, b) => Array.from({ length: 16 }, (_, i) => { const r = i % 4, c = i >> 2; let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; return s; });
  const visit = (ni, parent) => {
    const n = doc.nodes[ni], m = times(parent, mat(n));
    if (n.mesh != null) for (const pr of doc.meshes[n.mesh].primitives) {
      if (pr.mode != null && pr.mode !== 4) continue;
      const p = view(pr.attributes.POSITION, Float32Array, 3);
      const a = pr.indices != null ? doc.accessors[pr.indices] : null;
      const ix = a ? view(pr.indices, a.componentType === 5125 ? Uint32Array : Uint16Array, 1) : Array.from({ length: p.length / 3 }, (_, i) => i);
      for (let i = 0; i < p.length; i += 3) pos.push(...mul(m, [p[i], p[i + 1], p[i + 2]]));
      for (const i of ix) idx.push(nv + i);
      nv += p.length / 3;
    }
    for (const c of n.children || []) visit(c, m);
  };
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const ni of doc.scenes[doc.scene || 0].nodes) visit(ni, I);
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx), asset: doc.asset };
}

/**
 * Landmarks of the city at `dir`. `addMesh(id, spec)` hands a finished mesh to the renderer; call `check()`
 * whenever a building's colour is in the storage buffer (worker packs), `gidLoaded(gid)` to ask.
 */
export function landmarks({ dir, list, shadows, addMesh, gidLoaded }) {
  const pending = (list || []).map(m => ({ ...m, state: 'idle' }));
  const build = async m => {
    m.state = 'loading';
    try {
      const { pos, idx } = parseGlb(await fetchBin(dataUrl(dir + m.file)));
      const n = pos.length / 3, c = Math.cos(-(m.rotation || 0) * Math.PI / 180), s = Math.sin(-(m.rotation || 0) * Math.PI / 180);
      const p = new Float32Array(n * 3), uv = new Float32Array(n * 2), nrm = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const x = pos[3 * i], y = pos[3 * i + 1], z = pos[3 * i + 2];
        p[3 * i] = x * c - z * s; p[3 * i + 1] = Math.max(0, y); p[3 * i + 2] = x * s + z * c;
        uv[2 * i] = m.gid; uv[2 * i + 1] = m.base || 0;
        nrm[3 * i + 1] = 0.5;
      }
      // drawn with the building material (gfx.js; buffers handed over)
      addMesh(`model:${m.id}`, { mat: 'building', pos: p, uv, nrm, idx, position: [m.x, 0, m.z], castShadow: shadows });
      m.state = 'loaded';
    } catch (e) {
      m.state = 'error';
      console.warn('[city] landmark model', m.id, e);
    }
  };
  const check = () => { for (const m of pending) if (m.state === 'idle' && gidLoaded(m.gid)) build(m); };
  return { check, list: pending };
}
