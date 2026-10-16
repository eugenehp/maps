// Colour schemes: the page's ground, sky and UI, and the building palettes of each mode.
// Picked with ?scheme=<id>, else the last one chosen (localStorage), else 'classic'.
//
//   periods  null = the colours the city's manifest names (pipeline model.rs), else a ramp
//            (oldest -> newest) sampled at as many periods as the city has
//   floors   4 stops of the storeys ramp (1 -> 40+ floors, log scale; shaders.js floors_ramp)
//   uses     residential, commercial, industrial, civic, mixed, other
//   sources  year sources, in manifest order (up to SOURCE_SLOTS)
//   ui       CSS custom properties (styles.css)
// Occupancy layer colours come with the layers (layers.json) and are the same in every scheme.

export const SOURCE_SLOTS = 26;   // palette 22..47, see shaders.js

const hex = h => { const v = parseInt(h.replace('#', ''), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; };
const toHex = c => '#' + c.map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
function lift(h, t) { return toHex(hex(h).map(x => x + (255 - x) * t)); }

const CLASSIC_SOURCES = ['#3b5ba9', '#e8743b', '#7cc49a', '#c0392b', '#f2b134', '#8e7cc3', '#3c9dbb', '#7f1d3f',
  '#d9d56a', '#00909a', '#8c5a2b', '#d6336c', '#5b8c5a', '#a05195', '#ff7c43', '#2f4b7c', '#ffa600', '#93a8ac',
  '#b56576', '#6d597a', '#90be6d', '#355070', '#e56b6f', '#43aa8b', '#c9a227', '#5e548e'];

export const SCHEMES = [
  {
    id: 'classic', name: 'Classic',
    // a white architectural model under a pale sky, after LAYRS: Amsterdam
    sky: '#e4e8ea', land: '#f4f3ef', water: '#b5c7c6', park: '#dde6d0', pale: '#efeee9', unknown: '#8c8c8c',
    periods: null,
    floors: ['#dbe3e6', '#7da8bf', '#2b5c8c', '#0d1a40'],
    uses: ['#f2c76b', '#d9534f', '#8e7cc3', '#3d8fc6', '#f08a4b', '#b8b8b0'],
    sources: CLASSIC_SOURCES,
    ui: { paper: '#ffffff', ink: '#000000', muted: '#5d6266', rule: '#cfd5d8', accent: '#c0392b' },
  },
  {
    id: 'colorblind', name: 'Colour-blind safe',
    // periods on viridis (ordered by lightness, readable with any colour vision), uses and
    // sources from Okabe & Ito and Paul Tol's sets
    sky: '#e4e8ea', land: '#f4f3ef', water: '#b9c9d6', park: '#e2e6d4', pale: '#efeee9', unknown: '#9a9a9a',
    periods: ['#440154', '#46327e', '#365c8d', '#277f8e', '#1fa187', '#4ac16d', '#a0da39', '#fde725'],
    floors: ['#f0eadc', '#c9b98a', '#7d7a5c', '#2b3a55'],
    uses: ['#e69f00', '#d55e00', '#cc79a7', '#0072b2', '#009e73', '#bdbdb5'],
    sources: ['#0072b2', '#e69f00', '#009e73', '#cc79a7', '#56b4e9', '#d55e00', '#f0e442', '#332288', '#88ccee',
      '#44aa99', '#117733', '#999933', '#ddcc77', '#cc6677', '#882255', '#aa4499', '#6699cc', '#997700',
      '#004488', '#ee99aa', '#bbbbbb', '#994455', '#66ccee', '#228833', '#ccbb44', '#ee6677'],
    ui: { paper: '#ffffff', ink: '#000000', muted: '#5d6266', rule: '#cfd5d8', accent: '#0072b2' },
  },
  {
    id: 'night', name: 'Night',
    // dark ground and sky, the palettes lifted so the oldest periods still read
    sky: '#171b20', land: '#24282d', water: '#121d24', park: '#243327', pale: '#3b4046', unknown: '#62666b',
    periods: ['#b8407a', '#e2504f', '#f07c3e', '#f4ad42', '#e3d65c', '#8fd28a', '#52b9cf', '#7393ec'],
    floors: ['#5a6874', '#5f8fae', '#93c5e3', '#f2f8fc'],
    uses: ['#f5cf7a', '#e86a66', '#a593d6', '#5aa6dc', '#f39a60', '#7d7f80'],
    sources: CLASSIC_SOURCES.map(c => lift(c, 0.22)),
    ui: { paper: '#22272d', ink: '#f2f3f4', muted: '#9aa1a7', rule: '#3a4148', accent: '#ef6b5b' },
  },
];

export function pickScheme(Q) {
  const want = Q.get('scheme') || (() => { try { return localStorage.getItem('scheme'); } catch { return null; } })();
  return SCHEMES.find(s => s.id === want) || SCHEMES[0];
}
export function rememberScheme(s) {
  try { localStorage.setItem('scheme', s.id); } catch { }
}

/** `n` colours along `stops` (evenly spaced, linear in sRGB). */
export function ramp(stops, n) {
  if (n <= 1) return [stops[stops.length - 1]];
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1) * (stops.length - 1), k = Math.min(stops.length - 2, Math.floor(t)), f = t - k;
    const a = hex(stops[k]), b = hex(stops[k + 1]);
    return toHex(a.map((x, j) => x + (b[j] - x) * f));
  });
}

/** The colour of each of a city's periods under scheme `s`. */
export function periodColors(s, periods) {
  return s.periods ? ramp(s.periods, periods.length) : periods.map(p => p.dataColor || p.color);
}
