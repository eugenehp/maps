// The render worker: owns the map's canvas (an OffscreenCanvas from the page) and draws it with
// render-core.js on its own frame loop, so neither page work (DOM, JSON, layers) nor mesh uploads
// on the page delay a frame. The page sends calls as { op, args }; parse workers send finished
// pack meshes straight here through a MessagePort (worker.js), never through the page.
//
// Clock: the page stamps animation times (U.TIME, the layer / mode / mask start times) on its own
// performance.now(); this worker converts its clock to the page's with the two time origins.

import { RenderCore } from './render-core.js';

const core = new RenderCore();
// index.html creates this worker before app.js has loaded, naming the build: fetch and compile
// it now, so only the device is left to do when the canvas arrives
{
  const q = new URL(self.location.href).searchParams;
  if (q.get('variant')) core.preload({ variant: q.get('variant'), gz: q.get('gz') === '1', hideGpu: q.get('hide') === '1' }).catch(() => { });
}
let ready = false, pageOrigin = 0, frames = 0, lastStat = 0;
const queue = [];   // calls that arrive before init finishes
const times = [];

// Calls wait until the device is up (start) and the scene exists (setup); meshes from parse
// workers come on their own ports and can overtake the page's setup message.
// render on demand (see app.js): anything that changes the picture keeps the fallback loop
// drawing for WAKE_MS; pending uploads keep it drawing until they are in
const WAKE_MS = 1200;
let awakeUntil = 0;
function call(op, args) {
  awakeUntil = performance.now() + WAKE_MS;
  if (!ready || (!core.ready && op !== 'setup')) { queue.push([op, args]); return; }
  core[op](...args);
  if (op === 'setup') flush();
}
function flush() {
  const q = queue.splice(0);
  for (const [op, args] of q) call(op, args);
}

function listen(port) {
  port.onmessage = ({ data }) => {
    if (data.op === 'port') { listen(data.port); return; }
    if (data.op === 'frame') return;   // handled below
    if (data.op === 'start') {
      pageOrigin = data.args[0].timeOrigin;
      core.start(data.args[0]).then(info => {
        ready = true;
        flush();
        postMessage({ op: 'ready', info });
        requestAnimationFrame(tick);
      }, e => postMessage({ op: 'error', error: String(e && e.stack || e) }));
      return;
    }
    try { call(data.op, data.args); } catch (e) { postMessage({ op: 'error', error: `${data.op}: ${e && e.stack || e}` }); }
  };
}
listen(self);

// Frames follow the page's: it sends { op: 'frame' } (with its state) on each of its animation
// frames, and the worker draws on receipt, in step with the page and the display. When the page
// goes quiet (busy, or a background tab) for FALLBACK_MS, the worker's own loop keeps drawing.
const FALLBACK_MS = 50;
let lastPageFrame = 0;
function tick(now) {
  requestAnimationFrame(tick);
  if (now - lastPageFrame > FALLBACK_MS && (now < awakeUntil || core.pending?.length)) draw(now);
}
self.addEventListener('message', ({ data }) => {
  if (data.op !== 'frame' || !ready || !core.ready) return;
  lastPageFrame = performance.now();
  draw(lastPageFrame);
});
function draw(now) {
  const pageNow = performance.timeOrigin + now - pageOrigin;
  core.render(pageNow / 1000);
  frames++;
  times.push(now);
  if (times.length > 240) times.splice(0, 120);
  if (now - lastStat > 1000) {
    lastStat = now;
    postMessage({ op: 'stats', frames, times: times.slice(-121), uploadMs: core.uploadMs || 0, drawMs: core.drawMs || 0, pending: core.pending?.length || 0, firstDraws: core.firstDraws });
    core.uploadMs = core.drawMs = 0;
  }
}
