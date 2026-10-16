// Service worker of the static site (registered from index.html only when window.__SITE.static):
// keeps what the map downloaded so a second visit comes from disk, and works offline.
//
//   data/<city>/...?v=<version>   cache-first, one cache per city and version; a new version
//                                 (a rebuilt city) replaces the old cache
//   data/<city>/index.json        network first (it names the version), the cached copy offline
//   everything else (the app)     cache-first per site build: build-site writes BUILD, so a
//                                 deploy installs a new worker and a fresh, consistent copy
const BUILD = '__BUILD__';
const SHELL = `shell-${BUILD}`;
const MANIFESTS = 'manifests';

self.addEventListener('install', () => { });
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('shell-') && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

const pruned = new Set();
async function dataCache(city, v) {
  const name = `data-${city}-${v}`;
  if (!pruned.has(city)) {
    pruned.add(city);
    for (const k of await caches.keys()) if (k.startsWith(`data-${city}-`) && k !== name) await caches.delete(k);
  }
  return caches.open(name);
}

async function cacheFirst(cache, req) {
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.status === 200) cache.put(req, res.clone()).catch(() => { });
  return res;
}

async function networkFirst(cacheName, req) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req, { cache: 'no-cache' });
    if (res.ok) cache.put(req, res.clone()).catch(() => { });
    return res;
  } catch (e) {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw e;
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const scope = new URL(self.registration.scope).pathname;
  const path = url.pathname.startsWith(scope) ? url.pathname.slice(scope.length) : url.pathname;
  const m = /^data\/([^/]+)\/(.*)$/.exec(path);
  if (m) {
    const v = url.searchParams.get('v');
    if (v) e.respondWith(dataCache(m[1], v).then(c => cacheFirst(c, req)));
    else e.respondWith(networkFirst(MANIFESTS, req));
    return;
  }
  e.respondWith(caches.open(SHELL).then(c => cacheFirst(c, req)));
});
