// Офлайн: приложение из кеша, запросы к Apps Script — только в сеть.
const CACHE = 'ecru-fortune-v8';
const FILES = [
  './', 'index.html', 'dashboard.html', 'manifest.webmanifest', 'css/app.css', 'css/dashboard.css',
  'js/app.js', 'js/dashboard.js', 'js/config.js', 'js/store.js', 'js/pacing.js', 'js/sync.js',
  'js/shields.js', 'js/logo.js', 'js/roman.js',
  'fonts/fortune-serif.woff', 'fonts/fortune-sans-500.woff', 'fonts/fortune-sans-700.woff', 'fonts/fortune-sans-800.woff',
  'img/mosaic.svg', 'img/icon.svg', 'img/icon-180.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // stale-while-revalidate: мгновенно из кеша, свежая версия подтянется к следующему открытию
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    // no-cache: мимо HTTP-кеша GitHub Pages (max-age=600), иначе версии файлов смешиваются
    const net = fetch(e.request, { cache: 'no-cache' }).then((res) => { if (res.ok) c.put(e.request, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
