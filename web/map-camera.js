// MapCamera: a map-style camera controller for a Y-up world whose ground is the XZ plane.
//
// The camera orbits a target point on the ground:
//   left drag            rotate (azimuth) and tilt (elevation)
//   right / shift drag   pan; the ground point under the cursor stays under the cursor
//   middle drag          tilt only
//   wheel / pinch        zoom toward the point under the cursor
//   one-finger touch     pan; two fingers: pinch-zoom, twist-rotate, drag to pan
//   arrow keys           pan; +/- zoom; [ ] rotate
// Rotation and zoom are damped toward a goal pose; a released pan coasts.
//
// It only needs `camera.position.set(x, y, z)`, `camera.lookAt(x, y, z)`, `camera.fov` (degrees,
// vertical) and `camera.aspect`, so it works with three.js and with the threers shim alike.
//
// Pose: position = target + distance * (cos(el) sin(az), sin(el), cos(el) cos(az)).
// azimuth 0 puts the camera on the +Z side looking toward -Z, which is north-up for a frame
// with x = east and z = south.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class MapCamera {
  constructor(camera, dom, opts = {}) {
    this.camera = camera;
    this.dom = dom;
    this.minDistance = opts.minDistance ?? 50;
    this.maxDistance = opts.maxDistance ?? 40000;
    this.minElevation = opts.minElevation ?? (10 * Math.PI / 180);
    this.maxElevation = opts.maxElevation ?? (88 * Math.PI / 180);
    this.rotateSpeed = opts.rotateSpeed ?? 1.0;
    this.zoomSpeed = opts.zoomSpeed ?? 1.0;
    this.damping = opts.damping ?? 0.2;         // fraction of the remaining way per 1/60 s
    this.panFriction = opts.panFriction ?? 4;   // 1/s, decay rate of pan inertia
    this.bounds = opts.bounds ?? null;          // {minX, minZ, maxX, maxZ}: target clamp
    this.groundY = opts.groundY ?? 0;
    this.enabled = true;
    this.onChange = null;

    const p = { x: 0, z: 0, distance: 3000, azimuth: 0, elevation: 0.8 };
    this.pose = { ...p };
    this.goal = { ...p };
    this._vel = { x: 0, z: 0 };
    this._drag = null;
    this._pointers = new Map();
    this._pinch = null;
    this._lastMoveT = 0;
    this._moved = true;
    this.interacting = false;

    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);
    this._onWheel = this._onWheel.bind(this);
    this._onKey = this._onKey.bind(this);
    this._onContext = e => e.preventDefault();
    dom.addEventListener('pointerdown', this._onDown);
    dom.addEventListener('pointermove', this._onMove);
    dom.addEventListener('pointerup', this._onUp);
    dom.addEventListener('pointercancel', this._onUp);
    dom.addEventListener('wheel', this._onWheel, { passive: false });
    dom.addEventListener('contextmenu', this._onContext);
    window.addEventListener('keydown', this._onKey);
    dom.style.touchAction = 'none';
  }

  dispose() {
    const d = this.dom;
    d.removeEventListener('pointerdown', this._onDown);
    d.removeEventListener('pointermove', this._onMove);
    d.removeEventListener('pointerup', this._onUp);
    d.removeEventListener('pointercancel', this._onUp);
    d.removeEventListener('wheel', this._onWheel);
    d.removeEventListener('contextmenu', this._onContext);
    window.removeEventListener('keydown', this._onKey);
  }

  /** Set the view; `immediate` skips the damped transition. Angles in radians. */
  setView(v, immediate = false) {
    const g = this.goal;
    if (v.x !== undefined) g.x = v.x;
    if (v.z !== undefined) g.z = v.z;
    if (v.distance !== undefined) g.distance = v.distance;
    if (v.azimuth !== undefined) g.azimuth = v.azimuth;
    if (v.elevation !== undefined) g.elevation = v.elevation;
    this._clampGoal();
    if (immediate) Object.assign(this.pose, g);
    this._moved = true;
  }

  get target() { return { x: this.pose.x, y: this.groundY, z: this.pose.z }; }
  get distance() { return this.pose.distance; }

  /** Camera position for a pose. */
  positionOf(p = this.pose) {
    const ce = Math.cos(p.elevation);
    return {
      x: p.x + p.distance * ce * Math.sin(p.azimuth),
      y: this.groundY + p.distance * Math.sin(p.elevation),
      z: p.z + p.distance * ce * Math.cos(p.azimuth),
    };
  }

  /** Advance damping/inertia by dt seconds and write the camera. Returns true if it moved. */
  update(dt = 1 / 60) {
    dt = Math.min(dt, 0.1);
    const p = this.pose, g = this.goal;
    if (!this._drag && (this._vel.x || this._vel.z)) {
      g.x += this._vel.x * dt; g.z += this._vel.z * dt;
      p.x += this._vel.x * dt; p.z += this._vel.z * dt;
      const f = Math.exp(-this.panFriction * dt);
      this._vel.x *= f; this._vel.z *= f;
      if (Math.hypot(this._vel.x, this._vel.z) < 0.02 * p.distance * 0.01) this._vel.x = this._vel.z = 0;
      this._clampGoal(); p.x = g.x; p.z = g.z;
    }
    const k = 1 - Math.pow(1 - this.damping, dt * 60);
    let moved = this._moved;
    for (const key of ['x', 'z', 'azimuth', 'elevation']) {
      const d = g[key] - p[key];
      if (Math.abs(d) > 1e-6) { p[key] += d * k; moved = true; } else p[key] = g[key];
    }
    // distance interpolates in log space so zooming feels uniform
    const ld = Math.log(g.distance / p.distance);
    if (Math.abs(ld) > 1e-5) { p.distance *= Math.exp(ld * k); moved = true; } else p.distance = g.distance;
    this._moved = false;
    if (moved) {
      const c = this.positionOf(p);
      this.camera.position.set(c.x, c.y, c.z);
      this.camera.lookAt(p.x, this.groundY, p.z);
      this.onChange?.(this);
    }
    return moved;
  }

  /** World-space ray through a client (CSS pixel) point, for the current pose. */
  ray(clientX, clientY) {
    const r = this.dom.getBoundingClientRect();
    const nx = ((clientX - r.left) / r.width) * 2 - 1;
    const ny = 1 - ((clientY - r.top) / r.height) * 2;
    const o = this.positionOf(this.pose);
    let fx = this.pose.x - o.x, fy = this.groundY - o.y, fz = this.pose.z - o.z;
    const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
    // right = f x up(0,1,0)
    let rx = -fz, rz = fx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
    // up = right x f
    const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
    const ty = Math.tan((this.camera.fov * Math.PI / 180) / 2), tx = ty * (this.camera.aspect || r.width / r.height);
    let dx = fx + rx * nx * tx + ux * ny * ty, dy = fy + uy * ny * ty, dz = fz + rz * nx * tx + uz * ny * ty;
    const dl = Math.hypot(dx, dy, dz);
    return { origin: o, dir: { x: dx / dl, y: dy / dl, z: dz / dl } };
  }

  /** Where the ray through a client point meets the ground plane, or null above the horizon. */
  groundPoint(clientX, clientY) {
    const { origin: o, dir: d } = this.ray(clientX, clientY);
    if (d.y > -1e-4) return null;
    const t = (this.groundY - o.y) / d.y;
    // Very far hits (grazing angles) make panning and zooming jumpy; cap them.
    const maxT = this.pose.distance * 6;
    const tt = Math.min(t, maxT);
    return { x: o.x + d.x * tt, z: o.z + d.z * tt };
  }

  _clampGoal() {
    const g = this.goal;
    g.distance = clamp(g.distance, this.minDistance, this.maxDistance);
    g.elevation = clamp(g.elevation, this.minElevation, this.maxElevation);
    if (this.bounds) {
      g.x = clamp(g.x, this.bounds.minX, this.bounds.maxX);
      g.z = clamp(g.z, this.bounds.minZ, this.bounds.maxZ);
    }
  }

  _onDown(e) {
    if (!this.enabled) return;
    this.dom.setPointerCapture?.(e.pointerId);
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this._vel.x = this._vel.z = 0;
    if (this._pointers.size === 2) { this._startPinch(); this._drag = null; return; }
    if (this._pointers.size > 2) return;
    let mode;
    if (e.pointerType === 'touch') mode = 'pan';
    else if (e.button === 2 || (e.button === 0 && (e.shiftKey || e.ctrlKey || e.metaKey))) mode = 'pan';
    else if (e.button === 1) mode = 'tilt';
    else if (e.button === 0) mode = 'rotate';
    else return;
    this._drag = { mode, x: e.clientX, y: e.clientY, grab: null, samples: [] };
    if (mode === 'pan') {
      // pan without the damped lag: snap the pose's target to the goal first
      this.pose.x = this.goal.x; this.pose.z = this.goal.z;
      this._drag.grab = this.groundPoint(e.clientX, e.clientY);
    }
    this.interacting = true;
  }

  _onMove(e) {
    if (!this._pointers.has(e.pointerId)) return;
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this._pinch) { this._movePinch(); return; }
    const d = this._drag;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    d.x = e.clientX; d.y = e.clientY;
    const h = this.dom.clientHeight || 800;
    if (d.mode === 'rotate' || d.mode === 'tilt') {
      if (d.mode === 'rotate') this.goal.azimuth -= dx / h * Math.PI * this.rotateSpeed;
      this.goal.elevation += dy / h * Math.PI * 0.6 * this.rotateSpeed;
      this._clampGoal();
    } else if (d.mode === 'pan') {
      this._panTo(d, e.clientX, e.clientY);
    }
    this._moved = true;
  }

  _panTo(d, cx, cy) {
    if (!d.grab) { d.grab = this.groundPoint(cx, cy); return; }
    const p = this.groundPoint(cx, cy);
    if (!p) return;
    const mx = d.grab.x - p.x, mz = d.grab.z - p.z;
    this.goal.x += mx; this.goal.z += mz;
    this._clampGoal();
    this.pose.x = this.goal.x; this.pose.z = this.goal.z;
    const now = performance.now();
    d.samples.push({ t: now, x: mx, z: mz });
    while (d.samples.length && now - d.samples[0].t > 100) d.samples.shift();
  }

  _onUp(e) {
    this._pointers.delete(e.pointerId);
    this.dom.releasePointerCapture?.(e.pointerId);
    if (this._pinch) {
      this._pinch = null;
      if (this._pointers.size === 1) {
        const [q] = this._pointers.values();
        this._drag = { mode: 'pan', x: q.x, y: q.y, grab: this.groundPoint(q.x, q.y), samples: [] };
      }
      return;
    }
    const d = this._drag;
    if (d && d.mode === 'pan' && d.samples.length > 1) {
      const span = (d.samples[d.samples.length - 1].t - d.samples[0].t) / 1000;
      if (span > 0.01 && performance.now() - d.samples[d.samples.length - 1].t < 60) {
        let sx = 0, sz = 0; for (const s of d.samples) { sx += s.x; sz += s.z; }
        this._vel.x = sx / span; this._vel.z = sz / span;
      }
    }
    this._drag = null;
    if (this._pointers.size === 0) this.interacting = false;
  }

  _startPinch() {
    const [a, b] = [...this._pointers.values()];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.pose.x = this.goal.x; this.pose.z = this.goal.z;
    this._pinch = {
      dist: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x),
      mid, grab: this.groundPoint(mid.x, mid.y),
    };
  }

  _movePinch() {
    const [a, b] = [...this._pointers.values()];
    const P = this._pinch;
    const dist = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (P.dist > 0 && dist > 0) this._zoomAt(mid.x, mid.y, P.dist / dist, true);
    let da = ang - P.ang; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
    this.goal.azimuth -= da; this.pose.azimuth = this.goal.azimuth;
    this.goal.elevation += (mid.y - P.mid.y) / (this.dom.clientHeight || 800) * Math.PI * 0.3;
    this._clampGoal();
    const d = { grab: P.grab, samples: [] };
    this._panTo(d, mid.x, mid.y);
    P.grab = this.groundPoint(mid.x, mid.y);
    P.dist = dist; P.ang = ang; P.mid = mid;
    this._moved = true;
  }

  _zoomAt(cx, cy, factor, immediate = false) {
    const g = this.goal;
    const target = clamp(g.distance * factor, this.minDistance, this.maxDistance);
    const f = target / g.distance;
    const P = this.groundPoint(cx, cy);
    if (P) { g.x = P.x + (g.x - P.x) * f; g.z = P.z + (g.z - P.z) * f; }
    g.distance = target;
    this._clampGoal();
    if (immediate) { this.pose.x = g.x; this.pose.z = g.z; this.pose.distance = g.distance; }
    this._moved = true;
  }

  _onWheel(e) {
    if (!this.enabled) return;
    e.preventDefault();
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 33; else if (e.deltaMode === 2) dy *= 400;
    // ctrl+wheel is a trackpad pinch in Chrome/Safari: more sensitive
    const s = (e.ctrlKey ? 0.01 : 0.0015) * this.zoomSpeed;
    this._zoomAt(e.clientX, e.clientY, Math.exp(clamp(dy, -300, 300) * s));
  }

  _onKey(e) {
    if (!this.enabled || e.target?.closest?.('input, textarea, select')) return;
    const g = this.goal, step = g.distance * 0.15;
    const s = Math.sin(g.azimuth), c = Math.cos(g.azimuth);
    let used = true;
    switch (e.key) {
      case 'ArrowUp': g.x -= s * step; g.z -= c * step; break;
      case 'ArrowDown': g.x += s * step; g.z += c * step; break;
      case 'ArrowLeft': g.x -= c * step; g.z += s * step; break;
      case 'ArrowRight': g.x += c * step; g.z -= s * step; break;
      case '+': case '=': g.distance /= 1.3; break;
      case '-': case '_': g.distance *= 1.3; break;
      case '[': g.azimuth += 0.2; break;
      case ']': g.azimuth -= 0.2; break;
      default: used = false;
    }
    if (used) { this._clampGoal(); this._moved = true; e.preventDefault(); }
  }
}
