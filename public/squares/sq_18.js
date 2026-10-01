/**
 * 🎯 マスコンポーネント: 18番マス（強制ストップマス：入学式）
 * 
 * [設計思想]
 * 今あるモーダルの雛形（タイトル、説明文、CSSクラス）に値を流し込めるよう、
 * 最低限の設定データのみをシンプルに持たせます。
 */

window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES[18] = {
  normal: {
    id: 18,
    type: "force_stop",
    text: "【強制ストップ】サークル入学式！",
    location: "大学キャンパス",
    event: function (player, moduleData) {
      console.log(`🌸 [18番マス: 入学式] ${player.name} のイベント開始`);
      const targetRoom = typeof currentRoomCode !== "undefined" ? currentRoomCode : (typeof roomCode !== "undefined" ? roomCode : "");

      // ======================================================================
      // 🌸 パターン1: 美人（bijin）➔ PC乾杯モーダル完全流用（アラートなし）
      // ======================================================================
      if (player.jobId === "bijin") {
        // 1. 本人以外の全プレイヤーの飲酒数を +1
        if (typeof players !== "undefined" && Array.isArray(players)) {
          players.forEach((p) => {
            if (p.id !== player.id) {
              p.drinkCount = (p.drinkCount || 0) + 1;
            }
          });
        }

        // 2. PC大画面の乾杯モーダル (#pc-kanpai-modal) のテキストを差し替え表示
        const pcModal = document.getElementById("pc-kanpai-modal");
        if (pcModal) {
          const titleEl = pcModal.querySelector(".kanpai-header");
          const membersEl = document.getElementById("pc-kanpai-members");
          const locationEl = document.getElementById("pc-kanpai-location");

          if (titleEl) titleEl.textContent = "🌸 ミス龍大（美人）入学歓迎！ 🌸";
          if (membersEl) membersEl.textContent = `👤 ${player.name} を囲むサークル員一同`;
          if (locationEl) locationEl.textContent = "美人にモテたい気持ち";

          pcModal.style.display = "flex";
        }

        // 3. アラートを使わず、即座に手動進行（次へボタン点灯）へ進める
        if (typeof socket !== "undefined") {
          socket.emit("playerAction", {
            roomCode: targetRoom,
            action: "squareEventFinished",
            updatedPlayer: player
          });
        }
        return;
      }

      // ======================================================================
      // 🎲 パターン2: 美人以外 ➔ 新設「1発汎用ルーレット」を起動
      // ======================================================================
      const entranceMapping = {
        1: { name: "俺ばり飲めるっす！ (2杯飲む)", drinks: 2 },
        2: { name: "俺ばり飲めるっす！ (2杯飲む)", drinks: 2 },
        3: { name: "俺ばり飲めるっす！ (2杯飲む)", drinks: 2 },
        4: { name: "とりあえず飲めや！ (1杯飲む)", drinks: 1 },
        5: { name: "とりあえず飲めや！ (1杯飲む)", drinks: 1 },
        6: { name: "とりあえず飲めや！ (1杯飲む)", drinks: 1 },
        7: { name: "とりあえず飲めや！ (1杯飲む)", drinks: 1 },
        8: { name: "回避！ (0杯)", drinks: 0 },
        9: { name: "回避！ (0杯)", drinks: 0 },
        10: { name: "回避！ (0杯)", drinks: 0 }
      };

      // サーバーへ「手元の汎用モーダルを開け」と合図を送る
      if (typeof socket !== "undefined") {
        socket.emit("openCustomRouletteModal", {
          roomCode: targetRoom,
          eventName: "入学式！",
          mapping: entranceMapping
        });
      }
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
