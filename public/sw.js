
// Steak Sheikh service worker — app-shell caching + offline fallback only.
// Deliberately does NOT touch /api/* or /admin/* — those must always hit the
// network so prices, stock, cart, orders and admin data are never stale.
const CACHE_VERSION = 'v1';
const CACHE_NAME = `steak-sheikh-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const STATIC_ASSET_RE = /\.(png|jpg|jpeg|svg|webp|avif|gif|ico|woff2?|ttf)$/;

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Always network-only for API calls and the admin back office.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) return;

  // Page navigations: network-first, offline page on failure.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Static assets (Next build chunks, icons, images, fonts): stale-while-revalidate.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || STATIC_ASSET_RE.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
