// SODSAN Fabrika Portalı - Service Worker (sw.js)
const CACHE_NAME = 'sodsan-portal-v63';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/data.js',
  './js/calendar.js',
  './js/production.js',
  './js/products.js',
  './js/supplies.js',
  './js/leave.js',
  './js/overtime.js',
  './js/forklift.js',
  './js/breakdown.js',
  './js/admin.js',
  './js/catering_shuttle.js',
  './js/documents.js',
  './js/cloud_sync.js',
  './js/app.js',
  './assets/sodsan-favicon.png',
  './assets/sodsan-logo.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-192.png',
  './assets/icon-maskable-512.png',
  './assets/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network-First Stratejisi: Statik uygulama dosyalarını önbelleğe alır.
// Pil ve İşlemci Tasarrufu (Kritik): Dış API, ntfy.sh ve canlı SSE akışları Service Worker tarafından yakalanmaz.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  try {
    const url = new URL(event.request.url);
    // Sadece kendi alan adımızdan (origin) gelen statik dosyaları ele al
    if (url.origin !== self.location.origin) {
      return; // Service worker bypass -> doğrudan ağ üzerinden çalışır, telefonun CPU/pilini tüketmez
    }
  } catch (e) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
