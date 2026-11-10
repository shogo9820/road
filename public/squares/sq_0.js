/**
 * 🎯 マスコンポーネント: 0番マス（宅飲みスタート！）
 *
 * [設計思想]
 * 将来のモード拡張（normal, salaryman, short）に対応した設定データカタログとして定義します。
 * 「分岐の型（branch）」「影を落とすべきターゲットリスト（shadowTargets）」「進路選択モーダル設定（routeConfig）」を管理します。
 */

window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES[0] = {
  // 🌸 現行：宅飲み人生ゲーム（サークル生活モード）
  normal: {
    id: 0,
    type: "branch",
    text: "宅飲みスタート！",
    drink: 0,
    happiness: 0,
    location: "スタート前",

    // 🧭 進路選択モーダルの文言設定
    routeConfig: {
      title: "🧭 運命の進路選択",
      desc: "進むルートをタップしてください。",
      routeALabel: "Aルート（お前は持っているのか？ルート）",
      routeBLabel: "Bルート（来るもの拒まずルート）",
      confirmLabel: "進路を確定してルーレットへ"
    },

    // 🧭 分岐演出の共通パラメーター（影を落とすマスのIDを配列で指定）
    shadowTargets: {
      routeA: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17], // Aルート選択時、Bルート側の道（8~17番）に影を落とす
      routeB: [1, 2, 3, 4, 5, 6, 7] // Bルート選択時、Aルート側の道（1~7番）に影を落とす
    }
  },

  // 💼 将来用拡張：社会人モード
  salaryman: {
    id: 0,
    type: "branch",
    text: "社会人生活スタート！初任給で何買う？",
    drink: 0,
    happiness: 10,
    location: "配属先",
    routeConfig: {
      title: "🧭 運命の進路選択",
      desc: "進むルートをタップしてください。",
      routeALabel: "Aルート（お前は持っているのか？ルート）",
      routeBLabel: "Bルート（来るもの拒まずルート）",
      confirmLabel: "進路を確定してルーレットへ"
    },
    shadowTargets: {
      routeA: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
      routeB: [1, 2, 3, 4, 5, 6, 7]
    }
  },

  // ⚡ 将来用拡張：ショートモード
  short: {
    id: 0,
    type: "branch",
    text: "爆速宅飲みスタート！秒で酔え！",
    drink: 1,
    happiness: 0,
    location: "家",
    routeConfig: {
      title: "🧭 運命の進路選択",
      desc: "進むルートをタップしてください。",
      routeALabel: "Aルート（お前は持っているのか？ルート）",
      routeBLabel: "Bルート（来るもの拒まずルート）",
      confirmLabel: "進路を確定してルーレットへ"
    },
    shadowTargets: {
      routeA: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
      routeB: [1, 2, 3, 4, 5, 6, 7]
    }
  }
};
