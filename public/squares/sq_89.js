window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES[89] = {
  normal: {
    id: 89,
    type: "force_stop",
    text: "【強制ストップ】運命の卒業判定マス！",
    location: "卒業判定掲示板前",
    event: function (player, moduleData) {
      console.log(`🎓 [89番マス: 着地] プレイヤー: ${player.name} が到着。強制ストップとして一旦ターンを終了します。`);

      const targetRoom = typeof currentRoomCode !== "undefined" ? currentRoomCode : (typeof roomCode !== "undefined" ? roomCode : "");

      // 🎯 着地時はそのまま完了通知を送り、手元の「次へ」ボタンを点灯させて次の人へ手番を回す
      if (typeof socket !== "undefined") {
        socket.emit("playerAction", {
          roomCode: targetRoom,
          action: "squareEventFinished",
          updatedPlayer: player
        });
      }
    }
  }
};
