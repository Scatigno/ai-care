// Service worker do AI Care: guarda os arquivos do app para abrir sem
// internet. Não guarda dados de moradores (esses ficam no localStorage).
const CACHE = 'aicare-v0.2.0';
const ASSETS = ['./', './index.html', './app.js', './app.css', './public/manifest.webmanifest', './public/icon.svg', './public/icon-180.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Rede primeiro; cache só quando estiver sem conexão.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(event.request).then((r) => r || caches.match('./index.html'))),
  );
});
