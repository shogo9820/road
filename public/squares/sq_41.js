// public/squares/sq_41.js
window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES[41] = {
  // 🌸 横展開・再利用可能な汎用データ構造
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
      mobileFirstBtn: "🎲 運命 of 1回目スピンを回す！",
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
        // 🔥 【1回目スピン発火】
        // ──────────────────────────────────────────────────────────
        if (spinBtn) {
          const newSpinBtn = spinBtn.cloneNode(true);
          spinBtn.parentNode.replaceChild(newSpinBtn, spinBtn);

          newSpinBtn.onclick = function() {
            newSpinBtn.disabled = true;
            if (resultDisplay) resultDisplay.textContent = "🌀 1回目ルーレット要求中...";
            
            const firstMapping = {
              1: { name: "奇数", drinks: 0 }, 2: { name: "偶数", drinks: 0 }, 3: { name: "奇数", drinks: 0 }, 4: { name: "偶数", drinks: 0 }, 5: { name: "奇数", drinks: 0 },
              6: { name: "偶数", drinks: 0 }, 7: { name: "奇数", drinks: 0 }, 8: { name: "偶数", drinks: 0 }, 9: { name: "奇数", drinks: 0 }, 10: { name: "偶数", drinks: 0 }
            };
            socket.emit("startCustomRouletteEvent", {
              roomCode: targetRoom,
              eventName: "カップル成立チャンス",
              mapping: firstMapping
            });
          };
        }
        // ──────────────────────────────────────────────────────────
        // 🌟 【1回目の結果受信】共通の配信出目を捕まえて、偶数なら2回目ボタンへ進化、奇数なら終了
        // ──────────────────────────────────────────────────────────
        socket.off("spinCustomRoulette");
        socket.on("spinCustomRoulette", (data) => {
          if (window.SQ_MODULES[41].normal.isSecondStage) return; // 2回目用ガード
          const resNum = data.result !== undefined ? data.result : 1;
          
          if (resultDisplay) resultDisplay.textContent = "🌀 1回目ルーレット回転中...";
          if (typeof currentRotation !== "undefined" && typeof playMobileRouletteAnimation === "function") {
            const targetDegrees = [342, 306, 270, 234, 198, 162, 126, 90, 54, 18];
            currentRotation += 1800 + ((targetDegrees[resNum - 1] - (currentRotation % 360) + 360) % 360);
            playMobileRouletteAnimation(resNum, currentRotation, (finalSteps) => {});
          }
        });

        socket.off("customRouletteFinished");
        socket.on("customRouletteFinished", (data) => {
          if (window.SQ_MODULES[41].normal.isSecondStage) return; // 2回目用ガード
          const result = data.result;

          if (result % 2 === 0) {
            // 【偶数成功：2回目（告白）スピンの段取りへ移行】
            window.SQ_MODULES.normal.isSecondStage = true;

            const finalSpinBtn = document.getElementById("btn-phone-spin");
            if (finalSpinBtn) {
              finalSpinBtn.disabled = false;
              finalSpinBtn.textContent = cfg.mobileSecondBtn;
              if (resultDisplay) resultDisplay.textContent = `🎯 1回目 [出目:${result}] で成功！最終決着へ！`;

              const newFinalBtn = finalSpinBtn.cloneNode(true);
              finalSpinBtn.parentNode.replaceChild(newFinalBtn, finalSpinBtn);

              newFinalBtn.onclick = function() {
                newFinalBtn.disabled = true;
                if (resultDisplay) resultDisplay.textContent = "🌀 最終ルーレット要求中...";
                
                const currentMapping = window.SQ_MODULES.normal.lastMapping || {};
                socket.emit("startCustomRouletteEvent", {
                  roomCode: targetRoom,
                  eventName: cfg.pcSecondTitle,
                  mapping: currentMapping
                });
              };
            }

            // 自分以外のプレイヤーをシャッフル割り当て
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

            window.SQ_MODULES.normal.lastMapping = mapping;

            // サーバー経由でPC大画面の対応表をプレイヤー名へ切り替える
            socket.emit("playerAction", {
              roomCode: targetRoom,
              action: "customEventFirstSpinResult",
              playerId: player.id,
              result: result,
              mapping: mapping,
              nextStepEventName: cfg.pcSecondTitle,
              pcSecondDesc: cfg.pcSecondDesc
            });

            // 🎯 2回目のスピンがサーバーで開始された電波をスマホでもキャッチして同時回転！
            socket.on("spinCustomRoulette", (secondData) => {
              if (!window.SQ_MODULES[41].normal.isSecondStage) return;
              const secNum = secondData.result !== undefined ? secondData.result : 1;
              
              if (resultDisplay) resultDisplay.textContent = "🌀 最終判定ルーレット回転中...";
              if (typeof currentRotation !== "undefined" && typeof playMobileRouletteAnimation === "function") {
                const targetDegrees = [342, 306, 270, 234, 198, 162, 126, 90, 54, 18];
                currentRotation += 1800 + ((targetDegrees[secNum - 1] - (currentRotation % 360) + 360) % 360);
                playMobileRouletteAnimation(secNum, currentRotation, (finalSteps) => {});
              }
            });

            // 🎯 2回目の最終決着通知を受け取ったら、成否判定を行い、通常状態へ戻す
            socket.on("customRouletteFinished", (secondFinishData) => {
              if (!window.SQ_MODULES[41].normal.isSecondStage) return;
              const finalRes = secondFinishData.result;
              const currentMapping = window.SQ_MODULES.normal.lastMapping;
              const hitTarget = currentMapping ? currentMapping[finalRes] : null;

              if (hitTarget) {
                player.isLover = true;
                if (!player.lovers) player.lovers = [];
                if (!player.lovers.includes(hitTarget.name)) player.lovers.push(hitTarget.name);
                player.drinkCount = (player.drinkCount || 0) + 1;

                socket.emit("playerAction", {
                  roomCode: targetRoom,
                  action: "customEventSecondSpinResult",
                  playerId: player.id,
                  result: finalRes,
                  successMessage: `💕 イベント大成功！ ${player.name} と ${hitTarget.name} が結ばれました！ 🍺`
                });
              } else {
                socket.emit("playerAction", {
                  roomCode: targetRoom,
                  action: "customEventSecondSpinResult",
                  playerId: player.id,
                  result: finalRes,
                  failureMessage: "チャレンジ失敗...！💦"
                });
              }

              // 3.5秒の余韻のあと、着せ替えを剥がして安全に交代待機へ完了報告
              setTimeout(() => {
                document.body.classList.remove(cfg.themeClass);
                window.SQ_MODULES.normal.isSecondStage = false;
                socket.emit("playerAction", { roomCode: targetRoom, action: "squareEventFinished", updatedPlayer: player });
              }, 3500);
            });

          } else {
            // 奇数失敗：即終了リレー
            if (resultDisplay) resultDisplay.textContent = `💦 奇数 [出目:${result}] でフラれて終了…`;
            setTimeout(() => {
              document.body.classList.remove(cfg.themeClass);
              socket.emit("playerAction", { roomCode: targetRoom, action: "squareEventFinished", updatedPlayer: player });
            }, 2500);
          }
        });
      }
    }
  },
  salaryman: { id: 41, type: "force_stop", text: "【強制ストップ】社内恋愛勃発！？", location: "オフィス", event: function(player, square) { window.SQ_MODULES.normal.event(player, square); } },
  short: { id: 41, type: "force_stop", text: "【強制ストップ】スピード婚活チャンス！", location: "家", event: function(player, square) { window.SQ_MODULES.normal.event(player, square); } }
};
