import React, { useState, useEffect, memo } from "react";
import { createRoot } from "react-dom/client";

const socket = io();

let roomCode = "";
let players: any[] = [];
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

const GAME_EVENTS: Record<
  string,
  { class: string; title: string; desc: (name: string) => string }
> = {
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
let syncReactStateRef: (() => void) | null = null;
let setScreenRef: ((screenId: string) => void) | null = null;
let setQrCodeRef: ((url: string) => void) | null = null;

Object.defineProperties(window, {
  socket: { get: () => socket, configurable: true },
  roomCode: {
    get: () => roomCode,
    set: (v) => {
      roomCode = v;
      if (syncReactStateRef) syncReactStateRef();
    },
    configurable: true,
  },
  players: {
    get: () => players,
    set: (v) => {
      players = v;
      if (syncReactStateRef) syncReactStateRef();
    },
    configurable: true,
  },
  activePlayerIndex: {
    get: () => activePlayerIndex,
    set: (v) => {
      activePlayerIndex = v;
      if (syncReactStateRef) syncReactStateRef();
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
      if (syncReactStateRef) syncReactStateRef();
    },
    configurable: true,
  },
});

function switchScreen(targetId: string) {
  if (setScreenRef) {
    setScreenRef(targetId);
  }
}

function renderPlayerWaitingList() {
  if (syncReactStateRef) syncReactStateRef();
}

function renderLocationPlayersList() {
  if (syncReactStateRef) syncReactStateRef();
}

function updateCurrentPlayerDisplay() {
  if (syncReactStateRef) syncReactStateRef();
}

// 🎯 【基本ルーティン：行程③＆④】物理角度盤面スピン・トコトコ移動・100%無差別着地信号
function executeSyncedRoulette(resultNum: number) {
  const p = players[activePlayerIndex];
  if (!p) return;

  const resEl = document.getElementById("roulette-result-display");
  if (resEl) resEl.textContent = "🎯 回転中...";
  const descEl =
    document.getElementById("event-text") ||
    document.getElementById("current-tile-desc");
  if (descEl && !isPCEventMode)
    descEl.innerHTML = `<p class="event-msg" style="color: #666; font-weight: bold; animation: pulse 1s infinite;">🌀 ルーレット回転中... どこに止まるかな？ 🌀</p>`;

  const targetDegrees = [342, 306, 270, 234, 198, 162, 126, 90, 54, 18];
  const stopAngle = targetDegrees[resultNum - 1];
  pcCurrentRotation +=
    1800 + ((stopAngle - (pcCurrentRotation % 360) + 360) % 360);

  let wheel = (
    isPCEventMode
      ? document.querySelector("#pc-event-modal .event-roulette-wheel") ||
        document.querySelector("#pc-couple-event-modal .event-roulette-wheel")
      : document.getElementById("controller-roulette-wheel") ||
        document.getElementById("pc-roulette-wheel")
  ) as HTMLElement;
  if (wheel) {
    wheel.style.transition = "transform 3s cubic-bezier(0.15, 0.9, 0.2, 1)";
    wheel.style.transform = `rotate(${pcCurrentRotation}deg)`;
  }

  if (isPCEventMode) {
    return;
  }

  setTimeout(() => {
    if (resEl) resEl.textContent = `出目: ${resultNum}`;
    let stepsMoved = 0;
    console.log(`💻 [PC MOVEMENT] ピン movements を開始。歩数: ${resultNum}歩`);

    const moveTimer = setInterval(() => {
      const currentSquare = MAP_SQUARES[p.position];
      if (
        stepsMoved > 0 &&
        currentSquare &&
        (currentSquare.type === "branch" ||
          currentSquare.type === "force_stop" ||
          currentSquare.type === "force_stop_rankup")
      ) {
        console.log(
          `💻 [PC MOVEMENT] 強制ストップマス(ID: ${p.position})を発見！着地へ。`,
        );
        clearInterval(moveTimer);
        finalizeMovement();
        return;
      }
      if (
        stepsMoved >= resultNum ||
        !currentSquare ||
        !currentSquare.nextId ||
        currentSquare.nextId.length === 0
      ) {
        console.log(
          `💻 [PC MOVEMENT] 指定歩数完了。目的地(ID: ${p.position})へ着地。`,
        );
        clearInterval(moveTimer);
        finalizeMovement();
        return;
      }

      const nextIdArray = currentSquare.nextId;
      if (Number(p.position) === 89 && p.isRepeat) {
        // 🎯 留年フラグがある時は強制的に 90番マス（留年ルート）へ！
        p.position = 90;
      } else if (Array.isArray(nextIdArray) && nextIdArray.length > 1) {
        p.position = Number(
          nextIdArray[
            p.chosenRouteIdx !== undefined && p.chosenRouteIdx !== null
              ? Number(p.chosenRouteIdx)
              : 0
          ],
        );
      } else {
        p.position = Number(
          Array.isArray(nextIdArray) ? nextIdArray[0] : nextIdArray,
        );
      }
      stepsMoved++;
      if (window.boardManager)
        window.boardManager.draw(players, activePlayerIndex);
    }, 250);

    function finalizeMovement() {
      console.log(
        `💻 [PC FINALIZE] ➔ マスID: ${p.position} に到着。サーバーへ着地通知を送信します。`,
      );

      socket.emit("squareLanded", {
        roomCode: roomCode,
        position: p.position,
      });
    }
  }, 3000);
}

function triggerDelayedDisplay(resultNum: number, targetSquare: any) {
  const p = players[activePlayerIndex];
  if (!p) return;

  const modObj = window.SQ_MODULES && window.SQ_MODULES[p.position];
  const targetModule = modObj
    ? modObj[currentGameMode] || modObj.normal
    : null;

  const detectedText =
    targetModule && targetModule.text
      ? targetModule.text
      : targetSquare && targetSquare.text
        ? targetSquare.text
        : "通常マス";

  const detectedLocation =
    targetModule && targetModule.location
      ? targetModule.location
      : targetSquare && targetSquare.location
        ? targetSquare.location
        : "家";
  p.location = detectedLocation;

  const eventTextEl =
    document.getElementById("event-text") ||
    document.getElementById("current-tile-desc");
  const eventCardEl = document.querySelector(".tile-event-card");

  if (eventTextEl) {
    eventTextEl.innerHTML = `<p class="event-msg" style="color: #2c3e50; font-weight: bold; font-size: 1.15rem; margin: 0;">🎲 ${detectedText}</p>`;
  } else if (eventCardEl) {
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

function openPCEventModal(
  eventType: string,
  playerName: string,
  activePlayerId: any,
) {
  isPCEventMode = true;
  const pcModal = document.getElementById("pc-event-modal");
  if (!pcModal) return;

  const btnNext = document.getElementById("btn-next-turn") as HTMLButtonElement;
  if (btnNext) {
    btnNext.disabled = true;
    btnNext.style.display = "none";
  }

  const config = GAME_EVENTS[eventType];
  if (!config) return;
  pcModal.className = "event-modal-overlay active " + config.class;

  if (document.getElementById("modal-event-title"))
    document.getElementById("modal-event-title").textContent = config.title;

  if (document.getElementById("modal-event-desc"))
    document.getElementById("modal-event-desc").textContent =
      config.desc(playerName);

  const resultBox = document.getElementById(
    "modal-event-result-box",
  ) as HTMLElement;
  if (resultBox) {
    resultBox.style.display = "none";
  }
}

function handleForceStopSquare(player: any, square: any) {
  if (!square) return;
  if (Number(square.id) === 89) return;

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

function loadAndApplySquareComponent(squareId: number, callback: () => void) {
  if (
    window.SQ_MODULES &&
    window.SQ_MODULES[squareId] &&
    (window.SQ_MODULES[squareId][currentGameMode] ||
      window.SQ_MODULES[squareId].normal)
  ) {
    if (typeof callback === "function") callback();
    return;
  }
  const script = document.createElement("script");
  script.src = `/squares/sq_${squareId}.js`;
  script.onload = () => {
    if (typeof callback === "function") callback();
  };
  script.onerror = () => {
    if (typeof callback === "function") callback();
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
const RouletteAndTileZone = memo(
  ({ currentLocation }: { currentLocation: string }) => {
    useEffect(() => {
      const locEl = document.querySelector(".roulette-card #current-player-location");
      if (locEl) locEl.textContent = currentLocation || "-";
    }, [currentLocation]);

    return (
      <div className="layout-right">
        <div className="card roulette-card">
          <div className="roulette-result-display" id="roulette-result-display">
            🎯 タップして回そう！
          </div>

          <div
            style={{
              position: "relative",
              width: "200px",
              height: "200px",
              margin: "0 auto",
            }}
          >
            <div className="event-roulette-pointer"></div>
            <div className="roulette-wheel-board" id="pc-roulette-wheel">
              <div className="roulette-num num-1">1</div>
              <div className="roulette-num num-2">2</div>
              <div className="roulette-num num-3">3</div>
              <div className="roulette-num num-4">4</div>
              <div className="roulette-num num-5">5</div>
              <div className="roulette-num num-6">6</div>
              <div className="roulette-num num-7">7</div>
              <div className="roulette-num num-8">8</div>
              <div className="roulette-num num-9">9</div>
              <div className="roulette-num num-10">10</div>
            </div>
          </div>
          <div
            id="current-player-location"
            style={{
              fontWeight: "bold",
              marginTop: "8px",
              color: "#555",
              fontSize: "1.1rem",
            }}
          >
            スタート前
          </div>
        </div>

        {/* 止まったマスの内容テキストエリア */}
        <div
          className="card tile-event-card"
          style={{ flex: 1, minHeight: "150px" }}
        >
          <div
            className="card-title"
            style={{
              borderBottom: "2px solid #e0e0e0",
              paddingBottom: "4px",
              marginBottom: "8px",
            }}
          >
            📢 現在のマスの内容
          </div>
          <div
            id="current-tile-desc"
            style={{
              fontSize: "1.1rem",
              lineHeight: 1.6,
              fontWeight: "bold",
              color: "#2c3e50",
            }}
          >
            スマホからルーレットを回してください！
          </div>
        </div>
      </div>
    );
  },
  (prev, next) => prev.currentLocation === next.currentLocation,
);

const PCModalsZone = memo(
  () => (
    <>
      {/* PC側特大イベントモーダル */}
      <div id="pc-event-modal" className="event-modal-overlay">
        <div className="event-card-container">
          <h1 className="event-title" id="modal-event-title">
            💕 イベントタイトル 💕
          </h1>
          <p className="event-desc" id="modal-event-desc">
            イベントの説明文がここに表示されます。
          </p>

          <div className="event-main-flex">
            {/* 左カラム：ルーレット ＋ 下部に結果テキストボックスを縦並び配置 */}
            <div className="event-roulette-area">
              <div className="event-roulette-container">
                <div className="event-roulette-pointer"></div>
                <div className="event-roulette-wheel">
                  <div className="roulette-num num-1">1</div>
                  <div className="roulette-num num-2">2</div>
                  <div className="roulette-num num-3">3</div>
                  <div className="roulette-num num-4">4</div>
                  <div className="roulette-num num-5">5</div>
                  <div className="roulette-num num-6">6</div>
                  <div className="roulette-num num-7">7</div>
                  <div className="roulette-num num-8">8</div>
                  <div className="roulette-num num-9">9</div>
                  <div className="roulette-num num-10">10</div>
                </div>
              </div>
              <div
                className="result-display-zone"
                id="modal-roulette-result-display"
              >
                🎯 スマホから回してね！
              </div>

              {/* 🎯 1回目・2回目の成否を大きく伝える専用結果テキストボックス */}
              <div
                id="modal-event-result-box"
                className="event-result-box"
                style={{ display: "none" }}
              ></div>
            </div>

            <div
              className="event-table-area"
              id="pc-event-table-dynamic-zone"
            ></div>
          </div>
        </div>
      </div>

      {/* 🍻 一斉乾杯専用 特大デザインモーダル */}
      <div
        id="pc-kanpai-modal"
        className="kanpai-overlay"
        style={{ display: "none" }}
      >
        <div className="kanpai-window">
          <div className="kanpai-glow"></div>
          <h1 className="kanpai-header">🍻 特大乾杯イベント発生！ 🍻</h1>
          <div id="pc-kanpai-members" className="kanpai-buddies"></div>
          <div className="kanpai-at">が</div>
          <div id="pc-kanpai-location" className="kanpai-spot"></div>
          <div className="kanpai-at">で</div>
          <div className="kanpai-shout">🍻 乾杯！！！ 🍻</div>
          <div className="kanpai-footer-nav">
            ※スマホの「➡ 次のプレイヤーへ」ボタンを押して進めてください
          </div>
        </div>
      </div>
    </>
  ),
  () => true,
);

function PCApp() {
  const [activeScreen, setActiveScreen] = useState<string>("screen-setup");
  const [hostName, setHostName] = useState<string>("やじま");
  const [roomCodeState, setRoomCodeState] = useState<string>("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [playersState, setPlayersState] = useState<any[]>([]);
  const [activeIdxState, setActiveIdxState] = useState<number>(0);
  const [gameModeState, setGameModeState] = useState<string>("normal");

  useEffect(() => {
    setScreenRef = (screenId: string) => {
      setActiveScreen(screenId);
    };
    setQrCodeRef = (url: string) => {
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
  useEffect(() => {
    if (
      (activeScreen === "screen-waiting" || activeScreen === "screen-game") &&
      window.boardManager
    ) {
      if (!window.boardManager.canvas) {
        window.boardManager.init(100);
      }
      window.boardManager.draw(players, activePlayerIndex);
    }
  }, [activeScreen, playersState, activeIdxState]);

  const handleCreateRoom = (e: React.MouseEvent) => {
    if (e) e.preventDefault();
    const targetHostName = hostName ? hostName : "やじま";
    console.log(
      `💻 [PC ACTION] ルーム作成要求を発射。ホスト名: ${targetHostName}`,
    );
    socket.emit("createRoom", { hostName: targetHostName });
  };

  // 現在手番プレイヤーのステータス計算
  const p = playersState[activeIdxState];
  const jobMaster =
    p && typeof JOBS !== "undefined"
      ? JOBS.find(
          (j: any) => j.id === p.jobId || j.label === p.job || j.title === p.job,
        )
      : null;
  const baseCap = p ? (jobMaster ? jobMaster.cap : p.baseCap || 100) : 100;
  const maxHp = p ? baseCap + (p.bonusCap || 0) : 100;
  const rawCurrentHp =
    p && p.currentHp !== undefined ? p.currentHp : maxHp;
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
  const happinessColor =
    hpVal >= 100 ? "#ffeb3b" : hpVal >= 50 ? "#ffffff" : "#ff8a80";
  const currentLocation = p && p.location ? p.location : "-";

  // ロケーション別滞在プレイヤー集計
  const locationMap: Record<string, { index: number; name: string; color: string }[]> = {};
  ALL_GAME_LOCATIONS.forEach((loc) => (locationMap[loc] = []));
  playersState.forEach((pl, idx) => {
    const loc =
      pl.location && pl.location.trim() !== "" ? pl.location : "スタート前";
    if (!locationMap[loc]) locationMap[loc] = [];
    locationMap[loc].push({
      index: idx + 1,
      name: pl.name,
      color:
        pl.color || PLAYER_COLOR_PALETTE[idx % PLAYER_COLOR_PALETTE.length],
    });
  });

  return (
    <div className="app-container">
      {/* 【1】ルーム作成（初期画面） */}
      <div
        id="screen-setup"
        className={activeScreen === "screen-setup" ? "active" : ""}
        style={{ display: activeScreen === "screen-setup" ? "" : "none" }}
      >
        <div className="pc-card">
          <h1>🍻 宅飲み人生ゲーム 🍺</h1>
          <p>〜 サークル生活の思い出とアルコール 〜</p>
          <div style={{ margin: "20px 0" }}>
            <label>
              ホストプレイヤー名:{" "}
              <input
                type="text"
                id="pc-host-name"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                style={{
                  padding: "8px",
                  fontSize: "1.1rem",
                  borderRadius: "6px",
                  border: "1px solid #ccc",
                  textAlign: "center",
                }}
              />
            </label>
          </div>
          <button
            id="btn-create-room"
            className="btn-orange"
            style={{ margin: "0 auto", maxWidth: "300px" }}
            onClick={handleCreateRoom}
          >
            🚀 ルームを作成する
          </button>
        </div>
      </div>

      {/* 【2】参加待機室画面 */}
      <div
        id="screen-waiting"
        className={activeScreen === "screen-waiting" ? "active" : ""}
        style={{ display: activeScreen === "screen-waiting" ? "" : "none" }}
      >
        <div
          className="card"
          style={{ maxWidth: "800px", margin: "40px auto" }}
        >
          <div className="room-info-header">
            <h2>ROOM CODE</h2>
            <div className="room-code-display" id="display-room-code">
              {roomCodeState || "----"}
            </div>
          </div>
          <div className="waiting-grid">
            <div className="qr-panel">
              <img
                id="qrcode-img"
                src={qrCodeUrl}
                alt="参加用QRコード"
                style={{
                  width: "150px",
                  height: "150px",
                  display: "block",
                  background: "#eee",
                }}
              />
              <p style={{ fontWeight: "bold", margin: "5px 0 0 0" }}>
                スマホでQRコードを読み取って参加！
              </p>
            </div>
            <div>
              <h3>👥 参加メンバー</h3>
              <ul
                id="player-list"
                style={{
                  fontSize: "1.3rem",
                  fontWeight: "bold",
                  lineHeight: 2,
                }}
              >
                {playersState.map((pl, idx) => (
                  <li key={pl.id || idx}>{`👤 ${pl.name}`}</li>
                ))}
              </ul>
              <p
                style={{
                  color: "#e67e22",
                  fontWeight: "bold",
                  marginTop: "15px",
                  animation: "pulse 1s infinite",
                }}
              >
                ※ ゲームスタートはスマホ（コントローラー）から操作してください
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 【3】ゲームプレイ本番画面（盤面最大化） */}
      <div
        id="screen-game"
        className={activeScreen === "screen-game" ? "active" : ""}
        style={{ display: activeScreen === "screen-game" ? "" : "none" }}
      >
        <div className="game-layout">
          {/* 【左カラム】300px固定：操作プレイヤーのステータス */}
          <div className="layout-left">
            {/* 1. 現在プレイヤーのステータスカード */}
            <div
              className="card current-player-card"
              style={{
                background: `linear-gradient(135deg, ${playerColor} 0%, #2575fc 100%)`,
              }}
            >
              <div className="player-header">
                <div className="player-avatar" id="current-player-avatar">
                  👤
                </div>
                <div className="player-meta">
                  <h2 id="current-player-name">
                    {p ? p.name : "プレイヤー名"}
                  </h2>
                  <span className="job-badge" id="current-player-job">
                    {jobLabel}
                  </span>
                  <div
                    id="current-player-lover-icon"
                    style={{
                      display: p && p.isLover ? "inline-block" : "none",
                    }}
                  >
                    {p && p.isLover && p.lovers && p.lovers.length > 0 ? (
                      <span
                        style={{
                          fontSize: "0.95rem",
                          fontWeight: "bold",
                          color: "#ffeb3b",
                          background: "rgba(0,0,0,0.2)",
                          padding: "2px 8px",
                          borderRadius: "20px",
                        }}
                      >
                        {`💕 恋人: ${p.lovers.join("、")}`}
                      </span>
                    ) : p && p.isLover ? (
                      "❤️"
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="player-stats">
                <div className="stat-item">
                  <span>🍺 杯数</span>
                  <span id="current-player-drinks">
                    {`${p ? p.drinkCount || 0 : 0} 杯`}
                  </span>
                </div>
                <div className="stat-item">
                  <span>❤️ 体力</span>
                  <span id="current-player-hp">{`${currentHp} / ${maxHp}`}</span>
                </div>
                <div className="stat-item">
                  <span>✨ 幸福度</span>
                  <span
                    id="current-player-happiness"
                    style={{ color: happinessColor }}
                  >
                    {`${hpVal} pt`}
                  </span>
                </div>
                <div className="stat-item">
                  <span>📍 現在地</span>
                  <span id="current-player-location">{currentLocation}</span>
                </div>
              </div>
            </div>

            {/* 2. 何色が誰か分かるプレイヤーカラー凡例カード */}
            <div className="card player-color-legend-card">
              <div
                className="card-title"
                style={{
                  fontWeight: "bold",
                  fontSize: "0.95rem",
                  marginBottom: "8px",
                  color: "#555",
                }}
              >
                🎨 プレイヤーカラー
              </div>
              <div
                id="player-color-legend-list"
                className="color-legend-container"
              >
                {playersState.map((pl, idx) => {
                  const pColor =
                    pl.color ||
                    PLAYER_COLOR_PALETTE[idx % PLAYER_COLOR_PALETTE.length];
                  return (
                    <div key={pl.id || idx} className="color-legend-item">
                      <span
                        className="color-piece-dot"
                        style={{ background: pColor }}
                      ></span>
                      <span>{pl.name || `P${idx + 1}`}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. 全場所対照表カード（駒を並べるエリア） */}
            <div className="card location-board-card">
              <div
                className="card-title"
                style={{
                  fontWeight: "bold",
                  fontSize: "0.95rem",
                  marginBottom: "8px",
                  color: "#555",
                }}
              >
                📍 エリア別 滞在状況
              </div>
              <div className="location-table-wrapper">
                <table className="location-table">
                  <thead>
                    <tr>
                      <th style={{ width: "45%" }}>エリア</th>
                      <th style={{ width: "55%" }}>滞在中の駒</th>
                    </tr>
                  </thead>
                  <tbody id="location-table-body">
                    {ALL_GAME_LOCATIONS.map((locName) => {
                      const stayingPlayers = locationMap[locName] || [];
                      return (
                        <tr key={locName}>
                          <td className="location-name-cell">{locName}</td>
                          <td className="location-pieces-cell">
                            {stayingPlayers.length > 0 ? (
                              stayingPlayers.map((pObj) => (
                                <span
                                  key={pObj.index}
                                  className="board-mini-piece"
                                  style={{ backgroundColor: pObj.color }}
                                  title={`${pObj.name} (P${pObj.index})`}
                                >
                                  {pObj.index}
                                </span>
                              ))
                            ) : (
                              <span
                                style={{ color: "#ccc", fontSize: "0.75rem" }}
                              >
                                -
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 【中央カラム】残りの画面幅（1fr）を限界まで使い切ってすごろくを最大化 */}
          <div className="layout-center">
            <div className="map-card-maximized">
              <div className="map-header">
                <span className="map-title-text">🗺️ すごろくマップ</span>
                <span className="mode-badge" id="pc-game-mode-badge">
                  {gameModeState === "short" ? "ショートモード" : "通常モード"}
                </span>
              </div>
              <canvas id="board-canvas"></canvas>
            </div>
          </div>

          {/* 【右カラム】300px固定：スマホと完全シンクロするルーレット ＆ マス内容 */}
          <RouletteAndTileZone currentLocation={currentLocation} />
        </div>
      </div>

      {/* 特大イベントモーダル ＆ 乾杯モーダル */}
      <PCModalsZone />
    </div>
  );
}

function initSocketListeners() {
  socket.off("connect");
  socket.on("connect", () => {
    console.log(
      "💻 [PC SOCKET] Socket.io サーバーに正常接続完了。ID:",
      socket.id,
    );
  });

  socket.off("roomCreated");
  socket.on("roomCreated", (data: any) => {
    roomCode = data.roomCode;
    if (data.players) players = data.players;
    console.log(
      `💻 [PC RECEIVE] roomCreated 受信。作成された部屋コード: ${roomCode}`,
    );

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
  socket.on("applySettings", (data: any) => {
    console.log(
      "💻 [PC RECEIVE] applySettings 受信。参加者リストを同期します。",
    );
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
    } else if (syncReactStateRef) {
      syncReactStateRef();
    }
  });

  // ==========================================================================
  // 🧭 【ルーティン行程②：ゲーム開始・ターン開始時イベント確認（1.TURN_START）】
  // ==========================================================================
  socket.off("gameStarted");
  socket.on("gameStarted", (data: any) => {
    if (data && data.players) players = data.players;
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
      console.log(
        `💻 [2.1 PC受信] ➔ 開始時イベント確認。手番プレイヤーが ${p.position} 番マスにいるため、コンポーネントをロードします。`,
      );

      loadAndApplySquareComponent(p.position, () => {
        let targetSquare =
          typeof MAP_SQUARES !== "undefined" && MAP_SQUARES[p.position]
            ? MAP_SQUARES[p.position]
            : null;
        if (targetSquare) {
          console.log(
            `💻 [2.1.1 PC内部処理] sq_${p.position}.js のロード完了。自動進行をせき止めて待機ロックを掛けます。`,
          );
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
  socket.on("spinRoulette", (data: any) => {
    if (data) {
      if (data.activePlayerIndex !== undefined)
        activePlayerIndex = data.activePlayerIndex;

      if (data.players && Array.isArray(data.players)) {
        players = data.players;
      }

      if (syncReactStateRef) syncReactStateRef();
      if (window.boardManager) {
        window.boardManager.draw(players, activePlayerIndex);
      }

      const resultNum = data.result !== undefined ? data.result : 1;
      console.log(
        `💻 [3.3 PC受信] ➔ サーバーから出目 ${resultNum} を受信。大画面のルーレット回転とピンのトコトコ前進を開始します！`,
      );
      executeSyncedRoulette(resultNum);
    }
  });

  // 🎯 【重要】マス着地時：サーバーから合図を受け取り、PC大画面モーダルを即座に表示！
  socket.off("openCustomRouletteModal");
  socket.on("openCustomRouletteModal", (data: any) => {
    console.log(`💻 [PC 着地時モーダル展開] イベント: ${data.eventName}`);
    isPCEventMode = true;

    const pcModal = document.getElementById("pc-event-modal");
    if (pcModal) {
      pcModal.className = "event-modal-overlay active theme-entrance";
      pcModal.style.display = "flex";
    }

    const titleEl = document.getElementById("modal-event-title");
    if (titleEl) titleEl.textContent = `🌸 ${data.eventName} 🌸`;

    const descEl = document.getElementById("modal-event-desc");
    if (descEl)
      descEl.textContent = "出目に応じて結果が決まる！スマホから回してね！";

    const modalResultBox = document.getElementById("modal-event-result-box");
    if (modalResultBox) modalResultBox.style.display = "none";

    // 判定対応表を描画
    const dynamicTableZone = document.getElementById(
      "pc-event-table-dynamic-zone",
    );
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
  socket.on("openBijinKanpaiModal", (data: any) => {
    console.log(`💻 [PC 乾杯モーダル展開] プレイヤー: ${data.playerName}`);
    const pcModal = document.getElementById("pc-kanpai-modal");
    if (pcModal) {
      const titleEl = pcModal.querySelector(".kanpai-header");
      const membersEl = document.getElementById("pc-kanpai-members");
      const locationEl = document.getElementById("pc-kanpai-location");

      if (titleEl) titleEl.textContent = "🌸 美人さん大歓迎！ 🌸";

      // 🎯 手元の全プレイヤー配列から、美人以外の名前だけを抽出し「と」で結合する
      if (membersEl && Array.isArray(players) && players.length > 0) {
        const otherPlayerNames = players
          .filter((p) => p && p.name !== data.playerName)
          .map((p) => p.name);

        if (otherPlayerNames.length > 0) {
          membersEl.textContent = otherPlayerNames.join("と");
        } else {
          membersEl.textContent = "周囲のサークル員";
        }
      } else if (membersEl) {
        membersEl.textContent = "周囲のサークル員";
      }

      if (locationEl) locationEl.textContent = "美人にモテたいの";

      pcModal.style.display = "flex";
    }
  });

  // ==========================================================================
  // 🧭 【一本道リレー：行程④】サーバーからの着地号令（startSquareEvent）受信
  // PC側は「表示・演出」専任として、マスのロードと画面更新のみを行います。
  // ==========================================================================
  socket.off("startSquareEvent");
  socket.on("startSquareEvent", (data: any) => {
    if (!data || data.position === undefined) return;

    if (data.activePlayerIndex !== undefined) {
      activePlayerIndex = data.activePlayerIndex;
    }

    const p = players[activePlayerIndex];
    if (!p) return;

    p.position = Number(data.position);
    p.location = data.location || "家";

    console.log(
      `💻 [PC ROUTINE-演出開始] サーバーから着地号令(startSquareEvent)を受信。マスID: ${p.position}`,
    );

    // 着地先コンポーネントをロードして表示を更新
    loadAndApplySquareComponent(p.position, () => {
      const modObj = window.SQ_MODULES && window.SQ_MODULES[p.position];
      const targetModule = modObj
        ? modObj[currentGameMode] || modObj.normal
        : null;
      const targetSquare =
        typeof MAP_SQUARES !== "undefined" && MAP_SQUARES[p.position]
          ? MAP_SQUARES[p.position]
          : null;

      // マスの場所を最優先で確定させる（乾杯判定の前に確定！）
      const detectedLocation =
        targetModule && targetModule.location
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
      if (
        p.location &&
        p.location !== "家" &&
        p.location !== "スタート前" &&
        p.location !== "-" &&
        p.position !== 99
      ) {
        const samePlaceBuddies = players
          .filter(
            (otherP) =>
              otherP &&
              otherP.id !== p.id &&
              otherP.location === p.location,
          )
          .map((otherP) => otherP.name);

        if (samePlaceBuddies.length > 0) {
          console.log(
            `💻 [PC 乾杯検知] 場所「${p.location}」に先客を発見:`,
            samePlaceBuddies,
          );
          const allKanpaiMembers = [p.name, ...samePlaceBuddies];
          socket.emit("triggerKanpaiEvent", {
            roomCode: roomCode,
            members: allKanpaiMembers.join("と"),
            location: p.location,
            title: "🍻 特大乾杯イベント発生！ 🍻",
          });
        }
      }

      if (p.chosenRouteIdx !== undefined) delete p.chosenRouteIdx;

      // 4. 右下の「現在のマスの内容」枠にテキストを反映
      const mockSquare = targetModule ||
        targetSquare || { text: "通常マス", location: p.location };
      triggerDelayedDisplay(1, mockSquare);
    });
  });

  // 🎯 【復元】サーバーから乾杯合図を受け取り、PC大画面の乾杯モーダルを表示！
  socket.off("showKanpaiModal");
  socket.on("showKanpaiModal", (data: any) => {
    console.log(
      `💻 [PC 乾杯モーダル表示] メンバー: ${data.members} / 場所: ${data.location}`,
    );
    const pcModal = document.getElementById("pc-kanpai-modal");
    if (pcModal) {
      const titleEl = pcModal.querySelector(".kanpai-header");
      const membersEl = document.getElementById("pc-kanpai-members");
      const locationEl = document.getElementById("pc-kanpai-location");

      if (titleEl && data.title) titleEl.textContent = data.title;
      if (membersEl && data.members) membersEl.textContent = data.members;
      if (locationEl && data.location) locationEl.textContent = data.location;

      pcModal.style.display = "flex";
    }
  });

  // 🎯 汎用ルーレット回転同期
  socket.off("spinCustomRoulette");
  socket.on("spinCustomRoulette", (data: any) => {
    console.log(
      `💻 [PC ROUTINE] ルーレット回転同期を受信: 出目 ${data.result}`,
    );
    isPCEventMode = true;

    if (typeof executeSyncedRoulette === "function") {
      executeSyncedRoulette(data.result);
    }
  });

  // 🎯 汎用ルーレット決着（結果テキスト表示）
  socket.off("customRouletteFinished");
  socket.on("customRouletteFinished", (data: any) => {
    const pcModal = document.getElementById("pc-event-modal");
    if (pcModal && pcModal.classList.contains("theme-couple")) {
      // 41番マス1回目スピンが奇数で失敗だった場合はPC画面にも失敗表示を出して閉じる
      if (
        data &&
        data.eventName === "💕 カップル成立チャンス 💕" &&
        data.result !== undefined &&
        data.result % 2 !== 0
      ) {
        isPCEventMode = false;
        const modalResultBox = document.getElementById(
          "modal-event-result-box",
        );
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
      } else {
        console.log(
          "💻 [PC GUARD] カップルイベント進行中のため、専用の通知を待ちます。",
        );
      }
      return;
    }

    // ─── 通常の入学式・ランクアップ・引退ギャンブルマスなどの処理 ───
    isPCEventMode = false;
    const modalResultBox = document.getElementById("modal-event-result-box");
    if (modalResultBox) {
      modalResultBox.style.display = "block";
      const isSuccess =
        data.outcome && data.outcome.isRankUp !== undefined
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
  socket.on("startCustomEventSecondSpin", (data: any) => {
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
      const rollNum =
        data.result !== undefined ? `【出目:${data.result}】` : "";
      modalResultBox.innerHTML = `
        <div style="font-size:1.1rem; color:#d81b60; font-weight:bold;">${rollNum} 💕 偶数達成！</div>
        <div style="font-size:1.3rem; font-weight:900; color:#e91e63; margin-top:2px;">告白チャンス獲得！</div>
      `;
    }

    // 4. 対応表の差し替え
    const dynamicTableZone = document.getElementById(
      "pc-event-table-dynamic-zone",
    );
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
  socket.on("customEventFinished", (data: any) => {
    console.log("💻 [PC RECEIVE] 2段階カスタムイベントの決着通知を受信:", data);
    isPCEventMode = false;

    const modalResultBox = document.getElementById("modal-event-result-box");
    if (!modalResultBox) return;

    modalResultBox.style.display = "block";

    if (data.success) {
      modalResultBox.className = "event-result-box couple-success";
      modalResultBox.innerHTML = `
        <div class="couple-congrats-title">🎉 おめでとう！！！ 🎉</div>
        <div class="couple-names-highlight">${data.targetA || "告白者"} と ${data.targetB || "意中の相手"}</div>
        <div class="couple-kanpai-shout">🍻 成立記念！全員で乾杯！ 🍻</div>
      `;
    } else {
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
      const btnNext = document.getElementById(
        "btn-next-turn",
      ) as HTMLButtonElement;
      if (btnNext) {
        btnNext.disabled = false;
      }
    }, 4500);
  });

  // 🎓 89番マス：卒業判定イベント（sq_89.js へ委譲）
  socket.off("showGraduateEvent");
  socket.on("showGraduateEvent", (data: any) => {
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
  const displayGoalModal = (data: any) => {
    if (!data || !data.player) return;
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

      if (titleEl) titleEl.textContent = "🎉 祝・大学卒業ゴール！！！ 🎉";
      if (membersEl)
        membersEl.textContent = `🎓 ${data.player.name} が見事卒業達成！`;
      if (locationEl) locationEl.textContent = "社会への輝かしい旅立ち";

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
  socket.on("gameAllFinished", (data: any) => {
    if (data && data.players) players = data.players;
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

      if (titleEl) titleEl.textContent = "🎊 全員卒業！ゲーム終了！ 🎊";
      if (membersEl) {
        const summary = players
          .map(
            (p) =>
              `${p.name}(${p.drinkCount || 0}杯 / ${p.happiness !== undefined ? p.happiness : 100}pt)`,
          )
          .join(" ・ ");
        membersEl.textContent = summary || "全員卒業達成！";
      }
      if (locationEl) locationEl.textContent = "最高の宅飲み人生に乾杯！！！";

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
  socket.on("syncGameState", (data: any) => {
    if (data.players && Array.isArray(data.players)) players = data.players;
    if (data.activePlayerIndex !== undefined)
      activePlayerIndex = data.activePlayerIndex;
    updateCurrentPlayerDisplay();
    if (window.boardManager)
      window.boardManager.draw(players, activePlayerIndex);
  });

  socket.off("applyPlayerAction");
  socket.on("applyPlayerAction", (data: any) => {
    if (data && data.action === "turnUpdated") {
      console.log(
        "💻 [PC 新ターン開始] 全アクティブモーダルを一括クローズします。",
      );
      isPCEventMode = false;

      if (data.activePlayerIndex !== undefined) {
        activePlayerIndex = data.activePlayerIndex;
      }
      const curP = players[activePlayerIndex];
      if (curP && curP.isRepeat) {
        document.body.classList.add("theme-repeat-dark");
      } else {
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
    } else if (data && data.action === "turnSkipped") {
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
      const descEl =
        document.getElementById("event-text") ||
        document.getElementById("current-tile-desc");
      if (descEl) {
        descEl.innerHTML = `<p class="event-msg" style="color: #e67e22; font-weight: bold; font-size: 1.15rem; margin: 0;">💤 ${data.activePlayerName || "プレイヤー"} さんは二日酔い（1回休み）のためターンをスキップします！</p>`;
      }
      updateCurrentPlayerDisplay();
    } else if (data && data.action === "insuranceUsed") {
      const p = players.find((pl) => String(pl.id) === String(data.playerId));
      if (p) {
        p.insurance = data.nextInsuranceCount;
        const descEl =
          document.getElementById("event-text") ||
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
    const root = createRoot(rootEl);
    root.render(<PCApp />);
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountPC);
} else {
  mountPC();
}

