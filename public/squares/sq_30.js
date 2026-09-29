/**
 * 🎯 マスコンポーネント: 30番マス（【強制ストップ】生命保険購入）
 * 
 * [設計思想]
 * このマスに止まった瞬間に、大画面の停止、スマホ側への購入ダイアログの直接表示、
 * データの加算、サーバー・ルーム全体への同期まで、すべての処理をこのファイルが100%直接請け負います。
 * 他のファイルを中継するリレー処理は1文字もありません。書いてあることだけで100%完結します。
 */

window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES = {
  // 🌸 現行：サークル生活モード
  normal: {
    id: 30,
    type: "insurance_shop",
    text: "【強制ストップ】生命保険購入（0〜3枚選択可能）",
    drink: 0,
    happiness: 0,
    location: "家",
    
    // 🎯 マスに止まった瞬間に、この関数の中のコードが100%直接すべて動く！
    event: function(player, square) {
      console.log("[sq_30.js] 30番マス着地。このマスのファイルがすべての処理を直接実行します。");
      
      // 1. 【大画面PC制御】自動スキップタイマーに邪魔されないよう、大画面の進行をこの場でガチッと緊急停止！
      isPCEventMode = true; 

      // 2. 【スマホ画面制御】操作権を持つスマホ画面（HTML）へ「0〜3枚」の購入特大モーダルをダイレクトに強制出現！
      let shopHtml = `
        <div id="insurance-shop-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); display:flex; justify-content:center; align-items:center; z-index:999999; font-family:sans-serif;">
          <div style="background:#fff; width:90%; max-width:320px; padding:25px; border-radius:16px; text-align:center; box-sizing:border-box; box-shadow: 0 8px 24px rgba(0,0,0,0.3);">
            <h3 style="margin-top:0; color:#9c27b0; font-size:1.3rem; font-weight:bold;">🛡️ 生命保険の加入（購入）</h3>
            <p style="font-size:0.85rem; color:#666; margin-bottom:20px; line-height:1.4;">今後の飲酒を完全無効化できる命の盾です。<br>何枚購入しますか？</p>
            <div style="display:flex; flex-direction:column; gap:10px;">
              <button class="btn-shop-select" data-count="0" style="padding:12px; font-weight:bold; border:2px solid #ddd; border-radius:10px; background:#fff; color:#333; cursor:pointer; outline:none;">0枚（購入しない）</button>
              <button class="btn-shop-select" data-count="1" style="padding:12px; font-weight:bold; border:2px solid #ddd; border-radius:10px; background:#fff; color:#333; cursor:pointer; outline:none;">1枚購入</button>
              <button class="btn-shop-select" data-count="2" style="padding:12px; font-weight:bold; border:2px solid #ddd; border-radius:10px; background:#fff; color:#333; cursor:pointer; outline:none;">2枚購入</button>
              <button class="btn-shop-select" data-count="3" style="padding:12px; font-weight:bold; border:2px solid #ddd; border-radius:10px; background:#fff; color:#333; cursor:pointer; outline:none;">3枚購入（最大）</button>
            </div>
          </div>
        </div>
      `;

      // スマホ子機側のプレイ画面コンテナを探して、モーダルをダイレクトに流し込む！
      const playScreen = document.getElementById("phone-screen-play") || document.body;
      const oldShop = document.getElementById("insurance-shop-modal");
      if (oldShop) oldShop.remove();
      playScreen.insertAdjacentHTML("beforeend", shopHtml);

      // 3. 【購入確定時のデータ処理＆同期】
      playScreen.querySelectorAll(".btn-shop-select").forEach(btn => {
        btn.onclick = (e) => {
          const buyCount = parseInt(e.target.getAttribute("data-count"), 10);
          
          if (!player.insurance) player.insurance = 0;
          player.insurance += buyCount; // 💡 選択された枚数をプレイヤーのデータに直接加算！

          console.log(`[sq_30.js] ${player.name} が ${buyCount}枚 購入。全体へガチッと同期報告します。`);

          // 最新のゲームデータをサーバー＆ルームの全員（PC大画面含む）へ100%確実に同期送信！
          if (typeof socket !== "undefined") {
            socket.emit("updateGameState", {
              roomCode: roomCode || currentRoomCode || "",
              activePlayerIndex: activePlayerIndex,
              players: players
            });
          }

          // 用済みのショップモーダルをスマホ画面から物理的に消去パージ！
          document.getElementById("insurance-shop-modal")?.remove();

          // 4. 【しかるべきタイミング】枚数が100%確定したので、スマホの「次へ進む」ボタンを点灯！
          const nextBtn = document.getElementById("btn-phone-next");
          if (nextBtn) {
            nextBtn.disabled = false; // 🔓 点灯
          }
        };
      });
    }
  },

  // 💼 将来用拡張：社会人モード
  salaryman: {
    id: 30, type: "insurance_shop", text: "【強制ストップ】生命保険・ライフプラン設計", drink: 0, happiness: 10, location: "オフィス",
    event: function(player, square) { window.SQ_MODULES.normal.event(player, square); }
  },

  // ⚡ 将来用拡張：ショートモード
  short: {
    id: 30, type: "insurance_shop", text: "【強制ストップ】命の盾を闇取引！", drink: 1, happiness: 0, location: "家",
    event: function(player, square) { window.SQ_MODULES.normal.event(player, square); }
  }
};
