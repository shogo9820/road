const QRCode = require("qrcode");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

// 🎯 createPlayer, JOBS, MAP_SQUARES の読み込み
const { JOBS, MAP_SQUARES, createPlayer } = require("./master/gameMaster.js");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const rooms = {};

// ==========================================================================
// 🧭 人生ゲーム型ステートマシン・全6フェーズ定数定義
// ==========================================================================
const PHASES = {
  TURN_START: "1.TURN_START", // ターン開始前確認（1休み消化・進路選択）
  WAIT_SPIN: "2.WAIT_SPIN", // ルーレットスピン待機
  PIECE_MOVING: "3.PIECE_MOVING", // 移動アニメーション中
  SQUARE_LANDED: "4.SQUARE_LANDED", // マス着地イベント発生
  ACTION_RESOLVE: "5.ACTION_RESOLVE", // イベント数値確定処理（保険・清算）
  WAIT_NEXT: "6.WAIT_NEXT", // 次のプレイヤー交代待機
};

// 静的ファイルの公開範囲を「public」フォルダに指定
app.use(express.static(path.join(__dirname, "public")));

// MIMEタイプを明示して安全に配信
app.get("/master/gameMaster.js", (req, res) => {
  res.type("application/javascript");
  res.sendFile(path.join(__dirname, "master", "gameMaster.js"));
});

app.get("/css/common.css", (req, res) => {
  res.type("text/css");
  res.sendFile(path.join(__dirname, "public", "css", "common.css"));
});

// ==========================================================================
// 🧭 ターン開始時共通ルーティン（休み消化・分岐判定・フェーズ自動決定）
// ==========================================================================
function startTurnRoutine(room, roomCode) {
  const p = room.gamePlayers[room.activePlayerIndex];
  if (!p) return;

  // 1. ターン開始前確認フェーズに設定
  room.currentPhase = PHASES.TURN_START;

  console.log(`\n=========================================`);
  console.log(
    `🚨 [SERVER ROUTINE] ➔ 1. 新ターン開始: ${p.name} さん (現在地: ${p.position}番マス)`,
  );

  // 2. 休み（skipTurn）のチェック
  if (p.skipTurn) {
    console.log(
      `💤 [SERVER ROUTINE] ➔ ${p.name} さんは休み状態のためターンをスキップします。`,
    );
    p.skipTurn = false;
    room.currentPhase = PHASES.WAIT_NEXT; // 交代待機へジャンプ

    io.to(roomCode).emit("applyPlayerAction", {
      action: "turnSkipped",
      activePlayerName: p.name,
      activePlayerIndex: room.activePlayerIndex,
    });
    io.to(roomCode).emit("enableNextTurnButton");
    io.to(roomCode).emit("syncGameState", {
      players: room.gamePlayers,
      activePlayerIndex: room.activePlayerIndex,
      currentPhase: room.currentPhase,
    });
    return;
  }

  // 3. マスタデータから現在地の分岐有無を判定
  const currentSquare =
    typeof MAP_SQUARES !== "undefined" && MAP_SQUARES[p.position]
      ? MAP_SQUARES[p.position]
      : null;
  const isBranchSquare =
    currentSquare &&
    (currentSquare.type === "branch" || p.position === 0 || p.position === 49);

  // 4. 手元端末用のアクション通知
  io.to(roomCode).emit("applyPlayerAction", {
    action: "turnUpdated",
    activePlayerIndex: room.activePlayerIndex,
    activePlayerName: p.name,
    activePlayerId: p.id,
  });

  if (isBranchSquare && !p.hasConfirmedRoute) {
    // 🧭 分岐マス：進路選択が必要なため TURN_START を維持
    console.log(
      `🧭 [SERVER ROUTINE] ➔ 分岐マスを検知。進路選択完了を待機します。フェーズ: ${room.currentPhase}`,
    );
  } else {
    // 🎯 通常マス（または進路確定済み）：即座にスピン待機フェーズへ自動昇格
    room.currentPhase = PHASES.WAIT_SPIN;
    console.log(
      `🎯 [SERVER ROUTINE] ➔ 通常マスのためスピン待機へ自動遷移。フェーズ: ${room.currentPhase}`,
    );
  }

  // 全員へ状態を同期
  io.to(roomCode).emit("syncGameState", {
    players: room.gamePlayers,
    activePlayerIndex: room.activePlayerIndex,
    currentPhase: room.currentPhase,
  });
  console.log(`=========================================\n`);
}

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
      currentPhase: PHASES.WAIT_SPIN,
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
  // 🚀 【ゲーム開始】全プレイヤーを0番マスに初期化し、共通ルーティンを起動
  // ==========================================================================
  socket.on("startGame", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    const room = rooms[roomCode];
    if (room) {
      room.gamePlayers = (room.players || []).map((p, idx) => {
        const base = createPlayer(p.id, p.name);
        return {
          ...base,
          name: p.name || `プレイヤー${idx + 1}`,
          position: 0,
          location: "スタート前",
          hasConfirmedRoute: false,
          lovers: [],
        };
      });

      room.activePlayerIndex = 0;

      // 画面切り替え合図
      io.to(roomCode).emit("gameStarted", {
        roomCode,
        players: room.gamePlayers,
        mode: room.mode,
        activePlayerIndex: room.activePlayerIndex,
        currentPhase: PHASES.TURN_START,
      });

      // 共通ルーティンを実行（0番マス判定により TURN_START を維持）
      startTurnRoutine(room, roomCode);
    }
  });

  // ==========================================================================
  // 🧭 【基本ルーティン管理ハブ】
  // ==========================================================================
  socket.on("playerAction", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    if (!roomCode || !rooms[roomCode]) return;
    const room = rooms[roomCode];

    // 【次のプレイヤーへ】
    if (data.action === "nextTurn") {
      // 安全ガード：WAIT_NEXT 以外での交代要求をブロック
      if (
        room.currentPhase !== PHASES.WAIT_NEXT &&
        room.currentPhase !== "6.WAIT_NEXT"
      ) {
        console.log(
          `⚠️ [SERVER] 不正なターン交代要求をブロック（現在のフェーズ: ${room.currentPhase}）`,
        );
        return;
      }

      if (room.gamePlayers && room.gamePlayers.length > 0) {
        let nextIdx = room.activePlayerIndex;
        let found = false;
        for (let i = 0; i < room.gamePlayers.length; i++) {
          nextIdx = (nextIdx + 1) % room.gamePlayers.length;
          if (!room.gamePlayers[nextIdx].hasFinished) {
            found = true;
            break;
          }
        }

        if (!found) {
          console.log(
            "\n🎉 [SERVER] 全プレイヤーがゴールしました！ゲーム終了！",
          );
          io.to(roomCode).emit("gameAllFinished");
          return;
        }

        room.activePlayerIndex = nextIdx;
        const nextPlayer = room.gamePlayers[room.activePlayerIndex];
        nextPlayer.hasConfirmedRoute = false; // 新ターン用の進路フラグリセット

        // 共通ルーティンを起動（通常マスなら自動で WAIT_SPIN へ昇格）
        startTurnRoutine(room, roomCode);
      }
    }
    // 【着地イベント数値処理完了】
    else if (data.action === "squareEventFinished") {
      room.currentPhase = PHASES.ACTION_RESOLVE;

      if (data.updatedPlayer) {
        const target = room.gamePlayers.find(
          (p) => String(p.id) === String(data.updatedPlayer.id),
        );
        if (target) {
          target.drinkCount =
            data.updatedPlayer.drinkCount !== undefined
              ? data.updatedPlayer.drinkCount
              : target.drinkCount;
          target.happiness =
            data.updatedPlayer.happiness !== undefined
              ? data.updatedPlayer.happiness
              : target.happiness;
          target.insurance =
            data.updatedPlayer.insurance !== undefined
              ? data.updatedPlayer.insurance
              : target.insurance;
          target.currentHp =
            data.updatedPlayer.currentHp !== undefined
              ? data.updatedPlayer.currentHp
              : target.currentHp;
          target.hasJob =
            data.updatedPlayer.hasJob !== undefined
              ? data.updatedPlayer.hasJob
              : target.hasJob;
          target.jobId =
            data.updatedPlayer.jobId !== undefined
              ? data.updatedPlayer.jobId
              : target.jobId;
          target.job =
            data.updatedPlayer.job !== undefined
              ? data.updatedPlayer.job
              : target.job;
        }
      }

      console.log(
        `\n🚨 [SERVER] ➔ 5. イベント数値処理完了。交代待機フェーズ(WAIT_NEXT)へ。`,
      );
      room.currentPhase = PHASES.WAIT_NEXT;

      io.to(roomCode).emit("enableNextTurnButton");
      io.to(roomCode).emit("syncGameState", {
        players: room.gamePlayers,
        activePlayerIndex: room.activePlayerIndex,
        currentPhase: room.currentPhase,
      });
    }
  });

  // ==========================================================================
  // 🧭 【進路確定】分岐マスの選択完了を受け、WAIT_SPIN へフェーズ昇格
  // ==========================================================================
  socket.on("confirmRouteSelection", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    const room = rooms[roomCode];
    if (room && room.gamePlayers) {
      const p = room.gamePlayers[room.activePlayerIndex];
      if (p) {
        p.chosenRouteIdx = Number(data.chosenRouteIdx);
        p.hasConfirmedRoute = true;
        console.log(
          `🧭 [SERVER] ${p.name} 氏が進路を確定（ルート: ${data.chosenRouteIdx === 0 ? "A" : "B"}）。`,
        );

        // 進路が決定したため、スピン待機フェーズへ移行
        room.currentPhase = PHASES.WAIT_SPIN;
        console.log(
          `🎯 [SERVER] ルーレットスピン待機(WAIT_SPIN)へフェーズ昇格。`,
        );

        io.to(roomCode).emit("syncGameState", {
          players: room.gamePlayers,
          activePlayerIndex: room.activePlayerIndex,
          currentPhase: room.currentPhase,
        });
      }
    }
  });

  // ==========================================================================
  // 🎲 【通常ルーレットスピン要求】フェーズ防壁チェックと出目配信
  // ==========================================================================
  socket.on("requestSpinRoulette", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    const room = rooms[roomCode];
    if (!room) return;

    // フェーズ防壁：WAIT_SPIN 状態以外からのスピン要求を遮断
    if (
      room.currentPhase !== PHASES.WAIT_SPIN &&
      room.currentPhase !== "2.WAIT_SPIN"
    ) {
      console.log(
        `⚠️ [SERVER] スピン待機中ではないためリクエストを破棄しました（現在のフェーズ: ${room.currentPhase}）`,
      );
      return;
    }

    // 移動アニメーション中へ遷移
    room.currentPhase = PHASES.PIECE_MOVING;
    const resultNum = Math.floor(Math.random() * 10) + 1;

    console.log(
      `🎲 [SERVER] 出目決定: ${resultNum}。移動アニメーション中(PIECE_MOVING)へ移行。`,
    );

    io.to(roomCode).emit("spinRoulette", {
      result: resultNum,
      activePlayerIndex: room.activePlayerIndex,
      players: room.gamePlayers,
      currentPhase: room.currentPhase,
    });
  });

  // 【中継系イベント】
  socket.on("previewRouteSelection", (data) => {
    const room = rooms[data.roomCode || socket.roomCode];
    if (room) {
      io.to(data.roomCode).emit("applyRoutePreview", {
        activePlayerIndex: room.activePlayerIndex,
        selectedRouteIndex: data.selectedRouteIndex,
      });
    }
  });

  socket.on("openCustomRouletteModal", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    io.to(roomCode).emit("openCustomRouletteModal", data);
  });

  socket.on("openBijinKanpaiModal", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    io.to(roomCode).emit("openBijinKanpaiModal", data);
  });

  socket.on("triggerKanpaiEvent", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    io.to(roomCode).emit("showKanpaiModal", data);
  });

  // ==========================================================================
  // 🎓 【89番マス：運命の卒業判定】
  // ==========================================================================
  socket.on("showGraduateEvent", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    io.to(roomCode).emit("showGraduateEvent", data);
  });

  socket.on("requestGraduateSpin", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    const room = rooms[roomCode];
    if (!room) return;

    const resultNum = Math.floor(Math.random() * 10) + 1;
    const isPass = resultNum >= 6;
    const p = room.gamePlayers[room.activePlayerIndex];

    console.log(
      `🎓 [SERVER 卒業判定] プレイヤー: ${p.name} / 出目: ${resultNum} / 結果: ${isPass ? "🌸 合格" : "💀 留年"}`,
    );

    io.to(roomCode).emit("spinGraduateRoulette", {
      result: resultNum,
      isPass: isPass,
    });

    setTimeout(() => {
      if (isPass) {
        p.position = 99;
        p.location = "㊗️ 卒業式(GOAL)";
        p.hasFinished = true;
        room.currentPhase = PHASES.WAIT_NEXT;

        io.to(roomCode).emit("triggerGoalCelebration", {
          player: p,
          result: resultNum,
        });

        io.to(roomCode).emit("showGraduateNextButton", {
          message: `出目: ${resultNum} ➔ 見事単位取得！ストレート卒業GOAL！`,
        });
      } else {
        p.isRepeat = true;
        p.location = "留年（5年生）";
        room.currentPhase = PHASES.TURN_START;

        io.to(roomCode).emit("applyRepeatDarkTheme", {
          playerId: p.id,
          playerName: p.name,
        });

        io.to(roomCode).emit("graduateFailedRepeat", {
          message: `出目: ${resultNum} ➔ 単位不足で留年確定...！留年ルート突入！`,
        });
      }

      io.to(roomCode).emit("syncGameState", {
        players: room.gamePlayers,
        activePlayerIndex: room.activePlayerIndex,
        currentPhase: room.currentPhase,
      });
    }, 3500);
  });

  // ==========================================================================
  // 🎯 【汎用イベントルーレット】
  // ==========================================================================
  socket.on("startCustomRouletteEvent", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    const room = rooms[roomCode];
    if (!room) return;

    const resultNum = Math.floor(Math.random() * 10) + 1;
    const outcome =
      data.mapping && data.mapping[resultNum]
        ? data.mapping[resultNum]
        : { name: "結果なし", drinks: 0 };

    io.to(roomCode).emit("spinCustomRoulette", {
      result: resultNum,
      outcome: outcome,
      eventName: data.eventName,
      mapping: data.mapping,
    });

    setTimeout(() => {
      const p = room.gamePlayers[room.activePlayerIndex];
      if (p && outcome.drinks) {
        p.drinkCount = (p.drinkCount || 0) + outcome.drinks;
      }

      io.to(roomCode).emit("customRouletteFinished", {
        result: resultNum,
        outcome: outcome,
        eventName: data.eventName,
        message: outcome.name,
      });

      room.currentPhase = PHASES.WAIT_NEXT;
      io.to(roomCode).emit("enableNextTurnButton");
      io.to(roomCode).emit("syncGameState", {
        players: room.gamePlayers,
        activePlayerIndex: room.activePlayerIndex,
        currentPhase: room.currentPhase,
      });
    }, 3500);
  });

  // ==========================================================================
  // 🧭 【着地完了ハブ】
  // ==========================================================================
  socket.on("squareLanded", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    const room = rooms[roomCode];
    if (room) {
      if (data && data.position !== undefined) {
        const p = room.gamePlayers[room.activePlayerIndex];
        if (p) {
          const targetId = parseInt(data.position, 10);
          p.position = targetId;

          let detectedLoc = data.location || "家";
          if (typeof MAP_SQUARES !== "undefined" && MAP_SQUARES[targetId]) {
            detectedLoc = MAP_SQUARES[targetId].location || "家";
          }
          p.location = detectedLoc;

          io.to(roomCode).emit("squareLanded", {
            position: targetId,
            location: p.location,
          });
        }
      }

      room.currentPhase = PHASES.SQUARE_LANDED;
      console.log(
        `🚨 [SERVER] ➔ 4. マス着地完了を検知。フェーズ: ${room.currentPhase} を配信！`,
      );

      io.to(roomCode).emit("syncGameState", {
        players: room.gamePlayers,
        activePlayerIndex: room.activePlayerIndex,
        currentPhase: room.currentPhase,
      });
    }
  });

  socket.on("triggerJobChoice", (data) => {
    const { roomCode, playerId, jobId, jobName } = data;
    if (roomCode)
      io.to(roomCode).emit("showJobChoice", { jobId, jobName, playerId });
  });

  socket.on("triggerCoupleEvent", (data) => {
    const { roomCode, playerId, playerName } = data;
    if (roomCode)
      io.to(roomCode).emit("showCoupleEvent", { playerId, playerName });
  });

  socket.on("customEventFirstSpinResult", (data) => {
    const { roomCode, playerId, result, mapping, nextStepEventName } = data;
    const room = rooms[roomCode];
    if (!room) return;

    room.currentCustomEventMapping = mapping;
    io.to(roomCode).emit("startCustomEventSecondSpin", {
      targetPlayerId: playerId,
      nextStepEventName: nextStepEventName,
      mapping: mapping,
    });
  });

  socket.on("customEventSecondSpinResult", (data) => {
    const { roomCode, playerId, result, successMessage, failureMessage } = data;
    const room = rooms[roomCode];
    if (!room || !room.currentCustomEventMapping) return;

    const gamePlayers = room.gamePlayers;
    const player = gamePlayers.find((p) => String(p.id) === String(playerId));
    const mapping = room.currentCustomEventMapping;
    const hitTarget = mapping[result];

    if (player && hitTarget) {
      io.to(roomCode).emit("customEventFinished", {
        success: true,
        message: successMessage || "イベント大成功！",
      });
    } else {
      io.to(roomCode).emit("customEventFinished", {
        success: false,
        message: failureMessage || "イベント失敗...",
      });
    }

    delete room.currentCustomEventMapping;
    io.to(roomCode).emit("syncGameState", {
      players: room.gamePlayers,
      activePlayerIndex: room.activePlayerIndex,
      currentPhase: room.currentPhase,
    });
  });

  socket.on("updateGameState", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    if (roomCode && rooms[roomCode]) {
      if (data.players) {
        data.players.forEach((updatedP) => {
          const target = rooms[roomCode].gamePlayers.find(
            (p) => String(p.id) === String(updatedP.id),
          );
          if (target) {
            target.position =
              updatedP.position !== undefined
                ? updatedP.position
                : target.position;
            if (updatedP.location !== undefined)
              target.location = updatedP.location;
            target.currentHp =
              updatedP.currentHp !== undefined
                ? updatedP.currentHp
                : target.currentHp;
            target.drinkCount =
              updatedP.drinkCount !== undefined
                ? updatedP.drinkCount
                : target.drinkCount;
            target.happiness =
              updatedP.happiness !== undefined
                ? updatedP.happiness
                : target.happiness;
            target.isLover =
              updatedP.isLover !== undefined
                ? updatedP.isLover
                : target.isLover;
            target.skipTurn =
              updatedP.skipTurn !== undefined
                ? updatedP.skipTurn
                : target.skipTurn;
            target.hasJob =
              updatedP.hasJob !== undefined ? updatedP.hasJob : target.hasJob;
            target.jobId =
              updatedP.jobId !== undefined ? updatedP.jobId : target.jobId;
            target.job = updatedP.job !== undefined ? updatedP.job : target.job;
            target.insurance =
              updatedP.insurance !== undefined
                ? updatedP.insurance
                : target.insurance || 0;
          }
        });
      }
      if (data.activePlayerIndex !== undefined)
        rooms[roomCode].activePlayerIndex = data.activePlayerIndex;

      io.to(roomCode).emit("syncGameState", {
        players: rooms[roomCode].gamePlayers,
        activePlayerIndex: rooms[roomCode].activePlayerIndex,
        currentPhase: rooms[roomCode].currentPhase,
      });
    }
  });

  // ==========================================================================
  // 🛠️ 【デバッグ機能：4.SQUARE_LANDED 直接発行型・高速ワープエンジン】
  // 出目0のルーレット偽装や3秒タイマーを完全撤廃！
  // 目的地のマスIDへサーバーメモリを即時書き換え、直接 SQUARE_LANDED フェーズへ移行。
  // PC・スマホへダイレクトに着地信号を発信し、待機時間0ミリ秒でイベントを起動します。
  // ==========================================================================
  socket.on("debugWarp", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    const room = rooms[roomCode];
    if (room && room.gamePlayers && room.gamePlayers.length > 0) {
      const p = room.gamePlayers[room.activePlayerIndex];
      const targetId = parseInt(data.targetSquareId, 10);

      if (p && !isNaN(targetId) && targetId >= 0 && targetId <= 99) {
        console.log(
          `\n🛠️ [SERVER DEBUG-WARP] 目的地直撃シーケンスを起動: ${targetId}番マス`,
        );

        // 1. 座標を目的地に即時書き換え
        p.position = targetId;

        // 2. マスタデータから最新の場所名を取得して同期
        if (typeof MAP_SQUARES !== "undefined" && MAP_SQUARES[targetId]) {
          p.location = MAP_SQUARES[targetId].location || "家";
        } else {
          p.location = "家";
        }

        // 3. フェーズを「着地完了（4.SQUARE_LANDED）」へ直接昇格！
        room.currentPhase = PHASES.SQUARE_LANDED;

        console.log(
          `📡 [SERVER DEBUG-WARP] ${p.name} 氏を ${targetId}番マス（場所: ${p.location}）へ直接着地同期します。`,
        );

        // 4. PC大画面側へ直接着地イベント（squareLanded）を発行
        io.to(roomCode).emit("squareLanded", {
          position: targetId,
          location: p.location,
        });

        // 5. 全員へ最新ステート（SQUARE_LANDED）を一斉ブロードキャスト
        io.to(roomCode).emit("syncGameState", {
          players: room.gamePlayers,
          activePlayerIndex: room.activePlayerIndex,
          currentPhase: room.currentPhase,
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
