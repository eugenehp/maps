// Headless check of the occupancy layers: Layers mode screenshot, a click card with occupants,
// and a browser-mark round trip (mark -> reload -> still there -> export content).
//   node tools/layers-test.cjs [--city sf] [--view '#x,z,dist,az,el'] [--port 8123]
const path = require('path');
const fs = require('fs');
const puppeteer = require(process.env.PUPPETEER || '/Users/Shared/threers/web/node_modules/puppeteer-core');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const city = opt('city', 'sf'), port = opt('port', '8123');
const view = opt('view', { sf: '#1900,-900,2600,25,40', bay: '#-38500,47000,9000,0,45', boston: '#-3000,-2300,2600,20,40', nyc: '#-1200,3500,2500,30,40' }[city]);
const out = path.resolve(__dirname, '..', 'shots');
fs.mkdirSync(out, { recursive: true });
const W = 1440, H = 900;
const settle = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=metal', `--window-size=${W},${H}`],
    userDataDir: path.join(require('os').tmpdir(), `layers-test-${city}`),   // IndexedDB survives the reload
  });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H });
  const errors = [];
  page.on('pageerror', e => { errors.push(e.message); console.log('  pageerror', e.message); });
  page.on('console', m => { if (m.type() === 'error') { errors.push(m.text()); console.log('  console', m.text()); } });
  const url = `http://localhost:${port}/?city=${city}${view}`;
  const load = async () => {
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__city && window.__city.ready, { timeout: 240000, polling: 500 });
    await settle(2000);
  };
  await load();
  // clear marks left over from an earlier run
  await page.evaluate(() => new Promise(r => { const q = indexedDB.deleteDatabase('city-marks'); q.onsuccess = q.onerror = q.onblocked = r; }));
  await load();

  // Layers mode
  await page.click('.modes button[data-mode="4"]');
  await page.waitForFunction(() => document.querySelector('#panel-body .layer-cat'), { timeout: 60000 });
  await settle(2500);
  await page.screenshot({ path: path.join(out, `${city}-layers.png`) });
  const panel = await page.evaluate(() => document.querySelector('#panel-body h2').textContent + ' | ' + document.querySelector('#panel-body .note').textContent);
  console.log('panel:', panel);

  // click the centre building, mark it
  // a building near the centre, preferring one that has occupants
  const [px, py, gid] = await page.evaluate(([W, H]) => {
    let any = null;
    for (let r = 0; r < 300; r += 12) for (let a = 0; a < 6.28; a += 0.5) {
      const x = W / 2 + r * Math.cos(a), y = H / 2 + r * Math.sin(a), h = __city.pickAt(x, y);
      if (!h) continue;
      if (__city.layers.itemsOf(h.gid).length) return [x, y, h.gid];
      any = any || [x, y, h.gid];
    }
    return any || [W / 2, H / 2, -1];
  }, [W, H]);
  console.log('picked gid', gid, 'at', Math.round(px), Math.round(py));
  await page.mouse.click(px, py);
  await settle(1500);
  await page.screenshot({ path: path.join(out, `${city}-layers-card.png`) });
  const occupants = await page.evaluate(() => [...document.querySelectorAll('#card .occupants li')].map(li => li.textContent.replace(/\s+/g, ' ').trim()));
  console.log('occupants:', occupants.slice(0, 5));
  await page.$eval('#card .mark-open', b => b.click());
  await page.type('#card [name=name]', 'Test Robotics');
  await page.select('#card [name=cat]', 'new');
  await page.type('#card [name=newcat]', 'MIT spinouts');
  await page.type('#card [name=from]', '2019');
  await page.type('#card [name=tags]', 'mit-spinout, test');
  await page.$eval('#card [data-act=save]', b => b.click());
  await settle(1200);
  const afterSave = await page.evaluate(() => [...document.querySelectorAll('#card .occupants li')].map(li => li.textContent.replace(/\s+/g, ' ').trim()));
  console.log('after save:', afterSave.filter(t => /Test Robotics/.test(t)));

  // reload: still there?
  await load();
  await page.click('.modes button[data-mode="4"]');
  await page.waitForFunction(() => document.querySelector('#panel-body .layer-cat'), { timeout: 60000 });
  await settle(1500);
  const persisted = await page.evaluate(() => document.querySelector('#panel-body').textContent.includes('MIT spinouts'));
  console.log('persisted after reload:', persisted);
  await page.mouse.click(px, py);
  await settle(1200);
  await page.screenshot({ path: path.join(out, `${city}-layers-mark.png`) });
  const card = await page.evaluate(() => document.querySelector('#card').textContent.includes('Test Robotics'));
  console.log('mark on card after reload:', card);

  // export content (intercept the download by calling the exporter directly)
  const doc = await page.evaluate(async () => {
    const orig = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () {};
    try { return await __city.layers.exportMarks(); } finally { HTMLAnchorElement.prototype.click = orig; }
  });
  console.log('backend:', await page.evaluate(() => __city.api || 'static'));
  console.log('export:', JSON.stringify(doc).slice(0, 400));
  // remove the test mark again, so the API's marks database keeps only real ones
  const removed = await page.evaluate(async () => {
    if (!__city.api) return 0;
    const base = `${__city.api}/cities/${__city.city}/marks`;
    const list = await (await fetch(base)).json();
    let n = 0;
    for (const m of list.filter(m => m.name === 'Test Robotics')) {
      if ((await fetch(`${base}/${encodeURIComponent(m.id.replace(/^mark:/, ''))}`, { method: 'DELETE' })).ok) n++;
    }
    return n;
  });
  console.log('test marks removed:', removed);
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
