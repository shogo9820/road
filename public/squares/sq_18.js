/**
 * 🎯 マスコンポーネント: 18番マス（強制ストップマス：入学式）
 * 
 * [設計思想]
 * 今あるモーダルの雛形（タイトル、説明文、CSSクラス）に値を流し込めるよう、
 * 最低限の設定データのみをシンプルに持たせます。
 */

window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES = {
  // 🌸 現行：サークル生活モード
  normal: {
    id: 18,
    type: "force_stop",              // 🎯 システムに「私は強制ストップマスです」と伝える型
    text: "【強制ストップマス】入学式",
    location: "家",
    drink: 0,
    happiness: 0,
    
    // 🖥️ PCのモーダル雛形に流し込む値
    modalConfig: {
      title: "🌸 入学式 🌸",
      desc: "大学生活がスタート！最初の新歓イベントに向けてルーレットを回そう！",
      eventClass: "theme-entrance"    // pc.cssに定義されている青桜テーマのクラス
    }
  },

  // 💼 将来用拡張：社会人モード（今は枠だけ用意、中身はあとでゆっくり考える）
  salaryman: {
    id: 18,
    type: "force_stop",
    text: "【強制ストップマス】入社式",
    location: "本社ビル",
    drink: 0,
    happiness: 0,
    modalConfig: {
      title: "💼 入社式 💼",
      desc: "今日から社会人生活がスタート！研修に向けてルーレットを回そう！",
      eventClass: "theme-entrance"
    }
  },

  // ⚡ 将来用拡張：ショートモード
  short: {
    id: 18,
    type: "force_stop",
    text: "【強制ストップマス】爆速入学",
    location: "家",
    drink: 0,
    happiness: 0,
    modalConfig: {
      title: "⚡ 爆速入学式 ⚡",
      desc: "一瞬で入学！秒でルーレットを回せ！",
      eventClass: "theme-entrance"
    }
  }
};
