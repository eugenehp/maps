// Data URLs carry the build's version (`?v=`: the manifest's `version`, else its Last-Modified),
// so browsers (and the static site's service worker) can cache them for good: a rebuilt city
// gets new URLs, an unchanged one is never downloaded twice.
let version = '';
export function setDataVersion(v) { version = v ? encodeURIComponent(v) : ''; }
export function dataVersion() { return version; }
export function dataUrl(u) { return version ? `${u}${u.includes('?') ? '&' : '?'}v=${version}` : u; }

// Static hosting (GitHub Pages) sends .bin and .wasm uncompressed, so the site build publishes
// them gzipped (`name.bin.gz`) and the browser unpacks them. Set from `window.__SITE` (written
// into index.html by build-site.sh); off when the API server does HTTP compression itself.
const SITE = globalThis.__SITE || null;
export const GZ = !!(SITE && SITE.gz && typeof DecompressionStream !== 'undefined');
/** `url` with `.gz` before its query, when the site serves binaries gzipped. */
export function binUrl(url, gz = GZ) { return gz ? url.replace(/(\?|$)/, '.gz$1') : url; }

/** A binary data file's bytes, unpacked if it came as a .gz file (not if the server already did). */
export async function fetchBin(url, gz = GZ) {
  const r = await fetch(binUrl(url, gz));
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return gunzip(await r.arrayBuffer());
}
export async function gunzip(buf) {
  const b = new Uint8Array(buf, 0, Math.min(2, buf.byteLength));
  if (b[0] !== 0x1f || b[1] !== 0x8b) return buf;
  return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}
