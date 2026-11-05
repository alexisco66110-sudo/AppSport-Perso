// Service worker : l'app fonctionne hors ligne. Change VERSION à chaque mise en ligne.
const VERSION = 'elan-v3';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/anim.js', 'js/calories.js', 'js/charts.js', 'js/data.js', 'js/db.js',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(request, { ignoreSearch: request.mode === 'navigate' }).then((hit) => {
      if (hit) return hit;
      return fetch(request).catch(() => {
        if (request.mode === 'navigate') return caches.match('index.html');
        return Response.error();
      });
    }),
  );
});
