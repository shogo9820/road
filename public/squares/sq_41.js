window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES[41] = {
  // 🌸 現行：サークル生活モード
  normal: {
    id: 41,
    type: "force_stop",
    text: "【強制ストップ】カップル成立！？",
    drink: 0,
    happiness: 0,
    location: "家",
    
    event: function(player, square) {
      console.log("[sq_41.js] 41番マス着地。演出と条件表の生成を直接実行します。");

      // 💻 ① 【PC大画面側だった場合の直接処理】
      if (typeof isPCEventMode !== "undefined") {
        isPCEventMode = true;

        const btnNext = document.getElementById("btn-next-turn");
        if (btnNext) { btnNext.disabled = true; btnNext.style.display = "none"; }

        const pcModal = document.getElementById("pc-event-modal");
        if (pcModal) {
          pcModal.className = "event-modal-overlay active theme-couple";
          document.getElementById("modal-event-title").textContent = "💕 カップル成立チャンス！？ 💕";
          document.getElementById("modal-event-desc").textContent = `${player.name} さんがカップルマスに到着！運命 of 1回目スピンを回して【偶数】を狙え！`;

          const resultBox = document.getElementById("modal-event-result-box");
          if (resultBox) { resultBox.style.display = "none"; resultBox.className = "event-result-box"; resultBox.textContent = ""; }

          // 1〜10の判定条件表をダイレクト生成
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
        }
        return;
      }

      // 📱 ② 【スマホ手元側だった場合の直接処理（通信の上書きバインド）】
      if (typeof socket !== "undefined") {
        // 🌟 1回目スピン結果受信
        socket.off("coupleRouletteResult");
        socket.on("coupleRouletteResult", (data) => {
          const result = data.result;
          if (result % 2 === 0) {
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

            socket.emit("playerAction", {
              roomCode: currentRoomCode || "",
              action: "customEventFirstSpinResult",
              playerId: player.id,
              result: result,
              mapping: mapping,
              nextStepEventName: "カップル告白"
            });
          } else {
            // 奇数はノータイムで PHASE_WAIT_NEXT 完了報告！
            socket.emit("playerAction", { roomCode: currentRoomCode || "", action: "squareEventFinished", updatedPlayer: player });
          }
        });

        // 🌟 2回目（最終決着）スピン結果受信
        socket.off("coupleSecondRouletteResult");
        socket.on("coupleSecondRouletteResult", (data) => {
          const result = data.result;
          const currentMapping = window.SQ_MODULES[41].normal.lastMapping;
          const hitTarget = currentMapping ? currentMapping[result] : null;

          if (hitTarget) {
            player.isLover = true;
            if (!player.lovers) player.lovers = [];
            if (!player.lovers.includes(hitTarget.name)) player.lovers.push(hitTarget.name);
            player.drinkCount = (player.drinkCount || 0) + 1;

            socket.emit("playerAction", {
              roomCode: currentRoomCode || "",
              action: "customEventSecondSpinResult",
              playerId: player.id,
              result: result,
              successMessage: `💕 カップル成立！ ${player.name} と ${hitTarget.name} は、2人仲良く 杯数＋1！ 🍺`
            });

            // 🎯 【ルーティン結合】3.5秒の余韻のあと、最新ステータスを乗せて PHASE_WAIT_NEXT へ一斉報告！
            setTimeout(() => {
              socket.emit("playerAction", { roomCode: currentRoomCode || "", action: "squareEventFinished", updatedPlayer: player });
            }, 3500);
          } else {
            socket.emit("playerAction", { roomCode: currentRoomCode || "", action: "customEventSecondSpinResult", playerId: player.id, result: result, failureMessage: "告白失敗...！💦" });
            setTimeout(() => {
              socket.emit("playerAction", { roomCode: currentRoomCode || "", action: "squareEventFinished", updatedPlayer: player });
            }, 3500);
          }
        });

        socket.on("startCustomEventSecondSpin", (data) => {
          window.SQ_MODULES[41].normal.lastMapping = data.mapping;
        });
      }
    }
  },
  salaryman: { id: 41, type: "force_stop", text: "【強制ストップ】社内恋愛勃発！？", drink: 0, happiness: 15, location: "オフィス", event: function(player, square) { window.SQ_MODULES[41].normal.event(player, square); } },
  short: { id: 41, type: "force_stop", text: "【強制ストップ】スピード婚活チャンス！", drink: 1, happiness: 0, location: "家", event: function(player, square) { window.SQ_MODULES[41].normal.event(player, square); } }
};
