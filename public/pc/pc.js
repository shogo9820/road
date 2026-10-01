const socket = io();

let roomCode = "";
let players = [];
let activePlayerIndex = 0;
let pcCurrentRotation = 0;
let isPCEventMode = false;

document.addEventListener("DOMContentLoaded", () => {
  console.log("\n=========================================");
  console.log("💻 [PC DOM_LOAD] 大画面初期化を開始します...");
  initEventListeners();
  initSocketListeners();
  console.log("=========================================");
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
  const hostName =
    hostNameInput && hostNameInput.value ? hostNameInput.value : "やじま";
  console.log(`💻 [PC ACTION] ルーム作成要求を発射。ホスト名: ${hostName}`);
  socket.emit("createRoom", { hostName });
}

function handleNextTurnClick(e) {
  if (e) e.preventDefault();
  if (players.length === 0) return;
  console.log(
    "💻 [PC ACTION] 手動「次のプレイヤーへ」がクリックされました。サーバーへ nextTurn を送信します。",
  );
  socket.emit("playerAction", { roomCode, action: "nextTurn" });
}
function initSocketListeners() {
  socket.on("connect", () => {
    console.log(
      "💻 [PC SOCKET] Socket.io サーバーに正常接続完了。ID:",
      socket.id,
    );
  });

  socket.on("roomCreated", (data) => {
    roomCode = data.roomCode;
    if (data.players) players = data.players;
    console.log(
      `💻 [PC RECEIVE] roomCreated 受信。作成された部屋コード: ${roomCode}`,
    );

    const roomCodeEl = document.getElementById("display-room-code");
    if (roomCodeEl) roomCodeEl.textContent = roomCode;
    const qrImgEl = document.getElementById("qrcode-img");
    if (qrImgEl && data.qrCodeDataUrl) qrImgEl.src = data.qrCodeDataUrl;

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
    console.log(
      "💻 [PC RECEIVE] applySettings 受信。参加者リストを同期します。",
    );
    if (data.players && Array.isArray(data.players)) {
      players = data.players;
      renderPlayerWaitingList();
      updateCurrentPlayerDisplay();
      renderLocationPlayersList();
      if (window.boardManager)
        window.boardManager.draw(players, activePlayerIndex);
    }
  });

  // ==========================================================================
  // 🧭 【ルーティン行程②：ゲーム開始・ターン開始時イベント確認（1-2.START_CHECK）】
  // 順序：2.0 サーバーがSTART_CHECK発射 ➔ 2.1 PC大画面がロード ➔ 2.2 スマホがモーダル展開 ★
  // ==========================================================================
  socket.on("gameStarted", (data) => {
    if (data && data.players) players = data.players;
    if (data && data.activePlayerIndex !== undefined)
      activePlayerIndex = data.activePlayerIndex;

    switchScreen("screen-game");

    if (window.boardManager) {
      window.boardManager.init(100);
      window.boardManager.draw(players, activePlayerIndex);
    }
    updateCurrentPlayerDisplay();
    renderLocationPlayersList();

    const p = players[activePlayerIndex];
    if (p && typeof loadAndApplySquareComponent === "function") {
      // 🎯 【リレー番号：2.1】サーバー(2.0)の合図を受け、PC側が0番マスのファイルを読み込みにいく瞬間！
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
  // 🧭 【ルーティン行程③：ルーレットを回して駒を進める（3.MOVING）】
  // 順序：3.0 スマホがrequest発射 ➔ 3.1 サーバーが決定・出目配信 ➔ 3.2 スマホ回転 ➔ 3.3 PC大画面回転・トコトコ移動 ★
  // ==========================================================================
  socket.on("spinRoulette", (data) => {
    if (data) {
      if (data.activePlayerIndex !== undefined)
        activePlayerIndex = data.activePlayerIndex;
      const resultNum = data.result !== undefined ? data.result : 1;

      // 🎯 【リレー番号：3.3】サーバー(3.1)から出目を受け取り、PC大画面が物理回転とトコトコ移動を開始する瞬間！
      console.log(
        `💻 [3.3 PC受信] ➔ サーバーから出目 ${resultNum} を受信。大画面のルーレット回転とピンのトコトコ前進を開始します！`,
      );
      executeSyncedRoulette(resultNum);
    }
  });

    // 🎯 【重要】マス着地時：サーバーから合図を受け取り、PC大画面モーダルを即座に表示！
  socket.on("openCustomRouletteModal", (data) => {
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
    if (descEl) descEl.textContent = "出目に応じて結果が決まる！スマホから回してね！";

    const modalResultBox = document.getElementById("modal-event-result-box");
    if (modalResultBox) modalResultBox.style.display = "none";

    // 判定対応表を描画
    const dynamicTableZone = document.getElementById("pc-event-table-dynamic-zone");
    if (dynamicTableZone && data.mapping) {
      let html = `<div class="event-title" style="font-size:1.3rem; color:#d81b60; margin-bottom:8px; font-weight:bold; border-bottom:2px solid #ff69b4; padding-bottom:4px;">💖 判定対応表</div><ul class="event-table-list">`;
      for (let i = 1; i <= 10; i++) {
        const target = data.mapping[i];
        let targetText = '<span style="color:#aaa;">-</span>';
        if (target) targetText = `<span style="color:#e91e63; font-weight:bold;">${target.name}</span>`;
        html += `<li class="event-table-item"><div class="event-table-num-badge" style="background:#ff4081;">${i}</div><div>${targetText}</div></li>`;
      }
      html += `</ul>`;
      dynamicTableZone.innerHTML = html;
    }
  });

  // 🎯 汎用ルーレット開始（大画面モーダル展開＆ホイール回転）
  socket.on("spinCustomRoulette", (data) => {
    console.log(
      `💻 [PC 汎用ルーレット開始] イベント: ${data.eventName}, 出目: ${data.result}`,
    );
    isPCEventMode = true;

    const pcModal = document.getElementById("pc-event-modal");
    if (pcModal) {
      pcModal.className = "event-modal-overlay active theme-entrance";
      pcModal.style.display = "flex";
    }

    const titleEl = document.getElementById("modal-event-title");
    if (titleEl) titleEl.textContent = `🌸 ${data.eventName} 🌸`;

    const descEl = document.getElementById("modal-event-desc");
    if (descEl) descEl.textContent = "出目に応じて結果が決まる！";

    const modalResultBox = document.getElementById("modal-event-result-box");
    if (modalResultBox) modalResultBox.style.display = "none";

    // 対応表を描画
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

    // 大画面ルーレット物理回転
    executeSyncedRoulette(data.result);
  });

  // 🎯 汎用ルーレット決着（結果テキスト表示）
  socket.on("customRouletteFinished", (data) => {
    isPCEventMode = false;
    const modalResultBox = document.getElementById("modal-event-result-box");
    if (modalResultBox) {
      modalResultBox.style.display = "block";
      modalResultBox.className =
        data.outcome && data.outcome.drinks === 0
          ? "event-result-box success"
          : "event-result-box failure";
      modalResultBox.innerHTML = `
        <div style="font-size:1.8rem; font-weight:bold; margin-bottom:6px;">出目: ${data.result}</div>
        <div style="font-size:1.4rem; font-weight:bold;">${data.message}</div>
      `;
    }
  });

  socket.on("startCustomEventSecondSpin", (data) => {
    console.log(
      "💻 [PC RECEIVE] 2段階カスタムイベント開始合図を受信:",
      data.nextStepEventName,
    );

    // 🎯 【重要】大元のモーダル要素を表示状態にする
    const pcModal = document.getElementById("pc-event-modal");
    if (pcModal) {
      pcModal.className = "event-modal-overlay active theme-entrance";
      pcModal.style.display = "flex";
    }

    const titleEl = document.getElementById("modal-event-title");
    if (titleEl)
      titleEl.textContent = `🌸 ${data.nextStepEventName || "入学式イベント"} 🌸`;

    const descEl = document.getElementById("modal-event-desc");
    if (descEl)
      descEl.textContent = "出目に応じて洗礼が決まる！スマホから回してね！";

    const modalResultBox = document.getElementById("modal-event-result-box");
    if (modalResultBox) {
      modalResultBox.style.display = "none";
    }

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

  socket.on("customEventFinished", (data) => {
    console.log("💻 [PC RECEIVE] 2段階カスタムイベントの決着通知を受信:", data);
    isPCEventMode = false;
    setTimeout(() => {
      const modalResultBox = document.getElementById("modal-event-result-box");
      if (modalResultBox) {
        modalResultBox.style.display = "block";
        modalResultBox.className = data.success
          ? "event-result-box success"
          : "event-result-box failure";
        modalResultBox.innerHTML = data.message || "";
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
          btnNext.style.display = "block";
        }
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
    const loc =
      p.location && p.location.trim() !== "" ? p.location : "スタート前";
    if (!locationMap[loc]) locationMap[loc] = [];
    locationMap[loc].push(p.name);
  });
  let html = "";
  for (const [loc, names] of Object.entries(locationMap)) {
    html += `<div style="margin-bottom: 4px;"><strong>${loc}：</strong> ${names.join("、")}</div>`;
  }
  container.innerHTML =
    html ||
    '<p style="color: #666; font-size: 0.85rem;">プレイヤーがいません</p>';
}

function updateCurrentPlayerDisplay() {
  const p = players[activePlayerIndex];
  if (!p) return;
  const jobMaster =
    typeof JOBS !== "undefined"
      ? JOBS.find(
          (j) => j.id === p.jobId || j.label === p.job || j.title === p.job,
        )
      : null;
  const baseCap = jobMaster ? jobMaster.cap : p.baseCap || 100;
  const maxHp = baseCap + (p.bonusCap || 0);
  if (p.currentHp === undefined) p.currentHp = maxHp;
  const currentHp = Math.max(0, p.currentHp);
  const drunkPercent = Math.min(
    100,
    Math.round(((maxHp - currentHp) / maxHp) * 100),
  );

  const nameEl = document.getElementById("current-player-name");
  const jobEl = document.getElementById("current-player-job");
  if (nameEl) nameEl.textContent = p.name;
  if (jobEl) jobEl.textContent = jobMaster ? jobMaster.label : p.job || "モブ";

  const playerColors = [
    "#f44336",
    "#2196f3",
    "#4caf50",
    "#ff9800",
    "#9c27b0",
    "#00bcd4",
    "#e91e63",
    "#795548",
  ];
  const playerCardEl = document.querySelector(".current-player-card");
  if (playerCardEl) {
    const playerColor =
      p.color || playerColors[activePlayerIndex % playerColors.length];
    playerCardEl.style.background = `linear-gradient(135deg, ${playerColor} 0%, #2575fc 100%)`;
  }
  const loverIconEl = document.getElementById("current-player-lover-icon");
  if (loverIconEl) {
    if (p.isLover && p.lovers && p.lovers.length > 0) {
      loverIconEl.innerHTML = `<span style="font-size: 0.95rem; font-weight: bold; color: #ffeb3b; background: rgba(0,0,0,0.2); padding: 2px 8px; border-radius: 20px;">💕 恋人: ${p.lovers.join("、")}</span>`;
      loverIconEl.style.display = "inline-block";
    } else if (p.isLover) {
      loverIconEl.innerHTML = "❤️";
      loverIconEl.style.display = "inline-block";
    } else {
      loverIconEl.style.display = "none";
    }
  }

  if (document.getElementById("current-player-hp"))
    document.getElementById("current-player-hp").textContent =
      `${currentHp} / ${maxHp}`;
  if (document.getElementById("current-player-drunk")) {
    const hpRate = Math.max(0, (currentHp / maxHp) * 100);
    document.getElementById("current-player-drunk").style.width = `${hpRate}%`;
    document.getElementById("current-player-drunk").style.backgroundColor =
      hpRate > 50 ? "#4caf50" : hpRate > 20 ? "#ff9800" : "#f44336";
  }
  if (document.getElementById("current-player-drunk-percent"))
    document.getElementById("current-player-drunk-percent").textContent =
      `${drunkPercent}%`;
  if (document.getElementById("current-player-drinks"))
    document.getElementById("current-player-drinks").textContent =
      `${p.drinkCount || 0} 杯`;

  const happinessEl = document.getElementById("current-player-happiness");
  if (happinessEl) {
    const hpVal = p.happiness !== undefined ? p.happiness : 100;
    happinessEl.textContent = `${hpVal} pt`;
    if (hpVal >= 100) happinessEl.style.color = "#ffeb3b";
    else if (hpVal >= 50) happinessEl.style.color = "#ffffff";
    else happinessEl.style.color = "#ff8a80";
  }
  if (document.getElementById("current-player-location"))
    document.getElementById("current-player-location").textContent = p.location
      ? p.location
      : "-";
  renderLocationPlayersList();
}

// 🎯 【基本ルーティン：行程③＆④】物理角度盤面スピン・トコトコ移動・100%無差別着地信号
function executeSyncedRoulette(resultNum) {
  const p = players[activePlayerIndex];
  if (!p) return;

  if (p.skipTurn) {
    p.skipTurn = false;
    alert(`${p.name} は潰れていたため、このターンは1回休みです。`);
    socket.emit("playerAction", { roomCode: roomCode, action: "nextTurn" });
    return;
  }

  const resEl = document.getElementById("roulette-result-display");
  if (resEl) resEl.textContent = "🎯 回転中...";
  if (document.getElementById("event-text"))
    document.getElementById("event-text").innerHTML =
      `<p class="event-msg" style="color: #666; font-weight: bold; animation: pulse 1s infinite;">🌀 ルーレット回転中... どこに止まるかな？ 🌀</p>`;

  // 🎯 【不可視化バグ完全修復】大画面の物理ルーレット角度テーブル
  const targetDegrees = [342, 306, 270, 234, 198, 162, 126, 90, 54, 18];
  const stopAngle = targetDegrees[resultNum - 1];
  pcCurrentRotation +=
    1800 + ((stopAngle - (pcCurrentRotation % 360) + 360) % 360);

  let wheel = isPCEventMode
    ? document.querySelector("#pc-event-modal .event-roulette-wheel") ||
      document.querySelector("#pc-couple-event-modal .event-roulette-wheel")
    : document.getElementById("controller-roulette-wheel") ||
      document.getElementById("pc-roulette-wheel");
  if (wheel) {
    wheel.style.transition = "transform 3s cubic-bezier(0.15, 0.9, 0.2, 1)";
    wheel.style.transform = `rotate(${pcCurrentRotation}deg)`;
  }

  if (isPCEventMode) {
    triggerDelayedDisplay(resultNum, null);
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
      if (Array.isArray(nextIdArray) && nextIdArray.length > 1) {
        p.position = Number(
          nextIdArray[
            p.chosenRouteIdx !== undefined && p.chosenRouteIdx !== null
              ? Number(p.chosenRouteIdx)
              : 0
          ],
        );
      } else {
        p.position = Number(
          Array.isArray(nextIdArray) ? nextIdArray : nextIdArray,
        );
      }
      stepsMoved++;
      if (window.boardManager)
        window.boardManager.draw(players, activePlayerIndex);
    }, 250);

    function finalizeMovement() {
      console.log(
        `💻 [PC FINALIZE] ➔ マスID: ${p.position} に着地。JSをロード。`,
      );
      loadAndApplySquareComponent(p.position, () => {
        let targetSquare =
          typeof MAP_SQUARES !== "undefined" && MAP_SQUARES[p.position]
            ? MAP_SQUARES[p.position]
            : null;
        if (targetSquare) {
          p.location = targetSquare.location || "";
          if (typeof applySquareEffects === "function")
            applySquareEffects(p, targetSquare);
        }

        if (window.boardManager)
          window.boardManager.draw(players, activePlayerIndex);
        renderLocationPlayersList();
        updateCurrentPlayerDisplay();

        if (p.chosenRouteIdx !== undefined) delete p.chosenRouteIdx;

        // 🎯 1. 先にプレイヤーの最新位置（18番など）をサーバーへ送信して位置を確定させる
        triggerDelayedDisplay(resultNum, targetSquare);

        // 🎯 2. 位置確定後にサーバーへ「着地完了」を通知して 4.END_CHECK を配電させる
        if (targetSquare) {
          console.log(
            `📡 [PC SIGNAL] マスID: ${p.position} の到着通知をサーバーへ送信！`,
          );
          socket.emit("squareLanded", {
            roomCode: roomCode,
            position: p.position,
          });
        }
      });
    }
  }, 3000);
}
function triggerDelayedDisplay(resultNum, targetSquare) {
  if (!targetSquare) return;
  const p = players[activePlayerIndex];
  if (!p) return;
  if (document.getElementById("event-text"))
    document.getElementById("event-text").innerHTML =
      `<p class="event-msg" style="color: #2c3e50; font-weight: bold; font-size: 1.15rem;">🎲 ${targetSquare.text || "何もないマスのようです。"}</p>`;
  socket.emit("updateGameState", {
    roomCode: roomCode,
    activePlayerIndex: activePlayerIndex,
    players: [
      {
        id: p.id,
        position: p.position,
        location: targetSquare.location ? targetSquare.location : "スタート前",
        currentHp: p.currentHp,
        drinkCount: p.drinkCount,
        happiness: p.happiness !== undefined ? p.happiness : 100,
        isLover: p.isLover,
        skipTurn: p.skipTurn,
        hasJob: p.hasJob !== undefined ? p.hasJob : false,
        jobId: p.jobId || null,
        job: p.job || "モブ",
      },
    ],
  });
}

socket.on("syncGameState", (data) => {
  if (data.players && Array.isArray(data.players)) players = data.players;
  if (data.activePlayerIndex !== undefined)
    activePlayerIndex = data.activePlayerIndex;
  updateCurrentPlayerDisplay();
  if (window.boardManager) window.boardManager.draw(players, activePlayerIndex);
});

// 🎯 サーバーから「手動進行（次へボタン点灯）」の合図を受け取った時に、大画面の各種イベントモーダルを閉じる
socket.on("enableNextTurnButton", () => {
  const pcModal = document.getElementById("pc-event-modal");
  if (pcModal) pcModal.style.display = "none";
  const kanpaiModal = document.getElementById("pc-kanpai-modal");
  if (kanpaiModal) kanpaiModal.style.display = "none";
});

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

function openPCEventModal(eventType, playerName, activePlayerId) {
  isPCEventMode = true;
  const pcModal = document.getElementById("pc-event-modal");
  if (!pcModal) return;
  if (document.getElementById("btn-next-turn")) {
    document.getElementById("btn-next-turn").disabled = true;
    document.getElementById("btn-next-turn").style.display = "none";
  }
  const config = GAME_EVENTS[eventType];
  if (!config) return;
  pcModal.className = "event-modal-overlay active " + config.class;
  if (document.getElementById("modal-event-title"))
    document.getElementById("modal-event-title").textContent = config.title;
  if (document.getElementById("modal-event-desc"))
    document.getElementById("modal-event-desc").textContent =
      config.desc(playerName);
  if (document.getElementById("modal-event-result-box"))
    document.getElementById("modal-event-result-box").style.display = "none";
}

function handleForceStopSquare(player, square) {
  if (!square) return;
  if (Number(square.id) === 89) return;

  let currentMode = "normal";
  if (
    typeof roomCode !== "undefined" &&
    typeof rooms !== "undefined" &&
    rooms[roomCode]
  ) {
    currentMode = rooms[roomCode].mode || "normal";
  }

  const targetModule =
    window.SQ_MODULES &&
    window.SQ_MODULES[square.id] &&
    window.SQ_MODULES[square.id][currentMode];
  if (targetModule && typeof targetModule.event === "function") {
    console.log(`💻 [PC SIGNAL] sq_${square.id}.js の固有event()を起動。`);
    targetModule.event(player, square);
    return;
  }

  // 🎯 【型ガード確立】すでに仕様確定マスなら、下の古い引退式モーダルのdefaultへは流さず待機ロック！
  const squareType =
    targetModule && targetModule.type ? targetModule.type : square.type;
  if (
    squareType === "branch" ||
    squareType === "insurance_shop" ||
    squareType === "jobChallenge" ||
    squareType === "force_stop" ||
    // squareType === "force_stop_rankup" ||
    // squareType === "force_stop_retirement" ||
    targetModule
  ) {
    console.log(
      `💻 [PC RELEY-LOCK] マスID: ${square.id} (${squareType}) 正常待機。誤爆を防止。`,
    );
    return;
  }

  console.log(
    `💻 [PC TIME-SKIP] マスID: ${square.id} は未定義。0.3秒自動進行。`,
  );
  let fallbackType =
    square.id === 18 ? "入学式" : square.id === 49 ? "ランクアップ" : "引退";
  openPCEventModal(fallbackType, player.name, player.id);

  setTimeout(() => {
    socket.emit("playerAction", { roomCode: roomCode, action: "nextTurn" });
    if (document.getElementById("pc-event-modal"))
      document.getElementById("pc-event-modal").style.display = "none";
    isPCEventMode = false;
  }, 300);
}

function loadAndApplySquareComponent(squareId, callback) {
  let currentMode = "normal";
  if (
    window.SQ_MODULES &&
    window.SQ_MODULES[squareId] &&
    window.SQ_MODULES[squareId][currentMode]
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

socket.on("applyPlayerAction", (data) => {
  if (data && data.action === "turnUpdated") {
    console.log("💻 [PC 新ターン開始] 全アクティブモーダルを一括クローズします。");
    isPCEventMode = false;

    // 🎯 1. 判定ルーレット・イベントモーダルを完全に閉じる
    const pcModal = document.getElementById("pc-event-modal");
    if (pcModal) {
      pcModal.style.display = "none";
      pcModal.classList.remove("active");
    }

    // 🎯 2. 乾杯モーダルを閉じる
    const kanpaiModal = document.getElementById("pc-kanpai-modal");
    if (kanpaiModal) {
      kanpaiModal.style.display = "none";
    }

    // 🎯 3. カップルイベントモーダル（個別要素がある場合）を閉じる
    const coupleModal = document.getElementById("pc-couple-event-modal");
    if (coupleModal) {
      coupleModal.style.display = "none";
    }
  }
});
