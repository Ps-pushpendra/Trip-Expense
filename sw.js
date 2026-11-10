// Offline cache: always try the network first (so updates show up right away),
// and fall back to the saved copy when there is no internet.
const CACHE = 'tripsplit-v5';
const FILES = ['./', './index.html', './qr.js', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  // add files one by one, so a single missing file cannot stop the offline install
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(f => c.add(f).catch(() => {})))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
