// public/squares/sq_18.js
window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES[18] = {
  normal: {
    id: 18,
    type: "force_stop",
    text: "【強制ストップ】サークル入学式！", 
    location: "家",

    config: {
      themeClass: "theme-entrance",
      pcFirstTitle: "🌸 入学式 🌸",
      pcFirstDesc: "さんの大学生活がスタート！洗礼ルーレットを回せ！",
      mobileFirstDisplay: "🎯 洗礼を回避する出目を狙え！",
      mobileFirstBtn: "⚡ 運命の入学式スピンを回す！"
    },
    
    event: function (player, square) {
      const cfg = this.config;
      const targetRoom = typeof currentRoomCode !== "undefined" ? currentRoomCode : (typeof roomCode !== "undefined" ? roomCode : "");
      console.log(`🌸 [18番マス: 入学式] ${player.name} のイベント開始`);

      // 💻 ① 【PC大画面側の直接処理】
      const pcModal = document.getElementById("pc-event-modal");
      if (pcModal) {
        if (typeof isPCEventMode !== "undefined") isPCEventMode = true;

        const btnNext = document.getElementById("btn-next-turn");
        if (btnNext) { btnNext.disabled = true; btnNext.style.display = "none"; }

        // 美人役職の場合の即時乾杯
        if (player.jobId === "bijin") {
          if (typeof socket !== "undefined") {
            socket.emit("openBijinKanpaiModal", { roomCode: targetRoom, playerName: player.name });
          }
          return;
        }

        pcModal.className = "event-modal-overlay active " + cfg.themeClass;
        pcModal.style.display = "flex";
        document.getElementById("modal-event-title").textContent = cfg.pcFirstTitle;
        document.getElementById("modal-event-desc").textContent = `${player.name} ${cfg.pcFirstDesc}`;

        const resultBox = document.getElementById("modal-event-result-box");
        if (resultBox) { resultBox.style.display = "none"; resultBox.className = "event-result-box"; resultBox.textContent = ""; }

        let tableHTML = `
          <div class="event-title" style="font-size:1.3rem; color:#1976d2; margin-bottom:8px; font-weight:bold; border-bottom:2px solid #2196f3; padding-bottom:4px;">🍺 洗礼判定対応表</div>
          <ul class="event-table-list">`;
        const entranceMapping = {
          1: "俺ばり飲めるっす！！！ (2杯飲む)", 2: "俺ばり飲めるっす！！！ (2杯飲む)", 3: "俺ばり飲めるっす！！！ (2杯飲む)",
          4: "とりあえず飲めや！！！ (1杯飲む)", 5: "とりあえず飲めや！！！ (1杯飲む)", 6: "とりあえず飲めや！！！ (1杯飲む)", 7: "とりあえず飲めや！！！ (1杯飲む)",
          8: "回避！ (0杯)", 9: "回避！ (0杯)", 10: "回避！ (0杯)"
        };
        for (let i = 1; i <= 10; i++) {
          const badgeBg = i <= 3 ? "#f44336" : i <= 7 ? "#ff9800" : "#4caf50";
          tableHTML += `<li class="event-table-item"><div class="event-table-num-badge" style="background:${badgeBg};">${i}</div><div><span style="color:#333; font-weight:bold;">${entranceMapping[i]}</span></div></li>`;
        }
        tableHTML += `</ul>`;
        document.getElementById("pc-event-table-dynamic-zone").innerHTML = tableHTML;
        document.getElementById("modal-roulette-result-display").textContent = "🎯 スマホから運命のスピンを回してね！";
        return;
      }

      // 📱 ② 【スマホ手元側の直接処理】
      if (typeof socket !== "undefined") {
        const spinBtn = document.getElementById("btn-phone-spin");
        const resultDisplay = document.getElementById("roulette-result-display");

        // 美人役職の場合
        if (player.jobId === "bijin") {
          if (typeof players !== "undefined" && Array.isArray(players)) {
            players.forEach((p) => { if (p.id !== player.id) p.drinkCount = (p.drinkCount || 0) + 1; });
          }
          socket.emit("playerAction", { roomCode: targetRoom, action: "squareEventFinished", updatedPlayer: player });
          return;
        }

        document.body.classList.add(cfg.themeClass);
        if (resultDisplay) resultDisplay.textContent = cfg.mobileFirstDisplay;

        if (spinBtn) {
          const newSpinBtn = spinBtn.cloneNode(true);
          spinBtn.parentNode.replaceChild(newSpinBtn, spinBtn);
          newSpinBtn.disabled = false;
          newSpinBtn.textContent = cfg.mobileFirstBtn;

          newSpinBtn.onclick = function() {
            newSpinBtn.disabled = true;
            if (resultDisplay) resultDisplay.textContent = "🌀 ルーレット回転要求中...";
            
            const entranceMapping = {
              1: { name: "俺ばり飲めるっす！！！ (2杯飲む)", drinks: 2 }, 2: { name: "俺ばり飲めるっす！！！ (2杯飲む)", drinks: 2 }, 3: { name: "俺ばり飲めるっす！！！ (2杯飲む)", drinks: 2 },
              4: { name: "とりあえず飲めや！！！ (1杯飲む)", drinks: 1 }, 5: { name: "とりあえず飲めや！！！ (1杯飲む)", drinks: 1 }, 6: { name: "とりあえず飲めや！！！ (1杯飲む)", drinks: 1 }, 7: { name: "とりあえず飲めや！！！ (1杯飲む)", drinks: 1 },
              8: { name: "回避！ (0杯)", drinks: 0 }, 9: { name: "回避！ (0杯)", drinks: 0 }, 10: { name: "回避！ (0杯)", drinks: 0 }
            };

            socket.emit("startCustomRouletteEvent", {
              roomCode: targetRoom,
              eventName: "入学式洗礼判定",
              mapping: entranceMapping
            });
          };
        }

        // ホイール同期回転リスナー
        socket.off("spinCustomRoulette");
        socket.on("spinCustomRoulette", (data) => {
          const resNum = data.result !== undefined ? data.result : 1;
          if (resultDisplay) resultDisplay.textContent = "🌀 ルーレット回転中...";

          let pcWheel = document.querySelector("#pc-event-modal .event-roulette-wheel");
          if (pcWheel && typeof pcCurrentRotation !== "undefined") {
            const targetDegrees = [342, 306, 270, 234, 198, 162, 126, 90, 54, 18];
            pcCurrentRotation += 1800 + ((targetDegrees[resNum - 1] - (pcCurrentRotation % 360) + 360) % 360);
            pcWheel.style.transition = "transform 3s cubic-bezier(0.15, 0.9, 0.2, 1)";
            pcWheel.style.transform = `rotate(${pcCurrentRotation}deg)`;
          }

          if (typeof currentRotation !== "undefined" && typeof playMobileRouletteAnimation === "function") {
            const targetDegrees = [342, 306, 270, 234, 198, 162, 126, 90, 54, 18];
            currentRotation += 1800 + ((targetDegrees[resNum - 1] - (currentRotation % 360) + 360) % 360);
            playMobileRouletteAnimation(resNum, currentRotation, () => {});
          }
        });

        // 決着通知リスナー
        socket.off("customRouletteFinished");
        socket.on("customRouletteFinished", (data) => {
          if (resultDisplay) resultDisplay.textContent = `🎯 結果: ${data.message}`;
          setTimeout(() => {
            document.body.classList.remove(cfg.themeClass);
            const resetBtn = document.getElementById("btn-phone-spin");
            if (resetBtn) {
              const cleanedBtn = resetBtn.cloneNode(true);
              resetBtn.parentNode.replaceChild(cleanedBtn, resetBtn);
              cleanedBtn.disabled = true;
              cleanedBtn.textContent = "⚡ ルーレットを回す！";
            }
          }, 3500);
        });
      }
    }
  },
  salaryman: { id: 18, type: "force_stop", text: "【強制ストップマス】入社式", location: "本社ビル", event: function(p, s) { window.SQ_MODULES[18].normal.event(p, s); } },
  short: { id: 18, type: "force_stop", text: "【強制ストップマス】爆速入学", location: "家", event: function(p, s) { window.SQ_MODULES[18].normal.event(p, s); } }
};
