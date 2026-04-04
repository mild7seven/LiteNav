const CACHE_NAME = 'litenav-g-2026-v1';
const OFFLINE_URL = 'index.html';

// Aset statis inti yang wajib masuk cache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/src/main.js',
  '/src/style.css',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://cdn.osmbuildings.org/4.1.1/OSMBuildings-Leaflet.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Strategi Cache First untuk library external & icons
  if (event.request.url.includes('unpkg.com') || event.request.url.includes('gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then((res) => res || fetch(event.request))
    );
    return;
  }

  // Network First untuk navigasi rute & search
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
