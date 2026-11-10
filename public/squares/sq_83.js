window.SQ_MODULES = window.SQ_MODULES || {};
window.SQ_MODULES[83] = {
  normal: {
    id: 83,
    type: "normal",
    text: "【秋キャン】HOT LIMIT（１杯飲む【サッカーキャラの場合】２杯飲む）",
    drink: 1,
    happiness: 15,
    location: "家",
    event: function (player, square) {
      if (document.getElementById("pc-event-modal")) return;

      const targetRoom =
        typeof currentRoomCode !== "undefined"
          ? currentRoomCode
          : typeof roomCode !== "undefined"
            ? roomCode
            : "";

      function applyDrinkAndHappiness(targetP, drinkAmt, happyAmt) {
        const jobMaster =
          typeof JOBS !== "undefined" && Array.isArray(JOBS)
            ? JOBS.find(
                (j) =>
                  j.id === targetP.jobId ||
                  j.label === targetP.job ||
                  j.title === targetP.job
              )
            : null;
        const baseCap = jobMaster ? jobMaster.cap : targetP.baseCap || 80;
        const maxHp = baseCap + (targetP.bonusCap || 0);
        if (targetP.currentHp === undefined) targetP.currentHp = maxHp;

        if (drinkAmt > 0) {
          targetP.drinkCount = (targetP.drinkCount || 0) + drinkAmt;
          targetP.currentHp = Math.max(0, targetP.currentHp - drinkAmt * 10);
        }
        if (happyAmt !== 0) {
          if (targetP.happiness === undefined) targetP.happiness = 100;
          targetP.happiness += happyAmt;
        }
        if (targetP.currentHp <= 0) {
          if (targetP.happiness === undefined) targetP.happiness = 100;
          targetP.happiness = Math.max(0, targetP.happiness - 30);
          targetP.skipTurn = true;
          targetP.currentHp = maxHp;
        }
      }

      const isMatch =
        player.jobId === "soccer" ||
        ["サッカーキャラ","超絶イケメン天才カリスマフットボールプレイヤー"].includes(player.job);
      const drinkAmount = isMatch ? 2 : 1;
      applyDrinkAndHappiness(player, drinkAmount, 15);
      const resDisplay = document.getElementById("roulette-result-display");
      if (resDisplay) {
        resDisplay.textContent = isMatch
          ? "⚽ サッカーキャラ対象！2杯飲みます！"
          : drinkAmount > 0
            ? `🎲 ${this.text}（${drinkAmount}杯）`
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
    id: 83,
    type: "normal",
    text: "【秋キャン】HOT LIMIT（１杯飲む【サッカーキャラの場合】２杯飲む）",
    drink: 1,
    happiness: 15,
    location: "家",
    event: function (p, s) { window.SQ_MODULES[83].normal.event(p, s); }
  },
  short: {
    id: 83,
    type: "normal",
    text: "【秋キャン】HOT LIMIT（１杯飲む【サッカーキャラの場合】２杯飲む）",
    drink: 1,
    happiness: 15,
    location: "家",
    event: function (p, s) { window.SQ_MODULES[83].normal.event(p, s); }
  }
};
