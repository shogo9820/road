// public/squares/sq_30.js
window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES[30] = {
  normal: {
    id: 30,
    type: "insurance_shop",
    text: "【強制ストップ】生命保険購入（0〜3枚選択可能）",
    location: "家",
    
    event: function(player, square) {
      console.log("[sq_30.js] 30番マスの自前インラインイベントを実行します。");
      const targetRoom = typeof currentRoomCode !== "undefined" ? currentRoomCode : (typeof roomCode !== "undefined" ? roomCode : "");

      // 💻 ① 【PC大画面側だった場合の直接処理】
      if (typeof isPCEventMode !== "undefined") {
        isPCEventMode = true; // 大画面の自動スキップタイマーをその場で緊急停止
        return;
      }

      // 📱 ② 【スマホ手元側だった場合の直接処理（モーダルを出さずにボタンエリアを乗っ取る）】
      const resultDisplay = document.getElementById("roulette-result-display");
      const spinBtn = document.getElementById("btn-phone-spin");
      const playScreen = document.getElementById("phone-screen-play") || document.body;

      if (playScreen && typeof currentRoomCode !== "undefined") {
        // 通常スピンボタン（btn-phone-spin）を一時的に非表示にし、代わりに保険購入用のボタン群を美しく挿入
        if (spinBtn) spinBtn.style.display = "none";
        if (resultDisplay) resultDisplay.textContent = "🛡️ 今後の飲酒を完全無効化できる生命保険を購入できます。";

        let inlineShopHtml = `
          <div id="insurance-inline-zone" style="width:100%; display:flex; flex-direction:column; gap:8px; margin:10px auto; align-items:center;">
            <div style="font-weight:bold; font-size:1.1rem; color:#9c27b0; margin-bottom:4px;">🛡️ 何枚購入しますか？ (1枚につきHPの盾)</div>
            <button class="btn-shop-select btn-blue" data-count="0" style="background-color:#78909c !important;">0枚（購入しない）</button>
            <button class="btn-shop-select btn-orange" data-count="1">1枚購入</button>
            <button class="btn-shop-select btn-orange" data-count="2">2枚購入</button>
            <button class="btn-shop-select btn-orange" data-count="3">3枚購入（最大）</button>
          </div>
        `;

        // 古いインライン残骸があれば掃除して挿入
        document.getElementById("insurance-inline-zone")?.remove();
        
        // 通常ボタンのすぐ真上にインラインショップを展開
        if (spinBtn) {
          spinBtn.insertAdjacentHTML("beforebegin", inlineShopHtml);
        } else {
          playScreen.insertAdjacentHTML("beforeend", inlineShopHtml);
        }

        // インライン配置された各ボタンのクリック処理
        playScreen.querySelectorAll(".btn-shop-select").forEach(btn => {
          btn.onclick = (e) => {
            e.preventDefault();
            const buyCount = parseInt(e.currentTarget.getAttribute("data-count"), 10);
            
            if (!player.insurance) player.insurance = 0;
            player.insurance += buyCount; // 枚数の加算

            console.log(`[sq_30.js] 保険購入確定: ${buyCount}枚。最新ステータスをサーバーへ報告します。`);

            // 購入完了したらインラインショップを消去し、通常スピンボタンの表示を復活させる
            document.getElementById("insurance-inline-zone")?.remove();
            if (spinBtn) {
              spinBtn.style.display = "block";
              // 新しいターンに備えて次のプレイヤーに回すため、ボタンのイベントなどをクリアしたクローンにする
              const cleanedSpinBtn = spinBtn.cloneNode(true);
              spinBtn.parentNode.replaceChild(cleanedSpinBtn, spinBtn);
              cleanedSpinBtn.disabled = true; // 手番交代を待つため一旦非活性
            }
            if (resultDisplay) resultDisplay.textContent = `🛡️ 保険を ${buyCount} 枚購入しました！「次のプレイヤーへ」を押してね！`;

            // 🎯 最新データを乗せて完了報告電波を発射（これで手元の次へボタンが点灯）
            if (typeof socket !== "undefined") {
              socket.emit("playerAction", {
                roomCode: targetRoom,
                action: "squareEventFinished",
                updatedPlayer: player
              });
            }
          };
        });
      }
    }
  },
  salaryman: { id: 30, type: "insurance_shop", text: "【強制ストップ】生命保険・ライフプラン設計", location: "オフィス", event: function(player, square) { window.SQ_MODULES[30].normal.event(player, square); } },
  short: { id: 30, type: "insurance_shop", text: "【強制ストップ】命の盾を闇取引！", location: "家", event: function(player, square) { window.SQ_MODULES[30].normal.event(player, square); } }
};
