const CACHE_NAME = 'shopping-list-v1';
const urlsToCache = [
  '/lista/',
  '/lista/lista.html',
  '/lista/lista.css',
  '/lista/lista.js',
  '/lista/icon-192.png',
  '/lista/icon-512.png',
  '/lista/manifest.json'
  // Dodaj więcej zasobów, np. obrazy lub fonty, jeśli używasz
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request);
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});