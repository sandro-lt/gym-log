// Offline-Cache. Bei jedem Update die Versionsnummer erhöhen,
// damit Handys die neuen Dateien laden.
const CACHE = 'gymlog-v1.14.0';
const FILES = [
  './',
  './index.html',
  './styles.css',
  './db.js',
  './body.js',
  './strength.js',
  './app.js',
  './library.js',
  './swap.js',
  './records.js',
  './rest.js',
  './plans.js',
  './charts.js',
  './settings.js',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  // no skipWaiting here: the new version waits until the user taps "Update" in the app
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Stale-while-revalidate: sofort aus dem Cache starten (auch ohne Netz im Gym),
// im Hintergrund die neueste Version holen -> Updates sind beim nächsten Öffnen da.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const fresh = fetch(e.request).then((res) => {
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(fresh); return hit; }
    const res = await fresh;
    if (res) return res;
    return (e.request.mode === 'navigate' && await cache.match('./index.html')) || Response.error();
  }));
});
