/**
 * 🎯 マスコンポーネント: 30番マス（【強制ストップ】生命保険購入）
 * 
 * [設計思想]
 * 0番マス（sq_0.js）と200%完全に一致させた「window.SQ_MODULES[30]」の構造に統一し、
 * 親機側からイベント関数（event）を100%確実に引き出せるようにします。
 */

window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES[30] = { // 🎯 【核心の修正】30番の引き出しを正しく挟む！
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
      console.log(`[sq_30.js] 30番マスの自前イベントを実行。スマホ側へ購入ダイアログを送信します。`);
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
      if (window.SQ_MODULES[30] && window.SQ_MODULES[30].normal) {
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
      if (window.SQ_MODULES[30] && window.SQ_MODULES[30].normal) {
        window.SQ_MODULES[30].normal.event(player, square);
      }
    }
  }
};
