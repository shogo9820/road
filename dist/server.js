"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const qrcode_1 = __importDefault(require("qrcode"));
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// 🎯 createPlayer, JOBS, MAP_SQUARES の読み込み
// （nodenextのルールに従い、末尾の「.js」は残したままで大丈夫です）
const gameMaster_js_1 = require("./master/gameMaster.js");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server);
const rooms = {}; // とりあえず空のオブジェクトには型をつけておきます
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
const distPublicPath = path_1.default.join(process.cwd(), "dist", "public");
const rawPublicPath = path_1.default.join(process.cwd(), "public");
// dist配下にコンパイル済みJSがあれば優先配信
if (fs_1.default.existsSync(distPublicPath)) {
    app.use(express_1.default.static(distPublicPath));
}
// 通常のHTMLやCSS、画像などを配信
app.use(express_1.default.static(rawPublicPath));
// 🎯 2. 明示的なHTMLルーティング
app.get(["/pc", "/pc/", "/pc/index.html"], (req, res) => {
    const filePath = fs_1.default.existsSync(path_1.default.join(distPublicPath, "pc", "index.html"))
        ? path_1.default.join(distPublicPath, "pc", "index.html")
        : path_1.default.join(rawPublicPath, "pc", "index.html");
    res.sendFile(filePath);
});
app.get(["/mobile", "/mobile/", "/mobile/index.html"], (req, res) => {
    const filePath = fs_1.default.existsSync(path_1.default.join(distPublicPath, "mobile", "index.html"))
        ? path_1.default.join(distPublicPath, "mobile", "index.html")
        : path_1.default.join(rawPublicPath, "mobile", "index.html");
    res.sendFile(filePath);
});
// 🎯 3. /pc および /mobile 配下のファイルを適切なMIMEタイプで確実に届けるルート
app.get("/pc/:file", (req, res) => {
    const fileName = req.params.file;
    const distFile = path_1.default.join(distPublicPath, "pc", fileName);
    const rawFile = path_1.default.join(rawPublicPath, "pc", fileName);
    if (fileName.endsWith(".js"))
        res.type("application/javascript");
    else if (fileName.endsWith(".css"))
        res.type("text/css");
    else if (fileName.endsWith(".html"))
        res.type("text/html");
    if (fs_1.default.existsSync(distFile)) {
        return res.sendFile(distFile);
    }
    if (fs_1.default.existsSync(rawFile)) {
        return res.sendFile(rawFile);
    }
    res.status(404).send("File not found");
});
app.get("/mobile/:file", (req, res) => {
    const fileName = req.params.file;
    const distFile = path_1.default.join(distPublicPath, "mobile", fileName);
    const rawFile = path_1.default.join(rawPublicPath, "mobile", fileName);
    if (fileName.endsWith(".js"))
        res.type("application/javascript");
    else if (fileName.endsWith(".css"))
        res.type("text/css");
    else if (fileName.endsWith(".html"))
        res.type("text/html");
    if (fs_1.default.existsSync(distFile)) {
        return res.sendFile(distFile);
    }
    if (fs_1.default.existsSync(rawFile)) {
        return res.sendFile(rawFile);
    }
    res.status(404).send("File not found");
});
// 🎯 4. /squares/ 配下のJS配信
app.get("/squares/:file", (req, res) => {
    const fileName = req.params.file;
    const distFile = path_1.default.join(distPublicPath, "squares", fileName);
    const rawFile = path_1.default.join(rawPublicPath, "squares", fileName);
    res.type("application/javascript");
    if (fs_1.default.existsSync(distFile)) {
        return res.sendFile(distFile);
    }
    if (fs_1.default.existsSync(rawFile)) {
        return res.sendFile(rawFile);
    }
    res.status(404).send("File not found");
});
// 🎯 5. マスタデータ配信
app.get("/master/gameMaster.js", (req, res) => {
    res.type("application/javascript");
    const distMaster = path_1.default.join(process.cwd(), "dist", "master", "gameMaster.js");
    const rawMaster = path_1.default.join(process.cwd(), "master", "gameMaster.js");
    if (fs_1.default.existsSync(distMaster))
        return res.sendFile(distMaster);
    res.sendFile(rawMaster);
});
function getMaxSkillUsesForPlayer(p) {
    if (!p)
        return 1;
    if (p.jobId === "bijin" || p.job === "美人" || p.job === "ミス龍大") {
        return 2;
    }
    return 1;
}
function ensureSkillUsesInitialized(p) {
    if (!p)
        return;
    const maxUses = getMaxSkillUsesForPlayer(p);
    if (!p.skillUsedOnce) {
        p.skillUsesLeft = maxUses;
    }
    else if (p.skillUsesLeft === undefined) {
        p.skillUsesLeft = maxUses;
    }
}
function applySubstituteDrinkIfNeeded(room) {
    if (!room || !Array.isArray(room.gamePlayers))
        return;
    const activeP = room.gamePlayers[room.activePlayerIndex];
    // ① ミス龍大「代わりに飲んで♡」（発動したターン中の本人の飲酒増分をすべて指名相手へ）
    room.gamePlayers.forEach((p) => {
        if (!p || !p.substituteDrinkTargetId || Number(p.position) === 30)
            return;
        const subTarget = room.gamePlayers.find((pl) => pl && String(pl.id) === String(p.substituteDrinkTargetId));
        if (!subTarget)
            return;
        const baseDrinks = p._lastDrinkBaseline !== undefined
            ? p._lastDrinkBaseline
            : p.turnStartDrinkCount || 0;
        const delta = (p.drinkCount || 0) - baseDrinks;
        if (delta > 0) {
            p.drinkCount = baseDrinks;
            const pMax = (p.baseCap || 70) + (p.bonusCap || 0);
            p.currentHp = Math.min(pMax, (p.currentHp !== undefined ? p.currentHp : pMax) + delta * 10);
            if (p.currentHp > 0)
                p.skipTurn = false;
            subTarget.drinkCount = (subTarget.drinkCount || 0) + delta;
            const subMax = (subTarget.baseCap || 80) + (subTarget.bonusCap || 0);
            subTarget.currentHp = Math.max(0, (subTarget.currentHp !== undefined ? subTarget.currentHp : subMax) -
                delta * 10);
            if (subTarget.currentHp <= 0) {
                subTarget.happiness = Math.max(0, (subTarget.happiness !== undefined ? subTarget.happiness : 100) - 30);
                subTarget.skipTurn = true;
                subTarget.currentHp = subMax;
            }
            console.log(`💖 [代わりに飲んで♡] ${p.name} の飲酒 ${delta}杯 を ${subTarget.name} が代わりに飲みました！`);
        }
    });
    // ② 比嘉んちゅ「ほんまに申し訳ない」（指定されたプレイヤーが次に飲むお酒1回分を比嘉んちゅが代わりに飲む）
    room.gamePlayers.forEach((p) => {
        if (!p || !p.okinawaProtectorId)
            return;
        if (p === activeP && Number(p.position) === 30)
            return;
        const protector = room.gamePlayers.find((pl) => pl && String(pl.id) === String(p.okinawaProtectorId));
        if (!protector)
            return;
        const baseDrinks = p._lastDrinkBaseline !== undefined
            ? p._lastDrinkBaseline
            : p.turnStartDrinkCount || 0;
        const delta = (p.drinkCount || 0) - baseDrinks;
        if (delta > 0) {
            p.okinawaProtectorId = null; // 次に飲むお酒1回分のみ肩代わりして解除
            p.drinkCount = baseDrinks;
            const pMax = (p.baseCap || 80) + (p.bonusCap || 0);
            p.currentHp = Math.min(pMax, (p.currentHp !== undefined ? p.currentHp : pMax) + delta * 10);
            if (p.currentHp > 0)
                p.skipTurn = false;
            protector.drinkCount = (protector.drinkCount || 0) + delta;
            const protMax = (protector.baseCap || 140) + (protector.bonusCap || 0);
            protector.currentHp = Math.max(0, (protector.currentHp !== undefined ? protector.currentHp : protMax) -
                delta * 10);
            if (protector.currentHp <= 0) {
                protector.happiness = Math.max(0, (protector.happiness !== undefined ? protector.happiness : 100) - 30);
                protector.skipTurn = true;
                protector.currentHp = protMax;
            }
            console.log(`🌺 [ほんまに申し訳ない] ${p.name} の飲酒 ${delta}杯 を ${protector.name} が代わりに飲みました！`);
        }
    });
    // 基準杯数を最新値へ更新
    room.gamePlayers.forEach((pl) => {
        if (pl)
            pl._lastDrinkBaseline = pl.drinkCount || 0;
    });
}
// ==========================================================================
// 🧭 ターン開始時共通ルーティン（休み消化・分岐判定・フェーズ自動決定）
// ==========================================================================
function startTurnRoutine(room, roomCode) {
    const p = room.gamePlayers[room.activePlayerIndex];
    if (!p)
        return;
    // 1. ターン開始前確認フェーズに設定（このターン開始時点の杯数を記録）
    room.currentPhase = PHASES.TURN_START;
    room.pendingKanpaiLocation = null;
    room.koreanModeActive = false;
    if (Array.isArray(room.gamePlayers)) {
        room.gamePlayers.forEach((pl) => {
            if (pl) {
                pl.koreanModeThisTurn = false;
                pl.substituteDrinkTargetId = null;
                pl.usedSkillThisTurn = false;
                pl._lastDrinkBaseline = pl.drinkCount || 0;
                ensureSkillUsesInitialized(pl);
            }
        });
    }
    p.turnStartDrinkCount = p.drinkCount || 0;
    console.log(`\n=========================================`);
    console.log(`🚨 [SERVER ROUTINE] ➔ 1. 新ターン開始: ${p.name} さん (現在地: ${p.position}番マス)`);
    // 2. 休み（skipTurn）のチェック
    if (p.skipTurn) {
        console.log(`💤 [SERVER ROUTINE] ➔ ${p.name} さんは休み状態のためターンをスキップします。`);
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
    const currentSquare = typeof gameMaster_js_1.MAP_SQUARES !== "undefined" && gameMaster_js_1.MAP_SQUARES[p.position]
        ? gameMaster_js_1.MAP_SQUARES[p.position]
        : null;
    const isBranchSquare = currentSquare &&
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
        console.log(`🧭 [SERVER ROUTINE] ➔ ターン開始時確認マス(${p.position}番)を検知。完了を待機します。フェーズ: ${room.currentPhase}`);
    }
    else {
        // 🎯 通常マス（または進路確定済み）：即座にスピン待機フェーズへ自動昇格
        room.currentPhase = PHASES.WAIT_SPIN;
        console.log(`🎯 [SERVER ROUTINE] ➔ 通常マスのためスピン待機へ自動遷移。フェーズ: ${room.currentPhase}`);
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
            qrCodeDataUrl = await qrcode_1.default.toDataURL(joinUrl, {
                width: 150,
                margin: 1,
            });
        }
        catch (err) {
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
    // 【タイトル画面に戻る（ゲーム終了時など）】
    socket.on("returnToTitle", (data) => {
        const code = socket.roomCode || (data && data.roomCode);
        if (code) {
            console.log(`🏠 [SERVER] ルーム ${code} がタイトル画面へ戻るため初期化されました`);
            io.to(code).emit("returnToTitle");
            if (rooms[code]) {
                delete rooms[code];
            }
        }
    });
    // 【PC画面のモーダルを手動で閉じる（スマホ操作など）】
    socket.on("closePcModal", (data) => {
        const code = socket.roomCode || (data && data.roomCode);
        if (code) {
            console.log(`💻 [SERVER] ルーム ${code} のPCモーダル手動クローズ要求を受信`);
            io.to(code).emit("closePcModal");
        }
    });
    // 【ルーム参加（ゲーム進行中の途中復帰・リロード自動再接続にも対応）】
    socket.on("joinRoom", (data) => {
        const roomCode = data && data.roomCode ? data.roomCode : null;
        if (roomCode && rooms[roomCode]) {
            const room = rooms[roomCode];
            socket.join(roomCode);
            socket.roomCode = roomCode;
            console.log(`ルーム参加 [${roomCode}]:`, socket.id);
            const isGameInProgress = Boolean(room.gamePlayers && room.gamePlayers.length > 0);
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
                    action: activeP && activeP.skipTurn ? "turnSkipped" : "turnUpdated",
                    activePlayerIndex: room.activePlayerIndex,
                    activePlayerName: activeP ? activeP.name : "",
                });
                socket.emit("syncGameState", {
                    players: room.gamePlayers,
                    activePlayerIndex: room.activePlayerIndex,
                    currentPhase: room.currentPhase || PHASES.TURN_START,
                });
                if (room.currentPhase === PHASES.WAIT_NEXT ||
                    room.currentPhase === "6.WAIT_NEXT") {
                    socket.emit("enableNextTurnButton");
                }
            }
            else {
                socket.emit("applySettings", {
                    players: room.players,
                    mode: room.mode,
                });
            }
        }
        else {
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
                const base = (0, gameMaster_js_1.createPlayer)(p.id, p.name);
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
        if (!roomCode || !rooms[roomCode])
            return;
        const room = rooms[roomCode];
        // 【次のプレイヤーへ】
        if (data.action === "nextTurn") {
            // 安全ガード：WAIT_NEXT 以外での交代要求をブロック
            if (room.currentPhase !== PHASES.WAIT_NEXT &&
                room.currentPhase !== "6.WAIT_NEXT") {
                console.log(`⚠️ [SERVER] 不正なターン交代要求をブロック（現在のフェーズ: ${room.currentPhase}）`);
                return;
            }
            if (room.gamePlayers && room.gamePlayers.length > 0) {
                let nextIdx = room.activePlayerIndex;
                let found = false;
                const skippedGoalPlayers = [];
                for (let i = 0; i < room.gamePlayers.length; i++) {
                    nextIdx = (nextIdx + 1) % room.gamePlayers.length;
                    const candidate = room.gamePlayers[nextIdx];
                    if (candidate && candidate.hasFinished) {
                        skippedGoalPlayers.push(candidate);
                    }
                    else if (candidate && !candidate.hasFinished) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    console.log("\n🎉 [SERVER] 全プレイヤーがゴールしました！ゲーム終了！");
                    io.to(roomCode).emit("gameAllFinished", {
                        players: room.gamePlayers,
                    });
                    return;
                }
                // ㊗️ 自分の手番順をスキップされたゴール済みプレイヤーに1周ボーナス（幸福度 +5）
                skippedGoalPlayers.forEach((pl) => {
                    if (pl.happiness === undefined)
                        pl.happiness = 100;
                    pl.happiness += 5;
                    console.log(`✨ [GOAL 1周BONUS] ${pl.name} の手番スキップ (本来の手番順到達・1周ボーナス: 幸福度 +5 ➔ ${pl.happiness}pt)`);
                });
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
                const target = room.gamePlayers.find((p) => String(p.id) === String(data.updatedPlayer.id));
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
                    if (data.updatedPlayer.isRankedUp !== undefined) {
                        target.isRankedUp = data.updatedPlayer.isRankedUp;
                        if (target.isRankedUp) {
                            ensureSkillUsesInitialized(target);
                        }
                    }
                    if (data.updatedPlayer.skillUsesLeft !== undefined)
                        target.skillUsesLeft = data.updatedPlayer.skillUsesLeft;
                    if (data.updatedPlayer.hasFinished !== undefined)
                        target.hasFinished = data.updatedPlayer.hasFinished;
                    // 役職が決定した場合、JOBSマスタのcap(最大HP)を反映
                    if (target.hasJob && target.jobId && typeof gameMaster_js_1.JOBS !== "undefined") {
                        ensureSkillUsesInitialized(target);
                        const jobObj = gameMaster_js_1.JOBS.find((j) => j.id === target.jobId);
                        if (jobObj) {
                            target.baseCap = jobObj.cap;
                            if (target.isRankedUp &&
                                (target.job === "代表" || target.job === "副代表")) {
                                // 代表・副代表の個別役職名を維持
                            }
                            else {
                                target.job = target.isRankedUp
                                    ? jobObj.title || target.job
                                    : jobObj.label || target.job;
                            }
                            if (!prevHasJob || prevJobId !== target.jobId) {
                                target.currentHp = jobObj.cap + (target.bonusCap || 0);
                            }
                        }
                    }
                }
            }
            // 🍻 保留中の同じ場所乾杯を、最新値の上に適用
            if (room.pendingKanpaiLocation) {
                const kLoc = room.pendingKanpaiLocation;
                room.pendingKanpaiLocation = null;
                room.gamePlayers.forEach((kp) => {
                    if (kp && kp.location === kLoc && kp.position !== 99) {
                        kp.drinkCount = (kp.drinkCount || 0) + 1;
                        const kMax = (kp.baseCap || 80) + (kp.bonusCap || 0);
                        kp.currentHp = Math.max(0, (kp.currentHp !== undefined ? kp.currentHp : kMax) - 10);
                        if (kp.currentHp <= 0) {
                            kp.happiness = Math.max(0, (kp.happiness !== undefined ? kp.happiness : 100) - 30);
                            kp.skipTurn = true;
                            kp.currentHp = kMax;
                        }
                    }
                });
            }
            // 💖 ミス龍大「代わりに飲んで♡」が発動中の場合、このターンの飲酒増分を指名相手に肩代わりさせる
            applySubstituteDrinkIfNeeded(room);
            console.log(`\n🚨 [SERVER] ➔ 5. イベント数値処理完了。交代待機フェーズ(WAIT_NEXT)へ。`);
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
            const target = room.gamePlayers.find((p) => String(p.id) === String(data.playerId)) ||
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
                target._lastDrinkBaseline = target.drinkCount || 0;
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
        else if (data.action === "enableNextTurnButton" ||
            data.action === "showGraduateNextButton") {
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
                console.log(`🧭 [SERVER] ${p.name} 氏が進路を確定（ルート: ${data.chosenRouteIdx === 0 ? "A" : "B"}）。`);
                // 進路が決定したため、スピン待機フェーズへ移行
                room.currentPhase = PHASES.WAIT_SPIN;
                console.log(`🎯 [SERVER] ルーレットスピン待機(WAIT_SPIN)へフェーズ昇格。`);
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
        if (!room)
            return;
        // フェーズ防壁：WAIT_SPIN 状態以外からのスピン要求を遮断
        if (room.currentPhase !== PHASES.WAIT_SPIN &&
            room.currentPhase !== "2.WAIT_SPIN") {
            console.log(`⚠️ [SERVER] スピン待機中ではないためリクエストを破棄しました（現在のフェーズ: ${room.currentPhase}）`);
            return;
        }
        // 移動アニメーション中へ遷移
        room.currentPhase = PHASES.PIECE_MOVING;
        const activeP = room.gamePlayers && room.gamePlayers[room.activePlayerIndex];
        let resultNum = Math.floor(Math.random() * 10) + 1;
        if (activeP && activeP.fixedOneTurns && activeP.fixedOneTurns > 0) {
            resultNum = 1;
            activeP.fixedOneTurns = Math.max(0, activeP.fixedOneTurns - 1);
            console.log(`🎯 [点線ストーリー効果] ${activeP.name} の出目を 1 に固定！（残り ${activeP.fixedOneTurns} ターン）`);
        }
        console.log(`🎲 [SERVER] 出目決定: ${resultNum}。移動アニメーション中(PIECE_MOVING)へ移行。`);
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
        if (roomCode)
            io.to(roomCode).emit("openCustomRouletteModal", data);
    });
    socket.on("openBijinKanpaiModal", (data) => {
        const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
        if (roomCode)
            io.to(roomCode).emit("openBijinKanpaiModal", data);
    });
    socket.on("triggerKanpaiEvent", (data) => {
        const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
        const room = roomCode ? rooms[roomCode] : null;
        if (room && data && data.location) {
            // 乾杯の飲酒はマスイベント完了(squareEventFinished)後に適用する
            // （スマホの古い値で上書きされるのを防ぐため）
            room.pendingKanpaiLocation = data.location;
        }
        if (roomCode)
            io.to(roomCode).emit("showKanpaiModal", data);
    });
    socket.on("triggerGoalCelebration", (data) => {
        const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
        if (roomCode)
            io.to(roomCode).emit("showGoalModal", data);
    });
    // ==========================================================================
    // 🎲 【宅飲みミニゲーム：スマホで負けたプレイヤーを選択】
    // ==========================================================================
    socket.on("takunomiLoserSelected", (data) => {
        const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
        const room = roomCode ? rooms[roomCode] : null;
        if (!room || !room.gamePlayers)
            return;
        const drinkAmount = data && data.drinkAmount !== undefined ? Number(data.drinkAmount) : 1;
        const squareHappiness = data && data.squareHappiness !== undefined
            ? Number(data.squareHappiness)
            : 0;
        // 止まったプレイヤーにマスの幸福度変化があれば反映
        const activeP = room.gamePlayers[room.activePlayerIndex];
        if (activeP && squareHappiness !== 0) {
            activeP.happiness =
                (activeP.happiness !== undefined ? activeP.happiness : 100) +
                    squareHappiness;
        }
        // 選択された敗者プレイヤーに飲酒＆HP減少＆二日酔い判定を適用
        const loser = room.gamePlayers.find((p) => String(p.id) === String(data.loserId) || p.name === data.loserName) || activeP;
        if (loser) {
            loser.drinkCount = (loser.drinkCount || 0) + drinkAmount;
            const mHp = (loser.baseCap || 80) + (loser.bonusCap || 0);
            loser.currentHp = Math.max(0, (loser.currentHp !== undefined ? loser.currentHp : mHp) -
                drinkAmount * 10);
            if (loser.currentHp <= 0) {
                loser.happiness = Math.max(0, (loser.happiness !== undefined ? loser.happiness : 100) - 30);
                loser.skipTurn = true;
                loser.currentHp = mHp;
            }
            console.log(`🍻 [SERVER 宅飲み決着] ${loser.name} アウト！（+${drinkAmount}杯）`);
        }
        applySubstituteDrinkIfNeeded(room);
        room.currentPhase = PHASES.WAIT_NEXT;
        io.to(roomCode).emit("takunomiEventFinished", {
            loserId: loser ? loser.id : data.loserId,
            loserName: loser ? loser.name : data.loserName,
            drinkAmount,
        });
        io.to(roomCode).emit("enableNextTurnButton");
        io.to(roomCode).emit("syncGameState", {
            players: room.gamePlayers,
            activePlayerIndex: room.activePlayerIndex,
            currentPhase: room.currentPhase,
        });
    });
    // ==========================================================================
    // 🎓 【89番マス：運命の卒業判定】
    // ==========================================================================
    socket.on("showGraduateEvent", (data) => {
        const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
        if (roomCode)
            io.to(roomCode).emit("showGraduateEvent", data);
    });
    socket.on("requestGraduateSpin", (data) => {
        const roomCode = data && data.roomCode ? data.roomCode : socket.roomCode;
        const room = rooms[roomCode];
        if (!room)
            return;
        const p = room.gamePlayers[room.activePlayerIndex];
        if (!p)
            return;
        const resultNum = Math.floor(Math.random() * 10) + 1;
        const isPass = resultNum >= 6;
        console.log(`🎓 [SERVER 卒業判定] プレイヤー: ${p.name} / 出目: ${resultNum} / 結果: ${isPass ? "🌸 合格" : "💀 留年"}`);
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
            }
            else {
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
        if (!room)
            return;
        const resultNum = Math.floor(Math.random() * 10) + 1;
        const outcome = data.mapping && data.mapping[resultNum]
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
                    p.currentHp = Math.max(0, (p.currentHp !== undefined ? p.currentHp : maxHp) -
                        outcome.drinks * 10);
                }
                if (outcome.happiness) {
                    p.happiness =
                        (p.happiness !== undefined ? p.happiness : 100) + outcome.happiness;
                }
                if (outcome.isRankUp && typeof gameMaster_js_1.JOBS !== "undefined") {
                    const jobObj = gameMaster_js_1.JOBS.find((j) => j.id === p.jobId || j.label === p.job || j.title === p.job);
                    const nextTitle = outcome.newJobTitle || (jobObj && jobObj.title) || p.job;
                    if (nextTitle) {
                        p.job = nextTitle;
                        p.isRankedUp = true;
                        ensureSkillUsesInitialized(p);
                        console.log(`👑 [SERVER ランクアップ] ${p.name} さんが「${nextTitle}」にランクアップ！`);
                    }
                }
                if (outcome.name && outcome.name.includes("他全員1杯")) {
                    room.gamePlayers.forEach((op) => {
                        if (op.id !== p.id) {
                            op.drinkCount = (op.drinkCount || 0) + 1;
                            const mHp = (op.baseCap || 80) + (op.bonusCap || 0);
                            op.currentHp = Math.max(0, (op.currentHp !== undefined ? op.currentHp : mHp) - 10);
                            if (op.currentHp <= 0) {
                                op.happiness = Math.max(0, (op.happiness !== undefined ? op.happiness : 100) - 30);
                                op.skipTurn = true;
                                op.currentHp = mHp;
                            }
                        }
                    });
                }
                else if (outcome.name && outcome.name.includes("他全員2杯")) {
                    room.gamePlayers.forEach((op) => {
                        if (op.id !== p.id) {
                            op.drinkCount = (op.drinkCount || 0) + 2;
                            const mHp = (op.baseCap || 80) + (op.bonusCap || 0);
                            op.currentHp = Math.max(0, (op.currentHp !== undefined ? op.currentHp : mHp) - 20);
                            if (op.currentHp <= 0) {
                                op.happiness = Math.max(0, (op.happiness !== undefined ? op.happiness : 100) - 30);
                                op.skipTurn = true;
                                op.currentHp = mHp;
                            }
                        }
                    });
                }
                if (p.currentHp !== undefined && p.currentHp <= 0) {
                    p.happiness = Math.max(0, (p.happiness !== undefined ? p.happiness : 100) - 30);
                    p.skipTurn = true;
                    p.currentHp = (p.baseCap || 80) + (p.bonusCap || 0);
                }
                applySubstituteDrinkIfNeeded(room);
            }
            io.to(roomCode).emit("customRouletteFinished", {
                result: resultNum,
                outcome: outcome,
                eventName: data.eventName,
                message: outcome.name,
            });
            const isCoupleEvent = data.eventName === "💕 カップル成立チャンス 💕" ||
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
        if (!room)
            return;
        const p = room.gamePlayers[room.activePlayerIndex];
        if (!p)
            return;
        if (data && data.position !== undefined) {
            const targetId = parseInt(data.position, 10);
            p.position = targetId;
            let detectedLoc = data.location || "家";
            if (typeof gameMaster_js_1.MAP_SQUARES !== "undefined" && gameMaster_js_1.MAP_SQUARES[targetId]) {
                detectedLoc = gameMaster_js_1.MAP_SQUARES[targetId].location || "家";
            }
            p.location = detectedLoc;
        }
        // フェーズを着地イベント発生(SQUARE_LANDED)へ遷移
        room.currentPhase = PHASES.SQUARE_LANDED;
        // 移動が完了したので、前回の進路選択を破棄（次の分岐マスでの誤表示防止）
        delete p.chosenRouteIdx;
        console.log(`🚨 [SERVER ROUTINE] ➔ 4. マス着地確定: ${p.name} 氏 (マスID: ${p.position}, 場所: ${p.location})`);
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
        const { roomCode, playerId, result, mapping, nextStepEventName, pcSecondDesc, } = data;
        const room = rooms[roomCode];
        if (!room)
            return;
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
        const { roomCode, playerId, result, successMessage, failureMessage, targetA, targetB, } = data;
        const room = rooms[roomCode];
        if (!room || !room.currentCustomEventMapping)
            return;
        const gamePlayers = room.gamePlayers;
        const player = gamePlayers.find((p) => String(p.id) === String(playerId));
        const mapping = room.currentCustomEventMapping;
        const hitTarget = mapping[result];
        if (player && hitTarget) {
            player.isLover = true;
            if (!player.lovers)
                player.lovers = [];
            if (!player.lovers.includes(hitTarget.name)) {
                player.lovers.push(hitTarget.name);
            }
            const partner = gamePlayers.find((p) => String(p.id) === String(hitTarget.id) || p.name === hitTarget.name);
            if (partner) {
                partner.isLover = true;
                if (!partner.lovers)
                    partner.lovers = [];
                if (!partner.lovers.includes(player.name)) {
                    partner.lovers.push(player.name);
                }
                partner.drinkCount = (partner.drinkCount || 0) + 1;
                const mHp = (partner.baseCap || 80) + (partner.bonusCap || 0);
                partner.currentHp = Math.max(0, (partner.currentHp !== undefined ? partner.currentHp : mHp) - 10);
                if (partner.currentHp <= 0) {
                    partner.happiness = Math.max(0, (partner.happiness !== undefined ? partner.happiness : 100) - 30);
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
        }
        else {
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
                    const target = rooms[roomCode].gamePlayers.find((p) => String(p.id) === String(updatedP.id));
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
                        if (updatedP.isRankedUp !== undefined) {
                            target.isRankedUp = updatedP.isRankedUp;
                            if (target.isRankedUp && target.skillUsesLeft === undefined) {
                                target.skillUsesLeft = 1;
                            }
                        }
                        if (updatedP.skillUsesLeft !== undefined)
                            target.skillUsesLeft = updatedP.skillUsesLeft;
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
    // ⚡ 【必殺技システム（ランクアップ後限定）】
    // ==========================================================================
    socket.on("skillActivated", (data) => {
        const roomCode = data?.roomCode || socket.roomCode;
        if (!roomCode || !rooms[roomCode])
            return;
        const room = rooms[roomCode];
        // ⚽ 13. ファイアトルネードの場合、1〜10のルーレット枠にプレイヤーを均等配置して配信
        if (data && data.targetType === "fire_tornado" && room.gamePlayers) {
            const pls = room.gamePlayers;
            const count = Math.max(1, pls.length);
            const slotsPerPlayer = Math.max(1, Math.floor(10 / count));
            const mapping = {};
            for (let i = 1; i <= 10; i++) {
                const pIdx = Math.floor((i - 1) / slotsPerPlayer);
                if (pIdx < count && pls[pIdx]) {
                    mapping[i] = {
                        id: pls[pIdx].id,
                        name: pls[pIdx].name,
                        drinks: 3,
                    };
                }
                else {
                    mapping[i] = null;
                }
            }
            room.fireTornadoMapping = mapping;
            room.fireTornadoMaxSlot = Math.min(10, slotsPerPlayer * count);
            data.fireTornadoMapping = mapping;
        }
        io.to(roomCode).emit("skillActivated", data);
    });
    socket.on("skillTaimanStarted", (data) => {
        const roomCode = data?.roomCode || socket.roomCode;
        if (!roomCode || !rooms[roomCode])
            return;
        io.to(roomCode).emit("skillTaimanStarted", data);
    });
    socket.on("executeSkillEffect", (data) => {
        const roomCode = data?.roomCode || socket.roomCode;
        if (!roomCode || !rooms[roomCode])
            return;
        const room = rooms[roomCode];
        const p = room.gamePlayers.find((pl) => String(pl.id) === String(data.playerId)) ||
            room.gamePlayers[room.activePlayerIndex];
        ensureSkillUsesInitialized(p);
        if (!p ||
            !p.isRankedUp ||
            p.usedSkillThisTurn ||
            (p.skillUsesLeft !== undefined && p.skillUsesLeft <= 0)) {
            return;
        }
        p.skillUsedOnce = true;
        p.usedSkillThisTurn = true;
        p.skillUsesLeft = Math.max(0, (p.skillUsesLeft !== undefined
            ? p.skillUsesLeft
            : getMaxSkillUsesForPlayer(p)) - 1);
        const addDrinksToPlayer = (targetP, count) => {
            if (!targetP || count <= 0)
                return;
            targetP.drinkCount = (targetP.drinkCount || 0) + count;
            const maxHp = (targetP.baseCap || 80) + (targetP.bonusCap || 0);
            targetP.currentHp = Math.max(0, (targetP.currentHp !== undefined ? targetP.currentHp : maxHp) -
                count * 10);
            if (targetP.currentHp <= 0) {
                targetP.happiness = Math.max(0, (targetP.happiness !== undefined ? targetP.happiness : 100) - 30);
                targetP.skipTurn = true;
                targetP.currentHp = maxHp;
            }
        };
        const refundActivePlayerTurnDrinks = (activeP, maxRefund) => {
            if (!activeP)
                return 0;
            const drunkThisTurn = Math.max(0, (activeP.drinkCount || 0) - (activeP.turnStartDrinkCount || 0));
            const refund = maxRefund !== null
                ? Math.min(drunkThisTurn, maxRefund)
                : drunkThisTurn;
            if (refund > 0) {
                activeP.drinkCount = Math.max(0, (activeP.drinkCount || 0) - refund);
                const maxHp = (activeP.baseCap || 80) + (activeP.bonusCap || 0);
                activeP.currentHp = Math.min(maxHp, (activeP.currentHp !== undefined ? activeP.currentHp : maxHp) +
                    refund * 10);
                if (activeP.currentHp > 0)
                    activeP.skipTurn = false;
            }
            return refund;
        };
        const targetIds = Array.isArray(data.targetIds)
            ? data.targetIds.map(String)
            : [];
        const targetPlayers = targetIds
            .map((tid) => room.gamePlayers.find((pl) => String(pl.id) === tid))
            .filter(Boolean);
        const t1 = targetPlayers[0];
        let resultMessage = "必殺技の効果が発動した！";
        const jobId = p.jobId || data.jobId;
        if (jobId === "ikemen") {
            p.fixedOneTurns = 3;
            resultMessage = `🎯 点線ストーリー発動！これから3ターンの間、${p.name} のルーレットの出目がすべて【1】になります！`;
        }
        else if (jobId === "okinawa" && t1) {
            t1.okinawaProtectorId = String(p.id);
            t1._lastDrinkBaseline = t1.drinkCount || 0;
            resultMessage = `🌺 「ほんまに申し訳ない」発動！${t1.name} が次に飲むお酒を ${p.name} が代わりに飲みます！`;
        }
        else if (jobId === "korean") {
            p.koreanModeThisTurn = true;
            room.koreanModeActive = true;
            resultMessage = `🇰🇷 한국어로 변환! 모든 문자를 한국어로 변환합니다.`;
        }
        else if (jobId === "mob" && t1) {
            const isVice = p.job === "副代表" ||
                (data.mobRole === "副代表" && p.job !== "代表");
            const reqCount = isVice ? 1 : 2;
            const roleLabel = isVice ? "副代表" : "代表";
            t1.insurance = Math.max(0, (t1.insurance || 0) - reqCount);
            p.insurance = (p.insurance || 0) + reqCount;
            resultMessage = `👑 ${roleLabel}権限発動！${t1.name} から生命保険を ${reqCount}枚 もらった！`;
        }
        else if (jobId === "heian") {
            const chosenDice = Math.min(10, Math.max(1, Number(data.chosenDice) || 1));
            resultMessage = `🎓 エスカレーター進学！指定した出目【${chosenDice}】でそのまま進みます！`;
            room.currentPhase = PHASES.PIECE_MOVING;
            setTimeout(() => {
                if (!rooms[roomCode])
                    return;
                io.to(roomCode).emit("spinRoulette", {
                    result: chosenDice,
                    activePlayerIndex: room.activePlayerIndex,
                    players: room.gamePlayers,
                    currentPhase: room.currentPhase,
                });
            }, 1500);
        }
        else if (jobId === "bijin" && t1) {
            p.substituteDrinkTargetId = String(t1.id);
            p._lastDrinkBaseline = p.drinkCount || 0;
            resultMessage = `💖 代わりに飲んで♡ 発動！このターン ${p.name} が飲む分はすべて ${t1.name} が代わりに飲みます！`;
        }
        else if (jobId === "omoshiro") {
            if (targetPlayers.length > 0) {
                targetPlayers.forEach((tp) => addDrinksToPlayer(tp, 1));
                resultMessage = `🤣 NOスリップ！一発ギャグで笑った ${targetPlayers.map((x) => x.name).join("・")} が 1杯ずつ 飲む！`;
            }
            else {
                resultMessage = `🥶 一発ギャグを披露したが…誰も笑わなかった！！`;
            }
        }
        else if (jobId === "ijirare" && t1) {
            const cups = Math.max(1, Math.min(5, Number(data.chosenCups) || 1));
            addDrinksToPlayer(p, cups);
            addDrinksToPlayer(t1, cups);
            resultMessage = `🐶 「Who let the dogs out?」発動！${p.name} と ${t1.name} が ${cups}杯ずつ 乾杯して飲む！`;
        }
        else if (jobId === "p_char") {
            resultMessage = `🐟 ${p.name} の「はねる」！ …しかし なにもおこらない！`;
        }
        else if (jobId === "zako") {
            const refund = refundActivePlayerTurnDrinks(p, null);
            resultMessage = `🍼 「こんなに飲めません！」発動！このターンの飲酒（${Math.max(2, refund)}杯）が帳消しになり、飲まなくてよくなった！`;
        }
        else if (jobId === "psychopath" && targetPlayers.length > 0) {
            targetPlayers.forEach((tp) => addDrinksToPlayer(tp, 1));
            resultMessage = `🎆 花火乱射！！ ${targetPlayers.map((x) => x.name).join(" と ")} に 1杯ずつ 飲ませた！`;
        }
        else if (jobId === "shugo" && t1) {
            addDrinksToPlayer(t1, 2);
            resultMessage = `🔥 番長とタイマン決着！飲み会ゲームに負けた ${t1.name} が 2杯 飲む！`;
        }
        else if (jobId === "soccer") {
            const maxSlot = room.fireTornadoMaxSlot || 10;
            const resultNum = Math.floor(Math.random() * maxSlot) + 1;
            const mapping = room.fireTornadoMapping || {};
            const hitSlot = mapping[resultNum];
            const hitPlayer = (hitSlot &&
                room.gamePlayers.find((pl) => String(pl.id) === String(hitSlot.id))) ||
                room.gamePlayers[resultNum % room.gamePlayers.length] ||
                p;
            io.to(roomCode).emit("fireTornadoSpin", {
                result: resultNum,
                hitPlayerId: hitPlayer.id,
                hitPlayerName: hitPlayer.name,
            });
            setTimeout(() => {
                if (!rooms[roomCode])
                    return;
                addDrinksToPlayer(hitPlayer, 3);
                applySubstituteDrinkIfNeeded(room);
                const tornadoMsg = `⚽🔥 ファイアトルネード直撃！！ 出目【${resultNum}】の ${hitPlayer.name} が 3杯 飲む！`;
                io.to(roomCode).emit("skillEffectResolved", {
                    playerId: p.id,
                    resultMessage: tornadoMsg,
                    isFireTornado: true,
                    hitPlayerName: hitPlayer.name,
                    resultNum,
                });
                io.to(roomCode).emit("syncGameState", {
                    players: room.gamePlayers,
                    activePlayerIndex: room.activePlayerIndex,
                    currentPhase: room.currentPhase,
                });
            }, 3100);
            return;
        }
        else if (jobId === "busaiku") {
            const riajuList = room.gamePlayers.filter((op) => op &&
                String(op.id) !== String(p.id) &&
                (op.isLover || (Array.isArray(op.lovers) && op.lovers.length > 0)));
            if (riajuList.length > 0) {
                riajuList.forEach((op) => addDrinksToPlayer(op, 2));
                resultMessage = `😈 みちづれ発動！恋人がいるリア充（${riajuList.map((x) => x.name).join("・")}）に怨念で2杯ずつ飲ませた！`;
            }
            else if (t1) {
                addDrinksToPlayer(t1, 2);
                resultMessage = `😈 みちづれ発動！リア充がいないため、指名した ${t1.name} に2杯飲ませた！`;
            }
        }
        applySubstituteDrinkIfNeeded(room);
        io.to(roomCode).emit("skillEffectResolved", {
            playerId: p.id,
            resultMessage,
        });
        io.to(roomCode).emit("syncGameState", {
            players: room.gamePlayers,
            activePlayerIndex: room.activePlayerIndex,
            currentPhase: room.currentPhase,
        });
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
                console.log(`\n🛠️ [SERVER DEBUG-WARP] 目的地直撃シーケンス起動: ${targetId}番マス`);
                p.position = targetId;
                if (typeof gameMaster_js_1.MAP_SQUARES !== "undefined" && gameMaster_js_1.MAP_SQUARES[targetId]) {
                    p.location = gameMaster_js_1.MAP_SQUARES[targetId].location || "家";
                }
                else {
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
//# sourceMappingURL=server.js.map