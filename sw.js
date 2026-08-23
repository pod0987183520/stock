const CACHE_NAME = 'xiaogu-pwa-cache-v2.05';

const ASSETS_TO_CACHE = [
  'index.html',
  'app.html',
  'css/style.css?v=2.05',
  'js/app.js?v=2.05',
  'manifest.json',
  'z_img_app_192.png',
  'z_img_app_512.png',
  'z_img_line.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 網路優先 Network-First 策略：保證每次聯網載入最新內容，同時滿足 PWA 原生一鍵安裝
self.addEventListener('fetch', (event) => {
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
