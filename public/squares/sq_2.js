/**
 * 🎯 マスコンポーネント: 2番マス（【役職マス】美人）
 * 
 * [設計思想]
 * 1番マスと完全に同じ役職マスの型（jobChallenge）を再利用し、
 * 美人（bijin）の役職IDとテキストを綺麗に内包させます。
 */

window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES [2] = {
  // 🌸 現行：宅飲み人生ゲーム（サークル生活モード）
  normal: {
    id: 2,
    type: "jobChallenge",       // 🎯 役職マスの型を指定
    text: "【役職マス】美人",
    jobId: "bijin",             // 👤 gameMaster.js（JOBS）の美人に紐付け
    drink: 0,
    happiness: 0,
    location: "スタート前"
  },

  // 💼 将来用拡張：社会人モード
  salaryman: {
    id: 2,
    type: "jobChallenge",
    text: "【役職マス】受付嬢",
    jobId: "bijin",             
    drink: 0,
    happiness: 5,
    location: "本社ロビー"
  },

  // ⚡ 将来用拡張：ショートモード
  short: {
    id: 2,
    type: "jobChallenge",
    text: "【役職マス】インフルエンサー",
    jobId: "bijin",
    drink: 0,
    happiness: 20,
    location: "家"
  }
};
