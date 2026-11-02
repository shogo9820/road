"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const client_1 = require("react-dom/client");
const socket = io();
let roomCode = "";
let players = [];
let activePlayerIndex = 0;
let pcCurrentRotation = 0;
let isPCEventMode = false;
let currentGameMode = "normal";
// 🎯 カラーパレット定義（インデックス順）
const PLAYER_COLOR_PALETTE = [
    "#f44336",
    "#2196f3",
    "#4caf50",
    "#ff9800",
    "#9c27b0",
    "#00bcd4",
    "#e91e63",
    "#795548",
];
// 🗺️ ゲーム内に存在する全ロケーション一覧の定義
const ALL_GAME_LOCATIONS = [
    "スタート前",
    "家",
    "とりき",
    "ももじ",
    "ぱいぱい",
    "宅飲み",
];
const GAME_EVENTS = {
    入学式: {
        class: "theme-entrance",
        title: "🌸 入学式 🌸",
        desc: (name) => `${name} さんの大学生活がスタート！`,
    },
    ランクアップ: {
        class: "theme-rankup",
        title: "🔥 ランクアップチャンス 🔥",
        desc: (name) => `${name} さんの実力が試される時！`,
    },
    引退: {
        class: "theme-retirement",
        title: "🎓 サークル引退式 🎓",
        desc: (name) => `${name} さん、これまでの思い出を胸に引退！`,
    },
};
// 外部スクリプト（board.js / sq_XX.js）との完全互換用グローバルブリッジ
let syncReactStateRef = null;
let setScreenRef = null;
let setQrCodeRef = null;
Object.defineProperties(window, {
    socket: { get: () => socket, configurable: true },
    roomCode: {
        get: () => roomCode,
        set: (v) => {
            roomCode = v;
            if (syncReactStateRef)
                syncReactStateRef();
        },
        configurable: true,
    },
    players: {
        get: () => players,
        set: (v) => {
            players = v;
            if (syncReactStateRef)
                syncReactStateRef();
        },
        configurable: true,
    },
    activePlayerIndex: {
        get: () => activePlayerIndex,
        set: (v) => {
            activePlayerIndex = v;
            if (syncReactStateRef)
                syncReactStateRef();
        },
        configurable: true,
    },
    pcCurrentRotation: {
        get: () => pcCurrentRotation,
        set: (v) => {
            pcCurrentRotation = v;
        },
        configurable: true,
    },
    isPCEventMode: {
        get: () => isPCEventMode,
        set: (v) => {
            isPCEventMode = v;
        },
        configurable: true,
    },
    currentGameMode: {
        get: () => currentGameMode,
        set: (v) => {
            currentGameMode = v;
            if (syncReactStateRef)
                syncReactStateRef();
        },
        configurable: true,
    },
});
function switchScreen(targetId) {
    if (setScreenRef) {
        setScreenRef(targetId);
    }
}
function renderPlayerWaitingList() {
    if (syncReactStateRef)
        syncReactStateRef();
}
function renderLocationPlayersList() {
    if (syncReactStateRef)
        syncReactStateRef();
}
function updateCurrentPlayerDisplay() {
    if (syncReactStateRef)
        syncReactStateRef();
}
// 🎯 【基本ルーティン：行程③＆④】物理角度盤面スピン・トコトコ移動・100%無差別着地信号
function executeSyncedRoulette(resultNum) {
    const p = players[activePlayerIndex];
    if (!p)
        return;
    const resEl = document.getElementById("roulette-result-display");
    if (resEl)
        resEl.textContent = "🎯 回転中...";
    const descEl = document.getElementById("event-text") ||
        document.getElementById("current-tile-desc");
    if (descEl && !isPCEventMode)
        descEl.innerHTML = `<p class="event-msg" style="color: #666; font-weight: bold; animation: pulse 1s infinite;">🌀 ルーレット回転中... どこに止まるかな？ 🌀</p>`;
    const targetDegrees = [342, 306, 270, 234, 198, 162, 126, 90, 54, 18];
    const stopAngle = targetDegrees[resultNum - 1];
    pcCurrentRotation +=
        1800 + ((stopAngle - (pcCurrentRotation % 360) + 360) % 360);
    let wheel = (isPCEventMode
        ? document.querySelector("#pc-event-modal .event-roulette-wheel") ||
            document.querySelector("#pc-couple-event-modal .event-roulette-wheel")
        : document.getElementById("controller-roulette-wheel") ||
            document.getElementById("pc-roulette-wheel"));
    if (wheel) {
        wheel.style.transition = "transform 3s cubic-bezier(0.15, 0.9, 0.2, 1)";
        wheel.style.transform = `rotate(${pcCurrentRotation}deg)`;
    }
    if (isPCEventMode) {
        return;
    }
    setTimeout(() => {
        if (resEl)
            resEl.textContent = `出目: ${resultNum}`;
        let stepsMoved = 0;
        console.log(`💻 [PC MOVEMENT] ピン movements を開始。歩数: ${resultNum}歩`);
        const moveTimer = setInterval(() => {
            const currentSquare = MAP_SQUARES[p.position];
            if (stepsMoved > 0 &&
                currentSquare &&
                (currentSquare.type === "branch" ||
                    currentSquare.type === "force_stop" ||
                    currentSquare.type === "force_stop_rankup")) {
                console.log(`💻 [PC MOVEMENT] 強制ストップマス(ID: ${p.position})を発見！着地へ。`);
                clearInterval(moveTimer);
                finalizeMovement();
                return;
            }
            if (stepsMoved >= resultNum ||
                !currentSquare ||
                !currentSquare.nextId ||
                currentSquare.nextId.length === 0) {
                console.log(`💻 [PC MOVEMENT] 指定歩数完了。目的地(ID: ${p.position})へ着地。`);
                clearInterval(moveTimer);
                finalizeMovement();
                return;
            }
            const nextIdArray = currentSquare.nextId;
            if (Number(p.position) === 89 && p.isRepeat) {
                // 🎯 留年フラグがある時は強制的に 90番マス（留年ルート）へ！
                p.position = 90;
            }
            else if (Array.isArray(nextIdArray) && nextIdArray.length > 1) {
                p.position = Number(nextIdArray[p.chosenRouteIdx !== undefined && p.chosenRouteIdx !== null
                    ? Number(p.chosenRouteIdx)
                    : 0]);
            }
            else {
                p.position = Number(Array.isArray(nextIdArray) ? nextIdArray[0] : nextIdArray);
            }
            stepsMoved++;
            if (window.boardManager)
                window.boardManager.draw(players, activePlayerIndex);
        }, 250);
        function finalizeMovement() {
            console.log(`💻 [PC FINALIZE] ➔ マスID: ${p.position} に到着。サーバーへ着地通知を送信します。`);
            socket.emit("squareLanded", {
                roomCode: roomCode,
                position: p.position,
            });
        }
    }, 3000);
}
function triggerDelayedDisplay(resultNum, targetSquare) {
    const p = players[activePlayerIndex];
    if (!p)
        return;
    const modObj = window.SQ_MODULES && window.SQ_MODULES[p.position];
    const targetModule = modObj
        ? modObj[currentGameMode] || modObj.normal
        : null;
    const detectedText = targetModule && targetModule.text
        ? targetModule.text
        : targetSquare && targetSquare.text
            ? targetSquare.text
            : "通常マス";
    const detectedLocation = targetModule && targetModule.location
        ? targetModule.location
        : targetSquare && targetSquare.location
            ? targetSquare.location
            : "家";
    p.location = detectedLocation;
    const eventTextEl = document.getElementById("event-text") ||
        document.getElementById("current-tile-desc");
    const eventCardEl = document.querySelector(".tile-event-card");
    if (eventTextEl) {
        eventTextEl.innerHTML = `<p class="event-msg" style="color: #2c3e50; font-weight: bold; font-size: 1.15rem; margin: 0;">🎲 ${detectedText}</p>`;
    }
    else if (eventCardEl) {
        eventCardEl.innerHTML = `
      <div class="card-title" style="border-bottom: 2px solid #e0e0e0; padding-bottom: 4px; margin-bottom: 8px;">📢 現在のマスの内容</div>
      <div id="current-tile-desc"><p class="event-msg" style="color: #2c3e50; font-weight: bold; font-size: 1.15rem; margin: 0;">🎲 ${detectedText}</p></div>
    `;
    }
    updateCurrentPlayerDisplay();
    // サーバーへ位置と場所のみを通知（スマホ側のHP・杯数・就職判定を上書きしない）
    socket.emit("updateGameState", {
        roomCode: roomCode,
        activePlayerIndex: activePlayerIndex,
        players: [
            {
                id: p.id,
                position: p.position,
                location: p.location,
            },
        ],
    });
}
function openPCEventModal(eventType, playerName, activePlayerId) {
    isPCEventMode = true;
    const pcModal = document.getElementById("pc-event-modal");
    if (!pcModal)
        return;
    const btnNext = document.getElementById("btn-next-turn");
    if (btnNext) {
        btnNext.disabled = true;
        btnNext.style.display = "none";
    }
    const config = GAME_EVENTS[eventType];
    if (!config)
        return;
    pcModal.className = "event-modal-overlay active " + config.class;
    if (document.getElementById("modal-event-title"))
        document.getElementById("modal-event-title").textContent = config.title;
    if (document.getElementById("modal-event-desc"))
        document.getElementById("modal-event-desc").textContent =
            config.desc(playerName);
    const resultBox = document.getElementById("modal-event-result-box");
    if (resultBox) {
        resultBox.style.display = "none";
    }
}
function handleForceStopSquare(player, square) {
    if (!square)
        return;
    if (Number(square.id) === 89)
        return;
    const modObj = window.SQ_MODULES && window.SQ_MODULES[square.id];
    const targetModule = modObj
        ? modObj[currentGameMode] || modObj.normal
        : null;
    if (targetModule && typeof targetModule.event === "function") {
        console.log(`💻 [PC SIGNAL] sq_${square.id}.js の固有event()を起動。`);
        targetModule.event(player, square);
        return;
    }
}
function loadAndApplySquareComponent(squareId, callback) {
    if (window.SQ_MODULES &&
        window.SQ_MODULES[squareId] &&
        (window.SQ_MODULES[squareId][currentGameMode] ||
            window.SQ_MODULES[squareId].normal)) {
        if (typeof callback === "function")
            callback();
        return;
    }
    const script = document.createElement("script");
    script.src = `/squares/sq_${squareId}.js`;
    script.onload = () => {
        if (typeof callback === "function")
            callback();
    };
    script.onerror = () => {
        if (typeof callback === "function")
            callback();
    };
    document.head.appendChild(script);
}
// グローバル関数の公開
window.loadAndApplySquareComponent = loadAndApplySquareComponent;
window.executeSyncedRoulette = executeSyncedRoulette;
window.triggerDelayedDisplay = triggerDelayedDisplay;
window.switchScreen = switchScreen;
window.renderPlayerWaitingList = renderPlayerWaitingList;
window.updateCurrentPlayerDisplay = updateCurrentPlayerDisplay;
window.renderLocationPlayersList = renderLocationPlayersList;
window.handleForceStopSquare = handleForceStopSquare;
// sq_XX.js やルーレットアニメーションが直接DOM操作する領域を保護するメモ化コンポーネント
const RouletteAndTileZone = (0, react_1.memo)(({ currentLocation }) => {
    (0, react_1.useEffect)(() => {
        const locEl = document.querySelector(".roulette-card #current-player-location");
        if (locEl)
            locEl.textContent = currentLocation || "-";
    }, [currentLocation]);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "layout-right", children: [(0, jsx_runtime_1.jsxs)("div", { className: "card roulette-card", children: [(0, jsx_runtime_1.jsx)("div", { className: "roulette-result-display", id: "roulette-result-display", children: "\uD83C\uDFAF \u30BF\u30C3\u30D7\u3057\u3066\u56DE\u305D\u3046\uFF01" }), (0, jsx_runtime_1.jsxs)("div", { style: {
                            position: "relative",
                            width: "200px",
                            height: "200px",
                            margin: "0 auto",
                        }, children: [(0, jsx_runtime_1.jsx)("div", { className: "event-roulette-pointer" }), (0, jsx_runtime_1.jsxs)("div", { className: "roulette-wheel-board", id: "pc-roulette-wheel", children: [(0, jsx_runtime_1.jsx)("div", { className: "roulette-num num-1", children: "1" }), (0, jsx_runtime_1.jsx)("div", { className: "roulette-num num-2", children: "2" }), (0, jsx_runtime_1.jsx)("div", { className: "roulette-num num-3", children: "3" }), (0, jsx_runtime_1.jsx)("div", { className: "roulette-num num-4", children: "4" }), (0, jsx_runtime_1.jsx)("div", { className: "roulette-num num-5", children: "5" }), (0, jsx_runtime_1.jsx)("div", { className: "roulette-num num-6", children: "6" }), (0, jsx_runtime_1.jsx)("div", { className: "roulette-num num-7", children: "7" }), (0, jsx_runtime_1.jsx)("div", { className: "roulette-num num-8", children: "8" }), (0, jsx_runtime_1.jsx)("div", { className: "roulette-num num-9", children: "9" }), (0, jsx_runtime_1.jsx)("div", { className: "roulette-num num-10", children: "10" })] })] }), (0, jsx_runtime_1.jsx)("div", { id: "current-player-location", style: {
                            fontWeight: "bold",
                            marginTop: "8px",
                            color: "#555",
                            fontSize: "1.1rem",
                        }, children: "\u30B9\u30BF\u30FC\u30C8\u524D" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "card tile-event-card", style: { flex: 1, minHeight: "150px" }, children: [(0, jsx_runtime_1.jsx)("div", { className: "card-title", style: {
                            borderBottom: "2px solid #e0e0e0",
                            paddingBottom: "4px",
                            marginBottom: "8px",
                        }, children: "\uD83D\uDCE2 \u73FE\u5728\u306E\u30DE\u30B9\u306E\u5185\u5BB9" }), (0, jsx_runtime_1.jsx)("div", { id: "current-tile-desc", style: {
                            fontSize: "1.1rem",
                            lineHeight: 1.6,
                            fontWeight: "bold",
                            color: "#2c3e50",
                        }, children: "\u30B9\u30DE\u30DB\u304B\u3089\u30EB\u30FC\u30EC\u30C3\u30C8\u3092\u56DE\u3057\u3066\u304F\u3060\u3055\u3044\uFF01" })] })] }));
}, (prev, next) => prev.currentLocation === next.currentLocation);
const PCModalsZone = (0, react_1.memo)(() => ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("div", { id: "pc-event-modal", className: "event-modal-overlay", children: (0, jsx_runtime_1.jsxs)("div", { className: "event-card-container", children: [(0, jsx_runtime_1.jsx)("h1", { className: "event-title", id: "modal-event-title", children: "\uD83D\uDC95 \u30A4\u30D9\u30F3\u30C8\u30BF\u30A4\u30C8\u30EB \uD83D\uDC95" }), (0, jsx_runtime_1.jsx)("p", { className: "event-desc", id: "modal-event-desc", children: "\u30A4\u30D9\u30F3\u30C8\u306E\u8AAC\u660E\u6587\u304C\u3053\u3053\u306B\u8868\u793A\u3055\u308C\u307E\u3059\u3002" }), (0, jsx_runtime_1.jsxs)("div", { className: "event-main-flex", children: [(0, jsx_runtime_1.jsxs)("div", { className: "event-roulette-area", children: [(0, jsx_runtime_1.jsxs)("div", { className: "event-roulette-container", children: [(0, jsx_runtime_1.jsx)("div", { className: "event-roulette-pointer" }), (0, jsx_runtime_1.jsxs)("div", { className: "event-roulette-wheel", children: [(0, jsx_runtime_1.jsx)("div", { className: "roulette-num num-1", children: "1" }), (0, jsx_runtime_1.jsx)("div", { className: "roulette-num num-2", children: "2" }), (0, jsx_runtime_1.jsx)("div", { className: "roulette-num num-3", children: "3" }), (0, jsx_runtime_1.jsx)("div", { className: "roulette-num num-4", children: "4" }), (0, jsx_runtime_1.jsx)("div", { className: "roulette-num num-5", children: "5" }), (0, jsx_runtime_1.jsx)("div", { className: "roulette-num num-6", children: "6" }), (0, jsx_runtime_1.jsx)("div", { className: "roulette-num num-7", children: "7" }), (0, jsx_runtime_1.jsx)("div", { className: "roulette-num num-8", children: "8" }), (0, jsx_runtime_1.jsx)("div", { className: "roulette-num num-9", children: "9" }), (0, jsx_runtime_1.jsx)("div", { className: "roulette-num num-10", children: "10" })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "result-display-zone", id: "modal-roulette-result-display", children: "\uD83C\uDFAF \u30B9\u30DE\u30DB\u304B\u3089\u56DE\u3057\u3066\u306D\uFF01" }), (0, jsx_runtime_1.jsx)("div", { id: "modal-event-result-box", className: "event-result-box", style: { display: "none" } })] }), (0, jsx_runtime_1.jsx)("div", { className: "event-table-area", id: "pc-event-table-dynamic-zone" })] })] }) }), (0, jsx_runtime_1.jsx)("div", { id: "pc-kanpai-modal", className: "kanpai-overlay", style: { display: "none" }, children: (0, jsx_runtime_1.jsxs)("div", { className: "kanpai-window", children: [(0, jsx_runtime_1.jsx)("div", { className: "kanpai-glow" }), (0, jsx_runtime_1.jsx)("h1", { className: "kanpai-header", children: "\uD83C\uDF7B \u7279\u5927\u4E7E\u676F\u30A4\u30D9\u30F3\u30C8\u767A\u751F\uFF01 \uD83C\uDF7B" }), (0, jsx_runtime_1.jsx)("div", { id: "pc-kanpai-members", className: "kanpai-buddies" }), (0, jsx_runtime_1.jsx)("div", { className: "kanpai-at", children: "\u304C" }), (0, jsx_runtime_1.jsx)("div", { id: "pc-kanpai-location", className: "kanpai-spot" }), (0, jsx_runtime_1.jsx)("div", { className: "kanpai-at", children: "\u3067" }), (0, jsx_runtime_1.jsx)("div", { className: "kanpai-shout", children: "\uD83C\uDF7B \u4E7E\u676F\uFF01\uFF01\uFF01 \uD83C\uDF7B" }), (0, jsx_runtime_1.jsx)("div", { className: "kanpai-footer-nav", children: "\u203B\u30B9\u30DE\u30DB\u306E\u300C\u27A1 \u6B21\u306E\u30D7\u30EC\u30A4\u30E4\u30FC\u3078\u300D\u30DC\u30BF\u30F3\u3092\u62BC\u3057\u3066\u9032\u3081\u3066\u304F\u3060\u3055\u3044" })] }) })] })), () => true);
function PCApp() {
    const [activeScreen, setActiveScreen] = (0, react_1.useState)("screen-setup");
    const [hostName, setHostName] = (0, react_1.useState)("やじま");
    const [roomCodeState, setRoomCodeState] = (0, react_1.useState)("");
    const [qrCodeUrl, setQrCodeUrl] = (0, react_1.useState)("");
    const [playersState, setPlayersState] = (0, react_1.useState)([]);
    const [activeIdxState, setActiveIdxState] = (0, react_1.useState)(0);
    const [gameModeState, setGameModeState] = (0, react_1.useState)("normal");
    (0, react_1.useEffect)(() => {
        setScreenRef = (screenId) => {
            setActiveScreen(screenId);
        };
        setQrCodeRef = (url) => {
            setQrCodeUrl(url);
        };
        syncReactStateRef = () => {
            setRoomCodeState(roomCode);
            setPlayersState([...players]);
            setActiveIdxState(activePlayerIndex);
            setGameModeState(currentGameMode);
        };
        console.log("\n=========================================");
        console.log("💻 [PC DOM_LOAD] 大画面初期化を開始します...");
        initSocketListeners();
        appendSocketListeners();
        console.log("=========================================");
        return () => {
            syncReactStateRef = null;
            setScreenRef = null;
            setQrCodeRef = null;
        };
    }, []);
    // 画面切り替えやプレイヤー更新時にCanvas盤面を再描画
    (0, react_1.useEffect)(() => {
        if ((activeScreen === "screen-waiting" || activeScreen === "screen-game") &&
            window.boardManager) {
            if (!window.boardManager.canvas) {
                window.boardManager.init(100);
            }
            window.boardManager.draw(players, activePlayerIndex);
        }
    }, [activeScreen, playersState, activeIdxState]);
    const handleCreateRoom = (e) => {
        if (e)
            e.preventDefault();
        const targetHostName = hostName ? hostName : "やじま";
        console.log(`💻 [PC ACTION] ルーム作成要求を発射。ホスト名: ${targetHostName}`);
        socket.emit("createRoom", { hostName: targetHostName });
    };
    // 現在手番プレイヤーのステータス計算
    const p = playersState[activeIdxState];
    const jobMaster = p && typeof JOBS !== "undefined"
        ? JOBS.find((j) => j.id === p.jobId || j.label === p.job || j.title === p.job)
        : null;
    const baseCap = p ? (jobMaster ? jobMaster.cap : p.baseCap || 100) : 100;
    const maxHp = p ? baseCap + (p.bonusCap || 0) : 100;
    const rawCurrentHp = p && p.currentHp !== undefined ? p.currentHp : maxHp;
    const currentHp = Math.max(0, rawCurrentHp);
    const jobLabel = p
        ? (p.isRankedUp || (jobMaster && p.job === jobMaster.title)) && jobMaster
            ? jobMaster.title
            : jobMaster
                ? jobMaster.label
                : p.job || "モブ"
        : "モブ";
    const playerColor = p
        ? p.color ||
            PLAYER_COLOR_PALETTE[activeIdxState % PLAYER_COLOR_PALETTE.length]
        : "#6a11cb";
    const hpVal = p && p.happiness !== undefined ? p.happiness : 100;
    const happinessColor = hpVal >= 100 ? "#ffeb3b" : hpVal >= 50 ? "#ffffff" : "#ff8a80";
    const currentLocation = p && p.location ? p.location : "-";
    // ロケーション別滞在プレイヤー集計
    const locationMap = {};
    ALL_GAME_LOCATIONS.forEach((loc) => (locationMap[loc] = []));
    playersState.forEach((pl, idx) => {
        const loc = pl.location && pl.location.trim() !== "" ? pl.location : "スタート前";
        if (!locationMap[loc])
            locationMap[loc] = [];
        locationMap[loc].push({
            index: idx + 1,
            name: pl.name,
            color: pl.color || PLAYER_COLOR_PALETTE[idx % PLAYER_COLOR_PALETTE.length],
        });
    });
    return ((0, jsx_runtime_1.jsxs)("div", { className: "app-container", children: [(0, jsx_runtime_1.jsx)("div", { id: "screen-setup", className: activeScreen === "screen-setup" ? "active" : "", style: { display: activeScreen === "screen-setup" ? "" : "none" }, children: (0, jsx_runtime_1.jsxs)("div", { className: "pc-card", children: [(0, jsx_runtime_1.jsx)("h1", { children: "\uD83C\uDF7B \u5B85\u98F2\u307F\u4EBA\u751F\u30B2\u30FC\u30E0 \uD83C\uDF7A" }), (0, jsx_runtime_1.jsx)("p", { children: "\u301C \u30B5\u30FC\u30AF\u30EB\u751F\u6D3B\u306E\u601D\u3044\u51FA\u3068\u30A2\u30EB\u30B3\u30FC\u30EB \u301C" }), (0, jsx_runtime_1.jsx)("div", { style: { margin: "20px 0" }, children: (0, jsx_runtime_1.jsxs)("label", { children: ["\u30DB\u30B9\u30C8\u30D7\u30EC\u30A4\u30E4\u30FC\u540D:", " ", (0, jsx_runtime_1.jsx)("input", { type: "text", id: "pc-host-name", value: hostName, onChange: (e) => setHostName(e.target.value), style: {
                                            padding: "8px",
                                            fontSize: "1.1rem",
                                            borderRadius: "6px",
                                            border: "1px solid #ccc",
                                            textAlign: "center",
                                        } })] }) }), (0, jsx_runtime_1.jsx)("button", { id: "btn-create-room", className: "btn-orange", style: { margin: "0 auto", maxWidth: "300px" }, onClick: handleCreateRoom, children: "\uD83D\uDE80 \u30EB\u30FC\u30E0\u3092\u4F5C\u6210\u3059\u308B" })] }) }), (0, jsx_runtime_1.jsx)("div", { id: "screen-waiting", className: activeScreen === "screen-waiting" ? "active" : "", style: { display: activeScreen === "screen-waiting" ? "" : "none" }, children: (0, jsx_runtime_1.jsxs)("div", { className: "card", style: { maxWidth: "800px", margin: "40px auto" }, children: [(0, jsx_runtime_1.jsxs)("div", { className: "room-info-header", children: [(0, jsx_runtime_1.jsx)("h2", { children: "ROOM CODE" }), (0, jsx_runtime_1.jsx)("div", { className: "room-code-display", id: "display-room-code", children: roomCodeState || "----" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "waiting-grid", children: [(0, jsx_runtime_1.jsxs)("div", { className: "qr-panel", children: [(0, jsx_runtime_1.jsx)("img", { id: "qrcode-img", src: qrCodeUrl, alt: "\u53C2\u52A0\u7528QR\u30B3\u30FC\u30C9", style: {
                                                width: "150px",
                                                height: "150px",
                                                display: "block",
                                                background: "#eee",
                                            } }), (0, jsx_runtime_1.jsx)("p", { style: { fontWeight: "bold", margin: "5px 0 0 0" }, children: "\u30B9\u30DE\u30DB\u3067QR\u30B3\u30FC\u30C9\u3092\u8AAD\u307F\u53D6\u3063\u3066\u53C2\u52A0\uFF01" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { children: "\uD83D\uDC65 \u53C2\u52A0\u30E1\u30F3\u30D0\u30FC" }), (0, jsx_runtime_1.jsx)("ul", { id: "player-list", style: {
                                                fontSize: "1.3rem",
                                                fontWeight: "bold",
                                                lineHeight: 2,
                                            }, children: playersState.map((pl, idx) => ((0, jsx_runtime_1.jsx)("li", { children: `👤 ${pl.name}` }, pl.id || idx))) }), (0, jsx_runtime_1.jsx)("p", { style: {
                                                color: "#e67e22",
                                                fontWeight: "bold",
                                                marginTop: "15px",
                                                animation: "pulse 1s infinite",
                                            }, children: "\u203B \u30B2\u30FC\u30E0\u30B9\u30BF\u30FC\u30C8\u306F\u30B9\u30DE\u30DB\uFF08\u30B3\u30F3\u30C8\u30ED\u30FC\u30E9\u30FC\uFF09\u304B\u3089\u64CD\u4F5C\u3057\u3066\u304F\u3060\u3055\u3044" })] })] })] }) }), (0, jsx_runtime_1.jsx)("div", { id: "screen-game", className: activeScreen === "screen-game" ? "active" : "", style: { display: activeScreen === "screen-game" ? "" : "none" }, children: (0, jsx_runtime_1.jsxs)("div", { className: "game-layout", children: [(0, jsx_runtime_1.jsxs)("div", { className: "layout-left", children: [(0, jsx_runtime_1.jsxs)("div", { className: "card current-player-card", style: {
                                        background: `linear-gradient(135deg, ${playerColor} 0%, #2575fc 100%)`,
                                    }, children: [(0, jsx_runtime_1.jsxs)("div", { className: "player-header", children: [(0, jsx_runtime_1.jsx)("div", { className: "player-avatar", id: "current-player-avatar", children: "\uD83D\uDC64" }), (0, jsx_runtime_1.jsxs)("div", { className: "player-meta", children: [(0, jsx_runtime_1.jsx)("h2", { id: "current-player-name", children: p ? p.name : "プレイヤー名" }), (0, jsx_runtime_1.jsx)("span", { className: "job-badge", id: "current-player-job", children: jobLabel }), (0, jsx_runtime_1.jsx)("div", { id: "current-player-lover-icon", style: {
                                                                display: p && p.isLover ? "inline-block" : "none",
                                                            }, children: p && p.isLover && p.lovers && p.lovers.length > 0 ? ((0, jsx_runtime_1.jsx)("span", { style: {
                                                                    fontSize: "0.95rem",
                                                                    fontWeight: "bold",
                                                                    color: "#ffeb3b",
                                                                    background: "rgba(0,0,0,0.2)",
                                                                    padding: "2px 8px",
                                                                    borderRadius: "20px",
                                                                }, children: `💕 恋人: ${p.lovers.join("、")}` })) : p && p.isLover ? ("❤️") : null })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "player-stats", children: [(0, jsx_runtime_1.jsxs)("div", { className: "stat-item", children: [(0, jsx_runtime_1.jsx)("span", { children: "\uD83C\uDF7A \u676F\u6570" }), (0, jsx_runtime_1.jsx)("span", { id: "current-player-drinks", children: `${p ? p.drinkCount || 0 : 0} 杯` })] }), (0, jsx_runtime_1.jsxs)("div", { className: "stat-item", children: [(0, jsx_runtime_1.jsx)("span", { children: "\u2764\uFE0F \u4F53\u529B" }), (0, jsx_runtime_1.jsx)("span", { id: "current-player-hp", children: `${currentHp} / ${maxHp}` })] }), (0, jsx_runtime_1.jsxs)("div", { className: "stat-item", children: [(0, jsx_runtime_1.jsx)("span", { children: "\u2728 \u5E78\u798F\u5EA6" }), (0, jsx_runtime_1.jsx)("span", { id: "current-player-happiness", style: { color: happinessColor }, children: `${hpVal} pt` })] }), (0, jsx_runtime_1.jsxs)("div", { className: "stat-item", children: [(0, jsx_runtime_1.jsx)("span", { children: "\uD83D\uDCCD \u73FE\u5728\u5730" }), (0, jsx_runtime_1.jsx)("span", { id: "current-player-location", children: currentLocation })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "card player-color-legend-card", children: [(0, jsx_runtime_1.jsx)("div", { className: "card-title", style: {
                                                fontWeight: "bold",
                                                fontSize: "0.95rem",
                                                marginBottom: "8px",
                                                color: "#555",
                                            }, children: "\uD83C\uDFA8 \u30D7\u30EC\u30A4\u30E4\u30FC\u30AB\u30E9\u30FC" }), (0, jsx_runtime_1.jsx)("div", { id: "player-color-legend-list", className: "color-legend-container", children: playersState.map((pl, idx) => {
                                                const pColor = pl.color ||
                                                    PLAYER_COLOR_PALETTE[idx % PLAYER_COLOR_PALETTE.length];
                                                return ((0, jsx_runtime_1.jsxs)("div", { className: "color-legend-item", children: [(0, jsx_runtime_1.jsx)("span", { className: "color-piece-dot", style: { background: pColor } }), (0, jsx_runtime_1.jsx)("span", { children: pl.name || `P${idx + 1}` })] }, pl.id || idx));
                                            }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "card location-board-card", children: [(0, jsx_runtime_1.jsx)("div", { className: "card-title", style: {
                                                fontWeight: "bold",
                                                fontSize: "0.95rem",
                                                marginBottom: "8px",
                                                color: "#555",
                                            }, children: "\uD83D\uDCCD \u30A8\u30EA\u30A2\u5225 \u6EDE\u5728\u72B6\u6CC1" }), (0, jsx_runtime_1.jsx)("div", { className: "location-table-wrapper", children: (0, jsx_runtime_1.jsxs)("table", { className: "location-table", children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { style: { width: "45%" }, children: "\u30A8\u30EA\u30A2" }), (0, jsx_runtime_1.jsx)("th", { style: { width: "55%" }, children: "\u6EDE\u5728\u4E2D\u306E\u99D2" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { id: "location-table-body", children: ALL_GAME_LOCATIONS.map((locName) => {
                                                            const stayingPlayers = locationMap[locName] || [];
                                                            return ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { className: "location-name-cell", children: locName }), (0, jsx_runtime_1.jsx)("td", { className: "location-pieces-cell", children: stayingPlayers.length > 0 ? (stayingPlayers.map((pObj) => ((0, jsx_runtime_1.jsx)("span", { className: "board-mini-piece", style: { backgroundColor: pObj.color }, title: `${pObj.name} (P${pObj.index})`, children: pObj.index }, pObj.index)))) : ((0, jsx_runtime_1.jsx)("span", { style: { color: "#ccc", fontSize: "0.75rem" }, children: "-" })) })] }, locName));
                                                        }) })] }) })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "layout-center", children: (0, jsx_runtime_1.jsxs)("div", { className: "map-card-maximized", children: [(0, jsx_runtime_1.jsxs)("div", { className: "map-header", children: [(0, jsx_runtime_1.jsx)("span", { className: "map-title-text", children: "\uD83D\uDDFA\uFE0F \u3059\u3054\u308D\u304F\u30DE\u30C3\u30D7" }), (0, jsx_runtime_1.jsx)("span", { className: "mode-badge", id: "pc-game-mode-badge", children: gameModeState === "short" ? "ショートモード" : "通常モード" })] }), (0, jsx_runtime_1.jsx)("canvas", { id: "board-canvas" })] }) }), (0, jsx_runtime_1.jsx)(RouletteAndTileZone, { currentLocation: currentLocation })] }) }), (0, jsx_runtime_1.jsx)(PCModalsZone, {})] }));
}
function initSocketListeners() {
    socket.off("connect");
    socket.on("connect", () => {
        console.log("💻 [PC SOCKET] Socket.io サーバーに正常接続完了。ID:", socket.id);
    });
    socket.off("roomCreated");
    socket.on("roomCreated", (data) => {
        roomCode = data.roomCode;
        if (data.players)
            players = data.players;
        console.log(`💻 [PC RECEIVE] roomCreated 受信。作成された部屋コード: ${roomCode}`);
        if (setQrCodeRef && data.qrCodeDataUrl) {
            setQrCodeRef(data.qrCodeDataUrl);
        }
        switchScreen("screen-waiting");
        renderPlayerWaitingList();
        updateCurrentPlayerDisplay();
        renderLocationPlayersList();
        if (window.boardManager) {
            window.boardManager.init(100);
            window.boardManager.draw(players, activePlayerIndex);
        }
    });
    socket.off("applySettings");
    socket.on("applySettings", (data) => {
        console.log("💻 [PC RECEIVE] applySettings 受信。参加者リストを同期します。");
        const targetMode = data && (data.mode || data.gameMode);
        if (targetMode) {
            currentGameMode = targetMode;
        }
        if (data.players && Array.isArray(data.players)) {
            players = data.players;
            renderPlayerWaitingList();
            updateCurrentPlayerDisplay();
            renderLocationPlayersList();
            if (window.boardManager)
                window.boardManager.draw(players, activePlayerIndex);
        }
        else if (syncReactStateRef) {
            syncReactStateRef();
        }
    });
    // ==========================================================================
    // 🧭 【ルーティン行程②：ゲーム開始・ターン開始時イベント確認（1.TURN_START）】
    // ==========================================================================
    socket.off("gameStarted");
    socket.on("gameStarted", (data) => {
        if (data && data.players)
            players = data.players;
        if (data && data.activePlayerIndex !== undefined)
            activePlayerIndex = data.activePlayerIndex;
        const targetMode = data && (data.mode || data.gameMode);
        if (targetMode) {
            currentGameMode = targetMode;
        }
        switchScreen("screen-game");
        setTimeout(() => {
            if (window.boardManager) {
                window.boardManager.init(100);
                window.boardManager.draw(players, activePlayerIndex);
            }
        }, 0);
        updateCurrentPlayerDisplay();
        renderLocationPlayersList();
        const p = players[activePlayerIndex];
        if (p && typeof loadAndApplySquareComponent === "function") {
            console.log(`💻 [2.1 PC受信] ➔ 開始時イベント確認。手番プレイヤーが ${p.position} 番マスにいるため、コンポーネントをロードします。`);
            loadAndApplySquareComponent(p.position, () => {
                let targetSquare = typeof MAP_SQUARES !== "undefined" && MAP_SQUARES[p.position]
                    ? MAP_SQUARES[p.position]
                    : null;
                if (targetSquare) {
                    console.log(`💻 [2.1.1 PC内部処理] sq_${p.position}.js のロード完了。自動進行をせき止めて待機ロックを掛けます。`);
                    handleForceStopSquare(p, targetSquare);
                }
            });
        }
    });
}
function appendSocketListeners() {
    // ==========================================================================
    // 🧭 【基本ルーティン：行程③】サーバーから出目配信を受信した瞬間
    // ==========================================================================
    socket.off("spinRoulette");
    socket.on("spinRoulette", (data) => {
        if (data) {
            if (data.activePlayerIndex !== undefined)
                activePlayerIndex = data.activePlayerIndex;
            if (data.players && Array.isArray(data.players)) {
                players = data.players;
            }
            if (syncReactStateRef)
                syncReactStateRef();
            if (window.boardManager) {
                window.boardManager.draw(players, activePlayerIndex);
            }
            const resultNum = data.result !== undefined ? data.result : 1;
            console.log(`💻 [3.3 PC受信] ➔ サーバーから出目 ${resultNum} を受信。大画面のルーレット回転とピンのトコトコ前進を開始します！`);
            executeSyncedRoulette(resultNum);
        }
    });
    // 🎯 【重要】マス着地時：サーバーから合図を受け取り、PC大画面モーダルを即座に表示！
    socket.off("openCustomRouletteModal");
    socket.on("openCustomRouletteModal", (data) => {
        console.log(`💻 [PC 着地時モーダル展開] イベント: ${data.eventName}`);
        isPCEventMode = true;
        const pcModal = document.getElementById("pc-event-modal");
        if (pcModal) {
            pcModal.className = "event-modal-overlay active theme-entrance";
            pcModal.style.display = "flex";
        }
        const titleEl = document.getElementById("modal-event-title");
        if (titleEl)
            titleEl.textContent = `🌸 ${data.eventName} 🌸`;
        const descEl = document.getElementById("modal-event-desc");
        if (descEl)
            descEl.textContent = "出目に応じて結果が決まる！スマホから回してね！";
        const modalResultBox = document.getElementById("modal-event-result-box");
        if (modalResultBox)
            modalResultBox.style.display = "none";
        // 判定対応表を描画
        const dynamicTableZone = document.getElementById("pc-event-table-dynamic-zone");
        if (dynamicTableZone && data.mapping) {
            let html = `<div class="event-title" style="font-size:1.3rem; color:#d81b60; margin-bottom:8px; font-weight:bold; border-bottom:2px solid #ff69b4; padding-bottom:4px;">💖 判定対応表</div><ul class="event-table-list">`;
            for (let i = 1; i <= 10; i++) {
                const target = data.mapping[i];
                let targetText = '<span style="color:#aaa;">-</span>';
                if (target)
                    targetText = `<span style="color:#e91e63; font-weight:bold;">${target.name}</span>`;
                html += `<li class="event-table-item"><div class="event-table-num-badge" style="background:#ff4081;">${i}</div><div>${targetText}</div></li>`;
            }
            html += `</ul>`;
            dynamicTableZone.innerHTML = html;
        }
    });
    // 🎯 【確定版】美人入学式の乾杯モーダルを受信して大画面に表示（「と」で繋ぐプレイヤー名仕様）
    socket.off("openBijinKanpaiModal");
    socket.on("openBijinKanpaiModal", (data) => {
        console.log(`💻 [PC 乾杯モーダル展開] プレイヤー: ${data.playerName}`);
        const pcModal = document.getElementById("pc-kanpai-modal");
        if (pcModal) {
            const titleEl = pcModal.querySelector(".kanpai-header");
            const membersEl = document.getElementById("pc-kanpai-members");
            const locationEl = document.getElementById("pc-kanpai-location");
            if (titleEl)
                titleEl.textContent = "🌸 美人さん大歓迎！ 🌸";
            // 🎯 手元の全プレイヤー配列から、美人以外の名前だけを抽出し「と」で結合する
            if (membersEl && Array.isArray(players) && players.length > 0) {
                const otherPlayerNames = players
                    .filter((p) => p && p.name !== data.playerName)
                    .map((p) => p.name);
                if (otherPlayerNames.length > 0) {
                    membersEl.textContent = otherPlayerNames.join("と");
                }
                else {
                    membersEl.textContent = "周囲のサークル員";
                }
            }
            else if (membersEl) {
                membersEl.textContent = "周囲のサークル員";
            }
            if (locationEl)
                locationEl.textContent = "美人にモテたいの";
            pcModal.style.display = "flex";
        }
    });
    // ==========================================================================
    // 🧭 【一本道リレー：行程④】サーバーからの着地号令（startSquareEvent）受信
    // PC側は「表示・演出」専任として、マスのロードと画面更新のみを行います。
    // ==========================================================================
    socket.off("startSquareEvent");
    socket.on("startSquareEvent", (data) => {
        if (!data || data.position === undefined)
            return;
        if (data.activePlayerIndex !== undefined) {
            activePlayerIndex = data.activePlayerIndex;
        }
        const p = players[activePlayerIndex];
        if (!p)
            return;
        p.position = Number(data.position);
        p.location = data.location || "家";
        console.log(`💻 [PC ROUTINE-演出開始] サーバーから着地号令(startSquareEvent)を受信。マスID: ${p.position}`);
        // 着地先コンポーネントをロードして表示を更新
        loadAndApplySquareComponent(p.position, () => {
            const modObj = window.SQ_MODULES && window.SQ_MODULES[p.position];
            const targetModule = modObj
                ? modObj[currentGameMode] || modObj.normal
                : null;
            const targetSquare = typeof MAP_SQUARES !== "undefined" && MAP_SQUARES[p.position]
                ? MAP_SQUARES[p.position]
                : null;
            // マスの場所を最優先で確定させる（乾杯判定の前に確定！）
            const detectedLocation = targetModule && targetModule.location
                ? targetModule.location
                : targetSquare && targetSquare.location
                    ? targetSquare.location
                    : data.location || "家";
            p.location = detectedLocation;
            // 1. マス固有のイベント表示があれば起動（PC側のモーダル展開など）
            if (targetModule && typeof targetModule.event === "function") {
                console.log(`💻 [sq_${p.position}.js] 大画面側 event() を起動します。`);
                targetModule.event(p, targetSquare || targetModule);
            }
            // 2. 盤面Canvas、ステータス、凡例・エリア表を即座に再描画
            if (window.boardManager) {
                window.boardManager.draw(players, activePlayerIndex);
            }
            updateCurrentPlayerDisplay();
            // 3. 🍻 同じ場所乾杯判定
            if (p.location &&
                p.location !== "家" &&
                p.location !== "スタート前" &&
                p.location !== "-" &&
                p.position !== 99) {
                const samePlaceBuddies = players
                    .filter((otherP) => otherP &&
                    otherP.id !== p.id &&
                    otherP.location === p.location)
                    .map((otherP) => otherP.name);
                if (samePlaceBuddies.length > 0) {
                    console.log(`💻 [PC 乾杯検知] 場所「${p.location}」に先客を発見:`, samePlaceBuddies);
                    const allKanpaiMembers = [p.name, ...samePlaceBuddies];
                    socket.emit("triggerKanpaiEvent", {
                        roomCode: roomCode,
                        members: allKanpaiMembers.join("と"),
                        location: p.location,
                        title: "🍻 特大乾杯イベント発生！ 🍻",
                    });
                }
            }
            if (p.chosenRouteIdx !== undefined)
                delete p.chosenRouteIdx;
            // 4. 右下の「現在のマスの内容」枠にテキストを反映
            const mockSquare = targetModule ||
                targetSquare || { text: "通常マス", location: p.location };
            triggerDelayedDisplay(1, mockSquare);
        });
    });
    // 🎯 【復元】サーバーから乾杯合図を受け取り、PC大画面の乾杯モーダルを表示！
    socket.off("showKanpaiModal");
    socket.on("showKanpaiModal", (data) => {
        console.log(`💻 [PC 乾杯モーダル表示] メンバー: ${data.members} / 場所: ${data.location}`);
        const pcModal = document.getElementById("pc-kanpai-modal");
        if (pcModal) {
            const titleEl = pcModal.querySelector(".kanpai-header");
            const membersEl = document.getElementById("pc-kanpai-members");
            const locationEl = document.getElementById("pc-kanpai-location");
            if (titleEl && data.title)
                titleEl.textContent = data.title;
            if (membersEl && data.members)
                membersEl.textContent = data.members;
            if (locationEl && data.location)
                locationEl.textContent = data.location;
            pcModal.style.display = "flex";
        }
    });
    // 🎯 汎用ルーレット回転同期
    socket.off("spinCustomRoulette");
    socket.on("spinCustomRoulette", (data) => {
        console.log(`💻 [PC ROUTINE] ルーレット回転同期を受信: 出目 ${data.result}`);
        isPCEventMode = true;
        if (typeof executeSyncedRoulette === "function") {
            executeSyncedRoulette(data.result);
        }
    });
    // 🎯 汎用ルーレット決着（結果テキスト表示）
    socket.off("customRouletteFinished");
    socket.on("customRouletteFinished", (data) => {
        const pcModal = document.getElementById("pc-event-modal");
        if (pcModal && pcModal.classList.contains("theme-couple")) {
            // 41番マス1回目スピンが奇数で失敗だった場合はPC画面にも失敗表示を出して閉じる
            if (data &&
                data.eventName === "💕 カップル成立チャンス 💕" &&
                data.result !== undefined &&
                data.result % 2 !== 0) {
                isPCEventMode = false;
                const modalResultBox = document.getElementById("modal-event-result-box");
                if (modalResultBox) {
                    modalResultBox.style.display = "block";
                    modalResultBox.className = "event-result-box failure";
                    modalResultBox.innerHTML = `
            <div style="font-size:1.8rem; font-weight:bold; margin-bottom:6px; color:#d81b60;">出目: ${data.result}</div>
            <div style="font-size:1.4rem; font-weight:bold; color:#e91e63;">💔 奇数：タイミングが悪い...</div>
          `;
                }
                setTimeout(() => {
                    const targetModalEl = document.getElementById("pc-event-modal");
                    if (targetModalEl) {
                        targetModalEl.className = "event-modal-overlay";
                        targetModalEl.style.display = "none";
                    }
                }, 3500);
            }
            else {
                console.log("💻 [PC GUARD] カップルイベント進行中のため、専用の通知を待ちます。");
            }
            return;
        }
        // ─── 通常の入学式・ランクアップ・引退ギャンブルマスなどの処理 ───
        isPCEventMode = false;
        const modalResultBox = document.getElementById("modal-event-result-box");
        if (modalResultBox) {
            modalResultBox.style.display = "block";
            const isSuccess = data.outcome && data.outcome.isRankUp !== undefined
                ? data.outcome.isRankUp
                : data.outcome && data.outcome.drinks === 0;
            modalResultBox.className = isSuccess
                ? "event-result-box success"
                : "event-result-box failure";
            modalResultBox.innerHTML = `
        <div style="font-size:1.8rem; font-weight:bold; margin-bottom:6px;">出目: ${data.result}</div>
        <div style="font-size:1.4rem; font-weight:bold;">${data.message}</div>
      `;
        }
    });
    // 🎯 2段階目（または多段階）イベント：モーダルのテーマを維持し、文字・対応表だけを動的差し替え
    socket.off("startCustomEventSecondSpin");
    socket.on("startCustomEventSecondSpin", (data) => {
        console.log("💻 [PC HUB] イベント更新通知を受信:", data.nextStepEventName);
        const pcModal = document.getElementById("pc-event-modal");
        if (pcModal) {
            pcModal.classList.add("active");
            pcModal.style.display = "flex";
        }
        // 1. タイトル
        const titleEl = document.getElementById("modal-event-title");
        if (titleEl && data.nextStepEventName)
            titleEl.textContent = `💕 ${data.nextStepEventName} 💕`;
        // 2. 説明文
        const descEl = document.getElementById("modal-event-desc");
        if (descEl)
            descEl.textContent =
                data.pcSecondDesc || "スマホから最終決着スピンを回してね！";
        // 🎯 3. 1回目の結果文言を左下に表示
        const modalResultBox = document.getElementById("modal-event-result-box");
        if (modalResultBox) {
            modalResultBox.style.display = "block";
            modalResultBox.className = "event-result-box success";
            const rollNum = data.result !== undefined ? `【出目:${data.result}】` : "";
            modalResultBox.innerHTML = `
        <div style="font-size:1.1rem; color:#d81b60; font-weight:bold;">${rollNum} 💕 偶数達成！</div>
        <div style="font-size:1.3rem; font-weight:900; color:#e91e63; margin-top:2px;">告白チャンス獲得！</div>
      `;
        }
        // 4. 対応表の差し替え
        const dynamicTableZone = document.getElementById("pc-event-table-dynamic-zone");
        if (dynamicTableZone && data.mapping) {
            let html = `<div class="event-title" style="font-size:1.3rem; color:#d81b60; margin-bottom:8px; font-weight:bold; border-bottom:2px solid #ff69b4; padding-bottom:4px;">💘 告白対象スロット</div><ul class="event-table-list">`;
            for (let i = 1; i <= 10; i++) {
                const target = data.mapping[i];
                let targetText = '<span style="color:#aaa;">(該当なし)</span>';
                if (target && target.name) {
                    targetText = `<span style="color:#e91e63; font-weight:bold;">${target.name}</span>`;
                }
                html += `<li class="event-table-item"><div class="event-table-num-badge" style="background:#ff4081;">${i}</div><div>${targetText}</div></li>`;
            }
            html += `</ul>`;
            dynamicTableZone.innerHTML = html;
        }
    });
    socket.off("customEventFinished");
    socket.on("customEventFinished", (data) => {
        console.log("💻 [PC RECEIVE] 2段階カスタムイベントの決着通知を受信:", data);
        isPCEventMode = false;
        const modalResultBox = document.getElementById("modal-event-result-box");
        if (!modalResultBox)
            return;
        modalResultBox.style.display = "block";
        if (data.success) {
            modalResultBox.className = "event-result-box couple-success";
            modalResultBox.innerHTML = `
        <div class="couple-congrats-title">🎉 おめでとう！！！ 🎉</div>
        <div class="couple-names-highlight">${data.targetA || "告白者"} と ${data.targetB || "意中の相手"}</div>
        <div class="couple-kanpai-shout">🍻 成立記念！全員で乾杯！ 🍻</div>
      `;
        }
        else {
            modalResultBox.className = "event-result-box failure";
            modalResultBox.innerHTML = `
        <div style="font-size:1.3rem; font-weight:bold; color:#546e7a;">💔 チャレンジ失敗...</div>
        <div style="font-size:1rem; color:#78909c; margin-top:4px;">今回はご縁がありませんでした...</div>
      `;
        }
        setTimeout(() => {
            const targetModalEl = document.getElementById("pc-event-modal");
            if (targetModalEl) {
                targetModalEl.className = "event-modal-overlay";
                targetModalEl.style.display = "none";
            }
            const btnNext = document.getElementById("btn-next-turn");
            if (btnNext) {
                btnNext.disabled = false;
            }
        }, 4500);
    });
    // 🎓 89番マス：卒業判定イベント（sq_89.js へ委譲）
    socket.off("showGraduateEvent");
    socket.on("showGraduateEvent", (data) => {
        loadAndApplySquareComponent(89, () => {
            const modObj = window.SQ_MODULES && window.SQ_MODULES[89];
            const targetModule = modObj
                ? modObj[currentGameMode] || modObj.normal
                : null;
            if (targetModule && typeof targetModule.event === "function") {
                const p = players[activePlayerIndex] || {
                    name: data && data.playerName ? data.playerName : "プレイヤー",
                };
                targetModule.event(p, { ...targetModule, isTurnStart: true });
            }
        });
    });
    // 🎉 99番マス到着時：PC大画面にゴール祝賀モーダルを展開！
    const displayGoalModal = (data) => {
        if (!data || !data.player)
            return;
        console.log(`💻 [PC ゴール祝賀展開] プレイヤー: ${data.player.name}`);
        isPCEventMode = false;
        const pcEventModal = document.getElementById("pc-event-modal");
        if (pcEventModal) {
            pcEventModal.className = "event-modal-overlay";
            pcEventModal.style.display = "none";
        }
        const kanpaiModal = document.getElementById("pc-kanpai-modal");
        if (kanpaiModal) {
            const titleEl = kanpaiModal.querySelector(".kanpai-header");
            const membersEl = document.getElementById("pc-kanpai-members");
            const locationEl = document.getElementById("pc-kanpai-location");
            if (titleEl)
                titleEl.textContent = "🎉 祝・大学卒業ゴール！！！ 🎉";
            if (membersEl)
                membersEl.textContent = `🎓 ${data.player.name} が見事卒業達成！`;
            if (locationEl)
                locationEl.textContent = "社会への輝かしい旅立ち";
            kanpaiModal.style.display = "flex";
        }
        if (window.boardManager)
            window.boardManager.draw(players, activePlayerIndex);
    };
    socket.off("showGoalModal");
    socket.on("showGoalModal", displayGoalModal);
    socket.off("triggerGoalCelebration");
    socket.on("triggerGoalCelebration", displayGoalModal);
    // 🎊 全員ゴール完了（ゲーム終了）
    socket.off("gameAllFinished");
    socket.on("gameAllFinished", (data) => {
        if (data && data.players)
            players = data.players;
        isPCEventMode = false;
        const pcEventModal = document.getElementById("pc-event-modal");
        if (pcEventModal) {
            pcEventModal.className = "event-modal-overlay";
            pcEventModal.style.display = "none";
        }
        const kanpaiModal = document.getElementById("pc-kanpai-modal");
        if (kanpaiModal) {
            const titleEl = kanpaiModal.querySelector(".kanpai-header");
            const membersEl = document.getElementById("pc-kanpai-members");
            const locationEl = document.getElementById("pc-kanpai-location");
            if (titleEl)
                titleEl.textContent = "🎊 全員卒業！ゲーム終了！ 🎊";
            if (membersEl) {
                const summary = players
                    .map((p) => `${p.name}(${p.drinkCount || 0}杯 / ${p.happiness !== undefined ? p.happiness : 100}pt)`)
                    .join(" ・ ");
                membersEl.textContent = summary || "全員卒業達成！";
            }
            if (locationEl)
                locationEl.textContent = "最高の宅飲み人生に乾杯！！！";
            kanpaiModal.style.display = "flex";
        }
        updateCurrentPlayerDisplay();
        if (window.boardManager)
            window.boardManager.draw(players, activePlayerIndex);
    });
    socket.off("enableNextTurnButton");
    socket.on("enableNextTurnButton", () => {
        const pcModal = document.getElementById("pc-event-modal");
        if (pcModal && pcModal.classList.contains("theme-insurance")) {
            pcModal.className = "event-modal-overlay";
            pcModal.style.display = "none";
            isPCEventMode = false;
        }
    });
    socket.off("syncGameState");
    socket.on("syncGameState", (data) => {
        if (data.players && Array.isArray(data.players))
            players = data.players;
        if (data.activePlayerIndex !== undefined)
            activePlayerIndex = data.activePlayerIndex;
        updateCurrentPlayerDisplay();
        if (window.boardManager)
            window.boardManager.draw(players, activePlayerIndex);
    });
    socket.off("applyPlayerAction");
    socket.on("applyPlayerAction", (data) => {
        if (data && data.action === "turnUpdated") {
            console.log("💻 [PC 新ターン開始] 全アクティブモーダルを一括クローズします。");
            isPCEventMode = false;
            if (data.activePlayerIndex !== undefined) {
                activePlayerIndex = data.activePlayerIndex;
            }
            const curP = players[activePlayerIndex];
            if (curP && curP.isRepeat) {
                document.body.classList.add("theme-repeat-dark");
            }
            else {
                document.body.classList.remove("theme-repeat-dark");
            }
            const pcModal = document.getElementById("pc-event-modal");
            if (pcModal) {
                pcModal.style.display = "none";
                pcModal.classList.remove("active");
            }
            const kanpaiModal = document.getElementById("pc-kanpai-modal");
            if (kanpaiModal) {
                kanpaiModal.style.display = "none";
            }
            const coupleModal = document.getElementById("pc-couple-event-modal");
            if (coupleModal) {
                coupleModal.style.display = "none";
            }
            updateCurrentPlayerDisplay();
        }
        else if (data && data.action === "turnSkipped") {
            isPCEventMode = false;
            if (data.activePlayerIndex !== undefined) {
                activePlayerIndex = data.activePlayerIndex;
            }
            const pcModal = document.getElementById("pc-event-modal");
            if (pcModal) {
                pcModal.style.display = "none";
                pcModal.classList.remove("active");
            }
            const kanpaiModal = document.getElementById("pc-kanpai-modal");
            if (kanpaiModal) {
                kanpaiModal.style.display = "none";
            }
            const descEl = document.getElementById("event-text") ||
                document.getElementById("current-tile-desc");
            if (descEl) {
                descEl.innerHTML = `<p class="event-msg" style="color: #e67e22; font-weight: bold; font-size: 1.15rem; margin: 0;">💤 ${data.activePlayerName || "プレイヤー"} さんは二日酔い（1回休み）のためターンをスキップします！</p>`;
            }
            updateCurrentPlayerDisplay();
        }
        else if (data && data.action === "insuranceUsed") {
            const p = players.find((pl) => String(pl.id) === String(data.playerId));
            if (p) {
                p.insurance = data.nextInsuranceCount;
                const descEl = document.getElementById("event-text") ||
                    document.getElementById("current-tile-desc");
                if (descEl) {
                    descEl.innerHTML = `
          <p class="event-msg" style="color: #9c27b0; font-weight: bold; font-size: 1.2rem; margin: 0;">
            🛡️ 生命保険発動！！！ 🛡️<br>
            ${p.name} は保険を1枚消費し、このターンの飲酒ペナルティを無効化した！<br>
            <span style="font-size: 0.9rem; color: #666;">(残り保険枚数: ${p.insurance}枚)</span>
          </p>
        `;
                }
                updateCurrentPlayerDisplay();
            }
        }
    });
}
window.appendSocketListeners = appendSocketListeners;
const mountPC = () => {
    const rootEl = document.getElementById("root");
    if (rootEl) {
        const root = (0, client_1.createRoot)(rootEl);
        root.render((0, jsx_runtime_1.jsx)(PCApp, {}));
    }
};
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountPC);
}
else {
    mountPC();
}
//# sourceMappingURL=pc.js.map