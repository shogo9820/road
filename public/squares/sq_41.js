// public/squares/sq_41.js
window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES[41] = {
  normal: {
    id: 41,
    type: "force_stop",
    text: "【強制ストップ】カップル成立！？",
    drink: 0,
    happiness: 0,
    location: "家",

    event: function(player, square) {
      console.log("[sq_41.js] 41番マス着地。演出と条件表の生成を直接実行します。");

      // 💻 PC大画面側の処理（PC専用のモーダル要素があるかで判定）
      const pcModal = document.getElementById("pc-event-modal");
      if (pcModal) {
        if (typeof isPCEventMode !== "undefined") isPCEventMode = true;

        const btnNext = document.getElementById("btn-next-turn");
        if (btnNext) { btnNext.disabled = true; btnNext.style.display = "none"; }

        pcModal.className = "event-modal-overlay active theme-couple";
        document.getElementById("modal-event-title").textContent = "💕 カップル成立チャンス！？ 💕";
        document.getElementById("modal-event-desc").textContent = `${player.name} さんがカップルマスに到着！運命 of 1回目スピンを回して【偶数】を狙え！`;

        const resultBox = document.getElementById("modal-event-result-box");
        if (resultBox) { resultBox.style.display = "none"; resultBox.className = "event-result-box"; resultBox.textContent = ""; }

        let tableHTML = `
          <div class="event-table-title" style="font-size:1.3rem; color:#d81b60; margin-bottom:8px; font-weight:bold; border-bottom:2px solid #ff69b4; padding-bottom:4px;">🎯 1回目スピン：運命 of 判定条件表</div>
          <ul class="event-table-list">`;
        for (let i = 1; i <= 10; i++) {
          const isEven = i % 2 === 0;
          const badgeBg = isEven ? "#ff4081" : "#78909c";
          const text = isEven ? '<span style="color:#d81b60; font-weight:bold;">💕 偶数：告白チャンス突入！</span>' : '<span style="color:#546e7a;">💦 奇数：フラれて終了...</span>';
          tableHTML += `<li class="event-table-item"><div class="event-table-num-badge" style="background:${badgeBg};">${i}</div><div>${text}</div></li>`;
        }
        tableHTML += `</ul>`;
        document.getElementById("pc-event-table-dynamic-zone").innerHTML = tableHTML;
        document.getElementById("modal-roulette-result-display").textContent = "🎯 スマホから運命の告白スピンを回してね！";
        return;
      }

      // 📱 スマホ手元側の処理（PCモーダル要素がない場合）
      const mobileModal = document.getElementById("mobile-couple-event-modal");
      if (mobileModal) {
        mobileModal.style.display = "flex";
        const titleEl = mobileModal.querySelector("h3") || mobileModal.querySelector(".couple-title");
        if (titleEl) titleEl.textContent = "💕 運命の告白スピン 💕";
        const descEl = mobileModal.querySelector(".couple-desc");
        if (descEl) descEl.innerHTML = "偶数が出れば告白チャンス突入！<br>奇数ならフラれて終了！";

        const btnSpin = document.getElementById("btn-couple-spin");
        if (btnSpin) {
          btnSpin.style.display = "block";
          btnSpin.disabled = false;
          btnSpin.textContent = "🎲 告白ルーレットを回す！";

          // 告白専用スピンをサーバーへ要求
          btnSpin.onclick = () => {
            btnSpin.disabled = true;
            // サーバーの startCustomRouletteEvent などをキックする、または独自結果を送信
            socket.emit("startCustomRouletteEvent", {
              roomCode: currentRoomCode,
              eventName: "カップル告白判定",
              mapping: {
                1: { name: "奇数：フラれて終了...", drinks: 0 },
                2: { name: "偶数：告白チャンス！", drinks: 0 },
                3: { name: "奇数：フラれて終了...", drinks: 0 },
                4: { name: "偶数：告白チャンス！", drinks: 0 },
                5: { name: "奇数：フラれて終了...", drinks: 0 },
                6: { name: "偶数：告白チャンス！", drinks: 0 },
                7: { name: "奇数：フラれて終了...", drinks: 0 },
                8: { name: "偶数：告白チャンス！", drinks: 0 },
                9: { name: "奇数：フラれて終了...", drinks: 0 },
                10: { name: "偶数：告白チャンス！", drinks: 0 }
              }
            });
          };
        }
      }
    }
  }
};
