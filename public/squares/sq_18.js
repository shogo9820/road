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
    
    event: function (player, moduleData) {
      const cfg = this.config;
      console.log(`🌸 [18番マス: 入学式] ${player.name} のイベント開始`);
      const targetRoom = typeof currentRoomCode !== "undefined" ? currentRoomCode : (typeof roomCode !== "undefined" ? roomCode : "");

      // 💻 ① 【PC大画面側だった場合の直接処理】
      const pcModal = document.getElementById("pc-event-modal");
      if (pcModal) {
        if (typeof isPCEventMode !== "undefined") isPCEventMode = true;

        const btnNext = document.getElementById("btn-next-turn");
        if (btnNext) { btnNext.disabled = true; btnNext.style.display = "none"; }

        if (player.jobId === "bijin") {
          if (typeof socket !== "undefined") {
            socket.emit("openBijinKanpaiModal", { roomCode: targetRoom, playerName: player.name });
          }
          return;
        }

        pcModal.className = "event-modal-overlay active " + cfg.themeClass;
        document.getElementById("modal-event-title").textContent = cfg.pcFirstTitle;
        document.getElementById("modal-event-desc").textContent = `${player.name} ${cfg.pcFirstDesc}`;

        const resultBox = document.getElementById("modal-event-result-box");
        if (resultBox) { resultBox.style.display = "none"; resultBox.className = "event-result-box"; resultBox.textContent = ""; }

        let tableHTML = `
          <div class="event-title" style="font-size:1.3rem; color:#d81b60; margin-bottom:8px; font-weight:bold; border-bottom:2px solid #ff69b4; padding-bottom:4px;">💖 判定対応表</div>
          <ul class="event-table-list">`;
        const entranceMapping = {
          1: "俺ばり飲めるっす！！！ (2杯飲む)", 2: "俺ばり飲めるっす！！！ (2杯飲む)", 3: "俺ばり飲めるっす！！！ (2杯飲む)",
          4: "とりあえず飲めや！！！ (1杯飲む)", 5: "とりあえず飲めや！！！ (1杯飲む)", 6: "とりあえず飲めや！！！ (1杯飲む)", 7: "とりあえず飲めや！！！ (1杯飲む)",
          8: "回避！ (0杯)", 9: "回避！ (0杯)", 10: "回避！ (0杯)"
        };
        for (let i = 1; i <= 10; i++) {
          tableHTML += `<li class="event-table-item"><div class="event-table-num-badge" style="background:#ff4081;">${i}</div><div><span style="color:#e91e63; font-weight:bold;">${entranceMapping[i]}</span></div></li>`;
        }
        tableHTML += `</ul>`;
        document.getElementById("pc-event-table-dynamic-zone").innerHTML = tableHTML;
        document.getElementById("modal-roulette-result-display").textContent = "🎯 スマホから運命のスピンを回してね！";
        return;
      }

      // 📱 ② 【スマホ手元側だった場合の直接処理】
      if (typeof socket !== "undefined") {
        const spinBtn = document.getElementById("btn-phone-spin");
        const resultDisplay = document.getElementById("roulette-result-display");

        if (player.jobId === "bijin") {
          if (typeof players !== "undefined" && Array.isArray(players)) {
            players.forEach((p) => { if (p.id !== player.id) p.drinkCount = (p.drinkCount || 0) + 1; });
          }
          socket.emit("playerAction", { roomCode: targetRoom, action: "squareEventFinished", updatedPlayer: player });
          return;
        }

        document.body.classList.add(cfg.themeClass);
        if (spinBtn) { spinBtn.disabled = false; spinBtn.textContent = cfg.mobileFirstBtn; }
        if (resultDisplay) resultDisplay.textContent = cfg.mobileFirstDisplay;

        if (spinBtn) {
          // 重複EventListenerをへし折るためにクローン化
          const newSpinBtn = spinBtn.cloneNode(true);
          spinBtn.parentNode.replaceChild(newSpinBtn, spinBtn);

          // 🎯 【重要】自分で勝手に出目を決めず、通常のルーレット要求をそのままサーバーに頼む！
          newSpinBtn.onclick = function() {
            newSpinBtn.disabled = true;
            console.log("📱 [スマホ発信] 18番マスの通常スピン要求をサーバーへ送信します。");
            socket.emit("requestSpinRoulette", { roomCode: targetRoom });
          };
        }

        // 🎯 【重要】サーバーからPCと同時に配信されてくる同じ出目（spinRoulette）を捕まえて、ここで最終決着へ回す！
        socket.off("spinRoulette");
        socket.on("spinRoulette", (data) => {
          const resNum = data.result !== undefined ? data.result : 1;
          console.log(`📱 [スマホ受信] サーバー確定出目 [${resNum}] を受信。同時回転アニメーションの後、結果を確定します。`);
          
          const entranceMapping = {
            1: { name: "俺ばり飲めるっす！！！ (2杯飲む)", drinks: 2 }, 2: { name: "俺ばり飲めるっす！！！ (2杯飲む)", drinks: 2 }, 3: { name: "俺ばり飲めるっす！！！ (2杯飲む)", drinks: 2 },
            4: { name: "とりあえず飲めや！！！ (1杯飲む)", drinks: 1 }, 5: { name: "とりあえず飲めや！！！ (1杯飲む)", drinks: 1 }, 6: { name: "とりあえず飲めや！！！ (1杯飲む)", drinks: 1 }, 7: { name: "とりあえず飲めや！！！ (1杯飲む)", drinks: 1 },
            8: { name: "回避！ (0杯)", drinks: 0 }, 9: { name: "回避！ (0杯)", drinks: 0 }, 10: { name: "回避！ (0杯)", drinks: 0 }
          };
          const outcome = entranceMapping[resNum];

          // 3.5秒後（PCとスマホのルーレットが回りきったタイミング）にサーバーへ結果報告
          setTimeout(() => {
            player.drinkCount = (player.drinkCount || 0) + (outcome.drinks || 0);
            
            socket.emit("playerAction", {
              roomCode: targetRoom,
              action: "squareEventFinished",
              updatedPlayer: player
            });
            document.body.classList.remove(cfg.themeClass);
          }, 3500);
        });
      }
    }
  },
  salaryman: { id: 18, type: "force_stop", text: "【強制ストップマス】入社式", location: "本社ビル", event: function(player, square) { window.SQ_MODULES[18].normal.event(player, square); } },
  short: { id: 18, type: "force_stop", text: "【強制ストップマス】爆速入学", location: "家", event: function(player, square) { window.SQ_MODULES[18].normal.event(player, square); } }
};
