// (Runs with &inline: it reads the renderer's counters, which live in the render worker otherwise.)
// Fly NYC around so packs stream in and out; check that GPU geometries and scene objects
// track what is loaded (threers frees removed meshes) and the vertex budget holds.
const puppeteer = require(process.env.PUPPETEER || '/Users/Shared/threers/web/node_modules/puppeteer-core');
const city = process.argv[2] || 'nyc', gl = process.argv.includes('--gl');
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', protocolTimeout: 300000,
    args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--ignore-gpu-blocklist', '--use-angle=metal'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://localhost:8123/?city=${city}&inline${gl ? '&gl=1' : ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__city && window.__city.ready, { timeout: 120000 });
  const snap = () => page.evaluate(() => ({
    chunks: __city.chunks.size, verts: __city.loadedVerts,
    gpuGeoms: __city.renderer._w.cachedGeometryCount?.(), objects: __city.scene._w.objectCount?.(),
    heap: Math.round(performance.memory.usedJSHeapSize / 1e6),
  }));
  console.log('start', JSON.stringify(await snap()));
  const spots = city === 'nyc'
    ? [[-15000, 18000, 3000], [6000, -16000, 3000], [15000, 8000, 3000], [-1200, 3500, 3000], [-15000, 18000, 3000], [0, 0, 14000]]
    : [[0, 0, 3000], [30000, 30000, 3000], [-30000, -40000, 3000], [0, 0, 14000]];
  for (const [x, z, d] of spots) {
    await page.evaluate(([x, z, d]) => { location.hash = `#${x},${z},${d},0,50`; }, [x, z, d]);
    await new Promise(r => setTimeout(r, 1500));
    for (let i = 0; i < 120; i++) {
      const busy = await page.evaluate(() => __city.M.packs.some(p => p.state === 'loading'));
      if (!busy) break; await new Promise(r => setTimeout(r, 250));
    }
    await new Promise(r => setTimeout(r, 1000));
    console.log(`at ${x},${z},${d}`, JSON.stringify(await snap()));
  }
  console.log('errors', errors.length, errors.slice(0, 5));
  await browser.close();
})();
