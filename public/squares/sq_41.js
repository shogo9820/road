// public/squares/sq_41.js
window.SQ_MODULES = window.SQ_MODULES || {};

// 🎯 41番マスのキー指定を完璧に配置
window.SQ_MODULES[41] = {
  // 🌸 横展開・再利用可能な汎用データ構造
  normal: {
    id: 41,
    type: "force_stop",
    text: "【強制ストップ】カップル成立！？", 
    location: "家",

    // 🎯 【再利用のための固有設定カタログ】
    config: {
      themeClass: "theme-couple",           
      pcFirstTitle: "💕 カップル成立チャンス 💕",
      pcFirstDesc: "運命 of 1回目スピンを回して【偶数】を狙え！",
      pcSecondTitle: "カップル告白",        
      pcSecondDesc: "スマホから最終決着スピンを回して、意中の相手を射止めろ！",
      
      mobileFirstDisplay: "🎯 偶数（告白チャンス）を狙ってね！",
      mobileFirstBtn: "🎲 運命 of 1回目スピンを回す！",
      mobileSecondBtn: "💘 決着の2回目（告白）スピン！"
    },
    
    // 🚀 メイン進行ロジック
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
          const condText = isEven ? '<span style="color:#d81b60; font-weight:bold;">💕 偶数：告白チャンス！</span>' : '<span style="color:#546e7a;">💦 奇数：タイミングが悪い...</span>';
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

        if (spinBtn) {
          spinBtn.disabled = false;
          spinBtn.textContent = cfg.mobileFirstBtn;
        }
        if (resultDisplay) {
          resultDisplay.textContent = cfg.mobileFirstDisplay;
        }

        if (spinBtn) {
          const newSpinBtn = spinBtn.cloneNode(true);
          spinBtn.parentNode.replaceChild(newSpinBtn, spinBtn);

          newSpinBtn.onclick = function() {
            newSpinBtn.disabled = true;
            if (resultDisplay) resultDisplay.textContent = "🌀 1回目ルーレット要求中...";
            
            const firstMapping = {
              1: { name: "💦 奇数：タイミングが悪い...", drinks: 0 },
              2: { name: "💕 偶数：告白チャンス！", drinks: 0 },
              3: { name: "💦 奇数：タイミングが悪い...", drinks: 0 },
              4: { name: "💕 偶数：告白チャンス！", drinks: 0 },
              5: { name: "💦 奇数：タイミングが悪い...", drinks: 0 },
              6: { name: "💕 偶数：告白チャンス！", drinks: 0 },
              7: { name: "💦 奇数：タイミングが悪い...", drinks: 0 },
              8: { name: "💕 偶数：告白チャンス！", drinks: 0 },
              9: { name: "💦 奇数：タイミングが悪い...", drinks: 0 },
              10: { name: "💕 偶数：告白チャンス！", drinks: 0 }
            };
            socket.emit("startCustomRouletteEvent", {
              roomCode: targetRoom,
              eventName: "カップル成立チャンス",
              mapping: firstMapping
            });
          };
        }
        // ──────────────────────────────────────────────────────────
        // 🌟 【1回目の結果受信】共通の配信出目を捕まえて、物理回転のみを同期実行
        // ──────────────────────────────────────────────────────────
        socket.off("spinCustomRoulette");
        socket.on("spinCustomRoulette", (data) => {
          // 🎯 【回した瞬間バグの完全修正】
          // ここで大画面の className やインナーHTMLをいじる処理を一切排除しました。
          // これにより、ルーレットが回っている間も1枚目のピンク画面の見た目がそのまま完全に固定されます。

          if (window.SQ_MODULES[41].normal.isSecondStage) return; // 2回目用ガード
          const resNum = data.result !== undefined ? data.result : 1;
          
          if (resultDisplay) resultDisplay.textContent = "🌀 1回目ルーレット回転中...";
          
          // 大画面のモーダル内物理ホイールのみを狙って、ピンク画面のまま同期回転させる
          let pcWheel = document.querySelector("#pc-event-modal .event-roulette-wheel");
          if (pcWheel && typeof pcCurrentRotation !== "undefined") {
            const targetDegrees = [342, 306, 270, 234, 198, 162, 126, 90, 54, 18];
            const stopAngle = targetDegrees[resNum - 1];
            pcCurrentRotation += 1800 + ((stopAngle - (pcCurrentRotation % 360) + 360) % 360);
            pcWheel.style.transition = "transform 3s cubic-bezier(0.15, 0.9, 0.2, 1)";
            pcWheel.style.transform = `rotate(${pcCurrentRotation}deg)`;
          }

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
            window.SQ_MODULES[41].normal.isSecondStage = true;

            const finalSpinBtn = document.getElementById("btn-phone-spin");
            if (finalSpinBtn) {
              finalSpinBtn.disabled = false;
              finalSpinBtn.textContent = cfg.mobileSecondBtn;
              if (resultDisplay) {
                resultDisplay.textContent = `🎯 1回目成功！いざ告白！`;
              }

              const newFinalBtn = finalSpinBtn.cloneNode(true);
              finalSpinBtn.parentNode.replaceChild(newFinalBtn, finalSpinBtn);

              newFinalBtn.onclick = function() {
                newFinalBtn.disabled = true;
                if (resultDisplay) resultDisplay.textContent = "🌀 最終ルーレット要求中...";
                
                const currentMapping = window.SQ_MODULES[41].normal.lastMapping || {};
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

            window.SQ_MODULES[41].normal.lastMapping = mapping;

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

            // 🎯 2回目のスピンがサーバーで開始された電波をスマホでもキャッチして同時回転
            socket.on("spinCustomRoulette", (secondData) => {
              if (!window.SQ_MODULES[41].normal.isSecondStage) return;
              const secNum = secondData.result !== undefined ? secondData.result : 1;
              
              if (resultDisplay) resultDisplay.textContent = "🌀 最終判定ルーレット回転中...";

              let pcWheel2 = document.querySelector("#pc-event-modal .event-roulette-wheel");
              if (pcWheel2 && typeof pcCurrentRotation !== "undefined") {
                const targetDegrees = [342, 306, 270, 234, 198, 162, 126, 90, 54, 18];
                const stopAngle = targetDegrees[secNum - 1];
                pcCurrentRotation += 1800 + ((stopAngle - (pcCurrentRotation % 360) + 360) % 360);
                pcWheel2.style.transition = "transform 3s cubic-bezier(0.15, 0.9, 0.2, 1)";
                pcWheel2.style.transform = `rotate(${pcCurrentRotation}deg)`;
              }

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
              const currentMapping = window.SQ_MODULES[41].normal.lastMapping;
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

              setTimeout(() => {
                document.body.classList.remove(cfg.themeClass);
                window.SQ_MODULES[41].normal.isSecondStage = false;
                socket.emit("playerAction", { roomCode: targetRoom, action: "squareEventFinished", updatedPlayer: player });
              }, 3500);
            });

          } else {
            // 🎯 奇数失敗時に、PC側のゴミ表示を完全にねじ伏せて結果をオリジナルの文字表現で流し込み！
            if (resultDisplay) resultDisplay.textContent = `💦 奇数 [出目:${result}] でフラれて終了…`;
            
            const modalResultBox = document.getElementById("modal-event-result-box");
            if (modalResultBox) {
              modalResultBox.style.display = "block";
              modalResultBox.className = "event-result-box failure"; // ピンク/赤系のボックスに固定
              modalResultBox.innerHTML = `
                <div style="font-size:1.8rem; font-weight:bold; margin-bottom:6px; color:#d81b60;">出目: ${result}</div>
                <div style="font-size:1.4rem; font-weight:bold; color:#e91e63;">💔 奇数：タイミングが悪い...</div>
              `;
            }

            // 大画面を自動で閉じて通常進行へ復帰
            setTimeout(() => {
              const targetModalEl = document.getElementById("pc-event-modal");
              if (targetModalEl) {
                targetModalEl.className = "event-modal-overlay";
                targetModalEl.style.display = "none";
              }
              const btnNext = document.getElementById("btn-next-turn");
              if (btnNext) { btnNext.disabled = false; btnNext.style.display = "block"; }
              
              document.body.classList.remove(cfg.themeClass);
              socket.emit("playerAction", { roomCode: targetRoom, action: "squareEventFinished", updatedPlayer: player });
            }, 3500);
          }
        });

        socket.on("startCustomEventSecondSpin", (data) => {
          window.SQ_MODULES[41].normal.lastMapping = data.mapping;
        });
      }
    }
  },
  salaryman: { id: 41, type: "force_stop", text: "【強制ストップ】社内恋愛勃発！？", location: "オフィス", event: function(player, square) { window.SQ_MODULES[41].normal.event(player, square); } },
  short: { id: 41, type: "force_stop", text: "【強制ストップ】スピード婚活チャンス！", location: "家", event: function(player, square) { window.SQ_MODULES[41].normal.event(player, square); } }
};
