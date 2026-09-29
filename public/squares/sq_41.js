window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES[41] = {
  normal: {
    id: 41,
    type: "force_stop",
    text: "【強制ストップ】カップル成立！？",
    drink: 0,
    happiness: 0,
    location: "家",
    
    // 🎯 【仕様変更】41番マスの重厚なカップル成立システムも、41番のファイルの中に100%綺麗に閉じ込める！
    event: function(player, square) {
      console.log(`[sq_41.js] 自前イベント起動。大画面のカップルモーダルを展開し、サーバーへ通知します。`);
      if (typeof openPCEventModal === "function") {
        openPCEventModal("カップル", player.name, player.id);
      }
      if (typeof socket !== "undefined") {
        socket.emit("triggerCoupleEvent", {
          roomCode: roomCode,
          playerId: player.id,
          playerName: player.name,
        });
      }
    }
  },
  salaryman: { id: 41, type: "force_stop", text: "【強制ストップ】社内恋愛勃発！？", drink: 0, happiness: 15, location: "オフィス", event: function(player, square) { this.normal.event(player, square); } },
  short: { id: 41, type: "force_stop", text: "【強制ストップ】スピード婚活チャンス！", drink: 1, happiness: 0, location: "家", event: function(player, square) { this.normal.event(player, square); } }
};
