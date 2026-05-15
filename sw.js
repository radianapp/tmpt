const CACHE_NAME = 'tmpt-cache-v1.2';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/assets/css/app.css',
  '/assets/js/pwa.js',
  '/assets/js/auth.js',
  '/assets/js/crypto.js',
  '/assets/js/vault.js',
  '/assets/js/ui.js',
  '/assets/img/logo.svg',
  '/shared/header.html',
  '/shared/footer.html',
  '/shared/app-header.html',
  '/setup/index.html',
  '/login/index.html',
  '/dashboard/index.html',
  '/settings/index.html'
];

// Install Event
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('SW: Caching static assets');
      return cache.addAll(ASSETS);
    })
  );
});

// Activate Event
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // Return cached response if found, otherwise fetch from network
      return cachedResponse || fetch(event.request).then(fetchResponse => {
        // Optionally cache new successful requests
        if (fetchResponse.status === 200 && event.request.method === 'GET') {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, fetchResponse.clone());
            return fetchResponse;
          });
        }
        return fetchResponse;
      });
    }).catch(() => {
        // Offline fallback if needed
    })
  );
});
