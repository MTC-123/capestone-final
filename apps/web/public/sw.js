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

const CACHE_VERSION = 'v1';
const SHELL_CACHE = `ricer-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `ricer-static-${CACHE_VERSION}`;
const TILE_CACHE = `ricer-tiles-${CACHE_VERSION}`;
const UPLOAD_CACHE = `ricer-uploads-${CACHE_VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, STATIC_CACHE, TILE_CACHE, UPLOAD_CACHE];

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

const TILE_HOSTS = ['api.maptiler.com', 'basemaps.cartocdn.com', 'tile.openstreetmap.org'];
const TILE_CACHE_MAX_ENTRIES = 300;

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

  // API: only GET /api/uploads/* (immutable photo bytes) is cacheable.
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname.startsWith('/api/uploads/')) {
      event.respondWith(cacheFirst(request, UPLOAD_CACHE));
    }
    return; // everything else under /api/ goes straight to the network, uncached
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
