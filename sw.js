// Offline support: serve the app (and the barcode library) from cache when offline.
const CACHE = 'calories-v5';
const FILES = ["./", "./index.html", "./manifest.json", "./a1.js", "./a2.js", "./a3.js", "./a4.js", "./a5.js", "./a6.js", "./common.js", "./s1.css", "./s2.css", "https://cdn.jsdelivr.net/npm/@zxing/library@0.23.0/umd/index.min.js", "https://cdn.jsdelivr.net/npm/tempo-food-db@1.0.0/data/tempolife-foods.csv"];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const mine = url.origin === location.origin || url.href.startsWith('https://cdn.jsdelivr.net/npm/');
  if (!mine) return; // never touch food or Claude API calls
  e.respondWith(
    fetch(e.request)
      .then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
