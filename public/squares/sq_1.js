/**
 * 🎯 マスコンポーネント: 1番マス（【役職マス】イケメン）
 * 
 * [設計思想]
 * ロジックはシステム側の「役職マス共通エンジン」に一任するため、
 * ここにはモード別の「テキスト」「マスの種類」「紐づく役職ID」という設定データのみを持たせます。
 */

window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES[1] = {
  // 🌸 現行：宅飲み人生ゲーム（サークル生活モード）
  normal: {
    id: 1,
    type: "jobChallenge",       // 🎯 システムに「私は役職マスです」と伝える共通の型指定
    text: "【役職マス】イケメン",
    jobId: "ikemen",            // 👤 gameMaster.js（JOBS）のイケメンに紐付け
    drink: 0,
    happiness: 0,
    location: "スタート前"
  },

  // 💼 将来用拡張：社会人モード（引き出しを追加するだけで、いつでも拡張可能）
  salaryman: {
    id: 1,
    type: "jobChallenge",
    text: "【役職マス】平社員",
    jobId: "mob",               // 将来の社会人用の役職IDを指定
    drink: 0,
    happiness: 0,
    location: "配属先"
  },

  // ⚡ 将来用拡張：ショートモード
  short: {
    id: 1,
    type: "jobChallenge",
    text: "【役職マス】一発屋芸人",
    jobId: "omoshiro",
    drink: 0,
    happiness: 10,
    location: "家"
  }
};
