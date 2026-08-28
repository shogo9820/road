const CACHE_NAME = 'drinking-game-v1';
const ASSETS = [
  'index.html',
  'css/style.css',
  'js/data.js',
  'js/server.js',
  'manifest.json'
];

// インストール時にファイルをキャッシュ
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// オフライン時はキャッシュからページを返す
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});