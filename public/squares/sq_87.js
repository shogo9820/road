window.SQ_MODULES = window.SQ_MODULES || {};
window.SQ_MODULES[87] = {
  normal: {
    id: 87,
    type: "normal",
    text: "【追いコン】みんな今までありがとう！全員で乾杯！（全員１杯飲む）",
    drink: 1,
    degree: 25,
    happiness: 30,
    location: "家",
    event: function (player, square) {
      // PC側は着地時のテキスト反映に任せるため早期リターン
      if (document.getElementById("pc-event-modal")) return;

      const targetRoom =
        typeof currentRoomCode !== "undefined"
          ? currentRoomCode
          : typeof roomCode !== "undefined"
            ? roomCode
            : "";

      // 止まった本人の幸福度 +30
      if (player.happiness === undefined) player.happiness = 100;
      player.happiness += 30;

      // 参加プレイヤー全員に 1杯（HP -10）を加算
      if (typeof players !== "undefined" && Array.isArray(players)) {
        players.forEach((p) => {
          if (!p) return;
          const jobMaster =
            typeof JOBS !== "undefined" && Array.isArray(JOBS)
              ? JOBS.find(
                  (j) =>
                    j.id === p.jobId ||
                    j.label === p.job ||
                    j.title === p.job
                )
              : null;
          const baseCap = jobMaster ? jobMaster.cap : p.baseCap || 80;
          const maxHp = baseCap + (p.bonusCap || 0);
          if (p.currentHp === undefined) p.currentHp = maxHp;

          p.drinkCount = (p.drinkCount || 0) + 1;
          p.currentHp = Math.max(0, p.currentHp - 10);

          if (p.currentHp <= 0) {
            if (p.happiness === undefined) p.happiness = 100;
            p.happiness = Math.max(0, p.happiness - 30);
            p.skipTurn = true;
            p.currentHp = maxHp;
          }
        });
      } else {
        player.drinkCount = (player.drinkCount || 0) + 1;
      }

      const resDisplay = document.getElementById("roulette-result-display");
      if (resDisplay) {
        resDisplay.textContent = `🍻 ${this.text}`;
      }

      if (typeof updatePhoneStatusDisplay === "function") {
        updatePhoneStatusDisplay();
      }

      if (typeof socket !== "undefined") {
        if (typeof players !== "undefined" && Array.isArray(players)) {
          socket.emit("updateGameState", {
            roomCode: targetRoom,
            players: players
          });
        }
        socket.emit("playerAction", {
          roomCode: targetRoom,
          action: "squareEventFinished",
          updatedPlayer: player
        });
      }
    }
  },
  salaryman: {
    id: 87,
    type: "normal",
    text: "送別会で花束をもらい感涙の乾杯！",
    drink: 2,
    degree: 25,
    happiness: 25,
    location: "居酒屋"
  },
  short: {
    id: 87,
    type: "normal",
    text: "追いコンで全員感謝の乾杯！",
    drink: 2,
    degree: 25,
    happiness: 20,
    location: "Qoo"
  }
};
