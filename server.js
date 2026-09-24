const QRCode = require("qrcode");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

// 🎯 修正：createPlayer を追加で読み込む
const { JOBS, MAP_SQUARES, createPlayer } = require("./master/gameMaster.js");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const rooms = {};

// 静的ファイルの公開範囲を「public」フォルダに指定
app.use(express.static(path.join(__dirname, "public")));

// ─── server.js : publicの外にあるマスターデータをブラウザへ安全に公開するルーティングを追加 ───

// ─── server.js : 【完全修正版】マスターデータとCSSをブラウザへ安全かつ正確に公開するルーティング ───

// 静的ファイルの公開範囲を「public」フォルダに指定
app.use(express.static(path.join(__dirname, "public")));

// 🎯 修正：ブラウザからのアクセスに対して、JavaScriptとして認識されるようMIMEタイプを明示して安全に配信します
app.get("/master/gameMaster.js", (req, res) => {
  res.type("application/javascript"); // 👈 必須：これを追加してブラウザのセキュリティブロックを解除します
  res.sendFile(path.join(__dirname, "master", "gameMaster.js"));
});

// 🎯 追記：もしCSSがブロックされる場合、パスを直接解決する保険のルーティングを追加しておきます
app.get("/css/common.css", (req, res) => {
  res.type("text/css");
  res.sendFile(path.join(__dirname, "public", "css", "common.css"));
});


io.on("connection", (socket) => {
  console.log("クライアント接続成功:", socket.id);

  // 【ルーム作成】
  socket.on("createRoom", async (data) => {
    const roomCode = Math.floor(1000 + Math.random() * 9000).toString();
    const hostName = (data && data.hostName) ? data.hostName : "やじま";

    socket.join(roomCode);
    socket.roomCode = roomCode;

    rooms[roomCode] = {
      players: [],
      gamePlayers: [],
      activePlayerIndex: 0,
      mode: "normal",
      currentCoupleMapping: null
    };

    let qrCodeDataUrl = "";
    try {
      const host = socket.handshake.headers.host;
      const protocol = socket.handshake.headers["x-forwarded-proto"] || "http";
      const joinUrl = `${protocol}://${host}/mobile/index.html?room=${roomCode}`;
      qrCodeDataUrl = await QRCode.toDataURL(joinUrl, { width: 150, margin: 1 });
    } catch (err) {
      console.error("QRコード生成エラー:", err);
    }

    console.log(`ルーム作成完了 [${roomCode}]`);
    socket.emit("roomCreated", { 
      roomCode, 
      hostName, 
      players: rooms[roomCode].players,
      qrCodeDataUrl 
    });
  });

  // 【ルーム参加】
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
  
  // 【設定更新】
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

  // 【ゲーム開始】
  socket.on("startGame", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    const room = rooms[roomCode];
    if (room) {
      // 🎯 修正：スマホから届いたプレイヤーリスト（ID・名前）をもとに、雛形から正式なステータスを一括生成
      room.gamePlayers = (room.players || []).map((p, idx) => {
        const base = createPlayer(p.id, p.name);
        return {
          ...base,
          name: p.name || `プレイヤー${idx + 1}`
        };
      });
      room.activePlayerIndex = 0;

      io.to(roomCode).emit("gameStarted", {
        roomCode,
        players: room.gamePlayers,
        mode: room.mode,
        activePlayerIndex: room.activePlayerIndex
      });
      console.log(`[ゲーム開始] ルーム ${roomCode}: プレイヤー ${room.gamePlayers.length} 名のステータスを一括生成しました`);
    }
  });

    // 🛠️【デバッグ専用】指定マスへの強制ワープ処理（通常プレイのコードには一切影響を与えません）
  socket.on("debugWarp", (data) => {
    const { roomCode, targetSquareId } = data;
    const room = rooms[roomCode];
    if (room && room.gamePlayers && room.gamePlayers[room.activePlayerIndex]) {
      const p = room.gamePlayers[room.activePlayerIndex];
      p.position = Number(targetSquareId);

      // ルーム内の全員（PC・スマホ）へワープ実行を即時通知
      io.to(roomCode).emit("executeDebugWarp", {
        activePlayerIndex: room.activePlayerIndex,
        targetSquareId: p.position,
        players: room.gamePlayers
      });
      console.log(`[デバッグ] ${p.name} が ${p.position} 番マスへワープしました`);
    }
  });

  // 🎯【通常スピンの主導権】スマホから「トリガー」だけを受け取り、サーバーが出目を決定して一斉送信する
  socket.on("requestSpinRoulette", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    const room = rooms[roomCode];
    if (room) {
      // サーバー側で1〜10の出目を確定させる
      const resultNum = Math.floor(Math.random() * 10) + 1;
      
      // PC側・スマホ側の双方へ「この出目で同時に3秒間回せ」と一斉に合図を出す
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

  // 【カップル1回目判定】スマホ側からのルーレット結果の受け取り
  socket.on("coupleRouletteResult", (data) => {
    const { roomCode, playerId, result } = data;
    const room = rooms[roomCode];
    if (room) {
      const gamePlayers = room.gamePlayers;
      const targetPlayer = gamePlayers.find(p => String(p.id) === String(playerId));

      if (targetPlayer) {
        console.log(`[カップル1回目] ${targetPlayer.name} の出目: ${result}`);
        const isEven = (result % 2 === 0);

        if (isEven) {
          // 🎯 偶数の場合：自分以外の他プレイヤーを1〜10のマスへ重複なくランダム配置
          const otherPlayers = gamePlayers.filter(p => String(p.id) !== String(playerId));
          
          // 角度（度数）と出目（1〜10）の対応表を維持
          const degreeTable = [342, 306, 270, 234, 198, 162, 126, 90, 54, 18];
          
          // 1〜10の出目スロットを用意してシャッフル
          const rollSlots = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
          for (let i = rollSlots.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [rollSlots[i], rollSlots[j]] = [rollSlots[j], rollSlots[i]];
          }

          // 1〜10の出目をキーとして初期化（出目・角度・プレイヤー情報を統合）
          const mapping = {};
          for (let i = 1; i <= 10; i++) {
            mapping[i] = null;
          }
          
          otherPlayers.forEach((p, idx) => {
            if (idx < rollSlots.length) {
              const assignedRoll = rollSlots[idx];
              mapping[assignedRoll] = {
                id: p.id,
                name: p.name,
                degree: degreeTable[assignedRoll - 1] // 盤面角度とも1対1で連動保持
              };
            }
          });

          // 部屋データに今回の対応表を一時保存
          room.currentCoupleMapping = mapping;

          console.log(`[カップルチャンス] 偶数達成！2回目のランダム配置を生成しました。`, mapping);
          
          // 全員（PCとスマホ両方）に割り当て対応表を添付して2回目開始を通知
          io.to(roomCode).emit("startCoupleSecondRoulette", {
            targetPlayerId: targetPlayer.id, 
            targetPlayerName: "運命の相手",
            mapping: mapping
          });
        } else {
          console.log(`[カップル不成立] 奇数だったためイベント終了です。`);
          io.to(roomCode).emit("coupleEventFinished", { success: false, message: "奇数！フラれてしもた..." });
        }
      }
    }
  });

  // 🎯【カップル2回目判定】スマホ側からの実際の出目（1〜10）を受け取り、サーバー側で厳密に一元合否判定！
  socket.on("coupleSecondRouletteResult", (data) => {
    const { roomCode, playerId, result } = data; // resultにはスマホから実際の出目(1〜10)が入ってくる
    const room = rooms[roomCode];
    if (room && room.currentCoupleMapping) {
      const gamePlayers = room.gamePlayers;
      const player = gamePlayers.find(p => String(p.id) === String(playerId));
      
      const mapping = room.currentCoupleMapping;
      const hitTarget = mapping[result]; // 止まった出目にプレイヤーが割り当てられているか確認

      if (player && hitTarget) {
        // 🎯 見事「当たりマス（他プレイヤーがいるマス）」に止まった場合：カップル成立！
        const targetPlayer = gamePlayers.find(p => String(p.id) === String(hitTarget.id));
        
        player.isLover = true;
        if (targetPlayer) targetPlayer.isLover = true;
        
        player.drinkCount = (player.drinkCount || 0) + 1;
        if (targetPlayer) targetPlayer.drinkCount = (targetPlayer.drinkCount || 0) + 1;
        
        console.log(`[カップル成立 💕] ${player.name} と ${targetPlayer ? targetPlayer.name : "相手"} が結ばれました！`);
        
        // PCとスマホに成功を通知（メッセージに対応相手の名前を載せる）
        io.to(roomCode).emit("coupleEventFinished", { 
          success: true, 
          message: `💕 カップル成立！ ${player.name} と ${targetPlayer ? targetPlayer.name : "お相手"} は、2人仲良く 杯数＋1！ 🍺` 
        });
      } else {
        // 💦 「無し」のハズレマスに止まった場合：告白失敗！
        console.log(`[カップル失敗 💦] ターゲットのいないマス（出目: ${result}）に止まったため失敗`);
        io.to(roomCode).emit("coupleEventFinished", { success: false, message: "告白失敗...！💦" });
      }

      // 使用済みのマッピングデータを安全にクリア
      delete room.currentCoupleMapping;

      // 最新状態を全員（PC・スマホ）に同期
      io.to(roomCode).emit("syncGameState", {
        players: room.gamePlayers,
        activePlayerIndex: room.activePlayerIndex
      });
    }
  });

  // ゲーム状態の更新
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
            target.happiness = updatedP.happiness !== undefined ? updatedP.happiness : target.happiness;
            target.isLover = updatedP.isLover !== undefined ? updatedP.isLover : target.isLover;
            target.skipTurn = updatedP.skipTurn !== undefined ? updatedP.skipTurn : target.skipTurn;
            target.hasJob = updatedP.hasJob !== undefined ? updatedP.hasJob : target.hasJob;
            target.jobId = updatedP.jobId !== undefined ? updatedP.jobId : target.jobId;
            target.job = updatedP.job !== undefined ? updatedP.job : target.job;
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

  // プレイヤーアクションの管理
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
        }
      } 
      else {
        socket.to(roomCode).emit("playerAction", data);
      }
    }
  });

    // 🎯 追加：スマホでルートボタンがタップされた瞬間、PCへリアルタイムに影を落とすよう転送
  socket.on("previewRouteSelection", (data) => {
    const room = rooms[data.roomCode || socket.roomCode];
    if (room) {
      io.to(data.roomCode).emit("applyRoutePreview", {
        activePlayerIndex: room.activePlayerIndex,
        selectedRouteIndex: data.selectedRouteIndex // 0ならルートA、1ならルートB
      });
    }
  });

  // 🎯 完全修正：ややこしい変数を全て廃止！選んだ瞬間に分岐マスのnextIdを選んだ進路のマスIDへ直接書き換えます！
  socket.on("confirmRouteSelection", (data) => {
    const room = rooms[data.roomCode || socket.roomCode];
    if (room && room.gamePlayers) {
      const p = room.gamePlayers[room.activePlayerIndex];
      if (!p) return;

      console.log(`[進路ルート直接書き換え] ${p.name} さんがルート ${data.chosenRouteIdx === 0 ? 'A' : 'B'} を選択しました。`);

      // 💡 ご指摘の通り、分岐マスの nextId 配列の中身を、選んだ側のマスID（数字）に直接書き換えて1本道化します！
      if (p.position === 0) {
        // 0番マスの次の選択肢：Aルートなら 1番マス、Bルートなら 8番マス
        // 元のデータ形式が nextId: [1, 8] の場合、[chosenRouteIdx] で直接数字に変えます
        const chosenNextId = (data.chosenRouteIdx === 0) ? 1 : 8;
        
        // サーバー側が保持している新マップ定義配列の0番マスのnextIdを直接上書き
        if (room.MAP_SQUARES && room.MAP_SQUARES[0]) {
          room.MAP_SQUARES[0].nextId = chosenNextId; 
        }
      } 
      else if (p.position === 49) {
        // 49番マスの次の選択肢：Aルートなら 50番マス、Bルートなら 59番マス
        const chosenNextId = (data.chosenRouteIdx === 0) ? 50 : 59;
        if (room.MAP_SQUARES && room.MAP_SQUARES[49]) {
          room.MAP_SQUARES[49].nextId = chosenNextId;
        }
      }

      // 💡 書き換えたマップデータ一式を、既存の「syncGameState」でPC大画面とスマホへ丸ごと送りつけるだけ！
      io.to(data.roomCode).emit("syncGameState", {
        players: room.gamePlayers,
        activePlayerIndex: room.activePlayerIndex,
        MAP_SQUARES: room.MAP_SQUARES // マップデータも一緒に最新化して完全同期
      });
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
