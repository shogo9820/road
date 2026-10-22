// public/squares/sq_41.js
window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES[41] = {
  normal: {
    id: 41,
    type: "force_stop",
    text: "【強制ストップ】カップル成立！？", 
    location: "家",

    config: {
      themeClass: "theme-couple",
      pcFirstTitle: "💕 カップル成立チャンス！？ 💕",
      pcFirstDesc: "運命 of 1回目スピンを回して【偶数】を狙え！",
      pcSecondTitle: "カップル告白",
      pcSecondDesc: "スマホから最終決着スピンを回して、意中の相手を射止めろ！",
      
      mobileFirstDisplay: "🎯 偶数（告白チャンス）を狙ってね！",
      mobileFirstBtn: "🎲 運命の1回目スピンを回す！",
      mobileSecondBtn: "💘 決着の2回目（告白）スピン！"
    },
    
    event: function(player, square) {
      const cfg = this.config;
      const targetRoom = typeof currentRoomCode !== "undefined" ? currentRoomCode : (typeof roomCode !== "undefined" ? roomCode : "");

      // 💻 ① 【PC大画面側だった場合の直接処理】
      const pcModal = document.getElementById("pc-event-modal");
      if (pcModal) {
        if (typeof isPCEventMode !== "undefined") isPCEventMode = true;

        const btnNext = document.getElementById("btn-next-turn");
        if (btnNext) { btnNext.disabled = true; btnNext.style.display = "none"; }

        pcModal.className = "event-modal-overlay active " + cfg.themeClass;
        document.getElementById("modal-event-title").textContent = cfg.pcFirstTitle;
        document.getElementById("modal-event-desc").textContent = `${player.name} さんがマスに到着！ ${cfg.pcFirstDesc}`;

        const resultBox = document.getElementById("modal-event-result-box");
        if (resultBox) { resultBox.style.display = "none"; resultBox.className = "event-result-box"; resultBox.textContent = ""; }

        let tableHTML = `
          <div class="event-table-title" style="font-size:1.3rem; color:#d81b60; margin-bottom:8px; font-weight:bold; border-bottom:2px solid #ff69b4; padding-bottom:4px;">🎯 1回目スピン：運命 of 判定条件表</div>
          <ul class="event-table-list">`;
        for (let i = 1; i <= 10; i++) {
          const isEven = i % 2 === 0;
          const badgeBg = isEven ? "#ff4081" : "#78909c";
          const condText = isEven ? '<span style="color:#d81b60; font-weight:bold;">💕 偶数：チャンス突入！</span>' : '<span style="color:#546e7a;">💦 奇数：ここで終了...</span>';
          tableHTML += `<li class="event-table-item"><div class="event-table-num-badge" style="background:${badgeBg};">${i}</div><div>${condText}</div></li>`;
        }
        tableHTML += `</ul>`;
        document.getElementById("pc-event-table-dynamic-zone").innerHTML = tableHTML;
        document.getElementById("modal-roulette-result-display").textContent = "🎯 スマホから運命のスピンを回してね！";
        return;
      }

      // 📱 ② 【スマホ手元側だった場合の直接処理】
      if (typeof socket !== "undefined") {
        console.log(`📱 [スマホ側] マスID: ${this.id} の進行制御を通常画面にバインドします。`);

        const spinBtn = document.getElementById("btn-phone-spin");
        const resultDisplay = document.getElementById("roulette-result-display");

        document.body.classList.add(cfg.themeClass);
        if (spinBtn) { spinBtn.disabled = false; spinBtn.textContent = cfg.mobileFirstBtn; }
        if (resultDisplay) resultDisplay.textContent = cfg.mobileFirstDisplay;

        // ──────────────────────────────────────────────────────────
        // 🔥 【1回目スピン発火】サーバーの通常レールにリクエストを投げる
        // ──────────────────────────────────────────────────────────
        if (spinBtn) {
          const newSpinBtn = spinBtn.cloneNode(true);
          spinBtn.parentNode.replaceChild(newSpinBtn, spinBtn);

          newSpinBtn.onclick = function() {
            newSpinBtn.disabled = true;
            if (resultDisplay) resultDisplay.textContent = "🌀 1回目ルーレット要求中...";
            socket.emit("requestSpinRoulette", { roomCode: targetRoom });
          };
        }

        // ──────────────────────────────────────────────────────────
        // 🌟 【1回目の結果受信】共通の配信出目を捕まえて、偶数なら2回目ボタンへ進化、奇数なら終了
        // ──────────────────────────────────────────────────────────
        socket.off("spinRoulette");
        socket.on("spinRoulette", (data) => {
          const result = data.result !== undefined ? data.result : 1;
          
          // 2回目（決着スピン中）にこのイベントがまた呼ばれるのを防ぐガード
          if (window.SQ_MODULES[41].normal.isSecondStage) return;

          console.log(`📱 [スマホ受信-1回目決着] サーバー確定出目: ${result}`);

          setTimeout(() => {
            if (result % 2 === 0) {
              // 偶数成功：2回目ステージのフラグを立てる
              window.SQ_MODULES[41].normal.isSecondStage = true;

              const finalSpinBtn = document.getElementById("btn-phone-spin");
              if (finalSpinBtn) {
                finalSpinBtn.disabled = false;
                finalSpinBtn.textContent = cfg.mobileSecondBtn;
                if (resultDisplay) resultDisplay.textContent = `🎯 1回目 [出目:${result}] で成功！最終決着へ！`;

                const newFinalBtn = finalSpinBtn.cloneNode(true);
                finalSpinBtn.parentNode.replaceChild(newFinalBtn, finalSpinBtn);

                // 2回目のボタンを押した時も、サーバーへ正規のスピンを要求する！
                newFinalBtn.onclick = function() {
                  newFinalBtn.disabled = true;
                  if (resultDisplay) resultDisplay.textContent = "🌀 最終ルーレット要求中...";
                  socket.emit("requestSpinRoulette", { roomCode: targetRoom });
                };
              }

              // マッピングを生成してPCへ中継
              const otherPlayers = players.filter((p) => String(p.id) !== String(player.id));
              const degreeTable = [342, 306, 270, 234, 198, 162, 126, 90, 54, 18];
              const rollSlots = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
              for (let i = rollSlots.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [rollSlots[i], rollSlots[j]] = [rollSlots[j], rollSlots[i]];
              }

              const mapping = {};
              for (let i = 1; i <= 10; i++) mapping[i] = null;
              otherPlayers.forEach((p, idx) => {
                if (idx < rollSlots.length) {
                  const assignedRoll = rollSlots[idx];
                  mapping[assignedRoll] = { id: p.id, name: p.name, degree: degreeTable[assignedRoll - 1] };
                }
              });

              window.SQ_MODULES[41].normal.lastMapping = mapping;

              socket.emit("playerAction", {
                roomCode: targetRoom,
                action: "customEventFirstSpinResult",
                playerId: player.id,
                result: result,
                mapping: mapping,
                nextStepEventName: cfg.pcSecondTitle,
                pcSecondDesc: cfg.pcSecondDesc
              });

              // 🎯 2回目の共通スピン配信（最終決着）をここで待ち受ける！
              socket.on("spinRoulette", (secondData) => {
                if (!window.SQ_MODULES[41].normal.isSecondStage) return;
                const secondResult = secondData.result !== undefined ? secondData.result : 1;
                console.log(`📱 [スマホ受信-2回目決着] サーバー確定出目: ${secondResult}`);

                setTimeout(() => {
                  const currentMapping = window.SQ_MODULES[41].normal.lastMapping;
                  const hitTarget = currentMapping ? currentMapping[secondResult] : null;

                  if (hitTarget) {
                    player.isLover = true;
                    if (!player.lovers) player.lovers = [];
                    if (!player.lovers.includes(hitTarget.name)) player.lovers.push(hitTarget.name);
                    player.drinkCount = (player.drinkCount || 0) + 1;

                    socket.emit("playerAction", {
                      roomCode: targetRoom,
                      action: "customEventSecondSpinResult",
                      playerId: player.id,
                      result: secondResult,
                      successMessage: `💕 イベント大成功！ ${player.name} と ${hitTarget.name} が結ばれました！ 🍺`
                    });
                  } else {
                    socket.emit("playerAction", {
                      roomCode: targetRoom,
                      action: "customEventSecondSpinResult",
                      playerId: player.id,
                      result: secondResult,
                      failureMessage: "チャレンジ失敗...！💦"
                    });
                  }

                  setTimeout(() => {
                    document.body.classList.remove(cfg.themeClass);
                    window.SQ_MODULES[41].normal.isSecondStage = false;
                    socket.emit("playerAction", { roomCode: targetRoom, action: "squareEventFinished", updatedPlayer: player });
                  }, 3500);
                }, 3500); // ルーレットが回りきるのを待つ
              });

            } else {
              // 奇数失敗：即終了
              setTimeout(() => {
                alert(`出目 ${result}：残念！チャレンジ失敗です…💦`);
                document.body.classList.remove(cfg.themeClass);
                socket.emit("playerAction", { roomCode: targetRoom, action: "squareEventFinished", updatedPlayer: player });
              }, 3500);
            }
          }, 3500); // 1回目のルーレットが回りきるのを待つ
        });
      }
    }
  },
  salaryman: { id: 41, type: "force_stop", text: "【強制ストップ】社内恋愛勃発！？", location: "オフィス", event: function(player, square) { window.SQ_MODULES[41].normal.event(player, square); } },
  short: { id: 41, type: "force_stop", text: "【強制ストップ】スピード婚活チャンス！", location: "家", event: function(player, square) { window.SQ_MODULES[41].normal.event(player, square); } }
};
