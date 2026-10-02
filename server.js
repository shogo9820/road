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

    // 🧭 【基本ルーティン：行程①＆⑥】手動で「次のプレイヤーへ」がタップされた瞬間
    if (data.action === "nextTurn") {
      if (room.gamePlayers && room.gamePlayers.length > 0) {
        // 🎯 ゴールしていないプレイヤーを探す（最大プレイヤー数分ループ）
        let nextIdx = room.activePlayerIndex;
        let found = false;
        for (let i = 0; i < room.gamePlayers.length; i++) {
          nextIdx = (nextIdx + 1) % room.gamePlayers.length;
          if (!room.gamePlayers[nextIdx].hasFinished) {
            found = true;
            break;
          }
        }

        // 全員ゴールしていたらゲーム終了
        if (!found) {
          console.log("\n🎉 [SERVER] 全プレイヤーがゴールしました！ゲーム終了！");
          io.to(roomCode).emit("gameAllFinished");
          return;
        }

        room.activePlayerIndex = nextIdx;
        const nextPlayer = room.gamePlayers[room.activePlayerIndex];

        room.currentPhase = "1-2.START_CHECK";

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
    else if (data.action === "squareEventFinished") {
      room.currentPhase = "6.WAIT_NEXT";

      if (data.updatedPlayer) {
        const target = room.gamePlayers.find(p => String(p.id) === String(data.updatedPlayer.id));
        if (target) {
          target.drinkCount = data.updatedPlayer.drinkCount !== undefined ? data.updatedPlayer.drinkCount : target.drinkCount;
          target.happiness  = data.updatedPlayer.happiness  !== undefined ? data.updatedPlayer.happiness  : target.happiness;
          target.insurance  = data.updatedPlayer.insurance  !== undefined ? data.updatedPlayer.insurance  : target.insurance;
          target.currentHp  = data.updatedPlayer.currentHp  !== undefined ? data.updatedPlayer.currentHp  : target.currentHp;
          
          // 🎯 【重要追加】役職ステータスを確実にサーバー側へ同期保存！
          target.hasJob = data.updatedPlayer.hasJob !== undefined ? data.updatedPlayer.hasJob : target.hasJob;
          target.jobId  = data.updatedPlayer.jobId  !== undefined ? data.updatedPlayer.jobId  : target.jobId;
          target.job    = data.updatedPlayer.job    !== undefined ? data.updatedPlayer.job    : target.job;
        }
      }

      console.log(`\n🚨 [SERVER] ➔ 5. イベント数値処理完了。手動進行ボタン点灯通知！`);
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

    // 🎯 マスのJSから「手元の汎用モーダルを開け」という合図を受け取り、スマホへ転送
  socket.on("openCustomRouletteModal", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    io.to(roomCode).emit("openCustomRouletteModal", data);
  });

    // 🎯 【追記】美人入学式の乾杯モーダル表示要求をPC大画面へ中継
  socket.on("openBijinKanpaiModal", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    io.to(roomCode).emit("openBijinKanpaiModal", data);
  });

    // 🎯 【復元】汎用一斉乾杯モーダルの表示要求をPC大画面へ中継
  socket.on("triggerKanpaiEvent", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    io.to(roomCode).emit("showKanpaiModal", data);
  });


    // ==========================================================================
  // 🎓 【89番マス：運命の卒業判定】サーバー制御部
  // ==========================================================================
  // 1. PC大画面・スマホへ卒業判定モーダル展開指示
  socket.on("showGraduateEvent", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    io.to(roomCode).emit("showGraduateEvent", data);
  });

  // 2. 卒業判定スピン要求
  socket.on("requestGraduateSpin", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    const room = rooms[roomCode];
    if (!room) return;

    const resultNum = Math.floor(Math.random() * 10) + 1;
    const isPass = (resultNum >= 6);
    const p = room.gamePlayers[room.activePlayerIndex];

    console.log(`\n🎓 [SERVER 卒業判定] プレイヤー: ${p.name} / 出目: ${resultNum} / 結果: ${isPass ? "🌸 合格(ストレートGOAL)" : "💀 留年(地獄ルート開通)"}`);

    // PC・スマホへ回転指示
    io.to(roomCode).emit("spinGraduateRoulette", {
      result: resultNum,
      isPass: isPass
    });

    // 演出完了（3.5秒後）に結果を確定
    setTimeout(() => {
      if (isPass) {
        // 🌸 6以上：合格（ストレートGOAL）
        p.position = 99;
        p.location = "㊗️ 卒業式(GOAL)";
        p.hasFinished = true; // 🎯 ゴールフラグ（手番巡回から除外）
        room.currentPhase = "6.WAIT_NEXT";

        // ゴール演出をPCへ通知
        io.to(roomCode).emit("triggerGoalCelebration", {
          player: p,
          result: resultNum
        });

        // スマホ側は交代ボタンのみ点灯
        io.to(roomCode).emit("showGraduateNextButton", {
          message: `出目: ${resultNum} ➔ 見事単位取得！ストレート卒業GOAL！`
        });
      } else {
        // 💀 5以下：留年
        p.isRepeat = true; // 🎯 留年フラグ
        p.location = "留年（5年生）";
        room.currentPhase = "1-2.START_CHECK"; // 通常移動できる状態に戻す

        // PC側をダークモード化＆留年ルート開通
        io.to(roomCode).emit("applyRepeatDarkTheme", {
          playerId: p.id,
          playerName: p.name
        });

        // スマホ側へ絶望ルーレット復活指示
        io.to(roomCode).emit("graduateFailedRepeat", {
          message: `出目: ${resultNum} ➔ 単位不足で留年確定...！留年ルート突入！`
        });
      }

      // 全員へ最新状態を同期
      io.to(roomCode).emit("syncGameState", {
        players: room.gamePlayers,
        activePlayerIndex: room.activePlayerIndex,
        currentPhase: room.currentPhase
      });
    }, 3500);
  });

  // ==========================================================================
  // 🎯 【汎用イベントルーレット】1回回して出目テーブルで決着する汎用パイプライン
  // ==========================================================================
  socket.on("startCustomRouletteEvent", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    const room = rooms[roomCode];
    if (!room) return;

    // 1〜10の出目をサーバー側で公平に決定
    const resultNum = Math.floor(Math.random() * 10) + 1;
    const outcome = data.mapping && data.mapping[resultNum] ? data.mapping[resultNum] : { name: "結果なし", drinks: 0 };

    console.log(`\n🎲 [SERVER 汎用ルーレット] イベント: ${data.eventName} / 出目: ${resultNum} / 結果: ${outcome.name}`);

    // ルーム全員（PC・スマホ）へルーレット回転指示
    io.to(roomCode).emit("spinCustomRoulette", {
      result: resultNum,
      outcome: outcome,
      eventName: data.eventName,
      mapping: data.mapping
    });

    // 演出完了（3.5秒後）に効果を反映して手動進行（次へ）を点灯
    setTimeout(() => {
      const p = room.gamePlayers[room.activePlayerIndex];
      if (p && outcome.drinks) {
        p.drinkCount = (p.drinkCount || 0) + outcome.drinks;
      }

      io.to(roomCode).emit("customRouletteFinished", {
        result: resultNum,
        outcome: outcome,
        eventName: data.eventName,
        message: outcome.name
      });

      // ターン終了（次へボタン点灯）フェーズへ
      room.currentPhase = "6.WAIT_NEXT";
      io.to(roomCode).emit("enableNextTurnButton");
      io.to(roomCode).emit("syncGameState", {
        players: room.gamePlayers,
        activePlayerIndex: room.activePlayerIndex,
        currentPhase: room.currentPhase
      });
    }, 3500);
  });


  // ==========================================================================
  // 🧭 【基本ルーティン：行程④】目的地着地完了（squareLanded）の受信用ハブ
  // 通常プレイ時はPCの着地報告を受け取るだけですが、デバッグワープ等で直接マスID（position）が
  // 送られてきた場合は、サーバーが位置と場所を直接書き換えて「4.END_CHECK」へ強制合流させます！
  // ==========================================================================
  socket.on("squareLanded", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    const room = rooms[roomCode];
    if (room) {
      // 🎯 【デバッグワープ・直撃合流処理】
      if (data && data.position !== undefined) {
        const p = room.gamePlayers[room.activePlayerIndex];
        if (p) {
          const targetId = parseInt(data.position, 10);
          p.position = targetId;
          
          // マスタから最新の場所名（location）を自動で引っ張る（無ければスマホ側から届いた場所か「家」）
          let detectedLoc = data.location || "家";
          if (typeof MAP_SQUARES !== "undefined" && MAP_SQUARES[targetId]) {
            detectedLoc = MAP_SQUARES[targetId].location || "家";
          }
          p.location = detectedLoc;
          
          console.log(`\n🛠️ [SERVER DEBUG-WARP] 既存の着地完了ハブ(squareLanded)をデバッグ直撃！`);
          console.log(`📡 [SERVER DEBUG-WARP] プレイヤー: ${p.name} を ${targetId}番マス（場所: ${p.location}）へ瞬間移動。`);
        }
      }

      room.currentPhase = "4.END_CHECK"; // 🎯 どんなルートから来ても、100%確実に到着確認フェーズへ！
      console.log(`🚨 [SERVER] ➔ 4. 目的地着地完了を検知。フェーズ: ${room.currentPhase} を全員へ配信！\n`);

      io.to(roomCode).emit("syncGameState", {
        players: room.gamePlayers,
        activePlayerIndex: room.activePlayerIndex,
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
  // 🎯 通常マスや個別同期用の汎用データ同期
  socket.on("updateGameState", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    if (roomCode && rooms[roomCode]) {
      if (data.players) {
        data.players.forEach((updatedP) => {
          const target = rooms[roomCode].gamePlayers.find((p) => String(p.id) === String(updatedP.id));
          if (target) {
            target.position = updatedP.position !== undefined ? updatedP.position : target.position;

            // 🎯 【重要修正】クライアントから送られてきた場所を最優先で保存！
            if (updatedP.location) {
              target.location = updatedP.location;
            } else if (typeof MAP_SQUARES !== "undefined" && MAP_SQUARES[target.position] && MAP_SQUARES[target.position].location) {
              target.location = MAP_SQUARES[target.position].location;
            } else {
              target.location = target.location || "スタート前";
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

  // ==========================================================================
  // 🛠️ 【デバッグ機能：最終決定版・1マス前フライング＋出目1完全合流エンジン】
  // 特殊な着地信号は一切不要！プレイヤーを目的地の「1マス前」に瞬間設置し、
  // そこから通常プレイと200%完全に同じ「出目1のスピン電波」を強制点火します。
  // これによりPC側は1歩トコトコ歩いて目的地に着地するため、すべての本番イベントが自動連動します。
  // ==========================================================================
  socket.on("debugWarp", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    const room = rooms[roomCode];
    if (room && room.gamePlayers && room.gamePlayers.length > 0) {
      const p = room.gamePlayers[room.activePlayerIndex];
      const targetId = parseInt(data.targetSquareId, 10);

      if (p && !isNaN(targetId)) {
        // 🎯 1. プレイヤーの位置を目的地の「1マス前」に一瞬で書き換える
        // (もし0番マスが指定された場合はそのまま0にセット)
        p.position = targetId > 0 ? (targetId - 1) : 0;
        
        // 0番マスの場合は1歩進むと1番に行くので、0番直撃の時は出目0にするか、通常の0歩移動をシミュレート
        const finalSteps = targetId > 0 ? 1 : 1; 
        if (targetId === 0) p.position = 0; // 0番マスの場合は開始位置を調整

        console.log(`\n🛠️ [SERVER DEBUG-WARP] 1マス前フライング起動！`);
        console.log(`📡 [SERVER DEBUG-WARP] プレイヤー: ${p.name} を ${p.position}番マスに仮設置し、「出目 ${finalSteps}」の通常移動をキックします！`);

        // 🎯 2. 通常プレイと1文字も狂わずに全く同じ移動中フェーズをセット
        room.currentPhase = "MOVING";

        // 🎯 3. 通常のルーレットを回した時と「200%完全に同じ電波」を配信してトコトコ移動を走らせる！
        io.to(roomCode).emit("spinRoulette", {
          result: finalSteps, // 強制的に「1歩進む」
          activePlayerIndex: room.activePlayerIndex,
          players: room.gamePlayers,
          currentPhase: room.currentPhase
        });
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
