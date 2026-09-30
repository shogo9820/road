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

// 🎯 ブラウザからのアクセスに対して、JavaScriptとして認識されるようMIMEタイプを明示して安全に配信します
app.get("/master/gameMaster.js", (req, res) => {
  res.type("application/javascript");
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
    const hostName = data && data.hostName ? data.hostName : "やじま";

    socket.join(roomCode);
    socket.roomCode = roomCode;

    rooms[roomCode] = {
      players: [],
      gamePlayers: [],
      activePlayerIndex: 0,
      mode: "normal",
      currentCoupleMapping: null,
      currentPhase: "WAIT_SPIN" // 🎯 初期フェーズはルーレット待機
    };

    let qrCodeDataUrl = "";
    try {
      const host = socket.handshake.headers.host;
      const protocol = socket.handshake.headers["x-forwarded-proto"] || "http";
      const joinUrl = `${protocol}://${host}/mobile/index.html?room=${roomCode}`;
      qrCodeDataUrl = await QRCode.toDataURL(joinUrl, {
        width: 150,
        margin: 1,
      });
    } catch (err) {
      console.error("QRコード生成エラー:", err);
    }

    console.log(`ルーム作成完了 [${roomCode}]`);
    socket.emit("roomCreated", {
      roomCode,
      hostName,
      players: rooms[roomCode].players,
      qrCodeDataUrl,
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
        mode: rooms[roomCode].mode,
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
        rooms[roomCode].players = data.players.map((p) => ({
          ...p,
          hasJob: p.hasJob !== undefined ? p.hasJob : false,
        }));
      }
      if (data.mode) {
        rooms[roomCode].mode = data.mode;
      }
      io.to(roomCode).emit("applySettings", rooms[roomCode]);
    }
  });

  // ==========================================================================
  // 🚀 【最終決定版】基本ルーティン完全直結型・ゲーム開始始動エンジン
  // あなたの教えてくれた「全プレイヤーを0マスに更新 ➔ ルーティン1から始めるだけ」
  // という大原則を100%体現！開始した瞬間に全員を0マスに特別指定し、
  // そこから通常の手動ターン交代と200%完全に同じ電波（turnUpdated）をその場で発射！
  // 手元のボタンをガチッとロックさせ、一本道のレールで0番の進路選択を展開させます。
  // ==========================================================================
  socket.on("startGame", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    const room = rooms[roomCode];
    if (room) {
      // 1. 【特別指定】全プレイヤーの最初の位置を確実に「0番マス（スタート地点）」に初期化！
      room.gamePlayers = (room.players || []).map((p, idx) => {
        const base = createPlayer(p.id, p.name);
        return {
          ...base,
          name: p.name || `プレイヤー${idx + 1}`,
          position: 0,        // 全員の初期位置を確実に0マスに更新
          location: "スタート前",
          lovers: []
        };
      });
      
      room.activePlayerIndex = 0;
      room.currentPhase = "1-2.START_CHECK"; // フェーズを開始時イベント確認にセット

      console.log(`\n=========================================`);
      console.log(`🚨 [SERVER ROUTINE] ➔ 1. ゲーム開始により、全プレイヤーを0マスに更新完了！`);
      console.log(`📡 [SERVER ROUTINE] ➔ ここから基本ルーティンを1から全く同じように始動させます。`);
      console.log(`=========================================\n`);

      // PC大画面とスマホを待機画面からプレイ画面へ切り替えさせるベース合図
      io.to(roomCode).emit("gameStarted", {
        roomCode,
        players: room.gamePlayers,
        mode: room.mode,
        activePlayerIndex: room.activePlayerIndex,
        currentPhase: room.currentPhase
      });

      // 🚀 【核心の配線：リレー行程①を始動】
      // 次のプレイヤーへ進む時と200%完全に同じ「新ターン開始（turnUpdated）」のバトン電波を発射！
      // これによりスマホ側の applyPlayerAction が即座に起動し、手元のボタンに完璧に初期ロックをかけます。
      io.to(roomCode).emit("applyPlayerAction", {
        action: "turnUpdated",
        activePlayerIndex: room.activePlayerIndex,
        activePlayerName: room.gamePlayers[room.activePlayerIndex].name,
        activePlayerId: room.gamePlayers[room.activePlayerIndex].id
      });

      // ルーム全員のステータス画面を一斉更新
      io.to(roomCode).emit("syncGameState", {
        players: room.gamePlayers,
        activePlayerIndex: room.activePlayerIndex,
        currentPhase: room.currentPhase
      });
    }
  });

  // 🎯 【基本ルーティン管理核心部】手動進行リレーのバトンパスカウンター
  socket.on("playerAction", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    if (!roomCode || !rooms[roomCode]) return;
    const room = rooms[roomCode];

    // 🧭 【基本ルーティン：行程①＆⑥】手動で「次のプレイヤーへ」がカチッとタップされた瞬間
    if (data.action === "nextTurn") {
      if (room.gamePlayers && room.gamePlayers.length > 0) {
        room.activePlayerIndex = (room.activePlayerIndex + 1) % room.gamePlayers.length;
        const nextPlayer = room.gamePlayers[room.activePlayerIndex];

        room.currentPhase = "1-2.START_CHECK"; // 🎯 1.新ターン開始 ➔ 2.開始時イベント確認へ

        console.log(`\n=========================================`);
        console.log(`🚨 [SERVER] ➔ 1. 新ターン開始 (手番: ${nextPlayer.name} さん)`);
        console.log(`📡 [SERVER] ➔ 2. 開始時イベントの確認を行います。フェーズ: ${room.currentPhase}`);
        console.log(`=========================================\n`);

        io.to(roomCode).emit("applyPlayerAction", {
          action: "turnUpdated",
          activePlayerIndex: room.activePlayerIndex,
          activePlayerName: nextPlayer.name,
          activePlayerId: nextPlayer.id
        });

        io.to(roomCode).emit("syncGameState", {
          players: room.gamePlayers,
          activePlayerIndex: room.activePlayerIndex,
          currentPhase: room.currentPhase
        });
      }
    } 
    // 🧭 【基本ルーティン：行程④＆⑤＆⑥】マスの手動確定（はい/いいえ、購入）がカチッと押されてリレーが完全決着した瞬間
    else if (data.action === "squareEventFinished") {
      room.currentPhase = "6.WAIT_NEXT"; // 🎯 サーバーの進行状態を「6.手動進行（タップ待機）」に書き換える！

      if (data.updatedPlayer) {
        const target = room.gamePlayers.find(p => String(p.id) === String(data.updatedPlayer.id));
        if (target) {
          target.drinkCount = data.updatedPlayer.drinkCount !== undefined ? data.updatedPlayer.drinkCount : target.drinkCount;
          target.happiness  = data.updatedPlayer.happiness  !== undefined ? data.updatedPlayer.happiness  : target.happiness;
          target.insurance  = data.updatedPlayer.insurance  !== undefined ? data.updatedPlayer.insurance  : target.insurance;
          target.currentHp  = data.updatedPlayer.currentHp  !== undefined ? data.updatedPlayer.currentHp  : target.currentHp;
        }
      }

      console.log(`\n=========================================`);
      console.log(`🚨 [SERVER] ➔ 5. 到着イベント数値処理の確認が完全決着！`);
      console.log(`📡 [SERVER] ➔ 6. 手動進行ボタンを明るく大点灯させます。フェーズ: ${room.currentPhase}`);
      console.log(`=========================================\n`);

      io.to(roomCode).emit("enableNextTurnButton");

      io.to(roomCode).emit("syncGameState", {
        players: room.gamePlayers,
        activePlayerIndex: room.activePlayerIndex,
        currentPhase: room.currentPhase
      });
    }
  });

  // 【通常ルーレットスピン要求】
  socket.on("requestSpinRoulette", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    const room = rooms[roomCode];
    if (room) {
      room.currentPhase = "MOVING";
      const resultNum = Math.floor(Math.random() * 10) + 1;

      io.to(roomCode).emit("spinRoulette", {
        result: resultNum,
        activePlayerIndex: room.activePlayerIndex,
        players: room.gamePlayers,
        currentPhase: room.currentPhase
      });
    }
  });
  // 役職・カップルイベントの単なる中継アンテナ（既存の互換性を保護）
  socket.on("triggerJobChoice", (data) => {
    const { roomCode, playerId, jobId, jobName } = data;
    if (roomCode) io.to(roomCode).emit("showJobChoice", { jobId, jobName, playerId });
  });
  socket.on("triggerCoupleEvent", (data) => {
    const { roomCode, playerId, playerName } = data;
    if (roomCode) io.to(roomCode).emit("showCoupleEvent", { playerId, playerName });
  });

  // 🎯 【完全汎用化：2段階イベント・1回目スピン判定ルーティン】
  // カップル等の固有ロジックは完全全廃。すべてマスのJS（sq_X.js）から送られてきた
  // 条件対応表（mapping）や演出データをそのまま部屋全員に流すだけの完全な空のレールです。
  socket.on("customEventFirstSpinResult", (data) => {
    const { roomCode, playerId, result, mapping, nextStepEventName } = data;
    const room = rooms[roomCode];
    if (!room) return;

    console.log(`[汎用イベント1回目] 出目: ${result} / 次のステップ: ${nextStepEventName}`);
    
    // マス側から届いた「1〜10の運命の対応表」を、サーバーのメモリにそのまま安全に一時記憶
    room.currentCustomEventMapping = mapping;

    // ルーム全員（PC大画面・スマホ）へ、マス側から指定された次の演出名と対応表をそのまま一斉転送！
    io.to(roomCode).emit("startCustomEventSecondSpin", {
      targetPlayerId: playerId,
      nextStepEventName: nextStepEventName,
      mapping: mapping
    });
  });

  // 🎯 【完全汎用化：2段階イベント・2回目スピン判定（最終決着）ルーティン】
  // 止まった出目にプレイヤーがいた場合の「ステータス変動内容」も、すべてマスのJS側から
  // 届いた指示通りにサーバーのメモリに上書き保存し、演出メッセージを一斉配信します。
  socket.on("customEventSecondSpinResult", (data) => {
    const { roomCode, playerId, result, successMessage, failureMessage } = data;
    const room = rooms[roomCode];
    if (!room || !room.currentCustomEventMapping) return;

    const gamePlayers = room.gamePlayers;
    const player = gamePlayers.find((p) => String(p.id) === String(playerId));
    
    const mapping = room.currentCustomEventMapping;
    const hitTarget = mapping[result]; // 止まった出目のスロットをチェック

    if (player && hitTarget) {
      console.log(`[汎用イベント決着] 見事的中！成功処理を行います。`);
      io.to(roomCode).emit("customEventFinished", {
        success: true,
        message: successMessage || "イベント大成功！"
      });
    } else {
      console.log(`[汎用イベント決着] ハズレマス（出目: ${result}）のため失敗終了。`);
      io.to(roomCode).emit("customEventFinished", {
        success: false,
        message: failureMessage || "イベント失敗..."
      });
    }

    // 使用済みのメモリ用マッピングデータを安全に消去リセット
    delete room.currentCustomEventMapping;

    // 確定したベースステータスを一旦全体へ同期
    io.to(roomCode).emit("syncGameState", {
      players: room.gamePlayers,
      activePlayerIndex: room.activePlayerIndex
    });
  });
  // 🎯 通常マスや個別同期用の汎用データ同期（既存の互換性を完全死守）
  socket.on("updateGameState", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    if (roomCode && rooms[roomCode]) {
      if (data.players) {
        data.players.forEach((updatedP) => {
          const target = rooms[roomCode].gamePlayers.find((p) => String(p.id) === String(updatedP.id));
          if (target) {
            target.position = updatedP.position !== undefined ? updatedP.position : target.position;
            if (typeof MAP_SQUARES !== "undefined" && MAP_SQUARES[target.position]) {
              target.location = MAP_SQUARES[target.position].location ? MAP_SQUARES[target.position].location : "スタート前";
            }
            target.currentHp = updatedP.currentHp !== undefined ? updatedP.currentHp : target.currentHp;
            target.drinkCount = updatedP.drinkCount !== undefined ? updatedP.drinkCount : target.drinkCount;
            target.happiness = updatedP.happiness !== undefined ? updatedP.happiness : target.happiness;
            target.isLover = updatedP.isLover !== undefined ? updatedP.isLover : target.isLover;
            target.skipTurn = updatedP.skipTurn !== undefined ? updatedP.skipTurn : target.skipTurn;
            target.hasJob = updatedP.hasJob !== undefined ? updatedP.hasJob : target.hasJob;
            target.jobId = updatedP.jobId !== undefined ? updatedP.jobId : target.jobId;
            target.job = updatedP.job !== undefined ? updatedP.job : target.job;
            target.insurance = updatedP.insurance !== undefined ? updatedP.insurance : (target.insurance || 0);
          }
        });
      }
      if (data.activePlayerIndex !== undefined) rooms[roomCode].activePlayerIndex = data.activePlayerIndex;

      io.to(roomCode).emit("syncGameState", {
        players: rooms[roomCode].gamePlayers,
        activePlayerIndex: rooms[roomCode].activePlayerIndex,
        currentPhase: rooms[roomCode].currentPhase
      });
    }
  });

  // 🎯 【最終決定版：サーバー主導型手動進行フェーズ管理エンジン】
  // 泥臭い個別マスの直書きアクション残骸を全廃し、行程①・④・⑤・⑥のフェーズを一括制御します！
  socket.on("playerAction", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    if (!roomCode || !rooms[roomCode]) return;
    const room = rooms[roomCode];

    // 🎯 【行程①＆⑥】手動で「次のプレイヤーへ」がタップされた瞬間
    if (data.action === "nextTurn") {
      if (room.gamePlayers && room.gamePlayers.length > 0) {
        room.activePlayerIndex = (room.activePlayerIndex + 1) % room.gamePlayers.length;
        const nextIndex = room.activePlayerIndex;
        const nextPlayer = room.gamePlayers[nextIndex];

        room.currentPhase = "START_CHECK"; // 🎯 開始時イベントの確認フェーズへ
        console.log(`\n[ターン更新] ルーム ${roomCode}: 手番は ${nextPlayer.name} さん。フェーズ: ${room.currentPhase}`);

        io.to(roomCode).emit("applyPlayerAction", {
          action: "turnUpdated",
          activePlayerIndex: nextIndex,
          activePlayerName: nextPlayer.name,
          activePlayerId: nextPlayer.id
        });

        // 💡 卒業判定（89番）などの開始時イベント特別監視
        if (nextPlayer && Number(nextPlayer.position) === 89) {
          setTimeout(() => {
            io.to(roomCode).emit("showGraduateEvent", { playerId: nextPlayer.id, playerName: nextPlayer.name });
          }, 150);
        } else {
          room.currentPhase = "WAIT_SPIN"; // 通常は自動でルーレット待機へ
        }

        io.to(roomCode).emit("syncGameState", {
          players: room.gamePlayers,
          activePlayerIndex: room.activePlayerIndex,
          currentPhase: room.currentPhase
        });
      }
    } 
    // 🎯 【行程④＆⑤：PHASE_WAIT_NEXT 一斉一発同期】
    // マスファイル（sq_X.js）から届く最終決着電波をキャッチし、データの固定と手元開放を同時実行！
    else if (data.action === "squareEventFinished") {
      room.currentPhase = "WAIT_NEXT"; // 🎯 手動進行タップ待機フェーズへ

      if (data.updatedPlayer) {
        const target = room.gamePlayers.find(p => String(p.id) === String(data.updatedPlayer.id));
        if (target) {
          target.drinkCount = data.updatedPlayer.drinkCount !== undefined ? data.updatedPlayer.drinkCount : target.drinkCount;
          target.happiness  = data.updatedPlayer.happiness  !== undefined ? data.updatedPlayer.happiness  : target.happiness;
          target.insurance  = data.updatedPlayer.insurance  !== undefined ? data.updatedPlayer.insurance  : target.insurance;
          target.currentHp  = data.updatedPlayer.currentHp  !== undefined ? data.updatedPlayer.currentHp  : target.currentHp;
          console.log(`[ステータス確定] ${target.name} さんの最新データを PHASE_WAIT_NEXT で固定保存しました。`);
        }
      }

      console.log(`[フェーズ進行] ルーム ${roomCode}: フェーズを ${room.currentPhase} （次へボタン点灯）へ移行します。`);
      io.to(roomCode).emit("enableNextTurnButton");

      io.to(roomCode).emit("syncGameState", {
        players: room.gamePlayers,
        activePlayerIndex: room.activePlayerIndex,
        currentPhase: room.currentPhase
      });
    }
  });

  socket.on("previewRouteSelection", (data) => {
    const room = rooms[data.roomCode || socket.roomCode];
    if (room) io.to(data.roomCode).emit("applyRoutePreview", { activePlayerIndex: room.activePlayerIndex, selectedRouteIndex: data.selectedRouteIndex });
  });

  socket.on("confirmRouteSelection", (data) => {
    const room = rooms[data.roomCode || socket.roomCode];
    if (room && room.gamePlayers) {
      const p = room.gamePlayers[room.activePlayerIndex];
      if (p) {
        console.log(`[進路確定成功] ${p.name} 氏がルート ${data.chosenRouteIdx === 0 ? "A" : "B"} を選択。`);
        p.chosenRouteIdx = Number(data.chosenRouteIdx);
      }
      io.to(data.roomCode).emit("syncGameState", { players: room.gamePlayers, activePlayerIndex: room.activePlayerIndex, currentPhase: room.currentPhase });
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
