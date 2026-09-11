const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const rooms = {};

app.use(express.static(path.join(__dirname, "./")));

io.on("connection", (socket) => {
  console.log("クライアント接続成功:", socket.id);

  socket.on("createRoom", (data) => {
    const roomCode = Math.floor(1000 + Math.random() * 9000).toString();
    const hostName = (data && data.hostName) ? data.hostName : "やじま";

    socket.join(roomCode);
    socket.roomCode = roomCode;

    rooms[roomCode] = {
      players: [],
      gamePlayers: [],
      activePlayerIndex: 0,
      mode: "normal"
    };

    console.log(`ルーム作成完了 [${roomCode}]`);
    socket.emit("roomCreated", { roomCode, hostName, players: rooms[roomCode].players });
  });

  socket.on("joinRoom", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : null;
    if (roomCode && rooms[roomCode]) {
      socket.join(roomCode);
      socket.roomCode = roomCode;
      console.log(`ルーム参加 [${roomCode}]:`, socket.id);

      socket.emit("joinedSuccess", { roomCode });
      socket.emit("applySettings", {
        players: rooms[roomCode].players,
        mode: rooms[roomCode].mode
      });
    } else {
      socket.emit("errorMsg", { message: "指定されたルームが見つかりません" });
    }
  });
  
  socket.on("updateSettings", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    if (roomCode && rooms[roomCode]) {
      if (data.players && Array.isArray(data.players)) {
        rooms[roomCode].players = data.players.map(p => ({
          ...p,
          hasJob: p.hasJob !== undefined ? p.hasJob : false
        }));
      }
      if (data.mode) {
        rooms[roomCode].mode = data.mode;
      }
      io.to(roomCode).emit("applySettings", rooms[roomCode]);
    }
  });

  socket.on("startGame", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    if (roomCode && rooms[roomCode]) {
      rooms[roomCode].gamePlayers = JSON.parse(JSON.stringify(rooms[roomCode].players)).map(p => ({
        ...p,
        hasJob: p.hasJob !== undefined ? p.hasJob : false
      }));
      rooms[roomCode].activePlayerIndex = 0;

      io.to(roomCode).emit("gameStarted", {
        roomCode,
        players: rooms[roomCode].gamePlayers,
        mode: rooms[roomCode].mode,
        activePlayerIndex: rooms[roomCode].activePlayerIndex
      });
    }
  });

  socket.on("spinRoulette", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    if (roomCode && rooms[roomCode]) {
      const resultNum = data.result !== undefined ? data.result : 1;
      const room = rooms[roomCode];
      const currentPlayer = room.gamePlayers[room.activePlayerIndex];

      if (currentPlayer) {
        currentPlayer.position = (currentPlayer.position || 0) + resultNum;
      }

      io.to(roomCode).emit("spinRoulette", {
        result: resultNum,
        activePlayerIndex: room.activePlayerIndex,
        players: room.gamePlayers
      });
    }
  });

  // PC側からの役職選択トリガーをスマホへ中継
  socket.on("triggerJobChoice", (data) => {
    const { roomCode, playerId, jobId, jobName } = data;
    if (roomCode) {
      console.log(`[ルーム:${roomCode}] 役職選択ダイアログ表示指示をスマホへ送信します: ${jobName} (対象ID: ${playerId})`);
      io.to(roomCode).emit("showJobChoice", { jobId, jobName, playerId });
    }
  });

  // PC側からのカップルイベント開始トリガーをスマホへ中継
  socket.on("triggerCoupleEvent", (data) => {
    const { roomCode, playerId, playerName } = data;
    if (roomCode) {
      console.log(`[ルーム:${roomCode}] カップルイベント開始指示をスマホへ送信します: ${playerName}`);
      io.to(roomCode).emit("showCoupleEvent", { playerId, playerName });
    }
  });

  // スマホ側からの1回目カップルルーレット結果の受け取り
  socket.on("coupleRouletteResult", (data) => {
    const { roomCode, playerId, result } = data;
    if (roomCode && rooms[roomCode]) {
      const gamePlayers = rooms[roomCode].gamePlayers;
      const targetPlayer = gamePlayers.find(p => String(p.id) === String(playerId));

      if (targetPlayer) {
        console.log(`[カップル1回目] ${targetPlayer.name} の出目: ${result}`);
        const isEven = (result % 2 === 0);

        if (isEven) {
          // ⭕ 1人プレイ（親1・子1）想定に修正：
          // 自分以外のプレイヤーがいなくても、そのまま2回目のスピン（告白）に進ませる
          console.log(`[カップルチャンス] 偶数達成！2回目の告白ルーレットの指示をスマホへ送ります。`);
          
          // ルーム全体（PCとスマホ両方）に「2回目のルーレット準備」を通知
          io.to(roomCode).emit("startCoupleSecondRoulette", {
            targetPlayerId: targetPlayer.id, // 自分自身が2回目を回す
            targetPlayerName: "運命の相手"    // 固定のテキストにするか、親機に表示する用
          });
        } else {
          console.log(`[カップル不成立] 奇数だったためイベント終了です。`);
          // PC側に「失敗」を伝えるイベントを送ると親切
          io.to(roomCode).emit("coupleEventFinished", { success: false, message: "奇数！フラれてしもた..." });
        }
      }
    }
  });

  // スマホ側からの2回目カップルルーレット結果の受け取り
  socket.on("coupleSecondRouletteResult", (data) => {
    const { roomCode, playerId, result } = data;
    if (roomCode && rooms[roomCode]) {
      const gamePlayers = rooms[roomCode].gamePlayers;
      const player = gamePlayers.find(p => String(p.id) === String(playerId));

      if (player) {
        console.log(`[カップル2回目] ${player.name} の出目: ${result}`);
        const isSuccess = (result % 2 === 0);

        if (isSuccess) {
          player.isLover = true;
          player.drinkCount = (player.drinkCount || 0) + 1;
          console.log(`[カップル成立 💕] ${player.name} が結ばれました！杯数+1`);
          
          // PCとスマホに成功を通知
          io.to(roomCode).emit("coupleEventFinished", { 
            success: true, 
            message: `💕 カップル成立！ ${player.name} は、2人仲良く 杯数＋1！ 🍺` 
          });
        } else {
          console.log(`[カップル失敗 💦] 告白は失敗に終わりました……`);
          io.to(roomCode).emit("coupleEventFinished", { success: false, message: "告白失敗...！💦" });
        }

        // 状態を全員（PC・スマホ）に同期
        io.to(roomCode).emit("syncGameState", {
          players: rooms[roomCode].gamePlayers,
          activePlayerIndex: rooms[roomCode].activePlayerIndex
        });
      }
    }
  });

  socket.on("updateGameState", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    if (roomCode && rooms[roomCode]) {
      if (data.players) {
        data.players.forEach(updatedP => {
          const target = rooms[roomCode].gamePlayers.find(p => String(p.id) === String(updatedP.id));
          if (target) {
            target.position = updatedP.position !== undefined ? updatedP.position : target.position;
            target.location = updatedP.location !== undefined ? updatedP.location : target.location;
            target.currentHp = updatedP.currentHp !== undefined ? updatedP.currentHp : target.currentHp;
            target.drinkCount = updatedP.drinkCount !== undefined ? updatedP.drinkCount : target.drinkCount;
            target.isLover = updatedP.isLover !== undefined ? updatedP.isLover : target.isLover;
            target.skipTurn = updatedP.skipTurn !== undefined ? updatedP.skipTurn : target.skipTurn;
          }
        });
      }
      if (data.activePlayerIndex !== undefined) {
        rooms[roomCode].activePlayerIndex = data.activePlayerIndex;
      }

      io.to(roomCode).emit("syncGameState", {
        players: rooms[roomCode].gamePlayers,
        activePlayerIndex: rooms[roomCode].activePlayerIndex
      });
    }
  });

  socket.on("playerAction", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    if (roomCode && rooms[roomCode]) {
      if (data.action === "nextTurn") {
        const gamePlayers = rooms[roomCode].gamePlayers;
        if (gamePlayers && gamePlayers.length > 0) {
          rooms[roomCode].activePlayerIndex = (rooms[roomCode].activePlayerIndex + 1) % gamePlayers.length;
          const nextIndex = rooms[roomCode].activePlayerIndex;
          const nextPlayer = gamePlayers[nextIndex];

          io.to(roomCode).emit("applyPlayerAction", {
            action: "turnUpdated",
            activePlayerIndex: nextIndex,
            activePlayerName: nextPlayer.name,
            activePlayerId: nextPlayer.id
          });

          io.to(roomCode).emit("syncGameState", {
            players: rooms[roomCode].gamePlayers,
            activePlayerIndex: rooms[roomCode].activePlayerIndex
          });
        }
      } 
      else if (data.action === "chooseJob") {
        const gamePlayers = rooms[roomCode].gamePlayers;
        console.log("サーバー側 chooseJob 受信:", data);
        
        const targetPlayer = gamePlayers.find(p => String(p.id) === String(data.playerId)) || gamePlayers[rooms[roomCode].activePlayerIndex];

        if (targetPlayer) {
          if (data.choice === "yes") {
            targetPlayer.jobId = data.jobId;
            targetPlayer.job = data.jobName;
            targetPlayer.hasJob = true;
            console.log(`[役職決定] ${targetPlayer.name} は 「${data.jobName}」 に就職しました。`);
          } else {
            targetPlayer.hasJob = false;
            console.log(`[役職辞退] ${targetPlayer.name} は役職を辞退しました (hasJob = false)。`);
          }

          io.to(roomCode).emit("syncGameState", {
            players: rooms[roomCode].gamePlayers,
            activePlayerIndex: rooms[roomCode].activePlayerIndex
          });
        } else {
          console.log("⚠️ エラー: 対象のプレイヤーが見つかりませんでした。playerId:", data.playerId);
        }
      } 
      else {
        socket.to(roomCode).emit("playerAction", data);
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("クライアント切断:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});