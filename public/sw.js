const CACHE_NAME = "salmons-game-v5";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
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
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        // 1つ取得に失敗してもインストール全体が失敗しないよう個別に追加
        Promise.all(
          ASSETS_TO_CACHE.map((url) => cache.add(url).catch(() => null)),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((cache) => {
            if (cache !== CACHE_NAME) return caches.delete(cache);
          }),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/socket.io/")
  ) {
    return;
  }

  // Network-First: 常に最新を取得し、オフライン時のみキャッシュへフォールバック
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
      .catch(() =>
        caches.match(event.request, { ignoreSearch: true }).then((cached) => {
          if (cached) return cached;
          // ページ遷移がオフラインならスマホ画面（?room=付き含む）を返す
          if (event.request.mode === "navigate") {
            return caches.match("/mobile/index.html");
          }
          return undefined;
        }),
      ),
  );
});
