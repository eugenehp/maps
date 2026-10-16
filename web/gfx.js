// The page's handle on the renderer (render-core.js): in a worker that owns the canvas when the
// browser can (OffscreenCanvas + a GPU device in a worker), else on the page. Same calls either way;
// in worker mode they are messages, and mesh buffers are transferred, not copied.
//
//   const gfx = await createGfx(canvas, opts, { worker: true })    shim, wasm, device: at page start
//   gfx.setup(sceneOpts)                                          scene, materials: with the manifest
//   gfx.mode: 'worker' | 'inline';  gfx.info: { backend, msaa, variant, startup }
//   gfx.port(): a MessagePort to the render worker (parse workers post meshes on it), or null
//   gfx.onStats = ({ frames, times }) => …   (worker mode: its frame times, once a second)

import { RenderCore } from './render-core.js';

const meshBuffers = m => (m.parts || [m]).flatMap(q => [q.pos, q.uv, q.nrm, q.idx]).filter(Boolean).map(a => a.buffer);

export async function createGfx(canvas, opts, { worker = true } = {}) {
  if (worker && typeof OffscreenCanvas !== 'undefined' && canvas.transferControlToOffscreen) {
    try { return await workerGfx(canvas, opts); } catch (e) {
      console.warn('[city] render worker failed, rendering on the page', e);
      // the canvas's control went to the worker: the page needs a new one
      const c2 = canvas.cloneNode(false); canvas.replaceWith(c2); canvas = c2;
    }
  }
  return inlineGfx(canvas, opts);
}

async function workerGfx(canvas, opts) {
  // started by index.html (already fetching the renderer) when it could, else now
  const w = globalThis.__renderWorker || new Worker('render-worker.js', { type: 'module' });
  const off = canvas.transferControlToOffscreen();
  const info = await new Promise((ok, fail) => {
    const t = setTimeout(() => fail(new Error('render worker: no answer in 15 s')), 15000);
    w.onmessage = ({ data }) => {
      if (data.op === 'ready') { clearTimeout(t); ok(data.info); }
      else if (data.op === 'error') { clearTimeout(t); fail(new Error(data.error)); }
    };
    w.onerror = e => { clearTimeout(t); fail(new Error(e.message || 'render worker error')); };
    const variant = !opts.forceGl && navigator.gpu ? 'threers' : 'threers-gl';
    w.postMessage({ op: 'start', args: [{ ...opts, variant, hideGpu: !!opts.forceGl, canvas: off, timeOrigin: performance.timeOrigin }] }, [off]);
  });
  const g = {
    mode: 'worker', info, canvas, onStats: null,
    _post(op, args, transfer) { w.postMessage({ op, args }, transfer || []); },
    setup(o) { g._post('setup', [o]); },
    state(s) { g._post('state', [s]); },
    setStorage(slot, data) { g._post('setStorage', [slot, data]); },
    setStorageRange(slot, off, data) { g._post('setStorageRange', [slot, off, data]); },
    attrsRuns(runs) { g._post('attrsRuns', [runs]); },
    addMesh(id, m) { g._post('addMesh', [id, m], meshBuffers(m)); },
    removeMesh(id) { g._post('removeMesh', [id]); },
    setVisible(id, on) { g._post('setVisible', [id, on]); },
    setBackground(rgb) { g._post('setBackground', [rgb]); },
    setMsaa(samples) { g._post('setMsaa', [samples]); },
    resize(wd, ht, aspect) { g._post('resize', [wd, ht, aspect]); },
    render() { w.postMessage({ op: 'frame' }); },   // the worker draws when this arrives
    port() { const ch = new MessageChannel(); w.postMessage({ op: 'port', port: ch.port2 }, [ch.port2]); return ch.port1; },
  };
  w.onmessage = ({ data }) => {
    if (data.op === 'stats') g.onStats?.(data);
    else if (data.op === 'error') { console.error('[render worker]', data.error); g.onError?.(data.error); }
  };
  return g;
}

async function inlineGfx(canvas, opts) {
  const make = async (variant, c) => {
    const core = new RenderCore();
    const info = await core.start({ ...opts, variant, canvas: c });
    return { core, info };
  };
  let r;
  if (opts.forceGl) { try { Object.defineProperty(navigator, 'gpu', { get: () => undefined, configurable: true }); } catch { } }
  if (!opts.forceGl && navigator.gpu) {
    try { r = await make('threers', canvas); } catch (e) {
      console.warn('WebGPU renderer failed, falling back to WebGL2', e);
      // a canvas that handed out a webgpu context can never give webgl2: replace it
      const c2 = canvas.cloneNode(false); canvas.replaceWith(c2); canvas = c2;
      try { Object.defineProperty(navigator, 'gpu', { get: () => undefined, configurable: true }); } catch { }
    }
  }
  if (!r) r = await make('threers-gl', canvas);
  const { core, info } = r;
  return {
    mode: 'inline', info, canvas, core,
    setup: o => core.setup(o),
    state: s => core.state(s),
    setStorage: (slot, data) => core.setStorage(slot, data),
    setStorageRange: (slot, off, data) => core.setStorageRange(slot, off, data),
    attrsRuns: runs => core.attrsRuns(runs),
    addMesh: (id, m) => core.addMesh(id, m),
    removeMesh: id => core.removeMesh(id),
    setVisible: (id, on) => core.setVisible(id, on),
    setBackground: rgb => core.setBackground(rgb),
    setMsaa: samples => core.setMsaa(samples),
    resize: (w, h, aspect) => core.resize(w, h, aspect),
    render: time => core.render(time),
    port: () => null,
  };
}
