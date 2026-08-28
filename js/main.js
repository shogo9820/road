const socket = io();

let roomCode = "";
let players = [];
let activePlayerIndex = 0;
let pcCurrentRotation = 0;

document.addEventListener("DOMContentLoaded", () => {
  initEventListeners();
  initSocketListeners();
});

function initEventListeners() {
  const btnCreate = document.getElementById("btn-create-room");
  if (btnCreate) {
    btnCreate.removeEventListener("click", handleCreateRoom);
    btnCreate.addEventListener("click", handleCreateRoom);
  }

  const btnNext = document.getElementById("btn-next-turn");
  if (btnNext) {
    btnNext.removeEventListener("click", handleNextTurnClick);
    btnNext.addEventListener("click", handleNextTurnClick);
  }
}

function handleCreateRoom(e) {
  if (e) e.preventDefault();
  const hostNameInput = document.getElementById("pc-host-name");
  const hostName = (hostNameInput && hostNameInput.value) ? hostNameInput.value : "やじま";
  socket.emit("createRoom", { hostName });
}

function handleNextTurnClick(e) {
  if (e) e.preventDefault();
  if (players.length === 0) return;
  socket.emit("playerAction", { roomCode, action: "nextTurn" });
}

function initSocketListeners() {
  socket.on("connect", () => {
    console.log("Socket.io 接続成功:", socket.id);
  });

  socket.on("roomCreated", (data) => {
    roomCode = data.roomCode;
    if (data.players) players = data.players;
    
    const roomCodeEl = document.getElementById("display-room-code");
    if (roomCodeEl) roomCodeEl.textContent = roomCode;

    const qrContainer = document.getElementById("qrcode");
    if (qrContainer) {
      qrContainer.innerHTML = "";
      if (typeof QRCode !== "undefined") {
        new QRCode(qrContainer, {
          text: `${window.location.origin}/controller.html?room=${roomCode}`,
          width: 128,
          height: 128
        });
      }
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
  
  socket.on("applySettings", (data) => {
    if (data.players && Array.isArray(data.players)) {
      players = data.players;
      renderPlayerWaitingList();
      updateCurrentPlayerDisplay();
      renderLocationPlayersList();
      if (window.boardManager) {
        window.boardManager.draw(players, activePlayerIndex);
      }
    }
  });

  socket.on("gameStarted", (data) => {
    if (data && data.players) players = data.players;
    switchScreen("screen-game");

    if (window.boardManager) {
      window.boardManager.init(100);
      window.boardManager.draw(players, activePlayerIndex);
    }
    updateCurrentPlayerDisplay();
    renderLocationPlayersList();
  });

  socket.on("spinRoulette", (data) => {
    if (data) {
      if (data.activePlayerIndex !== undefined) {
        activePlayerIndex = data.activePlayerIndex;
      }
      const resultNum = data.result !== undefined ? data.result : 1;
      executeSyncedRoulette(resultNum);
    }
  });

  socket.on("syncGameState", (data) => {
    if (data.players && Array.isArray(data.players)) players = data.players;
    if (data.activePlayerIndex !== undefined) activePlayerIndex = data.activePlayerIndex;
    updateCurrentPlayerDisplay();

    if (window.boardManager) {
      window.boardManager.draw(players, activePlayerIndex);
    }
  });

  socket.on("applyPlayerAction", (data) => {
    if (data && data.action === "turnUpdated") {
      activePlayerIndex = data.activePlayerIndex;
      updateCurrentPlayerDisplay();
      if (window.boardManager) {
        window.boardManager.draw(players, activePlayerIndex);
      }
    }
  });
}

function switchScreen(targetId) {
  const screenIds = ["screen-setup", "screen-waiting", "screen-game"];
  screenIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = "none";
      el.classList.remove("active");
    }
  });

  const target = document.getElementById(targetId);
  if (target) {
    target.style.display = ""; 
    target.classList.add("active");
  }
}

function renderPlayerWaitingList() {
  const ul = document.getElementById("player-list");
  if (!ul) return;
  ul.innerHTML = "";
  players.forEach(p => {
    const li = document.createElement("li");
    li.textContent = `👤 ${p.name}`;
    ul.appendChild(li);
  });
}

function renderLocationPlayersList() {
  const container = document.getElementById("location-players-list");
  if (!container) return;

  const locationMap = {};
  players.forEach(p => {
    const loc = (p.location && p.location.trim() !== "") ? p.location : "スタート前";
    if (!locationMap[loc]) locationMap[loc] = [];
    locationMap[loc].push(p.name);
  });

  let html = "";
  for (const [loc, names] of Object.entries(locationMap)) {
    html += `<div style="margin-bottom: 4px;"><strong>${loc}：</strong> ${names.join("、")}</div>`;
  }
  container.innerHTML = html || '<p style="color: #666; font-size: 0.85rem;">プレイヤーがいません</p>';
}

function updateCurrentPlayerDisplay() {
  const p = players[activePlayerIndex];
  if (!p) return;

  const jobMaster = (typeof JOBS !== 'undefined')
    ? JOBS.find(j => j.id === p.jobId || j.label === p.job || j.title === p.job)
    : null;

  const baseCap = jobMaster ? jobMaster.cap : (p.baseCap || 100);
  const bonusCap = p.bonusCap || 0;
  const maxHp = baseCap + bonusCap;

  if (p.currentHp === undefined) p.currentHp = maxHp;
  const currentHp = Math.max(0, p.currentHp);
  const drunkPercent = Math.min(100, Math.round(((maxHp - currentHp) / maxHp) * 100));

  const nameEl = document.getElementById("current-player-name");
  const jobEl = document.getElementById("current-player-job");
  if (nameEl) nameEl.textContent = p.name;
  if (jobEl) jobEl.textContent = jobMaster ? jobMaster.label : (p.job || "モブ");

// プレイヤーカードの色設定（board.jsのカラー配列と同期）
  const playerColors = [
    "#f44336", // 赤
    "#2196f3", // 青
    "#4caf50", // 緑
    "#ff9800", // オレンジ
    "#9c27b0", // 紫
    "#00bcd4", // シアン
    "#e91e63", // ピンク
    "#795548"  // 茶色
  ];

  const playerCardEl = document.querySelector(".current-player-card");
  if (playerCardEl) {
    // p.color があればそれを使用し、なければインデックスから自動割り当て
    const playerColor = p.color || playerColors[activePlayerIndex % playerColors.length];
    playerCardEl.style.background = `linear-gradient(135deg, ${playerColor} 0%, #2575fc 100%)`;
  }

  // リア充アイコン（❤️）の表示切り替え
  const loverIconEl = document.getElementById("current-player-lover-icon");
  if (loverIconEl) {
    if (p.isLover) {
      loverIconEl.style.display = "inline-block";
    } else {
      loverIconEl.style.display = "none";
    }
  }

  const hpTextEl = document.getElementById("current-player-hp");
  const hpBarEl = document.getElementById("current-player-drunk");
  const drunkPercentEl = document.getElementById("current-player-drunk-percent");

  if (hpTextEl) hpTextEl.textContent = `${currentHp} / ${maxHp}`;
  if (hpBarEl) {
    const hpRate = Math.max(0, (currentHp / maxHp) * 100);
    hpBarEl.style.width = `${hpRate}%`;
    hpBarEl.style.backgroundColor = hpRate > 50 ? "#4caf50" : hpRate > 20 ? "#ff9800" : "#f44336";
  }
  if (drunkPercentEl) drunkPercentEl.textContent = `${drunkPercent}%`;

  const drinksEl = document.getElementById("current-player-drinks");
  if (drinksEl) drinksEl.textContent = `${p.drinkCount || 0} 杯`;

  const locationEl = document.getElementById("current-player-location");
  if (locationEl) locationEl.textContent = p.location ? p.location : "-";

  renderLocationPlayersList();
}

function executeSyncedRoulette(resultNum) {
  const p = players[activePlayerIndex];
  if (!p) return;

  if (p.skipTurn) {
    p.skipTurn = false;
    alert(`${p.name} は潰れていたため、このターンは1回休みです。`);
    socket.emit("playerAction", { roomCode, action: "nextTurn" });
    return;
  }

  const resEl = document.getElementById("roulette-result-display");
  if (resEl) resEl.textContent = "🎯 回転中...";

  const eventBox = document.getElementById("event-text");
  if (eventBox) eventBox.innerHTML = `<p class="event-msg">ルーレット回転中...</p>`;

  const targetDegrees = [342, 306, 270, 234, 198, 162, 126, 90, 54, 18];
  const stopAngle = targetDegrees[resultNum - 1];

  const currentMod = pcCurrentRotation % 360;
  pcCurrentRotation += 1800 + ((stopAngle - currentMod + 360) % 360);

  const wheel = document.getElementById("controller-roulette-wheel");
  if (wheel) {
    wheel.style.transition = "transform 3s cubic-bezier(0.15, 0.9, 0.2, 1)";
    wheel.style.transform = `rotate(${pcCurrentRotation}deg)`;
  }

  setTimeout(() => {
    if (resEl) resEl.textContent = `🎯 出目: ${resultNum}`;

    let targetPosition = p.position + resultNum;
    
    if (typeof MAP_SQUARES !== 'undefined') {
      for (let pos = p.position + 1; pos <= targetPosition; pos++) {
        const sq = MAP_SQUARES[pos];
        if (sq && (sq.type === "force_stop" || sq.type === "force_stop_rankup")) {
          targetPosition = pos;
          console.log(`強制ストップマス（ID: ${sq.id}, ${sq.text}）でピタッと停止します。`);
          break;
        }
      }
    }

    p.position = targetPosition;

    let squareLocation = "";
    if (typeof MAP_SQUARES !== 'undefined' && MAP_SQUARES[p.position]) {
      const sq = MAP_SQUARES[p.position];
      squareLocation = sq.location || "";
      
      if (eventBox) {
        eventBox.innerHTML = `<p class="event-msg">${sq.text || "何もないマスです。"}</p>`;
      }

      applySquareEffects(p, sq);

      const isJobSquare = sq.type === "jobChallenge" || sq.jobId || (sq.text && sq.text.includes("【役職マス】"));
      if (isJobSquare && !p.hasJob) {
        const jobId = sq.jobId || sq.type || "unknown_job";
        const jobName = sq.text ? sq.text.replace(/【役職マス】/g, "").trim() : "新しい役職";

        console.log("役職マスに到達しました。スマホへダイアログ表示を要求します:", { jobId, jobName });
        socket.emit("triggerJobChoice", {
          roomCode: roomCode,
          playerId: p.id,
          jobId: jobId,
          jobName: jobName
        });
      }

      if (sq.type === "force_stop" || sq.type === "force_stop_rankup") {
        handleForceStopSquare(p, sq);
      }
    }

    p.location = squareLocation;

if (window.boardManager) {
      window.boardManager.draw(players, activePlayerIndex);
    }

    renderLocationPlayersList();
    updateCurrentPlayerDisplay();

    // ★ 役職データ（hasJob等）を絶対に含めないことで、サーバー側の「いいえ(false)」を保護する
    socket.emit("updateGameState", {
      roomCode: roomCode,
      activePlayerIndex: activePlayerIndex,
      players: players.map(pl => ({
        id: pl.id,
        position: pl.position,
        location: pl.location,
        currentHp: pl.currentHp,
        drinkCount: pl.drinkCount,
        isLover: pl.isLover,
        skipTurn: pl.skipTurn
        // ※ hasJob や job はここに入れない！
      }))
    });
  }, 3000);
}

function applySquareEffects(player, square) {
  const drinkAmount = square.drink !== undefined ? square.drink : 0;

  if (drinkAmount > 0) {
    if (!player.drinkCount) player.drinkCount = 0;
    player.drinkCount += drinkAmount;

    if (player.currentHp !== undefined) {
      player.currentHp = Math.max(0, player.currentHp - (drinkAmount * 10));
    }

    console.log(`${player.name} がマス「${square.text}」で ${drinkAmount} 杯飲みました。合計: ${player.drinkCount}杯`);
  }
}

function handleForceStopSquare(player, square) {
  switch (square.id) {
    case 15:
      console.log(`${player.name} が入学式で強制停止しました。`);
      break;

    case 35:
      console.log(`${player.name} がカップル成立マスで停止しました。イベント開始！`);
      
      // 1. PC側のモーダルを表示する
      const pcModal = document.getElementById("pc-couple-event-modal");
      if (pcModal) pcModal.style.display = "flex";

      // 2. スマホ側へカップルイベントの開始を通知する
      socket.emit("triggerCoupleEvent", {
        roomCode: roomCode,
        playerId: player.id,
        playerName: player.name
      });
      break;

    case 52:
      console.log(`${player.name} がランクアップチャンスで強制停止しました。`);
      break;

    case 78:
      console.log(`${player.name} が引退マスで強制停止しました。`);
      break;

    default:
      console.log(`${player.name} が強制ストップマスで停止しました。`);
      break;
  }
}