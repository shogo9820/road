const CACHE_NAME = "salmons-game-v2";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/css/common.css",
  "/master/gameMaster.js",
  "/pc/index.html",
  "/pc/pc.css",
  "/pc/pc.js",
  "/pc/board.js",
  "/mobile/index.html",
  "/mobile/controller.css",
  "/mobile/controller.js"
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

  // 🎯 修正：自サーバー以外への外部通信（://qrserver.com等）とSocket.ioはキャッシュ処理から完全除外
  if (url.origin !== self.location.origin || url.pathname.startsWith("/socket.io/")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      });
    })
  );
});
