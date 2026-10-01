window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES[99] = {
  normal: {
    id: 99,
    type: "goal",
    text: "㊗️ 祝・大学卒業！ゴール！！！",
    location: "卒業式場（ゴール）",
    event: function (player, moduleData) {
      console.log(`🎉 [99番マス: GOAL到着] プレイヤー: ${player.name} が卒業式場に着地しました！`);

      const targetRoom = typeof currentRoomCode !== "undefined" ? currentRoomCode : (typeof roomCode !== "undefined" ? roomCode : "");

      // 1. プレイヤーにゴールフラグを付与
      player.hasFinished = true;
      player.location = "㊗️ 卒業式(GOAL)";

      // 2. 🎯 PC大画面へゴール祝賀モーダル展開指示を送信！
      if (typeof socket !== "undefined") {
        socket.emit("triggerGoalCelebration", {
          roomCode: targetRoom,
          player: player
        });

        // 3. 到着イベント完了通知を送り、スマホ側の「次へ」ボタンを点灯
        socket.emit("playerAction", {
          roomCode: targetRoom,
          action: "squareEventFinished",
          updatedPlayer: player
        });
      }
    }
  }
};
