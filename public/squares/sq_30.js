window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES[30] = {
  normal: {
    id: 30,
    type: "insurance_shop",
    text: "【強制ストップ】生命保険購入（0〜3枚選択可能）",
    drink: 0,
    happiness: 0,
    location: "家",
    event: function(player, square) {
      isPCEventMode = true; 
      console.log("[sq_30.js] 生命保険購入イベントをマスのファイルから自前で直接実行します。");
      if (typeof socket !== "undefined") {
        socket.emit("playerAction", {
          roomCode: roomCode,
          action: "triggerInsuranceShop",
          playerId: player.id,
          playerName: player.name
        });
      }
    }
  },
  salaryman: {
    id: 30,
    type: "insurance_shop",
    text: "【強制ストップ】生命保険・ライフプラン設計",
    drink: 0,
    happiness: 10,
    location: "オフィス",
    event: function(player, square) {
      window.SQ_MODULES[30].normal.event(player, square);
    }
  },
  short: {
    id: 30,
    type: "insurance_shop",
    text: "【強制ストップ】命の盾を闇取引！",
    drink: 1,
    happiness: 0,
    location: "家",
    event: function(player, square) {
      window.SQ_MODULES[30].normal.event(player, square);
    }
  }
};
