/**
 * 🎯 マスコンポーネント: 30番マス（【強制ストップ】生命保険購入）
 * 
 * [設計思想]
 * 0〜3枚の購入枚数選択ダイアログをスマホ側にポップアップさせます。
 * 難しい処理はすべて親機・子機の共通エンジンに委ねるため、ここにはカタログデータのみを持たせます。
 */

window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES = {
  // 🌸 現行：サークル生活モード
  normal: {
    id: 30,
    type: "insurance_shop", // 🎯 専用のイベント型を指定
    text: "【強制ストップ】生命保険購入（0〜3枚選択可能）",
    drink: 0,
    happiness: 0,
    location: "家"
  },

  // 💼 将来用拡張：社会人モード
  salaryman: {
    id: 30,
    type: "insurance_shop",
    text: "【強制ストップ】生命保険・ガチのライフプラン設計",
    drink: 0,
    happiness: 10,
    location: "オフィス"
  },

  // ⚡ 将来用拡張：ショートモード
  short: {
    id: 30,
    type: "insurance_shop",
    text: "【強制ストップ】命の盾を闇取引！",
    drink: 1,
    happiness: 0,
    location: "家"
  }
};
