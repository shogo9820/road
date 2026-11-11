window.SQ_MODULES = window.SQ_MODULES || {};
window.SQ_MODULES[70] = {
  normal: {
    id: 70,
    type: "normal",
    text: "リア充は爆発しろ！（１杯飲む【恋人がいる場合】それぞれ２杯飲む）",
    drink: 1,
    happiness: -5,
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

      const hasLover = Boolean(player.isLover && Array.isArray(player.lovers) && player.lovers.length > 0);
      if (hasLover) {
        applyDrinkAndHappiness(player, 2, 0);
        if (typeof players !== "undefined" && Array.isArray(players)) {
          players.forEach((p) => {
            if (p && String(p.id) !== String(player.id) && player.lovers.includes(p.name)) {
              applyDrinkAndHappiness(p, 2, 0);
            }
          });
          if (typeof socket !== "undefined") {
            socket.emit("updateGameState", { roomCode: targetRoom, players: players });
          }
        }
      } else {
        applyDrinkAndHappiness(player, 1, 0);
      }
      const resDisplay = document.getElementById("roulette-result-display");
      if (resDisplay) {
        resDisplay.textContent = hasLover
          ? `💕 恋人と一緒にそれぞれ2杯飲む！`
          : `🍺 恋人がいないため1杯飲む！`;
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
    id: 70,
    type: "normal",
    text: "リア充は爆発しろ！（１杯飲む【恋人がいる場合】それぞれ２杯飲む）",
    drink: 1,
    happiness: -5,
    location: "家",
    event: function (p, s) { window.SQ_MODULES[70].normal.event(p, s); }
  },
  short: {
    id: 70,
    type: "normal",
    text: "リア充は爆発しろ！（１杯飲む【恋人がいる場合】それぞれ２杯飲む）",
    drink: 1,
    happiness: -5,
    location: "家",
    event: function (p, s) { window.SQ_MODULES[70].normal.event(p, s); }
  }
};
