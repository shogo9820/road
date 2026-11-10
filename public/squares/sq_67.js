window.SQ_MODULES = window.SQ_MODULES || {};
window.SQ_MODULES[67] = {
  normal: {
    id: 67,
    type: "normal",
    text: "【龍祭】バケツタピオカでぼろ儲け（【美人の場合】他のプレイヤー全員で乾杯）",
    drink: 0,
    happiness: 0,
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

      const isBijin = player.jobId === "bijin";
      applyDrinkAndHappiness(player, 0, 0);
      if (isBijin && typeof players !== "undefined" && Array.isArray(players)) {
        players.forEach((p) => {
          if (p && String(p.id) !== String(player.id)) {
            applyDrinkAndHappiness(p, 1, 0);
          }
        });
        if (typeof socket !== "undefined") {
          socket.emit("updateGameState", { roomCode: targetRoom, players: players });
        }
      }
      const resDisplay = document.getElementById("roulette-result-display");
      if (resDisplay) {
        resDisplay.textContent = isBijin
          ? "🌸 美人特典！他のプレイヤー全員1杯乾杯！"
          : `🎲 ${this.text}（0杯）`;
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
    id: 67,
    type: "normal",
    text: "【龍祭】バケツタピオカでぼろ儲け（【美人の場合】他のプレイヤー全員で乾杯）",
    drink: 0,
    happiness: 0,
    location: "家",
    event: function (p, s) { window.SQ_MODULES[67].normal.event(p, s); }
  },
  short: {
    id: 67,
    type: "normal",
    text: "【龍祭】バケツタピオカでぼろ儲け（【美人の場合】他のプレイヤー全員で乾杯）",
    drink: 0,
    happiness: 0,
    location: "家",
    event: function (p, s) { window.SQ_MODULES[67].normal.event(p, s); }
  }
};
