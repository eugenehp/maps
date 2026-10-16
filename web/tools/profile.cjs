// Main-thread profile: long tasks during load and while the camera turns, and frame times.
//   node tools/profile.cjs [--city nyc] [--port 8123] [--extra '&gl=1'] [--latency 80 --mbps 50]
const puppeteer = require(process.env.PUPPETEER || '/Users/Shared/threers/web/node_modules/puppeteer-core');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
(async () => {
  const city = opt('city', 'nyc'), port = opt('port', '8123');
  const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
    args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=metal', '--window-size=1440,900'] });
  const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
  await p.evaluateOnNewDocument(() => {
    window.__long = [];
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__long.push([Math.round(e.startTime), Math.round(e.duration), e.name]); }).observe({ type: 'longtask', buffered: true });
  });
  // --latency ms --mbps n: a real network (Chrome's throttling)
  if (opt('latency')) {
    const c = await p.createCDPSession(); await c.send('Network.enable');
    const bps = (+opt('mbps', 50)) * 1e6 / 8;
    await c.send('Network.emulateNetworkConditions', { offline: false, latency: +opt('latency'), downloadThroughput: bps, uploadThroughput: bps / 4 });
  }
  const t0 = Date.now();
  await p.goto(`http://localhost:${port}/?city=${city}${opt('extra', '')}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__city && __city.ready, { timeout: 120000, polling: 100 });
  const ready = await p.evaluate(() => ({ readyAt: __city.readyAt, startup: __city.startup }));
  await new Promise(r => setTimeout(r, 6000));
  const loadLong = await p.evaluate(() => window.__long.splice(0));
  // turn the camera for 4 s, one step a frame, and hover
  const spin = await p.evaluate(() => new Promise(res => {
    const cam = __city.mapCam, ts = []; const t0 = performance.now();
    const f = t => { ts.push(t); const pose = { ...cam.goal }; pose.azimuth += 0.012; cam.setView(pose, true);
      if (t - t0 < 4000) requestAnimationFrame(f); else res(ts); };
    requestAnimationFrame(f);
  }).then(ts => { const d = []; for (let i = 1; i < ts.length; i++) d.push(ts[i] - ts[i - 1]); d.sort((a, b) => a - b);
    return { frames: d.length, p50: d[d.length >> 1], p95: d[Math.floor(d.length * 0.95)], max: d[d.length - 1], over20: d.filter(x => x > 20).length }; }));
  const spinLong = await p.evaluate(() => window.__long.splice(0));
  // worker mode: the render worker's own frame times (the page's loop no longer draws)
  const render = await p.evaluate(() => {
    const t = __city.renderFrameTimes || []; const d = [];
    for (let i = 1; i < t.length; i++) d.push(t[i] - t[i - 1]); d.sort((a, b) => a - b);
    return d.length ? { mode: __city.renderMode, stats: __city.renderStats?.slice(-12), frames: d.length, p50: d[d.length >> 1], p95: d[Math.floor(d.length * 0.95)], max: d[d.length - 1], over20: d.filter(x => x > 20).length } : { mode: __city.renderMode };
  });
  const sum = l => l.reduce((s, x) => s + x[1], 0);
  console.log(JSON.stringify({ city, wall: Date.now() - t0, ready, loadLong: { n: loadLong.length, ms: sum(loadLong), top: loadLong.sort((a, b) => b[1] - a[1]).slice(0, 8) }, spin, render, spinLong: { n: spinLong.length, ms: sum(spinLong), top: spinLong.slice(0, 8) } }, null, 1));
  await b.close();
})();
