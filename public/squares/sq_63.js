window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES[63] = {
  normal: {
    id: 63,
    type: "rankup_chance",
    text: "ランクアップチャンス！",
    drink: 0,
    happiness: 0,
    location: "家",

    config: {
      themeClass: "theme-rankup",
      pcTitle: "🔥 ランクアップチャンス 🔥",
      pcDesc: "さんの実力が試される時！6以上を出して役職ランクアップを掴み取れ！",
      mobileDisplay: "🎯 6以上を出して役職ランクアップを狙え！",
      mobileBtn: "🔥 運命のランクアップスピンを回す！"
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

      const jobMaster =
        typeof JOBS !== "undefined" && Array.isArray(JOBS)
          ? JOBS.find(
              (j) =>
                j.id === player.jobId ||
                j.label === player.job ||
                j.title === player.job
            )
          : null;
      const currentJobName = jobMaster
        ? jobMaster.label
        : player.job || "モブ";
      const rankUpJobName = jobMaster
        ? jobMaster.title
        : player.job || "代表or副代表";

      // 既にランクアップ済みの場合はスキップして完了
      if (player.isRankedUp) {
        if (document.getElementById("pc-event-modal")) return;
        const resDisplay = document.getElementById("roulette-result-display");
        if (resDisplay) {
          resDisplay.textContent = `👑 既に【${rankUpJobName}】へランクアップ済みです！`;
        }
        if (typeof socket !== "undefined") {
          socket.emit("playerAction", {
            roomCode: targetRoom,
            action: "squareEventFinished",
            updatedPlayer: player
          });
        }
        return;
      }

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
        document.getElementById("modal-event-desc").textContent =
          `${player.name} ${cfg.pcDesc}（現在: ${currentJobName} ➔ 成功時: ${rankUpJobName}）`;

        const resultBox = document.getElementById("modal-event-result-box");
        if (resultBox) {
          resultBox.style.display = "none";
          resultBox.className = "event-result-box";
          resultBox.textContent = "";
        }

        let tableHTML = `
          <div class="event-title" style="font-size:1.3rem; color:#b78103; margin-bottom:8px; font-weight:bold; border-bottom:2px solid #f5a623; padding-bottom:4px;">👑 ランクアップ判定対応表</div>
          <ul class="event-table-list">`;
        for (let i = 1; i <= 10; i++) {
          const isRankUp = i >= 6;
          const targetTitle =
            (player.jobId === "mob" || currentJobName === "モブ")
              ? i >= 9
                ? "代表"
                : "副代表"
              : rankUpJobName;
          const badgeBg = isRankUp ? "#f5a623" : "#78909c";
          const rowText = isRankUp
            ? `<span style="color:#d84315; font-weight:bold;">🔥 ランクアップ！【${targetTitle}】に昇格！</span>`
            : `<span style="color:#546e7a; font-weight:bold;">💦 現状維持（${currentJobName} のまま）</span>`;
          tableHTML += `<li class="event-table-item"><div class="event-table-num-badge" style="background:${badgeBg};">${i}</div><div>${rowText}</div></li>`;
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
        const resultDisplay = document.getElementById("roulette-result-display");

        document.body.classList.add(cfg.themeClass);
        if (resultDisplay) resultDisplay.textContent = cfg.mobileDisplay;

        if (spinBtn) {
          const newSpinBtn = spinBtn.cloneNode(true);
          spinBtn.parentNode.replaceChild(newSpinBtn, spinBtn);
          newSpinBtn.disabled = false;
          newSpinBtn.textContent = cfg.mobileBtn;

          newSpinBtn.onclick = function () {
            newSpinBtn.disabled = true;
            if (resultDisplay)
              resultDisplay.textContent = "🌀 ルーレット回転要求中...";

            const rankupMapping = {};
            for (let i = 1; i <= 10; i++) {
              if (i >= 6) {
                const targetTitle =
                  (player.jobId === "mob" || currentJobName === "モブ")
                    ? i >= 9
                      ? "代表"
                      : "副代表"
                    : rankUpJobName;
                rankupMapping[i] = {
                  name: `🎉 ランクアップ成功！【${targetTitle}】に昇格！`,
                  drinks: 0,
                  isRankUp: true,
                  newJobTitle: targetTitle
                };
              } else {
                rankupMapping[i] = {
                  name: `💦 現状維持...（${currentJobName} のまま）`,
                  drinks: 0,
                  isRankUp: false
                };
              }
            }

            socket.emit("startCustomRouletteEvent", {
              roomCode: targetRoom,
              eventName: "ランクアップ判定",
              mapping: rankupMapping
            });
          };
        }

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

        if (mod._onFinished)
          socket.off("customRouletteFinished", mod._onFinished);
        mod._onFinished = (data) => {
          if (mod._onSpin) socket.off("spinCustomRoulette", mod._onSpin);
          if (mod._onFinished)
            socket.off("customRouletteFinished", mod._onFinished);

          const resNum = data && data.result !== undefined ? data.result : 1;
          if (resNum >= 6) {
            const targetTitle =
              (player.jobId === "mob" || currentJobName === "モブ")
                ? resNum >= 9
                  ? "代表"
                  : "副代表"
                : rankUpJobName;
            player.job = targetTitle;
            player.isRankedUp = true;
            if (typeof updatePhoneStatusDisplay === "function") {
              updatePhoneStatusDisplay();
            }
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
    id: 63,
    type: "rankup_chance",
    text: "ランクアップチャンス！",
    drink: 0,
    happiness: 0,
    location: "家",
    event: function (p, s) { window.SQ_MODULES[63].normal.event(p, s); }
  },
  short: {
    id: 63,
    type: "rankup_chance",
    text: "ランクアップチャンス！",
    drink: 0,
    happiness: 0,
    location: "家",
    event: function (p, s) { window.SQ_MODULES[63].normal.event(p, s); }
  }
};
