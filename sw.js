/* Frost & Flame themes preview — scoped to this project path only. */
const SCOPE_PREFIX = self.registration.scope; // e.g. .../frost-flame-themes/
const CACHE = 'ff-themes-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([
    './',
    './index.html',
    './manifest.webmanifest',
    './icon-192.png',
    './apple-touch-icon.png'
  ]).catch(() => {})));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Only handle same-origin requests under our scope
  if (!url.href.startsWith(SCOPE_PREFIX)) return;
  // Network-first for navigations (SPA); cache-fallback for assets
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        return fresh;
      } catch (e) {
        const cached = await caches.match('./index.html');
        return cached || Response.error();
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok && (url.pathname.match(/\.(css|js|png|webp|jpg|woff2|webmanifest)$/))) {
        const copy = fresh.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return fresh;
    } catch (e) {
      return cached || Response.error();
    }
  })());
});
