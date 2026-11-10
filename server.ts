import qrcode from "qrcode";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import fs from "fs";

// 🎯 createPlayer, JOBS, MAP_SQUARES の読み込み
// （nodenextのルールに従い、末尾の「.js」は残したままで大丈夫です）
import { JOBS, MAP_SQUARES, createPlayer } from "./master/gameMaster.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const rooms: Record<string, any> = {}; // とりあえず空のオブジェクトには型をつけておきます

// 💡 socket.roomCode を TypeScript に公式に認めさせる魔法のコード
declare module "socket.io" {
  interface Socket {
    roomCode?: string | null;
  }
}

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

// 🎯 1. コンパイル後のファイル群(dist/public)と、元の静的ファイル群(public)の両方を公開
const distPublicPath = path.join(process.cwd(), "dist", "public");
const rawPublicPath = path.join(process.cwd(), "public");

// dist配下にコンパイル済みJSがあれば優先配信
if (fs.existsSync(distPublicPath)) {
  app.use(express.static(distPublicPath));
}
// 通常のHTMLやCSS、画像などを配信
app.use(express.static(rawPublicPath));

// 🎯 2. 明示的なHTMLルーティング
app.get(["/pc", "/pc/", "/pc/index.html"], (req, res) => {
  const filePath = fs.existsSync(path.join(distPublicPath, "pc", "index.html"))
    ? path.join(distPublicPath, "pc", "index.html")
    : path.join(rawPublicPath, "pc", "index.html");
  res.sendFile(filePath);
});

app.get(["/mobile", "/mobile/", "/mobile/index.html"], (req, res) => {
  const filePath = fs.existsSync(path.join(distPublicPath, "mobile", "index.html"))
    ? path.join(distPublicPath, "mobile", "index.html")
    : path.join(rawPublicPath, "mobile", "index.html");
  res.sendFile(filePath);
});

// 🎯 3. /pc および /mobile 配下のファイルを適切なMIMEタイプで確実に届けるルート
app.get("/pc/:file", (req, res) => {
  const fileName = req.params.file;
  const distFile = path.join(distPublicPath, "pc", fileName);
  const rawFile = path.join(rawPublicPath, "pc", fileName);

  if (fileName.endsWith(".js")) res.type("application/javascript");
  else if (fileName.endsWith(".css")) res.type("text/css");
  else if (fileName.endsWith(".html")) res.type("text/html");

  if (fs.existsSync(distFile)) {
    return res.sendFile(distFile);
  }
  if (fs.existsSync(rawFile)) {
    return res.sendFile(rawFile);
  }
  res.status(404).send("File not found");
});

app.get("/mobile/:file", (req, res) => {
  const fileName = req.params.file;
  const distFile = path.join(distPublicPath, "mobile", fileName);
  const rawFile = path.join(rawPublicPath, "mobile", fileName);

  if (fileName.endsWith(".js")) res.type("application/javascript");
  else if (fileName.endsWith(".css")) res.type("text/css");
  else if (fileName.endsWith(".html")) res.type("text/html");

  if (fs.existsSync(distFile)) {
    return res.sendFile(distFile);
  }
  if (fs.existsSync(rawFile)) {
    return res.sendFile(rawFile);
  }
  res.status(404).send("File not found");
});

// 🎯 4. /squares/ 配下のJS配信
app.get("/squares/:file", (req, res) => {
  const fileName = req.params.file;
  const distFile = path.join(distPublicPath, "squares", fileName);
  const rawFile = path.join(rawPublicPath, "squares", fileName);

  res.type("application/javascript");
  if (fs.existsSync(distFile)) {
    return res.sendFile(distFile);
  }
  if (fs.existsSync(rawFile)) {
    return res.sendFile(rawFile);
  }
  res.status(404).send("File not found");
});

// 🎯 5. マスタデータ配信
app.get("/master/gameMaster.js", (req, res) => {
  res.type("application/javascript");
  const distMaster = path.join(process.cwd(), "dist", "master", "gameMaster.js");
  const rawMaster = path.join(process.cwd(), "master", "gameMaster.js");
  if (fs.existsSync(distMaster)) return res.sendFile(distMaster);
  res.sendFile(rawMaster);
});


// ==========================================================================
// 🧭 ターン開始時共通ルーティン（休み消化・分岐判定・フェーズ自動決定）
// ==========================================================================
function startTurnRoutine(room, roomCode) {
  const p = room.gamePlayers[room.activePlayerIndex];
  if (!p) return;

  // 1. ターン開始前確認フェーズに設定（このターン開始時点の杯数を記録）
  room.currentPhase = PHASES.TURN_START;
  p.turnStartDrinkCount = p.drinkCount || 0;

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

  // 3. マスタデータから現在地の分岐有無・89番卒業判定有無を判定
  const currentSquare =
    typeof MAP_SQUARES !== "undefined" && MAP_SQUARES[p.position]
      ? MAP_SQUARES[p.position]
      : null;
  const isBranchSquare =
    currentSquare &&
    (currentSquare.type === "branch" || p.position === 0 || p.position === 49);
  const isGraduateSquare = Number(p.position) === 89 && !p.isRepeat;

  // 4. 手元端末用のアクション通知
  io.to(roomCode).emit("applyPlayerAction", {
    action: "turnUpdated",
    activePlayerIndex: room.activePlayerIndex,
    activePlayerName: p.name,
    activePlayerId: p.id,
  });

  if ((isBranchSquare && !p.hasConfirmedRoute) || isGraduateSquare) {
    // 🧭 分岐マスまたは89番卒業判定マス：開始時イベント完了を待機するため TURN_START を維持
    console.log(
      `🧭 [SERVER ROUTINE] ➔ ターン開始時確認マス(${p.position}番)を検知。完了を待機します。フェーズ: ${room.currentPhase}`,
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
    (socket as any).roomCode = roomCode;

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
      qrCodeDataUrl = await qrcode.toDataURL(joinUrl, {
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

  // 【ルーム参加（ゲーム進行中の途中復帰・リロード自動再接続にも対応）】
  socket.on("joinRoom", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : null;
    if (roomCode && rooms[roomCode]) {
      const room = rooms[roomCode];
      socket.join(roomCode);
      (socket as any).roomCode = roomCode;
      console.log(`ルーム参加 [${roomCode}]:`, socket.id);

      const isGameInProgress = Boolean(
        room.gamePlayers && room.gamePlayers.length > 0,
      );

      socket.emit("joinedSuccess", { roomCode, isGameInProgress });

      if (isGameInProgress) {
        const activeP = room.gamePlayers[room.activePlayerIndex];
        socket.emit("gameStarted", {
          roomCode,
          players: room.gamePlayers,
          mode: room.mode,
          activePlayerIndex: room.activePlayerIndex,
          currentPhase: room.currentPhase || PHASES.TURN_START,
        });
        socket.emit("applyPlayerAction", {
          action:
            activeP && activeP.skipTurn ? "turnSkipped" : "turnUpdated",
          activePlayerIndex: room.activePlayerIndex,
          activePlayerName: activeP ? activeP.name : "",
        });
        socket.emit("syncGameState", {
          players: room.gamePlayers,
          activePlayerIndex: room.activePlayerIndex,
          currentPhase: room.currentPhase || PHASES.TURN_START,
        });
        if (
          room.currentPhase === PHASES.WAIT_NEXT ||
          room.currentPhase === "6.WAIT_NEXT"
        ) {
          socket.emit("enableNextTurnButton");
        }
      } else {
        socket.emit("applySettings", {
          players: room.players,
          mode: room.mode,
        });
      }
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
      if (!room.players || room.players.length === 0) {
        room.players = [
          { id: "p_1", name: "プレイヤー1", hasJob: false },
          { id: "p_2", name: "プレイヤー2", hasJob: false },
        ];
      }

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
          io.to(roomCode).emit("gameAllFinished", {
            players: room.gamePlayers,
          });
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
          const prevJobId = target.jobId;
          const prevHasJob = target.hasJob;

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
          if (data.updatedPlayer.position !== undefined)
            target.position = data.updatedPlayer.position;
          if (data.updatedPlayer.location !== undefined)
            target.location = data.updatedPlayer.location;
          if (data.updatedPlayer.isLover !== undefined)
            target.isLover = data.updatedPlayer.isLover;
          if (data.updatedPlayer.lovers !== undefined)
            target.lovers = data.updatedPlayer.lovers;
          if (data.updatedPlayer.skipTurn !== undefined)
            target.skipTurn = data.updatedPlayer.skipTurn;
          if (data.updatedPlayer.isRepeat !== undefined)
            target.isRepeat = data.updatedPlayer.isRepeat;
          if (data.updatedPlayer.isRankedUp !== undefined)
            target.isRankedUp = data.updatedPlayer.isRankedUp;
          if (data.updatedPlayer.hasFinished !== undefined)
            target.hasFinished = data.updatedPlayer.hasFinished;

          // 役職が決定した場合、JOBSマスタのcap(最大HP)を反映
          if (target.hasJob && target.jobId && typeof JOBS !== "undefined") {
            const jobObj = JOBS.find((j) => j.id === target.jobId);
            if (jobObj) {
              target.baseCap = jobObj.cap;
              target.job = target.isRankedUp
                ? jobObj.title || target.job
                : jobObj.label || target.job;
              if (!prevHasJob || prevJobId !== target.jobId) {
                target.currentHp = jobObj.cap + (target.bonusCap || 0);
              }
            }
          }
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
    // 🛡️ 【生命保険使用】
    else if (data.action === "insuranceUsed") {
      const target =
        room.gamePlayers.find((p) => String(p.id) === String(data.playerId)) ||
        room.gamePlayers[room.activePlayerIndex];
      if (target) {
        target.insurance =
          data.nextInsuranceCount !== undefined
            ? data.nextInsuranceCount
            : Math.max(0, (target.insurance || 1) - 1);

        if (target.drinkCount && target.drinkCount > 0) {
          target.drinkCount = Math.max(0, target.drinkCount - 1);
        }
        const maxHp = (target.baseCap || 80) + (target.bonusCap || 0);
        if (target.currentHp !== undefined) {
          target.currentHp = Math.min(maxHp, target.currentHp + 10);
        }
        if (target.currentHp > 0 && target.skipTurn) {
          target.skipTurn = false;
        }

        io.to(roomCode).emit("applyPlayerAction", {
          action: "insuranceUsed",
          playerId: target.id,
          nextInsuranceCount: target.insurance,
        });
        io.to(roomCode).emit("syncGameState", {
          players: room.gamePlayers,
          activePlayerIndex: room.activePlayerIndex,
          currentPhase: room.currentPhase,
        });
      }
    }
    else if (
      data.action === "enableNextTurnButton" ||
      data.action === "showGraduateNextButton"
    ) {
      room.currentPhase = PHASES.WAIT_NEXT;
      io.to(roomCode).emit("enableNextTurnButton");
      if (data.action === "showGraduateNextButton") {
        io.to(roomCode).emit("showGraduateNextButton", {
          message: "ゴール達成！",
        });
      }
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

        io.to(roomCode).emit("routeSelectionConfirmed", {
          chosenRouteIdx: p.chosenRouteIdx,
        });
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
    const roomCode = (data && data.roomCode) || socket.roomCode;
    const room = roomCode ? rooms[roomCode] : null;
    if (room && roomCode) {
      io.to(roomCode).emit("applyRoutePreview", {
        activePlayerIndex: room.activePlayerIndex,
        selectedRouteIndex: data.selectedRouteIndex,
      });
    }
  });

  socket.on("openCustomRouletteModal", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    if (roomCode) io.to(roomCode).emit("openCustomRouletteModal", data);
  });

  socket.on("openBijinKanpaiModal", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    if (roomCode) io.to(roomCode).emit("openBijinKanpaiModal", data);
  });

  socket.on("triggerKanpaiEvent", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    const room = roomCode ? rooms[roomCode] : null;
    if (room && data && data.location) {
      room.gamePlayers.forEach((p) => {
        if (p && p.location === data.location) {
          p.drinkCount = (p.drinkCount || 0) + 1;
          const maxHp = (p.baseCap || 80) + (p.bonusCap || 0);
          p.currentHp = Math.max(
            0,
            (p.currentHp !== undefined ? p.currentHp : maxHp) - 10,
          );
          if (p.currentHp <= 0) {
            p.happiness = Math.max(
              0,
              (p.happiness !== undefined ? p.happiness : 100) - 30,
            );
            p.skipTurn = true;
            p.currentHp = maxHp;
          }
        }
      });
      io.to(roomCode).emit("syncGameState", {
        players: room.gamePlayers,
        activePlayerIndex: room.activePlayerIndex,
        currentPhase: room.currentPhase,
      });
    }
    if (roomCode) io.to(roomCode).emit("showKanpaiModal", data);
  });

  socket.on("triggerGoalCelebration", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    if (roomCode) io.to(roomCode).emit("showGoalModal", data);
  });

  // ==========================================================================
  // 🎓 【89番マス：運命の卒業判定】
  // ==========================================================================
  socket.on("showGraduateEvent", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    if (roomCode) io.to(roomCode).emit("showGraduateEvent", data);
  });

  socket.on("requestGraduateSpin", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    const room = rooms[roomCode];
    if (!room) return;

    const p = room.gamePlayers[room.activePlayerIndex];
    if (!p) return;

    const resultNum = Math.floor(Math.random() * 10) + 1;
    const isPass = resultNum >= 6;

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

        io.to(roomCode).emit("showGoalModal", {
          player: p,
          result: resultNum,
        });

        io.to(roomCode).emit("showGraduateNextButton", {
          message: `出目: ${resultNum} ➔ 見事単位取得！ストレート卒業GOAL！`,
        });
        io.to(roomCode).emit("enableNextTurnButton");
      } else {
        p.isRepeat = true;
        p.location = "留年（5年生）";
        // 留年ルートへそのままスピンして進めるよう WAIT_SPIN に設定
        room.currentPhase = PHASES.WAIT_SPIN;

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
    }, 4000);
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
      if (p) {
        if (data.consumeAllInsurance) {
          p.insurance = 0;
        }
        if (outcome.drinks && outcome.drinks > 0) {
          p.drinkCount = (p.drinkCount || 0) + outcome.drinks;
          const maxHp = (p.baseCap || 80) + (p.bonusCap || 0);
          p.currentHp = Math.max(
            0,
            (p.currentHp !== undefined ? p.currentHp : maxHp) -
              outcome.drinks * 10,
          );
        }
        if (outcome.happiness) {
          p.happiness =
            (p.happiness !== undefined ? p.happiness : 100) + outcome.happiness;
        }
        if (outcome.isRankUp && typeof JOBS !== "undefined") {
          const jobObj = JOBS.find(
            (j) =>
              j.id === p.jobId || j.label === p.job || j.title === p.job,
          );
          if (jobObj && jobObj.title) {
            p.job = jobObj.title;
            p.isRankedUp = true;
            console.log(
              `👑 [SERVER ランクアップ] ${p.name} さんが「${jobObj.title}」にランクアップ！`,
            );
          }
        }
        if (outcome.name && outcome.name.includes("他全員1杯")) {
          room.gamePlayers.forEach((op) => {
            if (op.id !== p.id) {
              op.drinkCount = (op.drinkCount || 0) + 1;
              const mHp = (op.baseCap || 80) + (op.bonusCap || 0);
              op.currentHp = Math.max(
                0,
                (op.currentHp !== undefined ? op.currentHp : mHp) - 10,
              );
              if (op.currentHp <= 0) {
                op.happiness = Math.max(
                  0,
                  (op.happiness !== undefined ? op.happiness : 100) - 30,
                );
                op.skipTurn = true;
                op.currentHp = mHp;
              }
            }
          });
        } else if (outcome.name && outcome.name.includes("他全員2杯")) {
          room.gamePlayers.forEach((op) => {
            if (op.id !== p.id) {
              op.drinkCount = (op.drinkCount || 0) + 2;
              const mHp = (op.baseCap || 80) + (op.bonusCap || 0);
              op.currentHp = Math.max(
                0,
                (op.currentHp !== undefined ? op.currentHp : mHp) - 20,
              );
              if (op.currentHp <= 0) {
                op.happiness = Math.max(
                  0,
                  (op.happiness !== undefined ? op.happiness : 100) - 30,
                );
                op.skipTurn = true;
                op.currentHp = mHp;
              }
            }
          });
        }
        if (p.currentHp !== undefined && p.currentHp <= 0) {
          p.happiness = Math.max(
            0,
            (p.happiness !== undefined ? p.happiness : 100) - 30,
          );
          p.skipTurn = true;
          p.currentHp = (p.baseCap || 80) + (p.bonusCap || 0);
        }
      }

      io.to(roomCode).emit("customRouletteFinished", {
        result: resultNum,
        outcome: outcome,
        eventName: data.eventName,
        message: outcome.name,
      });

      const isCoupleEvent =
        data.eventName === "💕 カップル成立チャンス 💕" ||
        data.eventName === "カップル告白";

      if (!isCoupleEvent) {
        room.currentPhase = PHASES.WAIT_NEXT;
        io.to(roomCode).emit("enableNextTurnButton");
        io.to(roomCode).emit("syncGameState", {
          players: room.gamePlayers,
          activePlayerIndex: room.activePlayerIndex,
          currentPhase: room.currentPhase,
        });
      }
    }, 3500);
  });

  // ==========================================================================
  // 🧭 【着地完了ハブ：完全一本道化版】
  // PCの移動完了、またはデバッグワープから着地通知を受信した瞬間、
  // サーバー主導で PC・スマホ双方へ同時に startSquareEvent を一斉ブロードキャストします。
  // ==========================================================================
  socket.on("squareLanded", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    const room = rooms[roomCode];
    if (!room) return;

    const p = room.gamePlayers[room.activePlayerIndex];
    if (!p) return;

    if (data && data.position !== undefined) {
      const targetId = parseInt(data.position, 10);
      p.position = targetId;

      let detectedLoc = data.location || "家";
      if (typeof MAP_SQUARES !== "undefined" && MAP_SQUARES[targetId]) {
        detectedLoc = MAP_SQUARES[targetId].location || "家";
      }
      p.location = detectedLoc;
    }

    // フェーズを着地イベント発生(SQUARE_LANDED)へ遷移
    room.currentPhase = PHASES.SQUARE_LANDED;

    console.log(
      `🚨 [SERVER ROUTINE] ➔ 4. マス着地確定: ${p.name} 氏 (マスID: ${p.position}, 場所: ${p.location})`,
    );

    // 🎯 1. PC・スマホ双方へ「マスイベント開始」を同時に号令
    io.to(roomCode).emit("startSquareEvent", {
      position: p.position,
      location: p.location,
      playerId: p.id,
      playerName: p.name,
      activePlayerIndex: room.activePlayerIndex,
    });

    // 🎯 2. 最新の盤面ステータスを全員へ同期
    io.to(roomCode).emit("syncGameState", {
      players: room.gamePlayers,
      activePlayerIndex: room.activePlayerIndex,
      currentPhase: room.currentPhase,
    });
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
    const {
      roomCode,
      playerId,
      result,
      mapping,
      nextStepEventName,
      pcSecondDesc,
    } = data;
    const room = rooms[roomCode];
    if (!room) return;

    room.currentCustomEventMapping = mapping;
    io.to(roomCode).emit("startCustomEventSecondSpin", {
      targetPlayerId: playerId,
      result: result,
      nextStepEventName: nextStepEventName,
      pcSecondDesc: pcSecondDesc,
      mapping: mapping,
    });
  });

  socket.on("customEventSecondSpinResult", (data) => {
    const {
      roomCode,
      playerId,
      result,
      successMessage,
      failureMessage,
      targetA,
      targetB,
    } = data;
    const room = rooms[roomCode];
    if (!room || !room.currentCustomEventMapping) return;

    const gamePlayers = room.gamePlayers;
    const player = gamePlayers.find((p) => String(p.id) === String(playerId));
    const mapping = room.currentCustomEventMapping;
    const hitTarget = mapping[result];

    if (player && hitTarget) {
      player.isLover = true;
      if (!player.lovers) player.lovers = [];
      if (!player.lovers.includes(hitTarget.name)) {
        player.lovers.push(hitTarget.name);
      }

      const partner = gamePlayers.find(
        (p) =>
          String(p.id) === String(hitTarget.id) || p.name === hitTarget.name,
      );
      if (partner) {
        partner.isLover = true;
        if (!partner.lovers) partner.lovers = [];
        if (!partner.lovers.includes(player.name)) {
          partner.lovers.push(player.name);
        }
        partner.drinkCount = (partner.drinkCount || 0) + 1;
        const mHp = (partner.baseCap || 80) + (partner.bonusCap || 0);
        partner.currentHp = Math.max(
          0,
          (partner.currentHp !== undefined ? partner.currentHp : mHp) - 10,
        );
        if (partner.currentHp <= 0) {
          partner.happiness = Math.max(
            0,
            (partner.happiness !== undefined ? partner.happiness : 100) - 30,
          );
          partner.skipTurn = true;
          partner.currentHp = mHp;
        }
      }

      io.to(roomCode).emit("customEventFinished", {
        success: true,
        message: successMessage || "イベント大成功！",
        targetA: targetA || player.name,
        targetB: targetB || hitTarget.name,
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
            if (updatedP.lovers !== undefined)
              target.lovers = updatedP.lovers;
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
            if (updatedP.isRepeat !== undefined)
              target.isRepeat = updatedP.isRepeat;
            if (updatedP.isRankedUp !== undefined)
              target.isRankedUp = updatedP.isRankedUp;
            if (updatedP.hasFinished !== undefined)
              target.hasFinished = updatedP.hasFinished;
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
  // 🛠️ 【デバッグ機能：着地ハブ直結型】
  // ==========================================================================
  socket.on("debugWarp", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    const room = rooms[roomCode];
    if (room && room.gamePlayers && room.gamePlayers.length > 0) {
      const p = room.gamePlayers[room.activePlayerIndex];
      const targetId = parseInt(data.targetSquareId, 10);

      if (p && !isNaN(targetId) && targetId >= 0 && targetId <= 99) {
        console.log(
          `\n🛠️ [SERVER DEBUG-WARP] 目的地直撃シーケンス起動: ${targetId}番マス`,
        );

        p.position = targetId;
        if (typeof MAP_SQUARES !== "undefined" && MAP_SQUARES[targetId]) {
          p.location = MAP_SQUARES[targetId].location || "家";
        } else {
          p.location = "家";
        }

        // 🎯 サーバーの着地ハブと同じ合図を即時発行
        room.currentPhase = PHASES.SQUARE_LANDED;

        io.to(roomCode).emit("startSquareEvent", {
          position: targetId,
          location: p.location,
          playerId: p.id,
          playerName: p.name,
          activePlayerIndex: room.activePlayerIndex,
        });

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
  console.log(`Server running on http://localhost:${PORT}`);
});
