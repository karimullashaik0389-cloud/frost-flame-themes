/* Same worker as ff-sw.js so an older registration of /sw.js updates in place.
   No fetch intercept, no forced reload. */
var FF_SW_VERSION = '2026-11-08-menu-ready';

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    try {
      var keys = await caches.keys();
      await Promise.all(keys.map(function (key) { return caches.delete(key); }));
    } catch (e) {}
  })());
});

self.addEventListener('message', function (event) {
  var data = event.data;
  if (data === 'skipWaiting' || (data && data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
});
