self.onmessage = async ({ data: { canvas, gl } }) => {
  try {
    const variant = gl ? 'threers-gl' : 'threers';
    const mod = await import(`../../${variant}/threejs-shim.js`);
    await mod.initThreers({ module_or_path: `../../${variant}/pkg/threers_bg.wasm` });
    const T = mod.default;
    const r = await T.WebGLRenderer.create(canvas);
    r.setSize(400, 300, false);
    const scene = new T.Scene(), cam = new T.PerspectiveCamera(50, 4 / 3, 0.1, 100);
    cam.position.set(2, 2, 3); cam.lookAt(0, 0, 0);
    scene.add(new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ color: 0xff3300 })));
    let n = 0; const t0 = performance.now();
    const f = () => { r.render(scene, cam); if (++n < 60) requestAnimationFrame(f); else self.postMessage({ ok: true, frames: n, ms: Math.round(performance.now() - t0) }); };
    requestAnimationFrame(f);
  } catch (e) { self.postMessage({ ok: false, error: String(e && e.stack || e) }); }
};
