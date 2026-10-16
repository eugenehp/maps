// The timeline histogram, drawn in a worker on an OffscreenCanvas: the page only posts what it
// shows (year, mask, mode, colours, size), and never pays for 2D canvas set-up or web-font text
// layout. The page keeps the numbers (year, count) and the pointer handling.
//
//   { op: 'init', canvas, years: [[year, n]], periods: [{from, to}], T0, T1, lastYear, fontCss }
//   { op: 'draw', w, h, dpr, Y, mask, mode, colors: { periods: [...], unknown, muted, ink } }

const FONT = '500 11px "Schibsted Grotesk", system-ui, sans-serif';
let C = null, ctx = null, D = null, last = null, fontReady = false;

self.onmessage = ({ data }) => {
  if (data.op === 'init') {
    C = data.canvas; ctx = C.getContext('2d'); D = data;
    D.yMax = Math.max(1, ...D.years.map(([, n]) => n));
    loadFont(data.fontCss);
  } else if (data.op === 'draw') {
    last = data;
    draw(data);
  }
};

// the page's web font, for the year labels: the same face its CSS loads, fetched here
async function loadFont(cssUrl) {
  if (!cssUrl || !self.fonts || typeof FontFace === 'undefined') return;
  try {
    const css = await (await fetch(cssUrl)).text();
    const blocks = css.split('@font-face').filter(b => /font-weight:\s*500/.test(b));
    const latin = blocks.find(b => /U\+0000-00FF/.test(b)) || blocks[0];
    const url = latin?.match(/url\((https:[^)]+)\)/)?.[1];
    if (!url) return;
    const face = new FontFace('Schibsted Grotesk', `url(${url})`, { weight: '500' });
    self.fonts.add(await face.load());
    fontReady = true;
    if (last) draw(last);
  } catch { /* the fallback font is fine */ }
}

const periodOf = y => D.periods.findIndex(p => y >= p.from && y <= p.to);

function draw({ w, h, dpr, Y, mask, mode, colors }) {
  if (!ctx || !w || !h) return;
  if (C.width !== Math.round(w * dpr)) { C.width = Math.round(w * dpr); C.height = Math.round(h * dpr); }
  const { T0, T1 } = D;
  const xOf = y => (y - T0) / (T1 - T0) * w;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const plotH = h - 18, bw = Math.max(1, w / (T1 - T0));
  for (const [y, c] of D.years) {
    if (y < T0) continue;
    const i = periodOf(y);
    const on = y <= Y && (mode !== 0 || i < 0 || ((mask >> i) & 1));
    ctx.fillStyle = i >= 0 ? colors.periods[i] : colors.unknown;
    ctx.globalAlpha = on ? 1 : 0.18;
    const bh = Math.sqrt(c / D.yMax) * (plotH - 6);
    ctx.fillRect(xOf(y), plotH - bh, bw, bh);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = colors.muted;
  ctx.font = fontReady ? FONT : '500 11px system-ui, sans-serif';
  const step = w < 500 ? 50 : 25;
  for (let y = Math.ceil(T0 / step) * step; y <= T1; y += step) {
    ctx.fillRect(xOf(y), plotH, 1, 3);
    ctx.fillText(y, Math.min(w - 28, Math.max(0, xOf(y) - 13)), h - 3);
  }
  if (Y <= D.lastYear) { ctx.fillStyle = colors.ink; ctx.fillRect(xOf(Y) - 1, 0, 2, plotH); }
}
