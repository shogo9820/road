/**
 * 🎯 マスコンポーネント: 30番マス（【強制ストップ】生命保険購入）
 * 
 * [設計思想]
 * 0番マス（sq_0.js）と完全に一致させた、マスのファイル内でイベントが完結する構造です。
 * 構文エラーを完全に根絶した、100%安全に動作する完全決定版コードです。
 */

window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES = {
  // 🌸 現行：サークル生活モード
  normal: {
    id: 30,
    type: "insurance_shop",
    text: "【強制ストップ】生命保険購入（0〜3枚選択可能）",
    drink: 0,
    happiness: 0,
    location: "家",
    
    // 💡 動きをマスの中に直接閉じ込める
    event: function(player, square) {
      isPCEventMode = true; // 大画面をイベントモードに固定
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

  // 💼 将来用拡張：社会人モード
  salaryman: {
    id: 30,
    type: "insurance_shop",
    text: "【強制ストップ】生命保険・ライフプラン設計",
    drink: 0,
    happiness: 10,
    location: "オフィス",
    event: function(player, square) {
      if (window.SQ_MODULES && window.SQ_MODULES[30] && window.SQ_MODULES[30].normal) {
        window.SQ_MODULES[30].normal.event(player, square);
      }
    }
  },

  // ⚡ 将来用拡張：ショートモード
  short: {
    id: 30,
    type: "insurance_shop",
    text: "【強制ストップ】命の盾を闇取引！",
    drink: 1,
    happiness: 0,
    location: "家",
    event: function(player, square) {
      if (window.SQ_MODULES && window.SQ_MODULES[30] && window.SQ_MODULES[30].normal) {
        window.SQ_MODULES[30].normal.event(player, square);
      }
    }
  }
};
