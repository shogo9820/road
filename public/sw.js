const CACHE_NAME = "salmons-game-v1";
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

// インストール時に必要なファイルを一括キャッシュ
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] 共通アセットをキャッシュ中...");
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// アクティベート時に古いキャッシュをクリーンアップ
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("[Service Worker] 古いキャッシュを削除:", cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// オンライン優先 / キャッシュフォールバック戦略（サーバー側のSocket.io通信を邪魔しない最低限の静的ファイルキャッシュ）
self.addEventListener("fetch", (event) => {
  // Socket.ioの通信（/socket.io/）はサービスワーカーのキャッシュ対象から完全に除外する
  if (event.request.url.includes("/socket.io/")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 正常なレスポンスが返ってきたら、最新の静的ファイルをキャッシュにアップデート
        if (response.status === 200 && response.type === "basic") {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // オフライン時やネットワークエラー時はキャッシュから返す
        return caches.match(event.request);
      })
  );
});
