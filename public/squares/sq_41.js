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
      pcFirstTitle: "💕 カップル成立チャンス 💕",
      pcFirstDesc: "運命 of 1回目スピンを回して【偶数】を狙え！",
      pcSecondTitle: "カップル告白",
      pcSecondDesc: "スマホから最終決着スピンを回して、意中の相手を射止めろ！",

      mobileFirstDisplay: "🎯 偶数（告白チャンス）を狙ってね！",
      mobileFirstBtn: "🎲 運命 of 1回目スピンを回す！",
      mobileSecondBtn: "💘 決着の2回目（告白）スピン！",
    },

    event: function (player, square) {
      const cfg = this.config;
      const targetRoom =
        typeof currentRoomCode !== "undefined"
          ? currentRoomCode
          : typeof roomCode !== "undefined"
            ? roomCode
            : "";
      this.isSecondStage = false;
      this.lastMapping = null;

      // 💻 ① 【PC大画面側の初期描画】
      const pcModal = document.getElementById("pc-event-modal");
      if (pcModal) {
        if (typeof isPCEventMode !== "undefined") isPCEventMode = true;

        const btnNext = document.getElementById("btn-next-turn");
        if (btnNext) {
          btnNext.disabled = true;
          btnNext.style.display = "none";
        }

        pcModal.className = "event-modal-overlay active " + cfg.themeClass;
        pcModal.style.display = "flex";
        document.getElementById("modal-event-title").textContent =
          cfg.pcFirstTitle;
        document.getElementById("modal-event-desc").textContent =
          `${player.name} さんがマスに到着！ ${cfg.pcFirstDesc}`;

        const resultBox = document.getElementById("modal-event-result-box");
        if (resultBox) {
          resultBox.style.display = "none";
          resultBox.textContent = "";
        }

        let tableHTML = `
          <div class="event-table-title" style="font-size:1.3rem; color:#d81b60; margin-bottom:8px; font-weight:bold; border-bottom:2px solid #ff69b4; padding-bottom:4px;">🎯 1回目スピン：運命 of 判定条件表</div>
          <ul class="event-table-list">`;
        for (let i = 1; i <= 10; i++) {
          const isEven = i % 2 === 0;
          const badgeBg = isEven ? "#ff4081" : "#78909c";
          const condText = isEven
            ? '<span style="color:#d81b60; font-weight:bold;">💕 偶数：告白チャンス！</span>'
            : '<span style="color:#546e7a;">💦 奇数：タイミングが悪い...</span>';
          tableHTML += `<li class="event-table-item"><div class="event-table-num-badge" style="background:${badgeBg};">${i}</div><div>${condText}</div></li>`;
        }
        tableHTML += `</ul>`;
        document.getElementById("pc-event-table-dynamic-zone").innerHTML =
          tableHTML;
        document.getElementById("modal-roulette-result-display").textContent =
          "🎯 スマホから運命のスピンを回してね！";
        return;
      }

      // 📱 ② 【スマホ手元側の制御】
      if (typeof socket !== "undefined") {
        const spinBtn = document.getElementById("btn-phone-spin");
        const resultDisplay = document.getElementById(
          "roulette-result-display",
        );

        document.body.classList.add(cfg.themeClass);
        if (resultDisplay) resultDisplay.textContent = cfg.mobileFirstDisplay;

        // 1回目のスピンボタン設定
        if (spinBtn) {
          const newSpinBtn = spinBtn.cloneNode(true);
          spinBtn.parentNode.replaceChild(newSpinBtn, spinBtn);
          newSpinBtn.disabled = false;
          newSpinBtn.textContent = cfg.mobileFirstBtn;

          newSpinBtn.onclick = () => {
            newSpinBtn.disabled = true;
            if (resultDisplay)
              resultDisplay.textContent = "🌀 1回目ルーレット要求中...";
            socket.emit("startCustomRouletteEvent", {
              roomCode: targetRoom,
              eventName: cfg.pcFirstTitle,
              mapping: {},
            });
          };
        }

        // ホイール同期回転リスナー
        socket.off("spinCustomRoulette");
        socket.on("spinCustomRoulette", (data) => {
          const resNum = data.result !== undefined ? data.result : 1;
          if (resultDisplay)
            resultDisplay.textContent = "🌀 ルーレット回転中...";

          let pcWheel = document.querySelector(
            "#pc-event-modal .event-roulette-wheel",
          );
          if (pcWheel && typeof pcCurrentRotation !== "undefined") {
            const targetDegrees = [
              342, 306, 270, 234, 198, 162, 126, 90, 54, 18,
            ];
            pcCurrentRotation +=
              1800 +
              ((targetDegrees[resNum - 1] - (pcCurrentRotation % 360) + 360) %
                360);
            pcWheel.style.transition =
              "transform 3s cubic-bezier(0.15, 0.9, 0.2, 1)";
            pcWheel.style.transform = `rotate(${pcCurrentRotation}deg)`;
          }

          if (
            typeof currentRotation !== "undefined" &&
            typeof playMobileRouletteAnimation === "function"
          ) {
            const targetDegrees = [
              342, 306, 270, 234, 198, 162, 126, 90, 54, 18,
            ];
            currentRotation +=
              1800 +
              ((targetDegrees[resNum - 1] - (currentRotation % 360) + 360) %
                360);
            playMobileRouletteAnimation(resNum, currentRotation, () => {});
          }
        });

        // 決着通知リスナー（1回目と2回目を分岐処理）
        socket.off("customRouletteFinished");
        socket.on("customRouletteFinished", (data) => {
          const mod = window.SQ_MODULES[41].normal;
          const result = data && data.result !== undefined ? data.result : 1;

          // ─── 【第2段階（告白）の判定】 ───
          if (mod.isSecondStage) {
            const hitTarget = mod.lastMapping ? mod.lastMapping[result] : null;

            if (hitTarget) {
              player.isLover = true;
              if (!player.lovers) player.lovers = [];
              if (!player.lovers.includes(hitTarget.name)) player.lovers.push(hitTarget.name);
              player.drinkCount = (player.drinkCount || 0) + 1;

              // 🎯 直接イベント名を発射！名前も一緒に渡す
              socket.emit("customEventSecondSpinResult", {
                roomCode: targetRoom,
                playerId: player.id,
                result: result,
                targetA: player.name,
                targetB: hitTarget.name,
                success: true,
                successMessage: `🎉 おめでとう！ ${player.name} と ${hitTarget.name} が成立！全員で乾杯！ 🍻`
              });
            } else {
              socket.emit("customEventSecondSpinResult", {
                roomCode: targetRoom,
                playerId: player.id,
                result: result,
                success: false,
                failureMessage: "💔 チャレンジ失敗...！"
              });
            }

            // 終了クリーンアップ
            setTimeout(() => {
              document.body.classList.remove(cfg.themeClass);
              mod.isSecondStage = false;

              const resetBtn = document.getElementById("btn-phone-spin");
              if (resetBtn) {
                const cleanedBtn = resetBtn.cloneNode(true);
                resetBtn.parentNode.replaceChild(cleanedBtn, resetBtn);
                cleanedBtn.disabled = true;
                cleanedBtn.textContent = "⚡ ルーレットを回す！";
              }

              const pcNextBtnFinal = document.getElementById("btn-next-turn");
              if (pcNextBtnFinal) {
                pcNextBtnFinal.disabled = false;
                pcNextBtnFinal.style.display = "block";
              }

              socket.emit("playerAction", {
                roomCode: targetRoom,
                action: "squareEventFinished",
                updatedPlayer: player,
              });
            }, 3500);
            return;
          }

          // ─── 【第1段階の判定】 ───
          if (result % 2 === 0) {
            // 偶数成功：2回目へ移行
            mod.isSecondStage = true;

            const finalSpinBtn = document.getElementById("btn-phone-spin");
            if (finalSpinBtn) {
              const newFinalBtn = finalSpinBtn.cloneNode(true);
              finalSpinBtn.parentNode.replaceChild(newFinalBtn, finalSpinBtn);
              newFinalBtn.disabled = false;
              newFinalBtn.textContent = cfg.mobileSecondBtn;
              if (resultDisplay)
                resultDisplay.textContent = `🎯 1回目 [出目:${result}] 成功！相手を狙え！`;

              newFinalBtn.onclick = () => {
                newFinalBtn.disabled = true;
                if (resultDisplay)
                  resultDisplay.textContent = "🌀 告白ルーレット回転要求中...";
                socket.emit("startCustomRouletteEvent", {
                  roomCode: targetRoom,
                  eventName: cfg.pcSecondTitle,
                  mapping: mod.lastMapping || {},
                });
              };
            }

            // 他プレイヤーを1〜10へシャッフル割り当て
            const otherPlayers = (
              typeof players !== "undefined" ? players : []
            ).filter((p) => String(p.id) !== String(player.id));
            const rollSlots = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            for (let i = rollSlots.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [rollSlots[i], rollSlots[j]] = [rollSlots[j], rollSlots[i]];
            }

            const mapping = {};
            for (let i = 1; i <= 10; i++) mapping[i] = null;
            otherPlayers.forEach((p, idx) => {
              if (idx < rollSlots.length) {
                mapping[rollSlots[idx]] = { id: p.id, name: p.name };
              }
            });
            mod.lastMapping = mapping;

            // PC側の文字・対応表だけを切り替える電波を発信
            // sq_41.js: 偶数（result % 2 === 0）のブロック内
            // 🎯 サーバーの独立レシーバー customEventFirstSpinResult へ直撃送信！
            socket.emit("customEventFirstSpinResult", {
              roomCode: targetRoom,
              playerId: player.id,
              result: result,
              mapping: mapping,
              nextStepEventName: cfg.pcSecondTitle,
              pcSecondDesc: cfg.pcSecondDesc,
            });
          } else {
            // 奇数失敗：終了
            if (resultDisplay)
              resultDisplay.textContent = `💦 奇数 [出目:${result}] でフラれて終了…`;

            const modalResultBox = document.getElementById(
              "modal-event-result-box",
            );
            if (modalResultBox) {
              modalResultBox.style.display = "block";
              modalResultBox.className = "event-result-box failure";
              modalResultBox.innerHTML = `
                <div style="font-size:1.8rem; font-weight:bold; margin-bottom:6px; color:#d81b60;">出目: ${result}</div>
                <div style="font-size:1.4rem; font-weight:bold; color:#e91e63;">💔 奇数：タイミングが悪い...</div>
              `;
            }

            setTimeout(() => {
              const targetModalEl = document.getElementById("pc-event-modal");
              if (targetModalEl) {
                targetModalEl.className = "event-modal-overlay";
                targetModalEl.style.display = "none";
              }
              const btnNext = document.getElementById("btn-next-turn");
              if (btnNext) {
                btnNext.disabled = false;
                btnNext.style.display = "block";
              }
              const resetBtn = document.getElementById("btn-phone-spin");
              if (resetBtn) {
                const cleanedBtn = resetBtn.cloneNode(true);
                resetBtn.parentNode.replaceChild(cleanedBtn, resetBtn);
                cleanedBtn.disabled = true;
                cleanedBtn.textContent = "⚡ ルーレットを回す！";
              }
              document.body.classList.remove(cfg.themeClass);
              socket.emit("playerAction", {
                roomCode: targetRoom,
                action: "squareEventFinished",
                updatedPlayer: player,
              });
            }, 3500);
          }
        });
      }
    },
  },
  salaryman: {
    id: 41,
    type: "force_stop",
    text: "【強制ストップ】社内恋愛勃発！？",
    location: "オフィス",
    event: function (p, s) {
      window.SQ_MODULES[41].normal.event(p, s);
    },
  },
  short: {
    id: 41,
    type: "force_stop",
    text: "【強制ストップ】スピード婚活チャンス！",
    location: "家",
    event: function (p, s) {
      window.SQ_MODULES[41].normal.event(p, s);
    },
  },
};
