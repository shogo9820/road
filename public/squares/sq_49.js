/**
 * 🎯 マスコンポーネント: 49番マス（【強制ストップ】ランクアップチャンス！）
 * 
 * [設計思想]
 * Aルート(50-58)とBルート(59-79)の範囲を完璧に直書きし、
 * 選ばれなかった方の進路すべてに自動で美しく影を落とします。
 */

window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES = {
  // 🌸 現行：サークル生活モード
  normal: {
    id: 49,
    type: "branch",
    text: "【強制ストップ】ランクアップチャンス！",
    drink: 0,
    happiness: 0,
    location: "家",
    
    routes: [
      {
        name: "Aルート（通常進路）",
        targetId: 50,
        // 💡 Aを選んだ時は、進まない方のBルート（59番〜79番マス）の上に影を落とす
        maskSquares: [
          59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 
          70, 71, 72, 73, 74, 75, 76, 77, 78, 79
        ]
      },
      {
        name: "Bルート（特殊進路）",
        targetId: 59,
        // 💡 Bを選んだ時は、進まない方のAルート（50番〜58番マス）の上に影を落とす
        maskSquares: [50, 51, 52, 53, 54, 55, 56, 57, 58]
      }
    ]
  },

  // 💼 将来用拡張：社会人モード
  salaryman: {
    id: 49,
    type: "branch",
    text: "【強制ストップ】運命の昇進・独立分岐点！",
    drink: 0,
    happiness: 0,
    location: "オフィス",
    routes: [
      {
        name: "Aルート（社内昇進コース）",
        targetId: 50,
        maskSquares: [
          59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 
          70, 71, 72, 73, 74, 75, 76, 77, 78, 79
        ]
      },
      {
        name: "Bルート（ベンチャー独立コース）",
        targetId: 59,
        maskSquares: [50, 51, 52, 53, 54, 55, 56, 57, 58]
      }
    ]
  },

  // ⚡ 将来用拡張：ショートモード
  short: {
    id: 49,
    type: "branch",
    text: "【強制ストップ】爆速ルート分岐",
    drink: 0,
    happiness: 10,
    location: "家",
    routes: [
      {
        name: "Aルート（通常）",
        targetId: 50,
        maskSquares: [
          59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 
          70, 71, 72, 73, 74, 75, 76, 77, 78, 79
        ]
      },
      {
        name: "Bルート（ギャンブル）",
        targetId: 59,
        maskSquares: [50, 51, 52, 53, 54, 55, 56, 57, 58]
      }
    ]
  }
};
