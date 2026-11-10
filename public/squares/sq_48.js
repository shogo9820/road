window.SQ_MODULES = window.SQ_MODULES || {};
window.SQ_MODULES[48] = {
  normal: {
    id: 48,
    type: "normal",
    text: "【夏合宿】4位（【サッカーキャラの場合】２杯飲む）",
    drink: 0,
    happiness: 0,
    location: "家",
    event: function (player, square) {
      // PC側は通常のマス内容表示のみ行うため早期リターン
      if (document.getElementById("pc-event-modal")) return;

      const targetRoom =
        typeof currentRoomCode !== "undefined"
          ? currentRoomCode
          : typeof roomCode !== "undefined"
            ? roomCode
            : "";

      const isSoccer =
        player.jobId === "soccer" ||
        player.job === "サッカーキャラ" ||
        player.job === "超絶イケメン天才カリスマフットボールプレイヤー";

      const drinkAmount = isSoccer ? 2 : 0;

      if (drinkAmount > 0) {
        const jobMaster =
          typeof JOBS !== "undefined" && Array.isArray(JOBS)
            ? JOBS.find(
                (j) =>
                  j.id === player.jobId ||
                  j.label === player.job ||
                  j.title === player.job
              )
            : null;
        const baseCap = jobMaster ? jobMaster.cap : player.baseCap || 80;
        const maxHp = baseCap + (player.bonusCap || 0);
        if (player.currentHp === undefined) player.currentHp = maxHp;

        player.drinkCount = (player.drinkCount || 0) + drinkAmount;
        player.currentHp = Math.max(0, player.currentHp - drinkAmount * 10);

        if (player.currentHp <= 0) {
          if (player.happiness === undefined) player.happiness = 100;
          player.happiness = Math.max(0, player.happiness - 30);
          player.skipTurn = true;
          player.currentHp = maxHp;
        }
      }

      const resDisplay = document.getElementById("roulette-result-display");
      if (resDisplay) {
        resDisplay.textContent = isSoccer
          ? `⚽ サッカーキャラ対象！2杯飲みます！`
          : `🎲 ${this.text}（対象外のため0杯）`;
      }

      if (typeof updatePhoneStatusDisplay === "function") {
        updatePhoneStatusDisplay();
      }

      if (typeof socket !== "undefined") {
        socket.emit("playerAction", {
          roomCode: targetRoom,
          action: "squareEventFinished",
          updatedPlayer: player
        });
      }
    }
  },
  salaryman: {
    id: 48,
    type: "normal",
    text: "社内eスポーツ大会で惜しくも4位。悔しくて飲む。",
    drink: 2,
    happiness: -5,
    location: "オフィス"
  },
  short: {
    id: 48,
    type: "normal",
    text: "合宿罰ゲームの一気飲み！",
    drink: 2,
    happiness: 0,
    location: "家"
  }
};
