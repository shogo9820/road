/**
 * 🎯 マスコンポーネント: 41番マス（【強制ストップ】カップル成立！？）
 * 
 * [設計思想]
 * 0番マス（sq_0.js）と100%完全に一致させた「window.SQ_MODULES[41]」の構造に修正。
 * 大画面モーダルのデザイン反映、条件表の流し込み、告白電波の送信までをこのファイルが100%直接請け負います。
 */

window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES[41] = {
  // 🌸 現行：宅飲み人生ゲーム（サークル生活モード）
  normal: {
    id: 41,
    type: "force_stop",
    text: "【強制ストップ】カップル成立！？",
    drink: 0,
    happiness: 0,
    location: "家",
    
    // 🎯 マスに止まった瞬間に、この関数の中のコードが100%直接すべて動く！
    event: function(player, square) {
      console.log("[sq_41.js] 41番マス着地。カップル成立チャンス演出を直接実行します。");
      isPCEventMode = true;

      // 1. 大画面の「次のプレイヤーへ」ボタンを安全に非表示ロック
      const btnNext = document.getElementById("btn-next-turn");
      if (btnNext) {
        btnNext.disabled = true;
        btnNext.style.display = "none";
      }

      // 2. 大画面の汎用モーダルを直接キャッチして、カップル専用のデザインとテキストを流し込む！
      const pcModal = document.getElementById("pc-event-modal");
      if (pcModal) {
        pcModal.className = "event-modal-overlay active theme-couple";
        
        const titleEl = document.getElementById("modal-event-title");
        const descEl = document.getElementById("modal-event-desc");
        if (titleEl) titleEl.textContent = "💕 カップル成立チャンス！？ 💕";
        if (descEl) descEl.textContent = `\${player.name} さんがカップルマスに到着！運命 of 1回目スピンを回して【偶数】を狙え！`;

        const resultBox = document.getElementById("modal-event-result-box");
        if (resultBox) {
          resultBox.style.display = "none";
          resultBox.className = "event-result-box";
          resultBox.textContent = "";
        }

        // 3. 1〜10の運命の判定条件表（偶数・奇数のリスト）をここでダイレクトに完全生成！
        let tableHTML = `
          <div class="event-table-title" style="font-size:1.3rem; color:#d81b60; margin-bottom:8px; font-weight:bold; border-bottom:2px solid #ff69b4; padding-bottom:4px;">
            🎯 1回目スピン：運命 of 判定条件表
          </div>
          <ul class="event-table-list">`;
        for (let i = 1; i <= 10; i++) {
          const isEven = i % 2 === 0;
          const badgeBg = isEven ? "#ff4081" : "#78909c";
          const text = isEven
            ? '<span style="color:#d81b60; font-weight:bold;">💕 偶数：告白チャンス突入！</span>'
            : '<span style="color:#546e7a;">💦 奇数：フラれて終了...</span>';
          tableHTML += `<li class="event-table-item"><div class="event-table-num-badge" style="background:\${badgeBg};">\${i}</div><div>\${text}</div></li>`;
        }
        tableHTML += `</ul>`;

        const dynamicTableZone = document.getElementById("pc-event-table-dynamic-zone");
        if (dynamicTableZone) {
          dynamicTableZone.innerHTML = tableHTML;
        }

        const modalResEl = document.getElementById("modal-roulette-result-display");
        if (modalResEl) modalResEl.textContent = "🎯 スマホから運命の告白スピンを回してね！";
      }

      // 4. サーバーへ直接「triggerCoupleEvent」の電波を発射！
      if (typeof socket !== "undefined") {
        socket.emit("triggerCoupleEvent", {
          roomCode: roomCode || currentRoomCode || "",
          playerId: player.id,
          playerName: player.name
        });
      }
    }
  },

  // 💼 将来用拡張：社会人モード
  salaryman: {
    id: 41, type: "force_stop", text: "【強制ストップ】社内恋愛勃発！？", drink: 0, happiness: 15, location: "オフィス",
    event: function(player, square) { window.SQ_MODULES[41].normal.event(player, square); }
  },

  // ⚡ 将来用拡張：ショートモード
  short: {
    id: 41, type: "force_stop", text: "【強制ストップ】スピード婚活チャンス！", drink: 1, happiness: 0, location: "家",
    event: function(player, square) { window.SQ_MODULES[41].normal.event(player, square); }
  }
};
