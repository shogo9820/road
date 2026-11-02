// public/squares/sq_80.js
window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES[80] = {
  normal: {
    id: 80,
    type: "force_stop",
    text: "【強制ストップマス】引退（ギャンブル）",
    location: "家",
    drink: 0,
    happiness: 0,

    config: {
      themeClass: "theme-entrance",
      pcTitle: "🎓 サークル引退ギャンブル 🎓",
      pcDesc: "さんの引退式！所持している生命保険をすべて発動してルーレットに挑め！",
      mobileDisplay: "🎯 生命保険を全発動！引退ルーレットを回せ！",
      mobileBtn: "🎲 運命の引退ルーレットを回す！"
    },

    /**
     * 出目(1〜10)の杯数マッピングを生成
     * ベース:
     *   10: 5杯 / 9,8: 4杯 / 7,6: 3杯 / 5,4: 2杯 / 3,2: 1杯 / 1: 0杯
     * 生命保険の自動発動:
     *   1枚: 10 (5杯) ➔ 0杯
     *   2枚: 10,9,8 (5杯,4杯) ➔ 0杯
     *   3枚: 10,9,8,7,6 (5杯,4杯,3杯) ➔ 0杯
     *   4枚: 10〜4 (5杯〜2杯) ➔ 0杯
     *   5枚以上: 10〜1 すべて ➔ 0杯
     */
    buildRetirementMapping: function (usedInsurance) {
      const mapping = {};
      for (let i = 1; i <= 10; i++) {
        const baseDrinks = Math.floor(i / 2);
        const isShielded = baseDrinks > 0 && baseDrinks > 5 - usedInsurance;
        const finalDrinks = isShielded ? 0 : baseDrinks;

        let label = "";
        if (isShielded) {
          label = `🛡️ 0杯（生命保険で${baseDrinks}杯を無効化！）`;
        } else if (finalDrinks === 0) {
          label = `✨ セーフ！ (0杯)`;
        } else {
          label = `🍺 ${finalDrinks}杯飲む`;
        }

        mapping[i] = {
          name: label,
          drinks: finalDrinks,
          baseDrinks: baseDrinks,
          isShielded: isShielded
        };
      }
      return mapping;
    },

    event: function (player, square) {
      const cfg = this.config;
      const mod = this;
      const targetRoom =
        typeof currentRoomCode !== "undefined"
          ? currentRoomCode
          : typeof roomCode !== "undefined"
            ? roomCode
            : "";

      const usedInsurance = Math.max(0, Number(player.insurance || 0));
      const gambleMapping = this.buildRetirementMapping(usedInsurance);

      console.log(
        `🎓 [80番マス: 引退ギャンブル] ${player.name} のイベント開始（生命保険 ${usedInsurance}枚 全て使用）`
      );

      // 💻 ① 【PC大画面側の直接処理】
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
        document.getElementById("modal-event-title").textContent = cfg.pcTitle;

        const insuranceStatusText =
          usedInsurance > 0
            ? `🛡️ 生命保険 ${usedInsurance}枚 をすべて発動中！`
            : `⚠️ 所持している生命保険は 0枚！`;
        document.getElementById("modal-event-desc").textContent =
          `${player.name} ${cfg.pcDesc}（${insuranceStatusText}）`;

        const resultBox = document.getElementById("modal-event-result-box");
        if (resultBox) {
          resultBox.style.display = "none";
          resultBox.className = "event-result-box";
          resultBox.textContent = "";
        }

        let tableHTML = `
          <div class="event-title" style="font-size:1.3rem; color:#1976d2; margin-bottom:8px; font-weight:bold; border-bottom:2px solid #2196f3; padding-bottom:4px;">🍺 引退ルーレット判定表（保険${usedInsurance}枚適用）</div>
          <ul class="event-table-list">`;
        for (let i = 1; i <= 10; i++) {
          const item = gambleMapping[i];
          let badgeBg = "#4caf50";
          let textColor = "#2e7d32";
          if (item.isShielded) {
            badgeBg = "#9c27b0";
            textColor = "#7b1fa2";
          } else if (item.drinks >= 4) {
            badgeBg = "#d32f2f";
            textColor = "#c62828";
          } else if (item.drinks >= 2) {
            badgeBg = "#ff9800";
            textColor = "#e65100";
          } else if (item.drinks === 1) {
            badgeBg = "#1976d2";
            textColor = "#1565c0";
          }
          tableHTML += `<li class="event-table-item"><div class="event-table-num-badge" style="background:${badgeBg};">${i}</div><div><span style="color:${textColor}; font-weight:bold;">${item.name}</span></div></li>`;
        }
        tableHTML += `</ul>`;
        document.getElementById("pc-event-table-dynamic-zone").innerHTML =
          tableHTML;
        document.getElementById("modal-roulette-result-display").textContent =
          "🎯 スマホから運命のスピンを回してね！";
        return;
      }

      // 📱 ② 【スマホ手元側の直接処理】
      if (typeof socket !== "undefined") {
        const spinBtn = document.getElementById("btn-phone-spin");
        const resultDisplay = document.getElementById(
          "roulette-result-display"
        );
        const insuranceBtn = document.getElementById("btn-phone-use-insurance");

        document.body.classList.add(cfg.themeClass);
        if (resultDisplay) {
          resultDisplay.textContent =
            usedInsurance > 0
              ? `🛡️ 生命保険 ${usedInsurance}枚 すべて発動！ルーレットを回そう！`
              : cfg.mobileDisplay;
        }

        // このイベントで全ての生命保険を消費するため手動保険ボタンはロック
        if (insuranceBtn) {
          insuranceBtn.disabled = true;
          insuranceBtn.textContent =
            usedInsurance > 0
              ? `🛡️ 生命保険 全${usedInsurance}枚 自動発動中！`
              : `🛡️ 生命保険を利用する (0枚)`;
        }

        if (spinBtn) {
          const newSpinBtn = spinBtn.cloneNode(true);
          spinBtn.parentNode.replaceChild(newSpinBtn, spinBtn);
          newSpinBtn.disabled = false;
          newSpinBtn.textContent = cfg.mobileBtn;

          newSpinBtn.onclick = function () {
            newSpinBtn.disabled = true;
            if (resultDisplay)
              resultDisplay.textContent = "🌀 ルーレット回転要求中...";

            // プレイヤーの生命保険をすべて消費
            player.insurance = 0;

            socket.emit("startCustomRouletteEvent", {
              roomCode: targetRoom,
              eventName: "引退ギャンブル判定",
              mapping: gambleMapping,
              consumeAllInsurance: true
            });
          };
        }

        // ホイール同期回転リスナー
        if (mod._onSpin) socket.off("spinCustomRoulette", mod._onSpin);
        mod._onSpin = (data) => {
          const resNum = data.result !== undefined ? data.result : 1;
          if (resultDisplay)
            resultDisplay.textContent = "🌀 ルーレット回転中...";

          let pcWheel = document.querySelector(
            "#pc-event-modal .event-roulette-wheel"
          );
          if (pcWheel && typeof pcCurrentRotation !== "undefined") {
            const targetDegrees = [
              342, 306, 270, 234, 198, 162, 126, 90, 54, 18
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
              342, 306, 270, 234, 198, 162, 126, 90, 54, 18
            ];
            currentRotation +=
              1800 +
              ((targetDegrees[resNum - 1] - (currentRotation % 360) + 360) %
                360);
            playMobileRouletteAnimation(resNum, currentRotation, () => {});
          }
        };
        socket.on("spinCustomRoulette", mod._onSpin);

        // 決着通知リスナー
        if (mod._onFinished)
          socket.off("customRouletteFinished", mod._onFinished);
        mod._onFinished = (data) => {
          if (mod._onSpin) socket.off("spinCustomRoulette", mod._onSpin);
          if (mod._onFinished)
            socket.off("customRouletteFinished", mod._onFinished);

          player.insurance = 0;
          if (typeof updatePhoneStatusDisplay === "function") {
            updatePhoneStatusDisplay();
          }

          if (resultDisplay && data && data.message) {
            resultDisplay.textContent = `🎯 結果: ${data.message}`;
          }
          document.body.classList.remove(cfg.themeClass);

          const resetBtn = document.getElementById("btn-phone-spin");
          if (resetBtn) {
            const cleanedBtn = resetBtn.cloneNode(true);
            resetBtn.parentNode.replaceChild(cleanedBtn, resetBtn);
            cleanedBtn.disabled = true;
            cleanedBtn.textContent = "⚡ ルーレットを回す！";
            if (typeof requestSpin === "function") {
              cleanedBtn.addEventListener("click", requestSpin);
            }
          }
        };
        socket.on("customRouletteFinished", mod._onFinished);
      }
    }
  },
  salaryman: {
    id: 80,
    type: "force_stop",
    text: "【強制ストップ】早期退職・引退",
    location: "オフィス",
    drink: 0,
    happiness: 0,
    event: function (player, moduleData) {
      window.SQ_MODULES[80].normal.event(player, moduleData);
    }
  },
  short: {
    id: 80,
    type: "force_stop",
    text: "【強制ストップ】引退ギャンブル！",
    location: "家",
    drink: 0,
    happiness: 0,
    event: function (player, moduleData) {
      window.SQ_MODULES[80].normal.event(player, moduleData);
    }
  }
};
