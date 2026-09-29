/**
 * 🎯 マスコンポーネント: 41番マス（【強制ストップ】カップル成立！？）
 * 
 * [設計思想]
 * 0番マス（sq_0.js）と200%完全に一致させた「window.SQ_MODULES[41]」の構造に統一し、
 * 親機側からイベント関数（event）を100%確実に引き出せるようにします。
 */

window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES[41] = { // 🎯 【核心の修正】41番の引き出しを正しく挟む！
  // 🌸 現行：サークル生活モード
  normal: {
    id: 41,
    type: "force_stop",
    text: "【強制ストップ】カップル成立！？",
    drink: 0,
    happiness: 0,
    location: "家",
    
    // 💡 動きをマスの中に直接閉じ込める
    event: function(player, square) {
      console.log(`[sq_41.js] 41番マスの自前イベントを実行。大画面カップルモーダルを展開します。`);
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

  // 💼 将来用拡張：社会人モード
  salaryman: {
    id: 41,
    type: "force_stop",
    text: "【強制ストップ】社内恋愛勃発！？",
    drink: 0,
    happiness: 15,
    location: "オフィス",
    event: function(player, square) {
      if (window.SQ_MODULES[41] && window.SQ_MODULES[41].normal) {
        window.SQ_MODULES[41].normal.event(player, square);
      }
    }
  },

  // ⚡ 将来用拡張：ショートモード
  short: {
    id: 41,
    type: "force_stop",
    text: "【強制ストップ】スピード婚活チャンス！",
    drink: 1,
    happiness: 0,
    location: "家",
    event: function(player, square) {
      if (window.SQ_MODULES[41] && window.SQ_MODULES[41].normal) {
        window.SQ_MODULES[41].normal.event(player, square);
      }
    }
  }
};
