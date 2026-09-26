/**
 * RICER Ifrane service worker. Hand-written, no workbox.
 *
 * Responsibilities:
 *  - precache the app shell so the reporting flow works offline;
 *  - cache-first for hashed /_next/static assets;
 *  - network-first for navigations, falling back to a cached copy of the
 *    page or /offline;
 *  - stale-while-revalidate for map tile hosts, with a bounded cache;
 *  - never cache /api/* except GET /api/uploads/* (photo bytes are
 *    immutable once uploaded);
 *  - on a `sync` event, just tell every open tab to run syncAll() — the
 *    auth cookies and IndexedDB logic live in the page, not here.
 */

const CACHE_VERSION = 'v3';
const SHELL_CACHE = `ricer-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `ricer-static-${CACHE_VERSION}`;
const TILE_CACHE = `ricer-tiles-${CACHE_VERSION}`;
const UPLOAD_CACHE = `ricer-uploads-${CACHE_VERSION}`;
const MAP_CACHE = `ricer-map-${CACHE_VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, STATIC_CACHE, TILE_CACHE, MAP_CACHE];

const APP_SHELL_URLS = [
  '/',
  '/offline',
  '/report',
  '/signin',
  '/manifest.json',
  '/favicon.ico',
  '/icon-16x16.png',
  '/icon-32x32.png',
  '/apple-touch-icon.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
];

const TILE_HOSTS = ['api.maptiler.com', 'tile.openstreetmap.org'];
const TILE_CACHE_MAX_ENTRIES = 300;
const MAP_ARCHIVE = '/maps/ifrane.pmtiles';
let savedMapBytes;
const MAP_OFFLINE_ASSETS = [
  '/maplibre/maplibre-gl-worker.mjs',
  ...['light', 'dark'].flatMap((theme) => ['', '@2x'].flatMap((scale) => [`/maps/sprites/${theme}${scale}.json`, `/maps/sprites/${theme}${scale}.png`])),
  ...['Noto Sans Regular', 'Noto Sans Medium', 'Noto Sans Italic'].flatMap((font) =>
    [0, 256, 512, 768, 1536, 1792, 2048].map((start) => `/maps/fonts/${encodeURIComponent(font)}/${start}-${start + 255}.pbf`)),
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.all(
        APP_SHELL_URLS.map(async (url) => {
          try {
            await cache.add(url);
          } catch (err) {
            // Don't let one missing/failed URL (e.g. a route that 404s in
            // this environment) abort precaching of the rest of the shell.
            console.warn('[sw] failed to precache', url, err);
          }
        })
      );
      self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('ricer-') && !CURRENT_CACHES.includes(name))
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  // Only pages of this app may control the worker.
  const sourceUrl = event.source && 'url' in event.source ? event.source.url : '';
  if (!sourceUrl || new URL(sourceUrl).origin !== self.location.origin) return;
  if (event.data?.type === 'skipWaiting') self.skipWaiting();
  if (event.data?.type === 'saveIfrane') {
    event.waitUntil((async () => {
      const reply = (message) => event.source?.postMessage({ type: 'saveIfraneStatus', ...message });
      try {
        const cache = await caches.open(MAP_CACHE);
        const archive = await fetch(MAP_ARCHIVE);
        if (!archive.ok || archive.status !== 200) throw new Error('Map archive unavailable');
        await cache.put(MAP_ARCHIVE, archive);
        savedMapBytes = undefined;
        reply({ state: 'assets', completed: 1, total: MAP_OFFLINE_ASSETS.length + 1 });
        let completed = 1;
        for (const asset of MAP_OFFLINE_ASSETS) {
          const response = await fetch(asset);
          if (!response.ok) throw new Error(`Map asset unavailable: ${asset}`);
          await cache.put(asset, response);
          completed += 1;
          reply({ state: 'assets', completed, total: MAP_OFFLINE_ASSETS.length + 1 });
        }
        reply({ state: 'saved', completed, total: completed });
      } catch (error) {
        reply({ state: 'error', message: error instanceof Error ? error.message : 'Offline map failed' });
      }
    })());
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag !== 'ricer-offline-sync') return;
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) client.postMessage({ type: 'ricer-offline-sync' });
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // never intercept POST /api/reports, /api/uploads, etc.

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // API responses can contain personal or operational data; do not cache them.
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  if (url.origin === self.location.origin && url.pathname === MAP_ARCHIVE) {
    event.respondWith(serveMapArchive(request));
    return;
  }
  if (url.origin === self.location.origin && (url.pathname.startsWith('/maps/fonts/') || url.pathname.startsWith('/maps/sprites/'))) {
    event.respondWith(cacheFirst(request, MAP_CACHE));
    return;
  }
  if (url.origin === self.location.origin && url.pathname.startsWith('/maplibre/')) {
    event.respondWith(cacheFirst(request, MAP_CACHE));
    return;
  }

  if (TILE_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, TILE_CACHE, TILE_CACHE_MAX_ENTRIES));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
});

async function serveMapArchive(request) {
  const cache = await caches.open(MAP_CACHE);
  const saved = await cache.match(MAP_ARCHIVE);
  if (!saved) return fetch(request);
  const range = request.headers.get('range');
  if (!range) return saved;
  const bytes = savedMapBytes || (savedMapBytes = await saved.arrayBuffer());
  const match = /^bytes=(\d+)-(\d*)$/.exec(range);
  if (!match) return new Response(null, { status: 416 });
  const start = Number(match[1]);
  const end = match[2] ? Math.min(Number(match[2]), bytes.byteLength - 1) : bytes.byteLength - 1;
  if (start > end || start >= bytes.byteLength) return new Response(null, { status: 416 });
  return new Response(bytes.slice(start, end + 1), { status: 206, headers: {
    'Content-Type': 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Content-Range': `bytes ${start}-${end}/${bytes.byteLength}`,
    'Content-Length': String(end - start + 1),
  } });
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(request, response.clone());
        await trimCache(cache, maxEntries);
      }
      return response;
    })
    .catch(() => undefined);

  return cached || (await networkPromise) || fetch(request);
}

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  const toDelete = keys.slice(0, keys.length - maxEntries);
  await Promise.all(toDelete.map((key) => cache.delete(key)));
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await cache.match('/offline');
    if (offline) return offline;
    return new Response('Offline', { status: 503, statusText: 'Offline', headers: { 'content-type': 'text/plain' } });
  }
}
