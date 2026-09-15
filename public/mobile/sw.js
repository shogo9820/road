const CACHE_NAME = "salmons-game-mobile-v1";
const ASSETS_TO_CACHE = [
  "/mobile/index.html",
  "/mobile/controller.js",
  "/mobile/controller.css",
  "/css/common.css"
];

// インストール時にスマホ専用のアセットをキャッシュに保存
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker Mobile] アセットをキャッシュ中...");
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// アクティベート時に古いキャッシュを自動削除
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME && cache.startsWith("salmons-game-mobile-")) {
            console.log("[Service Worker Mobile] 古いキャッシュを削除:", cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// ネットワーク優先、だめならキャッシュを返す（リアルタイム通信のSocket.ioを邪魔しない基本設定）
self.addEventListener("fetch", (event) => {
  // socket.ioの通信はサービスワーカーのキャッシュ対象から完全に除外する（バグ防止）
  if (event.request.url.includes("socket.io")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 通常のWebアクセスが成功したら最新版をキャッシュにアップデート
        if (response.status === 200 && event.request.method === "GET") {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // オフラインなどで通信が途切れた場合はキャッシュから安全に画面を出す
        return caches.match(event.request);
      })
  );
});
