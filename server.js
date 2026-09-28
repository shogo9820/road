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
    const hostName = data && data.hostName ? data.hostName : "やじま";

    socket.join(roomCode);
    socket.roomCode = roomCode;

    rooms[roomCode] = {
      players: [],
      gamePlayers: [],
      activePlayerIndex: 0,
      mode: "normal",
      currentCoupleMapping: null,
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

  // 【ゲーム開始】
  socket.on("startGame", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    const room = rooms[roomCode];
    if (room) {
      // 🎯 修正：複数恋人システム（2股以上対応）のため、初期ステータスに空の配列 (lovers) を安全に配線！
      room.gamePlayers = (room.players || []).map((p, idx) => {
        const base = createPlayer(p.id, p.name);
        return {
          ...base,
          name: p.name || `プレイヤー${idx + 1}`,
          lovers: [] // 👈 🎯【新規配線】恋人たちの名前を何人でも格納できるリストの初期化！
        };
      });
      room.activePlayerIndex = 0;

      io.to(roomCode).emit("gameStarted", {
        roomCode,
        players: room.gamePlayers,
        mode: room.mode,
        activePlayerIndex: room.activePlayerIndex,
      });
      console.log(`[ゲーム開始] ルーム ${roomCode}: 複数交際対応の lovers 配列を初期化しました`);
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
        players: room.gamePlayers,
      });
      console.log(
        `[デバッグ] ${p.name} が ${p.position} 番マスへワープしました`,
      );
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
        players: room.gamePlayers,
      });
    }
  });
  // PC側からの役職選択トリガーをスマホへ中継
  socket.on("triggerJobChoice", (data) => {
    const { roomCode, playerId, jobId, jobName } = data;
    if (roomCode) {
      console.log(
        `[ルーム:${roomCode}] 役職選択ダイアログ表示指示をスマホへ送信します: ${jobName} (対象ID: ${playerId})`,
      );
      io.to(roomCode).emit("showJobChoice", { jobId, jobName, playerId });
    }
  });

  // PC側からのカップルイベント開始トリガーをスマホへ中継
  socket.on("triggerCoupleEvent", (data) => {
    const { roomCode, playerId, playerName } = data;
    if (roomCode) {
      console.log(
        `[ルーム:${roomCode}] カップルイベント開始指示をスマホへ送信します: ${playerName}`,
      );
      io.to(roomCode).emit("showCoupleEvent", { playerId, playerName });
    }
  });

  // 【カップル1回目判定】スマホ側からのルーレット結果の受け取り
  socket.on("coupleRouletteResult", (data) => {
    const { roomCode, playerId, result } = data;
    const room = rooms[roomCode];
    if (room) {
      const gamePlayers = room.gamePlayers;
      const targetPlayer = gamePlayers.find(
        (p) => String(p.id) === String(playerId),
      );

      if (targetPlayer) {
        console.log(`[カップル1回目] ${targetPlayer.name} の出目: ${result}`);
        const isEven = result % 2 === 0;

        if (isEven) {
          // 🎯 偶数の場合：自分以外の他プレイヤーを1〜10のマスへ重複なくランダム配置
          const otherPlayers = gamePlayers.filter(
            (p) => String(p.id) !== String(playerId),
          );

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
                degree: degreeTable[assignedRoll - 1], // 盤面角度とも1対1で連動保持
              };
            }
          });

          // 部屋データに今回の対応表を一時保存
          room.currentCoupleMapping = mapping;

          console.log(
            `[カップルチャンス] 偶数達成！2回目のランダム配置を生成しました。`,
            mapping,
          );

          // 全員（PCとスマホ両方）に割り当て対応表を添付して2回目開始を通知
          io.to(roomCode).emit("startCoupleSecondRoulette", {
            targetPlayerId: targetPlayer.id,
            targetPlayerName: "運命の相手",
            mapping: mapping,
          });
        } else {
          console.log(`[カップル不成立] 奇数だったためイベント終了です。`);
          io.to(roomCode).emit("coupleEventFinished", {
            success: false,
            message: "奇数！フラれてしもた...",
          });
        }
      }
    }
  });

  // ==========================================================================
  // 💖 【完全修正版】複数交際（2股以上）対応・カップル決着ロジック
  // 成立時、お互いの「lovers」配列に相手の名前を自動で push 追加します。
  // ==========================================================================
  socket.on("coupleSecondRouletteResult", (data) => {
    const { roomCode, playerId, result } = data; // resultにはスマホから実際の出目(1〜10)が入ってくる
    const room = rooms[roomCode];
    if (room && room.currentCoupleMapping) {
      const gamePlayers = room.gamePlayers;
      const player = gamePlayers.find((p) => String(p.id) === String(playerId));

      const mapping = room.currentCoupleMapping;
      const hitTarget = mapping[result]; // 止まった出目にプレイヤーが割り当てられているか確認

      if (player && hitTarget) {
        // 🎯 見事「当たりマス」に止まった場合：カップル成立！
        const targetPlayer = gamePlayers.find(
          (p) => String(p.id) === String(hitTarget.id)
        );

        player.isLover = true;
        if (targetPlayer) targetPlayer.isLover = true;

        // 🛡️ セーフティ：もし何らかの理由で lovers 配列が初期化されていなければここで作成
        if (!player.lovers) player.lovers = [];
        if (targetPlayer && !targetPlayer.lovers) targetPlayer.lovers = [];

        // 🎯 【新規追加】お互いの lovers 配列に相手の名前を push 追加！
        if (targetPlayer) {
          // 重複して同じ人と付き合うのを防ぐガード（必要であれば）
          if (!player.lovers.includes(targetPlayer.name)) {
            player.lovers.push(targetPlayer.name);
          }
          if (!targetPlayer.lovers.includes(player.name)) {
            targetPlayer.lovers.push(player.name);
          }
        }

        player.drinkCount = (player.drinkCount || 0) + 1;
        if (targetPlayer) {
          targetPlayer.drinkCount = (targetPlayer.drinkCount || 0) + 1;
        }

        console.log(`[カップル成立 💕] ${player.name} と ${targetPlayer ? targetPlayer.name : "相手"} が結ばれました！(現在の恋人数: ${player.lovers.length}名)`);

        // PCとスマホに成功を通知（付き合ったお相手の名前を載せる）
        io.to(roomCode).emit("coupleEventFinished", {
          success: true,
          message: `💕 カップル成立！ ${player.name} と ${targetPlayer ? targetPlayer.name : "お相手"} は、2人仲良く 杯数＋1！ 🍺`,
        });
      } else {
        // 💦 ハズレマスに止まった場合：告白失敗
        console.log(`[カップル失敗 💦] ターゲットのいないマス（出目: ${result}）に止まったため失敗`);
        io.to(roomCode).emit("coupleEventFinished", {
          success: false,
          message: "告白失敗...！💦",
        });
      }

      // 使用済みのマッピングデータを安全にクリア
      delete room.currentCoupleMapping;

      // 最新状態を全員（PC・スマホ）に同期
      io.to(roomCode).emit("syncGameState", {
        players: room.gamePlayers,
        activePlayerIndex: room.activePlayerIndex,
      });
    }
  });

  // ==========================================================================
  // 📍 【完全決定版】複数プレイヤー場所リセット巻き戻しバグ完全粉砕ロジック
  // PC側から他人の location データが一時的に届かないタイミングであっても、
  // サーバー側が保持している最新の滞在場所を絶対に破壊（リセット）せず完全に守り抜きます。
  // ==========================================================================
  socket.on("updateGameState", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    if (roomCode && rooms[roomCode]) {
      if (data.players) {
        data.players.forEach((updatedP) => {
          const target = rooms[roomCode].gamePlayers.find(
            (p) => String(p.id) === String(updatedP.id)
          );
          if (target) {
            target.position = updatedP.position !== undefined ? updatedP.position : target.position;
            
            // 🎯 【超重要修正】もし届いたデータが「スタート前」や「空っぽ」であっても、
            // ターゲット（元々そこにいた他プレイヤー）がすでに居酒屋などの場所（家やスタート前以外）に滞在している場合は、
            // 古いデータで上書き（リセット）せず、元々保持していた正しい場所を100%完全に保護・維持する！
            if (updatedP.location && updatedP.location !== "スタート前" && updatedP.location !== "") {
              target.location = updatedP.location;
            } else {
              // 届いたデータが空、かつサーバー側にもまだ場所が無い場合のみ初期値を適用
              target.location = target.location ? target.location : "スタート前";
            }

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

      // 完全に保護された状態のプレイヤーデータを全員（PC・スマホ）へ一斉同期！
      io.to(roomCode).emit("syncGameState", {
        players: rooms[roomCode].gamePlayers,
        activePlayerIndex: rooms[roomCode].activePlayerIndex,
      });
    }
  });

  // 🎯 完全修正：混線をすべて排除し、ターン交代時の卒業モーダル起動と、Yes/No役職、そして卒業・留年の分岐ルート書き換えを100%完全に繋ぎます！
  socket.on("playerAction", (data) => {
    const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
    if (roomCode && rooms[roomCode]) {
      const room = rooms[roomCode];

      // 1. 通常のターン交代処理（元の完璧なコードを完全保護）
      if (data.action === "nextTurn") {
        if (room.gamePlayers && room.gamePlayers.length > 0) {
          room.activePlayerIndex = (room.activePlayerIndex + 1) % room.gamePlayers.length;
          const nextIndex = room.activePlayerIndex;
          const nextPlayer = room.gamePlayers[nextIndex];

          io.to(roomCode).emit("applyPlayerAction", {
            action: "turnUpdated",
            activePlayerIndex: nextIndex,
            activePlayerName: nextPlayer.name,
            activePlayerId: nextPlayer.id
          });

          // 💡【大修正】通常マップ描画の波が完全に引き終わるのを150ミリ秒だけ待ってから、
          // PC大画面側へ向けて、100%独立した専用の通信名（showGraduateEvent）でダイレクトにモーダル起動指示を飛ばします！
          if (nextPlayer && nextPlayer.position === 89) {
            console.log(`[卒業判定ターン開始] ${nextPlayer.name} さんが89番マスにいるため、大画面へ独立イベント信号を送信します。`);
            setTimeout(() => {
              io.to(roomCode).emit("showGraduateEvent", {
                playerId: nextPlayer.id,
                playerName: nextPlayer.name
              });
            }, 150);
          }

          io.to(roomCode).emit("syncGameState", {
            players: room.gamePlayers,
            activePlayerIndex: room.activePlayerIndex
          });
        }
      } 
      // 2. 役職モーダルのYes/No処理（1端末マルチ用のサクサク進行状態を完全保護）
      else if (data.action === "chooseJob") {
        console.log("サーバー側 chooseJob 受信:", data);
        const targetPlayer = room.gamePlayers.find(p => String(p.id) === String(data.playerId)) || room.gamePlayers[room.activePlayerIndex];

        if (targetPlayer) {
          if (data.choice === "yes") {
            targetPlayer.jobId = data.jobId;
            targetPlayer.job = data.jobName;
            targetPlayer.hasJob = true;
          } else {
            targetPlayer.hasJob = false;
          }

          if (room.gamePlayers && room.gamePlayers.length > 0) {
            room.activePlayerIndex = (room.activePlayerIndex + 1) % room.gamePlayers.length;
            const nextIndex = room.activePlayerIndex;
            const nextPlayer = room.gamePlayers[nextIndex];

            io.to(roomCode).emit("applyPlayerAction", {
              action: "turnUpdated",
              activePlayerIndex: nextIndex,
              activePlayerName: nextPlayer.name,
              activePlayerId: nextPlayer.id
            });
            
            // 💡 役職が決まった次のプレイヤーがもし89番マスにいた場合にも、漏れなく独立電波を飛ばすセーフティガード！
            if (nextPlayer && nextPlayer.position === 89) {
              setTimeout(() => {
                io.to(roomCode).emit("showGraduateEvent", { playerId: nextPlayer.id, playerName: nextPlayer.name });
              }, 150);
            }
          }

          io.to(roomCode).emit("syncGameState", {
            players: room.gamePlayers,
            activePlayerIndex: room.activePlayerIndex
          });
        }
      } 
      // 🎯 完全決定版：サーバー側からの勝手な文字送信を全廃！位置を直接99にワープさせ、PC側の「case 99:」を純粋にキックするだけのスマートな神設計に復元します！
      else if (data.action === "graduateRouletteResult") {
        const roomsData = rooms[roomCode];
        if (roomsData && roomsData.gamePlayers) {
          const p = roomsData.gamePlayers[roomsData.activePlayerIndex];
          
          if (p) {
            const dice = data.result; // スマホからの出目（1〜10）
            const isSuccess = (dice >= 6);

            // PC大画面へ専用のクローズ信号を送信（モーダルをシュッと消します）
            io.to(roomCode).emit("closeGraduateModal", { success: isSuccess });

            // 卒業判定が終了したフラグを刻む
            p.graduateChecked = true;

            if (isSuccess) {
              console.log(`🎉 [卒業確定] ${p.name} 氏が合格！位置を直接 99(GOAL) へ強制上書きします。`);
              
              p.position = 99; 
              p.location = "ゴール";

              // 最新の位置(99)をPC大画面とスマホへ完全一斉同期！（ピンが赤色のGOALマスへ移動します）
              io.to(roomCode).emit("syncGameState", { 
                players: roomsData.gamePlayers, 
                activePlayerIndex: roomsData.activePlayerIndex
              });

              // 💡 PC大画面側へ向けて「99番マスの到着イベント（case 99:）を今すぐ起動しろ！」とダイレクトに発信！
              // PC側は元の正しい着地処理（triggerDelayedDisplay）を通過するため、IDエラーが100%完全に消滅します。
              setTimeout(() => {
                io.to(roomCode).emit("playerAction", {
                  roomCode: roomCode,
                  action: "squareEvent",
                  targetSquare: { id: 99, type: "goal", text: `🎉👑 ゴール！！！ ${p.name} さん、大学生活お疲れ様でした！無事にストレート卒業おめでとう！！！ 👑🎉` }
                });
              }, 200);

            } else {
              console.log(`🚨 [留年確定] ${p.name} 氏は留年。卒業判定マスの進路を 90(留年ルート先頭) に上書きします。`);
              
              let gradSquare = roomsData.MAP_SQUARES?.find(sq => sq && (sq.id === 89 || sq.eventType === "卒業判定"));
              if (gradSquare) {
                gradSquare.nextId = 90;
              }
              p.isRepeat = true; // 留年フラグを刻む（これでPC大画面に90〜98番マスが出現します）

              // 最新のプレイヤーデータと地図を完全同期
              io.to(roomCode).emit("syncGameState", { 
                players: roomsData.gamePlayers, 
                activePlayerIndex: roomsData.activePlayerIndex, 
                MAP_SQUARES: roomsData.MAP_SQUARES 
              });

              // 留年の場合は通常移動ルーレットボタンを復活させる
              setTimeout(() => {
                io.to(roomCode).emit("applyPlayerAction", { 
                  action: "turnUpdated", 
                  activePlayerIndex: roomsData.activePlayerIndex, 
                  activePlayerName: p.name, 
                  activePlayerId: p.id 
                });
              }, 200);
            }
          }
        }
      }
    }
  });

  // 🎯 追加：スマホでルートボタンがタップされた瞬間、PCへリアルタイムに影を落とすよう転送
  socket.on("previewRouteSelection", (data) => {
    const room = rooms[data.roomCode || socket.roomCode];
    if (room) {
      io.to(data.roomCode).emit("applyRoutePreview", {
        activePlayerIndex: room.activePlayerIndex,
        selectedRouteIndex: data.selectedRouteIndex, // 0ならルートA、1ならルートB
      });
    }
  });

  // ==========================================================================
  // 🧭 【完全修正版】複数プレイヤー対応・個別進路確定ロジック
  // 大元のマップは一切破壊せず、プレイヤー個人のステータスとして進路を完全に保証します。
  // ==========================================================================
  socket.on("confirmRouteSelection", (data) => {
    const room = rooms[data.roomCode || socket.roomCode];
    if (room && room.gamePlayers) {
      const p = room.gamePlayers[room.activePlayerIndex];
      if (p) {
        console.log(`[進路確定成功] ${p.name} 氏がルート ${data.chosenRouteIdx === 0 ? "A" : "B"} を選択。個人ステータスに保存します。`);

        // 🎯 重要：大元のMAP_SQUARESは1文字も触らず、プレイヤー個人に選択インデックスを確実に記憶させる！
        p.chosenRouteIdx = Number(data.chosenRouteIdx); 
      }

      // 最新の個人ルート情報が含まれた状態で、Room全員（PC・スマホ）へ一斉同期！
      io.to(data.roomCode).emit("syncGameState", {
        players: room.gamePlayers,
        activePlayerIndex: room.activePlayerIndex,
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
