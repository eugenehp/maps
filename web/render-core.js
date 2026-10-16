// The renderer side of the map: threers, the scene, the camera, the materials and every mesh.
// Runs either on the page (inline) or in a worker that owns the canvas (an OffscreenCanvas; see
// render-worker.js and gfx.js). The page talks to it through the same small API either way:
//
//   start(opts) -> { backend, msaa, variant, startup }   shim, wasm, GPU device (before the manifest)
//   setup(opts)                                        scene, materials, sun (with the manifest)
//   state({ cam, uniforms, ground, shadow, waterY })   per frame, only what changed
//   setStorage(slot, data) / setStorageRange(slot, offset, data)
//   addMesh(id, spec) / removeMesh(id) / setVisible(id, on)
//   attrsRuns(runs)                                    storage-0 runs [offset, Float32Array]
//   setBackground(rgb) / resize(w, h, aspect)
//   render()                                           inline mode: the page's frame loop calls it
//
// Mesh spec: { mat: 'building' | ground material name, pos, uv?, nrm?, idx, position?: [x, y, z],
// castShadow? }. Ground materials are created by name in init (`ground: { name: shade-uniforms }`).

import { U, UNIFORM_FLOATS, BUILDING_VERTEX, BUILDING_FRAGMENT, GROUND_FRAGMENT, GROUND_VERTEX } from './shaders.js';

/** Mesh uploads per frame: at most this long and this many vertices (at least one piece a frame). */
const UPLOAD_MS = 6;
const UPLOAD_VERTS = 150000;

export class RenderCore {
  /** Import the shim and compile the wasm (no canvas needed): started as early as possible. */
  preload(o) {
    if (this._pre && this._preVariant === o.variant) return this._pre;
    this._preVariant = o.variant;
    // the GL build still prefers WebGPU: hide it when the fallback was asked for
    if (o.hideGpu) { try { Object.defineProperty(navigator, 'gpu', { get: () => undefined, configurable: true }); } catch { } }
    return this._pre = (async () => {
      const t0 = performance.now();
      const mod = await import(`./${o.variant}/threejs-shim.js`);
      const t1 = performance.now();
      await mod.initThreers({ module_or_path: await wasmSource(o) });
      return { mod, t0, t1, t2: performance.now() };
    })();
  }

  async start(o) {
    this.o = o;
    const { mod, t0, t1, t2 } = await this.preload(o);
    const THREE = this.THREE = mod.default;
    const renderer = this.renderer = await THREE.WebGLRenderer.create(o.canvas);
    const startup = { importMs: t1 - t0, wasmMs: t2 - t1, deviceMs: performance.now() - t2, at: t0 };
    renderer._w?.setMsaa?.(o.msaa);
    return { backend: renderer._w?.backend?.() ?? (o.variant === 'threers' ? 'webgpu' : 'gl'), msaa: renderer._w?.msaa?.() ?? o.msaa, variant: o.variant, startup };
  }

  setup(o) {
    Object.assign(this.o, o);
    const THREE = this.THREE;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, o.aspect || 1.6, 8, 150000);

    this.uniforms = new Float32Array(UNIFORM_FLOATS);
    this.buildingMat = new THREE.ShaderMaterial({
      vertex: BUILDING_VERTEX, fragment: BUILDING_FRAGMENT, uniforms: this.uniforms,
      storage0: new Float32Array(Math.max(1, o.count) * 4),
      storage1: new Float32Array(128 * 4),
      storage2: new Float32Array(Math.max(1, o.count)).fill(-1),
      side: THREE.DoubleSide,
    });
    this.mats = { building: this.buildingMat };
    for (const [name, u] of Object.entries(o.ground || {})) {
      this.mats[name] = new THREE.ShaderMaterial({ vertex: GROUND_VERTEX, fragment: GROUND_FRAGMENT, uniforms: Float32Array.from(u), side: THREE.DoubleSide });
    }
    this.meshes = new Map();
    this.gone = new Set();   // ids removed before their mesh arrived (worker mode races)

    // water: one big quad under everything (sinks with distance: state.waterY)
    if (o.water) {
      const b = o.bounds, pad = 80000;
      const x0 = b.min[0] - pad, x1 = b.max[0] + pad, z0 = b.min[1] - pad, z1 = b.max[1] + pad;
      this._upload('water', { mat: o.water, pos: new Float32Array([x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z1]), idx: new Uint32Array([0, 2, 1, 0, 3, 2]) });
    }
    // sun: drives only the shadow map (the shaders light themselves)
    const sun = this.sun = new THREE.DirectionalLight(0xffffff, 0);
    const d = o.sunDir;
    sun.position.set(d[0] * 5000, d[1] * 5000, d[2] * 5000);
    if (o.shadows) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(4096, 4096);
      sun.shadow.camera.far = 1500;   // casters this far beyond the view, toward the sun
      sun.shadow.bias = 0.0004;
      sun.shadow.fitView = 3000;
    }
    this.scene.add(sun);
    if (!o.nowarm) this._warm();
    this.ready = true;
  }

  // Compile every material's pipelines (and the shadow pass) now, while the first packs are still
  // on the network: one zero-area triangle per material, drawn once in front of the default camera
  // and removed. Otherwise the first frame with buildings pays for it (~25 ms).
  _warm() {
    const T = this.THREE, warm = [];
    for (const [name, mat] of Object.entries(this.mats)) {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(new Float32Array([0, 0, -100, 0, 0, -100, 0, 0, -100]), 3));
      g.setAttribute('uv', new T.BufferAttribute(new Float32Array(6), 2));
      g.setAttribute('normal', new T.BufferAttribute(new Float32Array(9), 3));
      g.setIndex(new T.BufferAttribute(new Uint32Array([0, 1, 2]), 1));
      const m = new T.Mesh(g, mat);
      m.castShadow = name === 'building' && this.o.shadows;
      m.frustumCulled = false;
      this.scene.add(m);
      warm.push(m);
    }
    try { this.renderer.render(this.scene, this.camera); } catch { }
    for (const m of warm) this._free(m);
  }

  state(s) {
    if (s.cam) {
      const c = s.cam;
      this.camera.position.set(c.p[0], c.p[1], c.p[2]);
      this.camera.lookAt(c.t[0], c.t[1], c.t[2]);
    }
    if (s.uniforms) { this.uniforms.set(s.uniforms); this.uniformsDirty = true; }
    if (s.ground) for (const [name, u] of Object.entries(s.ground)) this.mats[name]?.setUniforms(u);
    if (s.shadow && this.o.shadows) { this.sun.shadow.normalBias = s.shadow.normalBias; this.sun.shadow.fitView = s.shadow.fit; }
    if (s.waterY !== undefined) { const w = this.meshes.get('water'); if (w) w[0].position.y = s.waterY; }
  }

  setStorage(slot, data) { this.buildingMat.setStorage(slot, data); }
  setStorageRange(slot, offset, data) { this.buildingMat.setStorageRange(slot, offset, data); }
  attrsRuns(runs) { for (const [off, run] of runs) this.buildingMat.setStorageRange(0, off, run); }
  setMsaa(samples) {
    this.renderer._w?.setMsaa?.(samples);
    this.o.msaa = samples;
  }

  // Meshes are uploaded on the frame loop, a few milliseconds' worth per frame (see render()):
  // a burst of packs arriving together would otherwise stall one frame for all of them.
  // A mesh may come in pieces (`parts`, from worker.js): they are added a few a frame, under
  // UPLOAD_VERTS vertices, because the GPU buffers are made on a mesh's first draw.
  addMesh(id, m) {
    const q = (this.pending ||= []);
    if (!m.parts) { q.push([id, m]); return; }
    const { parts, ...rest } = m;
    parts.forEach((pt, i) => q.push([id, { ...rest, ...pt, part: i }]));
  }
  _upload(id, m) {
    if (this.gone.has(id)) { if (!(m.part > 0) || !this.pending.some(e => e[0] === id)) this.gone.delete(id); return; }
    const T = this.THREE, g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(m.pos, 3));
    if (m.uv) g.setAttribute('uv', new T.BufferAttribute(m.uv, 2));
    if (m.nrm) g.setAttribute('normal', new T.BufferAttribute(m.nrm, 3));
    g.setIndex(new T.BufferAttribute(m.idx, 1));
    const mesh = new T.Mesh(g, this.mats[m.mat]);
    if (m.position) mesh.position.set(m.position[0], m.position[1], m.position[2]);
    mesh.castShadow = !!m.castShadow && this.o.shadows;
    if (m.hidden) mesh.visible = false;
    this.scene.add(mesh);
    g.attributes = {}; g._indexAttr = null;   // the GPU has it now; drop the JS copies
    // a new single mesh, or the first piece of a new one, replaces what the id had
    const old = this.meshes.get(id);
    if (old && !(m.part > 0)) { old.forEach(x => this._free(x)); this.meshes.set(id, [mesh]); }
    else if (old) old.push(mesh);
    else this.meshes.set(id, [mesh]);
  }
  removeMesh(id) {
    const had = this.pending?.some(e => e[0] === id);
    if (had) this.pending = this.pending.filter(e => e[0] !== id);
    const ms = this.meshes.get(id);
    if (ms) { ms.forEach(x => this._free(x)); this.meshes.delete(id); }
    // not here yet at all (worker mode: still in a parse worker's message): drop it when it comes
    if (!ms && !had) this.gone.add(id);
  }
  setVisible(id, on) {
    this.meshes.get(id)?.forEach(m => { m.visible = on; });
    this.pending?.forEach(e => { if (e[0] === id) e[1].hidden = !on; });
  }
  _free(m) {
    this.scene.remove(m);
    try { m._w?.free?.(); m.geometry?._w?.free?.(); m.geometry?._geom?.free?.(); } catch { }
  }

  setBackground(rgb) { this.scene.background = rgb; }
  resize(w, h, aspect) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** `time`: seconds on the page's clock (U.TIME, for the shaders' animations). */
  render(time) {
    if (!this.ready) return;
    const p = this.pending;
    if (p?.length) {
      const t0 = performance.now();
      let verts = 0;
      do {
        const [id, m] = p.shift();
        this._upload(id, m);
        verts += m.pos.length / 3;
      } while (p.length && verts + p[0][1].pos.length / 3 <= UPLOAD_VERTS && performance.now() - t0 < UPLOAD_MS);
      this.uploadMs = Math.max(this.uploadMs || 0, performance.now() - t0);
    }
    const tr = performance.now();
    this.uniforms[U.TIME] = time;
    this.buildingMat.setUniforms(this.uniforms);
    this.renderer.render(this.scene, this.camera);
    this.drawMs = Math.max(this.drawMs || 0, performance.now() - tr);
    if ((this.firstDraws ||= []).length < 20) this.firstDraws.push([Math.round(performance.now()), +(performance.now() - tr).toFixed(1), this.meshes.size]);
  }
}

async function wasmSource(o) {
  const url = `./${o.variant}/pkg/threers_bg.wasm`;
  if (!o.gz) return url;
  // a static site ships the wasm gzipped (see dataurl.js); unpacked into a streaming Response
  const r = await fetch(url + '.gz');
  if (!r.ok) throw new Error(`${url}.gz: HTTP ${r.status}`);
  return new Response(r.body.pipeThrough(new DecompressionStream('gzip')), { headers: { 'content-type': 'application/wasm' } });
}
