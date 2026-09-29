window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES[30] = {
  // 🌸 現行：サークル生活モード
  normal: {
    id: 30,
    type: "insurance_shop",
    text: "【強制ストップ】生命保険購入（0〜3枚選択可能）",
    drink: 0,
    happiness: 0,
    location: "家",
    
    // 🎯 マスに止まった瞬間に、PC・スマホそれぞれの環境でダイレクトに実行！
    event: function(player, square) {
      console.log("[sq_30.js] 30番マスの自前イベントを実行します。");

      // 💻 【PC大画面側だった場合の直接処理】
      if (typeof isPCEventMode !== "undefined") {
        isPCEventMode = true; // 🔓 大画面の自動スキップタイマーをその場で緊急停止
        return;
      }

      // 📱 【スマホ手元側だった場合の直接処理】
      const playScreen = document.getElementById("phone-screen-play") || document.body;
      if (playScreen && typeof currentRoomCode !== "undefined") {
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

        document.getElementById("insurance-shop-modal")?.remove();
        playScreen.insertAdjacentHTML("beforeend", shopHtml);

        playScreen.querySelectorAll(".btn-shop-select").forEach(btn => {
          btn.onclick = (e) => {
            const buyCount = parseInt(e.target.getAttribute("data-count"), 10);
            
            if (!player.insurance) player.insurance = 0;
            player.insurance += buyCount; // データの加算

            console.log(`[sq_30.js] 枚数確定。最新データを乗せて PHASE_WAIT_NEXT（手元開放）へ一斉報告します。`);

            // 🎯 【ルーティン結合】すべての処理が終わったこの一瞬に、最新の本人のデータを添えてサーバーへ完了を送信！
            if (typeof socket !== "undefined") {
              socket.emit("playerAction", {
                roomCode: currentRoomCode || "",
                action: "squareEventFinished",
                updatedPlayer: player
              });
            }

            document.getElementById("insurance-shop-modal")?.remove();
          };
        });
      }
    }
  },
  salaryman: { id: 30, type: "insurance_shop", text: "【強制ストップ】生命保険・ライフプラン設計", drink: 0, happiness: 10, location: "オフィス", event: function(player, square) { window.SQ_MODULES[30].normal.event(player, square); } },
  short: { id: 30, type: "insurance_shop", text: "【強制ストップ】命の盾を闇取引！", drink: 1, happiness: 0, location: "家", event: function(player, square) { window.SQ_MODULES[30].normal.event(player, square); } }
};
