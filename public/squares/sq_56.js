window.SQ_MODULES = window.SQ_MODULES || {};
window.SQ_MODULES[56] = {
  normal: {
    id: 56,
    type: "normal",
    text: "チャミスルはカルチャー（【韓国人の場合】２杯飲む）",
    drink: 0,
    happiness: 5,
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

      const isMatch = player.jobId === "korean";
      const drinkAmount = isMatch ? 2 : 0;
      applyDrinkAndHappiness(player, drinkAmount, 0);
      const resDisplay = document.getElementById("roulette-result-display");
      if (resDisplay) {
        resDisplay.textContent = isMatch
          ? "🍺 韓国人対象！2杯飲みます！"
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
    id: 56,
    type: "normal",
    text: "チャミスルはカルチャー（【韓国人の場合】２杯飲む）",
    drink: 0,
    happiness: 5,
    location: "家",
    event: function (p, s) { window.SQ_MODULES[56].normal.event(p, s); }
  },
  short: {
    id: 56,
    type: "normal",
    text: "チャミスルはカルチャー（【韓国人の場合】２杯飲む）",
    drink: 0,
    happiness: 5,
    location: "家",
    event: function (p, s) { window.SQ_MODULES[56].normal.event(p, s); }
  }
};
