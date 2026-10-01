window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES[80] = {
  normal: {
    id: 80,
    type: "force_stop",
    text: "【強制ストップマス】引退（ギャンブル）",
    location: "家",
    drink: 0,
    happiness: 0,
    event: function (player, moduleData) {
      console.log(`🎓 [80番マス: 引退] ${player.name} の引退ギャンブルイベント開始`);
      const targetRoom = typeof currentRoomCode !== "undefined" ? currentRoomCode : (typeof roomCode !== "undefined" ? roomCode : "");

      // ギャンブル出目対応表（1〜10）
      const gambleMapping = {
        1: { name: "大負け！ (3杯飲む & 幸福度-30)", drinks: 3, happiness: -30 },
        2: { name: "負け！ (2杯飲む & 幸福度-20)", drinks: 2, happiness: -20 },
        3: { name: "負け！ (2杯飲む)", drinks: 2, happiness: 0 },
        4: { name: "ちょい負け！ (1杯飲む)", drinks: 1, happiness: 0 },
        5: { name: "引き分け！ (0杯)", drinks: 0, happiness: 0 },
        6: { name: "引き分け！ (0杯)", drinks: 0, happiness: 0 },
        7: { name: "ちょい勝ち！ (幸福度+10)", drinks: 0, happiness: 10 },
        8: { name: "勝ち！ (他全員1杯奢り)", drinks: 0, happiness: 20 },
        9: { name: "大勝ち！ (幸福度+30)", drinks: 0, happiness: 30 },
        10: { name: "万馬券・大勝利！ (幸福度+50 & 他全員2杯)", drinks: 0, happiness: 50 }
      };

      if (typeof socket !== "undefined") {
        socket.emit("openCustomRouletteModal", {
          roomCode: targetRoom,
          eventName: "引退ギャンブル！最後の勝負",
          mapping: gambleMapping
        });
      }
    }
  },
  salaryman: {
    id: 80,
    type: "force_stop",
    text: "【強制ストップ】早期退職・引退",
    location: "オフィス",
    drink: 1,
    happiness: 10,
    event: function (player, moduleData) { window.SQ_MODULES[80].normal.event(player, moduleData); }
  },
  short: {
    id: 80,
    type: "force_stop",
    text: "【強制ストップ】引退ギャンブル！",
    location: "家",
    drink: 2,
    happiness: 0,
    event: function (player, moduleData) { window.SQ_MODULES[80].normal.event(player, moduleData); }
  }
};
