const CACHE_NAME = "salmons-game-v4";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/css/common.css",
  "/master/gameMaster.js",
  "/pc/index.html",
  "/pc/pc.css",
  "/pc/board.js",
  "/mobile/index.html",
  "/mobile/controller.css"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
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

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin || url.pathname.startsWith("/socket.io/")) {
    return;
  }

  // Network-First: 常に最新のファイルを取得し、オフライン時のみキャッシュへフォールバック
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
