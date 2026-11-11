window.SQ_MODULES = window.SQ_MODULES || {};
window.SQ_MODULES[35] = {
  normal: {
    id: 35,
    type: "normal",
    text: "飲んだら平安（【平安生の場合】平安生全員で乾杯）",
    drink: 0,
    happiness: 5,
    location: "ぱいぱい",
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

      const isMatch = player.jobId === "heian";
      applyDrinkAndHappiness(player, 0, 5);
      if (isMatch && typeof players !== "undefined" && Array.isArray(players)) {
        players.forEach((p) => {
          if (p && p.jobId === "heian") {
            applyDrinkAndHappiness(p, 1, 0);
          }
        });
        if (typeof socket !== "undefined") {
          socket.emit("updateGameState", { roomCode: targetRoom, players: players });
        }
      }
      const resDisplay = document.getElementById("roulette-result-display");
      if (resDisplay) {
        resDisplay.textContent = isMatch ? "🍻 平安生全員で乾杯！（平安生全員1杯）" : "🎲 飲んだら平安（平安生以外は0杯）";
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
    id: 35,
    type: "normal",
    text: "飲んだら平安（【平安生の場合】平安生全員で乾杯）",
    drink: 0,
    happiness: 5,
    location: "ぱいぱい",
    event: function (p, s) { window.SQ_MODULES[35].normal.event(p, s); }
  },
  short: {
    id: 35,
    type: "normal",
    text: "飲んだら平安（【平安生の場合】平安生全員で乾杯）",
    drink: 0,
    happiness: 5,
    location: "ぱいぱい",
    event: function (p, s) { window.SQ_MODULES[35].normal.event(p, s); }
  }
};
