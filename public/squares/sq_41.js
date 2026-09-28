/**
 * 🎯 マスコンポーネント: 41番マス（【強制ストップ】カップル成立！？）
 * 
 * [設計思想]
 * 2段階ルーレットや複数恋人登録の高度な通信・判定処理はシステム側に委ね、
 * ここにはモード別のテキスト、見た目（theme-couple）、イベントの型（force_stop_couple）
 * のパラメーターのみを綺麗に内包させます。
 */

window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES = {
  // 🌸 現行：宅飲み人生ゲーム（サークル生活モード）
  normal: {
    id: 41,
    type: "force_stop_couple",     // 🎯 システムに「私はカップルイベントの型です」と伝える指定
    text: "【強制ストップ】カップル成立！？",
    drink: 0,
    happiness: 0,
    location: "家",
    modalConfig: {
      title: "💕 カップル成立チャンス！？ 💕",
      desc: "カップルマスに到着！運命 of 1回目スピンを回して【偶数】を狙え！",
      eventClass: "theme-couple"   // pc.cssに定義されているピンクテーマ
    }
  },

  // 💼 将来用拡張：社会人モード
  salaryman: {
    id: 41,
    type: "force_stop_couple",
    text: "【強制ストップ】運命の社内合コン！",
    drink: 1,
    happiness: 0,
    location: "居酒屋",
    modalConfig: {
      title: "🍻 運命の社内合コンチャンス 🍻",
      desc: "気になるあの人と急接近！？ルーレットを回して【偶数】を狙え！",
      eventClass: "theme-couple"
    }
  },

  // ⚡ 将来用拡張：ショートモード
  short: {
    id: 41,
    type: "force_stop_couple",
    text: "【強制ストップ】秒でカップル化",
    drink: 0,
    happiness: 10,
    location: "家",
    modalConfig: {
      title: "💖 スピードマッチング 💖",
      desc: "ノータイム告白！偶数を出して即付き合え！",
      eventClass: "theme-couple"
    }
  }
};
