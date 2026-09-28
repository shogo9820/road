window.SQ_MODULES = window.SQ_MODULES || {};
window.SQ_MODULES = {
  normal: {
    id: 30,
    type: "force_stop",
    text: "【強制ストップ】生命保険購入",
    location: "家",
    drink: 0,
    happiness: 0,
    modalConfig: { title: "💰 生命保険購入 💰", desc: "将来に備えて生命保険に加入しよう！ルーレットを回して契約を完了せよ！", eventClass: "theme-couple" }
  },
  salaryman: { id: 30, type: "force_stop", text: "【強制ストップ】自社株買い", location: "オフィス", drink: 0, happiness: 10, modalConfig: { title: "📈 自社株購入 📈", desc: "資産運用スタート！ルーレットを回せ！", eventClass: "theme-rankup" } },
  short: { id: 30, type: "force_stop", text: "【強制ストップ】保険一発加入", location: "家", drink: 0, happiness: 0, modalConfig: { title: "⚡ スピード保険 ⚡", desc: "ノータイムで加入！次へ進め！", eventClass: "theme-couple" } }
};
