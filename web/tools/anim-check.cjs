// Captures frames mid-animation (timeline glide, mode cross-fade, period toggle) to /tmp/anim-*.png.
//   node tools/anim-check.cjs   (API server on :8123)
const puppeteer = require(process.env.PUPPETEER || '/Users/Shared/threers/web/node_modules/puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
    args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=metal', '--window-size=1200,760'] });
  const p = await b.newPage(); await p.setViewport({ width: 1200, height: 760 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8123/?city=nyc#3040,211,1100,210,40', { waitUntil: 'load' });
  await p.waitForFunction(() => window.__city && __city.ready, { timeout: 120000 });
  await new Promise(r => setTimeout(r, 2500));
  const w = ms => new Promise(r => setTimeout(r, ms));
  await p.evaluate(() => __city.setYear(1995)); await w(800);
  await p.evaluate(() => __city.glideTo(2026)); await w(180);
  await p.screenshot({ path: '/tmp/anim-glide.png' });
  await w(1500);
  await p.evaluate(() => __city.setMode(1)); await w(200);
  await p.screenshot({ path: '/tmp/anim-mode.png' });
  await w(800); await p.evaluate(() => __city.setMode(0)); await w(800);
  await p.evaluate(() => __city.setMask(1 << 2)); await w(230);
  await p.screenshot({ path: '/tmp/anim-mask.png' });
  console.log('errors', JSON.stringify(errs));
  await b.close();
})();
