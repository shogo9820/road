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

      // 🎯 PC側(roomCode)・スマホ側(currentRoomCode)のどちらから呼ばれても安全に取得
      const targetRoom = typeof currentRoomCode !== "undefined" ? currentRoomCode : (typeof roomCode !== "undefined" ? roomCode : "");

      // ======================================================================
      // 🌸 パターン1: 美人（bijin）の場合 ➔ 乾杯モーダル流用
      // ======================================================================
      if (player.jobId === "bijin") {
        if (typeof players !== "undefined" && Array.isArray(players)) {
          players.forEach((p) => {
            if (p.id !== player.id) {
              p.drinkCount = (p.drinkCount || 0) + 1;
            }
          });
        }

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

        alert("✨ ミス龍大（美人）の入学！周囲が色めき立ち全員で歓迎の乾杯！（他プレイヤー全員 +1杯）");
        
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
      // 🎲 パターン2: 美人以外の場合 ➔ 41番マスの汎用ルーレット機構流用
      // ======================================================================
      const entranceMapping = {
        1: { name: "手荒い歓迎！ (2杯飲む)", drinks: 2 },
        2: { name: "手荒い歓迎！ (2杯飲む)", drinks: 2 },
        3: { name: "手荒い歓迎！ (2杯飲む)", drinks: 2 },
        4: { name: "歓迎の洗礼！ (1杯飲む)", drinks: 1 },
        5: { name: "歓迎の洗礼！ (1杯飲む)", drinks: 1 },
        6: { name: "歓迎の洗礼！ (1杯飲む)", drinks: 1 },
        7: { name: "歓迎の洗礼！ (1杯飲む)", drinks: 1 },
        8: { name: "見事回避！ (0杯)", drinks: 0 },
        9: { name: "見事回避！ (0杯)", drinks: 0 },
        10: { name: "見事回避！ (0杯)", drinks: 0 }
      };

      if (typeof socket !== "undefined") {
        socket.emit("customEventFirstSpinResult", {
          roomCode: targetRoom,
          playerId: player.id,
          result: 1,
          mapping: entranceMapping,
          nextStepEventName: "入学式の洗礼回避チャレンジ"
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
