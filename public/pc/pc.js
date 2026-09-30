const socket = io();

let roomCode = "";
let players = [];
let activePlayerIndex = 0;
let pcCurrentRotation = 0;
let isPCEventMode = false;

// 🎯 画面初期化のタイミングで確実に各ボタンへクリックイベントをバインド
document.addEventListener("DOMContentLoaded", () => {
  console.log("[PC] 画面初期化開始...");
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
  const hostName = hostNameInput && hostNameInput.value ? hostNameInput.value : "やじま";
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

    const qrImgEl = document.getElementById("qrcode-img");
    if (qrImgEl && data.qrCodeDataUrl) {
      qrImgEl.src = data.qrCodeDataUrl;
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
}
function appendSocketListeners() {
  socket.on("spinRoulette", (data) => {
    if (data) {
      if (data.activePlayerIndex !== undefined) activePlayerIndex = data.activePlayerIndex;
      const resultNum = data.result !== undefined ? data.result : 1;
      executeSyncedRoulette(resultNum);
    }
  });

  // socket.on("executeDebugWarp", (data) => {
  //   if (data.players) players = data.players;
  //   if (data.activePlayerIndex !== undefined) activePlayerIndex = data.activePlayerIndex;

  //   const p = players[activePlayerIndex];
  //   if (!p) return;

  //   if (window.boardManager) window.boardManager.draw(players, activePlayerIndex);
  //   updateCurrentPlayerDisplay();

  //   if (typeof loadAndApplySquareComponent === "function") {
  //     loadAndApplySquareComponent(data.targetSquareId, () => {
  //       const targetSquare = typeof MAP_SQUARES !== "undefined" ? MAP_SQUARES[data.targetSquareId] : null;
  //       if (!targetSquare) return;

  //       p.location = targetSquare.location || "";
  //       applySquareEffects(p, targetSquare); 
  //       updateCurrentPlayerDisplay();

  //       const tileDescEl = document.getElementById("current-tile-desc");
  //       if (tileDescEl) {
  //         let drinkInfo = targetSquare.drink ? `<br><span style="color:#e74c3c; font-weight:bold;">🍺 飲酒ペナルティ: ${targetSquare.drink} 杯</span>` : "";
  //         let locInfo = targetSquare.location ? `<br>📍 場所: ${targetSquare.location}` : "";
  //         tileDescEl.innerHTML = `<strong>${targetSquare.text || "何もないマスです。"}</strong>${drinkInfo}${locInfo}`;
  //       }

  //       if (targetSquare.type === "force_stop" || targetSquare.type === "force_stop_rankup" || targetSquare.type === "insurance_shop") {
  //         handleForceStopSquare(p, targetSquare);
  //       } else if (targetSquare.type === "jobChallenge" || targetSquare.jobId) {
  //         const jobId = targetSquare.jobId || targetSquare.type || "unknown_job";
  //         const jobName = targetSquare.text ? targetSquare.text.replace(/【役職マス】/g, "").trim() : "新しい役職";
  //         socket.emit("triggerJobChoice", { roomCode: roomCode, playerId: p.id, jobId, jobName });
  //       }
  //     });
  //   }
  // });

  // 🎯 【完全汎用化】マスのJSから届いた設定に従い、大画面に2回目の運命対応表を美しく動的生成！
  socket.on("startCustomEventSecondSpin", (data) => {
    const modalResultBox = document.getElementById("modal-event-result-box");
    if (modalResultBox) {
      modalResultBox.className = "event-result-box success";
      modalResultBox.innerHTML = `🔥 1回目達成！<br>運命の ${data.nextStepEventName || "チャンス"} 突入！`;
      modalResultBox.style.display = "block";
    }

    const dynamicTableZone = document.getElementById("pc-event-table-dynamic-zone");
    if (dynamicTableZone && data.mapping) {
      let html = `<div class="event-title" style="font-size:1.3rem; color:#d81b60; margin-bottom:8px; font-weight:bold; border-bottom:2px solid #ff69b4; padding-bottom:4px;">💖 運命の決定対応表</div><ul class="event-table-list">`;
      for (let i = 1; i <= 10; i++) {
        const target = data.mapping[i];
        let targetText = '<span style="color:#aaa;">（誰もなし：失敗）</span>';
        if (target) {
          targetText = `<span style="color:#e91e63; font-weight:bold;">👤 ${target.name} に決定！</span>`;
        }
        html += `<li class="event-table-item"><div class="event-table-num-badge" style="background:#ff4081;">${i}</div><div>${targetText}</div></li>`;
      }
      html += `</ul>`;
      dynamicTableZone.innerHTML = html;
    }
  });

  // 🎯 【完全汎用化】2段階イベントが決着した瞬間の汎用クローズ余韻演出
  socket.on("customEventFinished", (data) => {
    isPCEventMode = false;
    setTimeout(() => {
      const modalResultBox = document.getElementById("modal-event-result-box");
      if (modalResultBox) {
        modalResultBox.style.display = "block";
        modalResultBox.className = data.success ? "event-result-box success" : "event-result-box failure";
        modalResultBox.innerHTML = data.message || "";
      }

      setTimeout(() => {
        const targetModalEl = document.getElementById("pc-event-modal");
        if (targetModalEl) {
          targetModalEl.className = "event-modal-overlay";
          targetModalEl.style.display = "none";
        }
        const btnNext = document.getElementById("btn-next-turn");
        if (btnNext) { btnNext.disabled = false; btnNext.style.display = "block"; }
      }, 3000);
    }, 3000);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  appendSocketListeners();
});
function switchScreen(targetId) {
  const screenIds = ["screen-setup", "screen-waiting", "screen-game"];
  screenIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) { el.style.display = "none"; el.classList.remove("active"); }
  });
  const target = document.getElementById(targetId);
  if (target) { target.style.display = ""; target.classList.add("active"); }
}

function renderPlayerWaitingList() {
  const ul = document.getElementById("player-list");
  if (!ul) return;
  ul.innerHTML = "";
  players.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = `👤 ${p.name}`;
    ul.appendChild(li);
  });
}

function renderLocationPlayersList() {
  const container = document.getElementById("location-players-list");
  if (!container) return;
  const locationMap = {};
  players.forEach((p) => {
    const loc = p.location && p.location.trim() !== "" ? p.location : "スタート前";
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

  const jobMaster = typeof JOBS !== "undefined" ? JOBS.find((j) => j.id === p.jobId || j.label === p.job || j.title === p.job) : null;
  const baseCap = jobMaster ? jobMaster.cap : p.baseCap || 100;
  const maxHp = baseCap + (p.bonusCap || 0);

  if (p.currentHp === undefined) p.currentHp = maxHp;
  const currentHp = Math.max(0, p.currentHp);
  const drunkPercent = Math.min(100, Math.round(((maxHp - currentHp) / maxHp) * 100));

  const nameEl = document.getElementById("current-player-name");
  const jobEl = document.getElementById("current-player-job");
  if (nameEl) nameEl.textContent = p.name;
  if (jobEl) jobEl.textContent = jobMaster ? jobMaster.label : p.job || "モブ";

  const playerColors = ["#f44336", "#2196f3", "#4caf50", "#ff9800", "#9c27b0", "#00bcd4", "#e91e63", "#795548"];
  const playerCardEl = document.querySelector(".current-player-card");
  if (playerCardEl) {
    const playerColor = p.color || playerColors[activePlayerIndex % playerColors.length];
    playerCardEl.style.background = `linear-gradient(135deg, ${playerColor} 0%, #2575fc 100%)`;
  }

  const loverIconEl = document.getElementById("current-player-lover-icon");
  if (loverIconEl) {
    if (p.isLover && p.lovers && p.lovers.length > 0) {
      loverIconEl.innerHTML = `<span style="font-size: 0.95rem; font-weight: bold; color: #ffeb3b; background: rgba(0,0,0,0.2); padding: 2px 8px; border-radius: 20px;">💕 恋人: ${p.lovers.join("、")}</span>`;
      loverIconEl.style.display = "inline-block";
    } else if (p.isLover) {
      loverIconEl.innerHTML = "❤️"; loverIconEl.style.display = "inline-block";
    } else {
      loverIconEl.style.display = "none";
    }
  }

  if (document.getElementById("current-player-hp")) document.getElementById("current-player-hp").textContent = `${currentHp} / ${maxHp}`;
  if (document.getElementById("current-player-drunk")) {
    const hpRate = Math.max(0, (currentHp / maxHp) * 100);
    document.getElementById("current-player-drunk").style.width = `${hpRate}%`;
    document.getElementById("current-player-drunk").style.backgroundColor = hpRate > 50 ? "#4caf50" : hpRate > 20 ? "#ff9800" : "#f44336";
  }
  if (document.getElementById("current-player-drunk-percent")) document.getElementById("current-player-drunk-percent").textContent = `${drunkPercent}%`;
  if (document.getElementById("current-player-drinks")) document.getElementById("current-player-drinks").textContent = `${p.drinkCount || 0} 杯`;

  const happinessEl = document.getElementById("current-player-happiness");
  if (happinessEl) {
    const hpVal = p.happiness !== undefined ? p.happiness : 100;
    happinessEl.textContent = `${hpVal} pt`;
    if (hpVal >= 100) happinessEl.style.color = "#ffeb3b";
    else if (hpVal >= 50) happinessEl.style.color = "#ffffff";
    else happinessEl.style.color = "#ff8a80";
  }

  if (document.getElementById("current-player-location")) document.getElementById("current-player-location").textContent = p.location ? p.location : "-";
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
  if (document.getElementById("event-text")) document.getElementById("event-text").innerHTML = `<p class="event-msg" style="color: #666; font-weight: bold; animation: pulse 1s infinite;">🌀 ルーレット回転中... どこに止まるかな？ 🌀</p>`;

  // 🎯 【システム同期】1〜10の出目に対応する、大画面の物理的な盤面ストップ角度（度数）
  const targetDegrees = [342, 306, 270, 234, 198, 162, 126, 90, 54, 18];
  const stopAngle = targetDegrees[resultNum - 1];
  pcCurrentRotation += 1800 + ((stopAngle - (pcCurrentRotation % 360) + 360) % 360);

  let wheel = isPCEventMode ? (document.querySelector("#pc-event-modal .event-roulette-wheel") || document.querySelector("#pc-couple-event-modal .event-roulette-wheel")) : (document.getElementById("controller-roulette-wheel") || document.getElementById("pc-roulette-wheel"));
  if (wheel) { wheel.style.transition = "transform 3s cubic-bezier(0.15, 0.9, 0.2, 1)"; wheel.style.transform = `rotate(${pcCurrentRotation}deg)`; }

  if (isPCEventMode) { triggerDelayedDisplay(resultNum, null); return; }

  setTimeout(() => {
    if (resEl) resEl.textContent = `出目: ${resultNum}`;
    let stepsMoved = 0;

    const moveTimer = setInterval(() => {
      const currentSquare = MAP_SQUARES[p.position];
      if (stepsMoved > 0 && currentSquare && (currentSquare.type === "force_stop" || currentSquare.type === "force_stop_rankup" || currentSquare.type === "insurance_shop")) {
        clearInterval(moveTimer); finalizeMovement(); return;
      }
      if (stepsMoved >= resultNum || !currentSquare || !currentSquare.nextId || currentSquare.nextId.length === 0) {
        clearInterval(moveTimer); finalizeMovement(); return;
      }

      const nextIdArray = currentSquare.nextId;
      if (Array.isArray(nextIdArray) && nextIdArray.length > 1) {
        p.position = Number(nextIdArray[(p.chosenRouteIdx !== undefined && p.chosenRouteIdx !== null) ? Number(p.chosenRouteIdx) : 0]);
      } else {
        p.position = Number(Array.isArray(nextIdArray) ? nextIdArray : nextIdArray);
      }
      stepsMoved++;
      if (window.boardManager) window.boardManager.draw(players, activePlayerIndex);
    }, 250);

    function finalizeMovement() {
      loadAndApplySquareComponent(p.position, () => {
        let targetSquare = (typeof MAP_SQUARES !== "undefined" && MAP_SQUARES[p.position]) ? MAP_SQUARES[p.position] : null;
        if (targetSquare) { p.location = targetSquare.location || ""; applySquareEffects(p, targetSquare); }

        if (window.boardManager) window.boardManager.draw(players, activePlayerIndex);
        renderLocationPlayersList(); updateCurrentPlayerDisplay();

        if (targetSquare && (targetSquare.type === "jobChallenge" || targetSquare.jobId)) {
          const jobId = targetSquare.jobId || targetSquare.type || "unknown_job";
          const jobName = targetSquare.text ? targetSquare.text.replace(/【役職マス】/g, "").trim() : "新しい役職";
          socket.emit("triggerJobChoice", { roomCode: roomCode, playerId: p.id, jobId, jobName });
        }
        if (p.chosenRouteIdx !== undefined) delete p.chosenRouteIdx;

        if (targetSquare && (targetSquare.type === "force_stop" || targetSquare.type === "force_stop_rankup" || targetSquare.type === "insurance_shop")) {
          handleForceStopSquare(p, targetSquare);
        }
        triggerDelayedDisplay(resultNum, targetSquare);
      });
    }
  }, 3000);
}
function triggerDelayedDisplay(resultNum, targetSquare) {
  if (!targetSquare) return;
  const p = players[activePlayerIndex];
  if (!p) return;

  if (document.getElementById("event-text")) document.getElementById("event-text").innerHTML = `<p class="event-msg" style="color: #2c3e50; font-weight: bold; font-size: 1.15rem;">🎲 ${targetSquare.text || "何もないマスのようです。"}</p>`;

  socket.emit("updateGameState", {
    roomCode: roomCode, activePlayerIndex: activePlayerIndex,
    players: [{ id: p.id, position: p.position, location: targetSquare.location ? targetSquare.location : "スタート前", currentHp: p.currentHp, drinkCount: p.drinkCount, happiness: p.happiness !== undefined ? p.happiness : 100, isLover: p.isLover, skipTurn: p.skipTurn, hasJob: p.hasJob !== undefined ? p.hasJob : false, jobId: p.jobId || null, job: p.job || "モブ" }]
  });

  if (targetSquare.type === "force_stop" || targetSquare.type === "force_stop_rankup" || targetSquare.type === "insurance_shop" || targetSquare.type === "jobChallenge") {
    socket.emit("playerAction", { roomCode: roomCode, action: "squareEvent", targetSquare: targetSquare });
  }
}

socket.on("syncGameState", (data) => {
  if (data.players && Array.isArray(data.players)) players = data.players;
  if (data.activePlayerIndex !== undefined) activePlayerIndex = data.activePlayerIndex;
  updateCurrentPlayerDisplay();
  if (window.boardManager) window.boardManager.draw(players, activePlayerIndex);
});

// ==========================================================================
// 🧭 【完全お掃除版】仕様未定マス専用・限定テキスト定義（カップル全廃）
// ==========================================================================
const GAME_EVENTS = {
  入学式: { class: "theme-entrance", title: "🌸 入学式 🌸", desc: (name) => `${name} さんの大学生活がスタート！` },
  ランクアップ: { class: "theme-rankup", title: "🔥 ランクアップチャンス 🔥", desc: (name) => `${name} さんの実力が試される時！` },
  引退: { class: "theme-retirement", title: "🎓 サークル引退式 🎓", desc: (name) => `${name} さん、これまでの思い出を胸に引退！` },
  卒業判定: { class: "theme-retirement", title: "🎓 運命の卒業判定チャンス 🎓", desc: (name) => `${name} さんの運命のルーレット！` }
};

function openPCEventModal(eventType, playerName, activePlayerId) {
  isPCEventMode = true;
  const pcModal = document.getElementById("pc-event-modal");
  if (!pcModal) return;

  if (document.getElementById("btn-next-turn")) { document.getElementById("btn-next-turn").disabled = true; document.getElementById("btn-next-turn").style.display = "none"; }
  const config = GAME_EVENTS[eventType];
  if (!config) return;

  pcModal.className = "event-modal-overlay active " + config.class;
  if (document.getElementById("modal-event-title")) document.getElementById("modal-event-title").textContent = config.title;
  if (document.getElementById("modal-event-desc")) document.getElementById("modal-event-desc").textContent = config.desc(playerName);
  if (document.getElementById("modal-event-result-box")) document.getElementById("modal-event-result-box").style.display = "none";
  if (document.getElementById("pc-event-table-dynamic-zone")) document.getElementById("pc-event-table-dynamic-zone").innerHTML = `<p>イベント待機中...</p>`;
}

// ==========================================================================
// 🎯 【真のコンポーネント起動エンジン】
// ==========================================================================
function handleForceStopSquare(player, square) {
  if (!square) return;
  if (Number(square.id) === 89) return;

  let currentMode = "normal";
  if (typeof roomCode !== "undefined" && typeof rooms !== "undefined" && rooms[roomCode]) {
    currentMode = rooms[roomCode].mode || "normal";
  }

  // 🎯 読み込まれたマスのJS（sq_30 や sq_41）に直書きされた自前の event 関数を1行で爆発させる！
  const targetModule = window.SQ_MODULES && window.SQ_MODULES[square.id] && window.SQ_MODULES[square.id][currentMode];
  if (targetModule && typeof targetModule.event === "function") {
    console.log(`[コンポーネント自動連動] sq_${square.id}.js の直書きイベントを実行します。`);
    targetModule.event(player, square);
    return; // 🔓 100%自動スキップタイマーをせき止めて手動操作を待つ！
  }

  console.log(`[開発デバッグ] マスID: ${square.id} はイベント処理未定義のため自動進行。`);
  let fallbackType = square.id === 18 ? "入学式" : square.id === 49 ? "ランクアップ" : "引退";
  openPCEventModal(fallbackType, player.name, player.id);

  setTimeout(() => {
    socket.emit("playerAction", { roomCode: roomCode, action: "nextTurn" });
    if (document.getElementById("pc-event-modal")) document.getElementById("pc-event-modal").style.display = "none";
    isPCEventMode = false;
  }, 300);
}

function loadAndApplySquareComponent(squareId, callback) {
  let currentMode = "normal";
  if (window.SQ_MODULES && window.SQ_MODULES[squareId] && window.SQ_MODULES[squareId][currentMode]) {
    if (typeof callback === "function") callback(); return;
  }
  const script = document.createElement("script");
  script.src = `/squares/sq_${squareId}.js`;
  script.onload = () => { if (typeof callback === "function") callback(); };
  script.onerror = () => { if (typeof callback === "function") callback(); };
  document.head.appendChild(script);
}

socket.on("applyPlayerAction", (data) => {
  if (data && data.action === "turnUpdated") {
    isPCEventMode = false;
    if (document.getElementById("pc-kanpai-modal")) document.getElementById("pc-kanpai-modal").style.display = "none";
    if (document.getElementById("pc-event-modal")) document.getElementById("pc-event-modal").style.display = "none";
  }
});
