/* One-shot recovery SW: unregister self + clear caches, then go away.
   Old home-screen installs that cached a broken SW recover on next visit. */
self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    try {
      var keys = await caches.keys();
      await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    } catch (e) {}
    try {
      await self.registration.unregister();
    } catch (e) {}
    try {
      var clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(function (c) {
        try { c.navigate(c.url); } catch (e) {}
      });
    } catch (e) {}
  })());
});

/* Do not intercept fetches — browser handles everything. */
