// Headless-Chrome check of the map: screenshots + console errors + frame times.
//   node tools/shoot.cjs [--city sf] [--gl] [--port 8123] [--out shots] [--only overview,downtown]
//   [--view '#x,z,distance,azimuth,elevation' (the downtown shot's camera)] [--name downtown] [--year 1990]
// Needs the dev server running (./serve.sh) and puppeteer-core (taken from the threers checkout,
// read-only, unless PUPPETEER points elsewhere) plus a local Chrome.
const path = require('path');
const fs = require('fs');
const puppeteer = require(process.env.PUPPETEER || '/Users/Shared/threers/web/node_modules/puppeteer-core');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const flag = k => args.includes('--' + k);
const city = opt('city', 'sf'), gl = flag('gl'), port = opt('port', '8123');
const out = path.resolve(__dirname, '..', opt('out', 'shots'));
const only = opt('only', '');
const W = +opt('width', 1440), H = +opt('height', 900);
const views = {
  sf: {
    downtown: '#1650,-1250,1500,25,38',
    hills: '#-2400,2000,3200,-20,28',
    hover: [W * 0.5, H * 0.5],
  },
  nyc: { downtown: '#-1200,3500,2500,30,40', hover: [W * 0.5, H * 0.5] },
  boston: { downtown: '#200,-200,1800,20,40', hover: [W * 0.5, H * 0.5] },
  bay: { downtown: '#1650,-1250,2500,25,40', hover: [W * 0.5, H * 0.5] },
}[city] || {};
if (opt('view')) views.downtown = opt('view');
fs.mkdirSync(out, { recursive: true });
const tag = `${city}${gl ? '-gl' : ''}`;
const want = s => !only || only.split(',').includes(s);

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: [
      '--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--ignore-gpu-blocklist',
      '--enable-gpu', '--use-angle=metal', `--window-size=${W},${H}`,
      ...(flag('uncapped') ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : []),
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', m => { const t = `${m.type()}: ${m.text()}`; logs.push(t); if (m.type() === 'error' || m.type() === 'warning' || /\[city\]/.test(t)) console.log('  page', t); });
  page.on('pageerror', e => { logs.push('pageerror: ' + e.message); console.log('  pageerror', e.message); });
  const url = `http://localhost:${port}/?city=${city}${gl ? '&gl=1' : ''}${opt('extra', '')}`;
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__city && (window.__city.ready || window.__city.errors.length > 3), { timeout: 240000, polling: 500 });
  const st0 = await page.evaluate(() => ({ backend: __city.backend, ready: __city.ready, errors: __city.errors, packs: __city.loadedPacks, verts: __city.loadedVerts, readyAt: __city.readyAt }));
  console.log(`${tag}: ready in ${((Date.now() - t0) / 1000).toFixed(1)} s`, JSON.stringify(st0));
  await new Promise(r => setTimeout(r, +opt('settle', 2500)));

  const measure = async (label) => {
    const r = await page.evaluate(() => new Promise(res => {
      const ts = []; const t0 = performance.now();
      const f = t => { ts.push(t); if (t - t0 < 5000) requestAnimationFrame(f); else res(ts); };
      requestAnimationFrame(f);
    }).then(ts => {
      const d = []; for (let i = 1; i < ts.length; i++) d.push(ts[i] - ts[i - 1]);
      d.sort((a, b) => a - b);
      const mean = d.reduce((a, b) => a + b, 0) / d.length;
      return { frames: d.length, fps: 1000 / mean, mean, p50: d[d.length >> 1], p95: d[Math.floor(d.length * 0.95)], max: d[d.length - 1] };
    }));
    console.log(`${tag} frame times [${label}]: ${r.frames} frames, ${r.fps.toFixed(1)} fps, mean ${r.mean.toFixed(1)} ms, p50 ${r.p50.toFixed(1)}, p95 ${r.p95.toFixed(1)}, max ${r.max.toFixed(1)}`);
    return r;
  };
  const shot = async name => { const f = path.join(out, `${tag}-${name}.png`); await page.screenshot({ path: f }); console.log('  wrote', f); };
  const settle = ms => new Promise(r => setTimeout(r, ms));
  const goView = async h => {
    await page.evaluate(h => { location.hash = h; }, h);
    await settle(800);
    await page.waitForFunction(() => !document.querySelector('#loading') || true, { timeout: 5000 });
    // wait for any new packs to arrive
    for (let i = 0; i < 60; i++) {
      const busy = await page.evaluate(() => __city.M.packs.some(p => p.state === 'loading'));
      if (!busy) break; await settle(500);
    }
    await settle(1200);
  };
  const perf = {};
  if (want('overview')) { await shot('overview'); perf.overview = await measure('overview'); }
  if (want('downtown') && views.downtown) {
    await goView(views.downtown);
    if (opt('year')) { await page.evaluate(y => __city.setYear(y), +opt('year')); await settle(900); }
    await shot(opt('name', 'downtown')); perf.downtown = await measure('downtown');
  }
  if (want('hover') && views.hover) {
    if (!want('downtown')) await goView(views.downtown);
    const [x, y] = views.hover;
    await page.mouse.move(x - 40, y - 30); await settle(200);
    await page.mouse.move(x, y); await settle(900);
    const gid = await page.evaluate(([x, y]) => { const h = __city.pickAt(x, y); return h && h.gid; }, [x, y]);
    console.log('  hover gid', gid);
    await settle(800);
    await page.mouse.move(x + 1, y); await settle(500);
    await shot('hover');
  }
  if (want('y1906')) {
    await page.mouse.move(5, 5);
    await page.evaluate(() => { location.hash = ''; });
    await goView('#' + await page.evaluate(() => { const v = __city.homeView(); return [v.x, v.z, v.distance, 0, 55].map(n => n.toFixed(0)).join(','); }));
    await page.evaluate(() => __city.setYear(1906));
    await settle(700);
    await shot('y1906');
    await page.evaluate(() => __city.setYear(9999));
  }
  if (want('hills') && views.hills) {
    await goView(views.hills);
    await shot('hills');
  }
  if (want('play')) {
    await page.mouse.move(5, 5);
    await goView('#' + await page.evaluate(() => { const v = __city.homeView(); return [v.x, v.z, v.distance, 0, 55].map(n => n.toFixed(0)).join(','); }));
    await page.evaluate(() => { __city.setYear(1930); __city.startPlay(); });
    await settle(2500);
    await shot('play');
    await page.evaluate(() => { __city.stopPlay(); __city.setYear(9999); });
  }
  if (want('legend')) {
    // click the "Boom twenties" swatch: that period alone
    await page.evaluate(() => document.querySelectorAll('.swatch')[2].click());
    await settle(600);
    await shot('legend');
    await page.evaluate(() => document.querySelectorAll('.swatch')[2].click());
  }
  if (want('sources')) {
    await page.evaluate(() => __city.setMode(3));
    await settle(700);
    await shot('sources');
    await page.evaluate(() => __city.setMode(0));
  }
  if (want('floors')) {
    await page.evaluate(() => __city.setMode(1));
    await settle(700);
    await shot('floors');
    await page.evaluate(() => __city.setMode(0));
  }
  if (want('home')) {
    await page.evaluate(() => { history.replaceState(null, '', location.pathname + location.search); });
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.__city && window.__city.ready, { timeout: 240000, polling: 500 });
    await settle(2500);
    await shot('home');
  }
  const st = await page.evaluate(() => ({ errors: __city.errors, packs: __city.loadedPacks, verts: __city.loadedVerts, backend: __city.backend, mem: performance.memory && { used: performance.memory.usedJSHeapSize } }));
  const errs = logs.filter(l => /^(error|pageerror)/.test(l));
  console.log(`${tag} summary`, JSON.stringify({ ...st, consoleErrors: errs.length }));
  fs.writeFileSync(path.join(out, `${tag}-report.json`), JSON.stringify({ url, status: st, perf, logs }, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
