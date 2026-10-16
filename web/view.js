// What the camera sees: which packs are inside the view frustum, and how far each is from the eye.
// The loader fetches visible packs nearest-first and fills the rest of its budget with a margin
// around the view, so panning finds buildings already there.

const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * A view is a map-camera pose `{x, z, distance, azimuth, elevation}` (see map-camera.js).
 * Returns `bbox => {visible, dist}` for ground boxes `[minX, minZ, maxX, maxZ]` holding
 * buildings up to `top` metres: `visible` is a conservative frustum test (a box may count as
 * visible when it only touches the corner of the screen, never the other way round) with a
 * `margin` around the screen edges, `dist` the distance from the eye to the box.
 */
export function viewRanker(v, aspect, { fov = 35, groundY = 0, top = 300, margin = 1.15, far = v.distance * 7 + 6000 } = {}) {
  const ce = Math.cos(v.elevation);
  const eye = [v.x + v.distance * ce * Math.sin(v.azimuth), groundY + v.distance * Math.sin(v.elevation), v.z + v.distance * ce * Math.cos(v.azimuth)];
  const f = norm([v.x - eye[0], groundY - eye[1], v.z - eye[2]]);
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const ty = Math.tan(fov * Math.PI / 360) * margin, tx = ty * aspect;
  const ys = [groundY, groundY + top];
  return bbox => {
    // all eight corners outside one frustum plane = not visible
    let near = true, left = true, right = true, below = true, above = true;
    for (const x of [bbox[0], bbox[2]]) for (const z of [bbox[1], bbox[3]]) for (const y of ys) {
      const d = [x - eye[0], y - eye[1], z - eye[2]];
      const zc = dot(d, f), xc = dot(d, r), yc = dot(d, u);
      if (zc > 1) near = false;
      if (xc + tx * zc > 0) left = false;
      if (tx * zc - xc > 0) right = false;
      if (yc + ty * zc > 0) below = false;
      if (ty * zc - yc > 0) above = false;
    }
    const dx = Math.max(bbox[0] - eye[0], 0, eye[0] - bbox[2]);
    const dz = Math.max(bbox[1] - eye[2], 0, eye[2] - bbox[3]);
    const dy = Math.max(groundY - eye[1], 0, eye[1] - groundY - top);
    const dist = Math.hypot(dx, dy, dz);
    return { visible: !(near || left || right || below || above) && dist < far, dist };
  };
}

/**
 * Packs in load order for a view: the visible ones nearest the eye first, then the rest within
 * `radius` of the view's target. Stops at `budget` estimated vertices (always takes one).
 * Each entry: `{p, visible, dist}`.
 */
export function rankPacks(packs, v, aspect, { budget, radius, vertsOf = p => p.nVert || p.estVerts } = {}) {
  const rank = viewRanker(v, aspect);
  const out = [];
  const margin = [];
  for (const p of packs) {
    const e = { p, ...rank(p.bbox) };
    if (e.visible) out.push(e);
    else {
      const dx = Math.max(p.bbox[0] - v.x, 0, v.x - p.bbox[2]), dz = Math.max(p.bbox[1] - v.z, 0, v.z - p.bbox[3]);
      if (Math.hypot(dx, dz) <= radius) margin.push(e);
    }
  }
  out.sort((a, b) => a.dist - b.dist);
  margin.sort((a, b) => a.dist - b.dist);
  const list = [];
  let verts = 0;
  for (const e of out.concat(margin)) {
    const n = vertsOf(e.p);
    if (verts + n > budget && list.length) break;
    verts += n; list.push(e);
  }
  return list;
}
