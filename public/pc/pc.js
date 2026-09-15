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
  const hostName =
    hostNameInput && hostNameInput.value ? hostNameInput.value : "やじま";
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
          text: `${window.location.origin}/mobile/index.html?room=${roomCode}`,
          width: 128,
          height: 128,
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
}
// 🎯 注意：initSocketListeners関数が途中で途切れないよう、既存の関数にイベントを後から安全に継承・追加します
function appendSocketListeners() {
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
    if (data.activePlayerIndex !== undefined)
      activePlayerIndex = data.activePlayerIndex;
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

  socket.on("startCoupleSecondRoulette", (data) => {
    const eventBox = document.getElementById("event-text");
    if (eventBox) {
      eventBox.innerHTML = `<p class="event-highlight-text" style="color: #d81b60; font-size: 1.5rem;">
      🔥 偶数達成！運命の告白チャンス突入！ 🔥<br>スマホから2回目のスピンを回してね！
    </p>`;
    }

    const dynamicTableZone = document.getElementById("pc-event-table-dynamic-zone");
    if (dynamicTableZone && data.mapping) {
      let html = `<div class="event-title" style="font-size:1.4rem; color:#d81b60; margin-bottom:10px;">💖 告白相手の決定対応表</div><ul class="event-table-list">`;

      for (let i = 1; i <= 10; i++) {
        const target = data.mapping[i];
        let targetText = '<span style="color:#aaa;">（誰もなし：告白失敗）</span>';

        if (target) {
          targetText = `<span style="color:#e91e63; font-weight:bold;">👤 ${target.name} に告白！ (カップル成立)</span>`;
        }

        html += `<li class="event-table-item"><div class="event-table-num-badge">${i}</div><div>${targetText}</div></li>`;
      }
      html += `</ul>`;
      dynamicTableZone.innerHTML = html;
    }
  });

// ─── pc.js : 【パーツ3】内ソケット受信：どんなイベント終了時でも確実にモーダルを消し去る修正 ───
  socket.on("coupleEventFinished", (data) => {
    const eventBox = document.getElementById("event-text");
    if (eventBox) {
      eventBox.innerHTML = `<p class="event-msg" style="font-size:1.5rem; color:#666; font-weight:bold; animation: pulse 1s infinite;">🌀 運命の判定中... ルーレットを注視せよ！ 🌀</p>`;
    }

    isPCEventMode = false;

    setTimeout(() => {
      // 🎯 修正：ID名（ 'pc-event-modal' ）でドキュメントから要素を安全に再取得し、
      // どのテーマ（ theme-couple / theme-entrance 等）であっても例外なく active クラスごと全消去して完全に画面から消し去ります
      const targetModalEl = document.getElementById("pc-event-modal");
      if (targetModalEl) {
        targetModalEl.className = "event-modal-overlay"; // クラスを初期状態（非表示）に完全リセット
        targetModalEl.style.display = "none";            // display属性も強制的に非表示に固定
      }

      if (eventBox) {
        if (data.success) {
          eventBox.innerHTML = `<div style="text-align:center; padding:10px; background:#ffe4e1; border:3px solid #ff69b4; border-radius:12px;">
          <h2 style="color:#d81b60; font-size:2rem; margin-bottom:5px;">💕 カップル成立！！ 💕</h2>
          <p style="font-weight:bold; font-size:1.2rem;">${data.message}</p>
        </div>`;
        } else {
          eventBox.innerHTML = `<div style="text-align:center; padding:10px; background:#eceff1; border:3px solid #b0bec5; border-radius:12px;">
          <h2 style="color:#37474f; font-size:1.8rem; margin-bottom:5px;">💦 告白失敗... 💦</h2>
          <p style="font-weight:bold;">運命の人は別にいるさ！ドンマイ！</p>
        </div>`;
        }
      }
    }, 3000); // 3秒の回転時間待ち
  });
}

// 🎯 初期化のトリガーへ追加したリスナーをフックします
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
  const bonusCap = p.bonusCap || 0;
  const maxHp = baseCap + bonusCap;

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
    "#f44336", "#2196f3", "#4caf50", "#ff9800", "#9c27b0", "#00bcd4", "#e91e63", "#795548"
  ];

  const playerCardEl = document.querySelector(".current-player-card");
  if (playerCardEl) {
    const playerColor =
      p.color || playerColors[activePlayerIndex % playerColors.length];
    playerCardEl.style.background = `linear-gradient(135deg, ${playerColor} 0%, #2575fc 100%)`;
  }

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
  const drunkPercentEl = document.getElementById(
    "current-player-drunk-percent",
  );

  if (hpTextEl) hpTextEl.textContent = `${currentHp} / ${maxHp}`;
  if (hpBarEl) {
    const hpRate = Math.max(0, (currentHp / maxHp) * 100);
    hpBarEl.style.width = `${hpRate}%`;
    hpBarEl.style.backgroundColor =
      hpRate > 50 ? "#4caf50" : hpRate > 20 ? "#ff9800" : "#f44336";
  }
  if (drunkPercentEl) drunkPercentEl.textContent = `${drunkPercent}%`;

  const drinksEl = document.getElementById("current-player-drinks");
  if (drinksEl) drinksEl.textContent = `${p.drinkCount || 0} 杯`;

  const locationEl = document.getElementById("current-player-location");
  if (locationEl) locationEl.textContent = p.location ? p.location : "-";

  renderLocationPlayersList();
}
// ─── pc.js : 【パーツ6】0秒目のモーダル自動起動を完全に消去し、3秒遅延へ一本化する修正 ───
function executeSyncedRoulette(resultNum) {
  const p = players[activePlayerIndex];
  if (!p) return;

  if (p.skipTurn) {
    p.skipTurn = false;
    alert(`${p.name} は潰れていたため、このターンは1回休みです。`);
    socket.emit("playerAction", { roomCode, action: "nextTurn" });
    return;
  }

  // 1. 【遅延ゼロ：0秒目】通常盤・イベント盤問わず、回り始めた瞬間のテキスト表示
  const resEl = document.getElementById("roulette-result-display");
  if (resEl) resEl.textContent = "🎯 回転中...";

  const eventBox = document.getElementById("event-text");
  if (eventBox) {
    eventBox.innerHTML = `<p class="event-msg" style="color: #666; font-weight: bold; animation: pulse 1s infinite;">🌀 ルーレット回転中... どこに止まるかな？ 🌀</p>`;
  }

  // 角度計算用の設定
  const targetDegrees = [342, 306, 270, 234, 198, 162, 126, 90, 54, 18];
  const stopAngle = targetDegrees[resultNum - 1];

  const currentMod = pcCurrentRotation % 360;
  pcCurrentRotation += 1800 + ((stopAngle - currentMod + 360) % 360);

  // 回転させるホイール（要素）の特定
  let wheel;
  if (typeof isPCEventMode !== 'undefined' && isPCEventMode) {
    wheel = document.querySelector("#pc-event-modal .event-roulette-wheel") || 
            document.querySelector("#pc-couple-event-modal .event-roulette-wheel") ||
            document.querySelector("#pc-couple-event-modal .couple-wheel");
  } else {
    wheel = document.getElementById("controller-roulette-wheel") || document.getElementById("pc-roulette-wheel");
  }

  // 2. 【遅延ゼロ：0秒目】ホイールをスマホと「遅延ゼロ」で即座に回転開始
  if (wheel) {
    console.log("[PCルーレット回転開始]", wheel);
    wheel.style.transition = "transform 3s cubic-bezier(0.15, 0.9, 0.2, 1)";
    wheel.style.transform = `rotate(${pcCurrentRotation}deg)`;
  }

  // 3. 【遅延ゼロ：0秒目】内部のすごろく移動、マスのデータ処理、ボード描写は即時実行（ピンは先に動く）
  let targetPosition = p.position + resultNum;
  
  if (typeof MAP_SQUARES !== 'undefined') {
    for (let pos = p.position + 1; pos <= targetPosition; pos++) {
      const sq = MAP_SQUARES[pos];
      if (sq && (sq.type === "force_stop" || sq.type === "force_stop_rankup")) {
        targetPosition = pos;
        break;
      }
    }
  }

  if (!(typeof isPCEventMode !== 'undefined' && isPCEventMode)) {
    p.position = targetPosition;
  }

  let squareLocation = "";
  let targetSquare = null;
  if (typeof MAP_SQUARES !== 'undefined' && MAP_SQUARES[p.position]) {
    targetSquare = MAP_SQUARES[p.position];
    squareLocation = targetSquare.location || "";
    applySquareEffects(p, targetSquare);
  }

  if (!(typeof isPCEventMode !== 'undefined' && isPCEventMode)) {
    p.location = squareLocation;
  }

  if (window.boardManager) {
    window.boardManager.draw(players, activePlayerIndex);
  }

  renderLocationPlayersList();
  updateCurrentPlayerDisplay();

  // ❌ 修正：ここに残っていた「 0秒目で即座にモーダルを開く handleForceStopSquare 」の記述を完全に削除しました！

  // 🎯 パーツ7の遅延表示関数を呼び出すために、出目と止まったマスを安全に中継
  triggerDelayedDisplay(resultNum, targetSquare, resEl, eventBox);
}

function applySquareEffects(player, square) {
  const drinkAmount = square.drink !== undefined ? square.drink : 0;

  if (drinkAmount > 0) {
    if (!player.drinkCount) player.drinkCount = 0;
    player.drinkCount += drinkAmount;

    if (player.currentHp !== undefined) {
      player.currentHp = Math.max(0, player.currentHp - drinkAmount * 10);
    }
  }
}

// ─── pc.js : 3秒後の表示制御＆イベントモーダル定義 ───

function triggerDelayedDisplay(resultNum, targetSquare, resEl, eventBox) {
  setTimeout(() => {
    // 🎯 修正：スコープエラーを完全に直すため、タイマー内で再度DOM要素を安全に再取得して上書きします
    const innerResEl = document.getElementById("roulette-result-display");
    const innerEventBox = document.getElementById("event-text");
    const tileDescEl = document.getElementById("current-tile-desc");
    const p = players[activePlayerIndex];

    if (innerResEl) innerResEl.textContent = `🎯 出目: ${resultNum}`;

    if (typeof isPCEventMode !== 'undefined' && isPCEventMode) {
      console.log(`[PCイベント中] 出目 ${resultNum} で停止。スマホ側の結果判定を待ちます。`);
      return; 
    }

    if (targetSquare && p) {
      if (innerEventBox) {
        innerEventBox.innerHTML = `<p class="event-msg" style="font-size: 1.4rem; font-weight: bold; color: var(--primary-color);">${targetSquare.text || "何もないマスです。"}</p>`;
      }

      if (tileDescEl) {
        let drinkInfo = targetSquare.drink ? `<br><span style="color:#e74c3c; font-weight:bold;">🍺 飲酒ペナルティ: ${targetSquare.drink} 杯 (HP -${targetSquare.drink * 10})</span>` : "";
        let locInfo = targetSquare.location ? `<br>📍 場所: ${targetSquare.location}` : "";
        tileDescEl.innerHTML = `<strong>${targetSquare.text || "何もないマスです。"}</strong>${drinkInfo}${locInfo}`;
      }

      const isJobSquare = targetSquare.type === "jobChallenge" || targetSquare.jobId || (targetSquare.text && targetSquare.text.includes("【役職マス】"));
      if (isJobSquare && !p.hasJob) {
        const jobId = targetSquare.jobId || targetSquare.type || "unknown_job";
        const jobName = targetSquare.text ? targetSquare.text.replace(/【役職マス】/g, "").trim() : "新しい役職";

        console.log("役職マスに到達しました。スマホへダイアログ表示を要求します:", { jobId, jobName });
        socket.emit("triggerJobChoice", {
          roomCode: roomCode,
          playerId: p.id,
          jobId: jobId,
          jobName: jobName
        });
      }
    }

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
        skipTurn: pl.skipTurn,
        hasJob: pl.hasJob !== undefined ? pl.hasJob : false,
        jobId: pl.jobId || null,
        job: pl.job || "モブ"
      }))
    });
  }, 3000);
}

const GAME_EVENTS = {
  入学式: {
    class: "theme-entrance",
    title: "🌸 入学式 🌸",
    desc: (name) => `${name} さんの大学生活がスタート！最初の新歓イベントに向けてルーレットを回そう！`,
  },
  カップル: {
    class: "theme-couple",
    title: "💕 カップル成立チャンス！？ 💕",
    desc: (name) => `${name} さんがカップルマスに到着！運命 of 1回目スピンを回して【偶数】を狙え！`,
  },
  ランクアップ: {
    class: "theme-rankup",
    title: "🔥 ランクアップチャンス 🔥",
    desc: (name) => `${name} さんの実力が試される時！ルーレットで【4以上】を出して上位役職へ這い上がれ！`,
  },
  引退: {
    class: "theme-retirement",
    title: "🎓 サークル引退式 🎓",
    desc: (name) => `${name} さん、これまでの思い出を胸に引退！最後の特大乾杯イベントが始まる...！`,
  },
};

function generateCoupleTargetTable(activePlayerId) {
  const otherPlayers = players.filter(
    (p) => String(p.id) !== String(activePlayerId),
  );

  let html = `<div class="event-title" style="font-size:1.4rem; color:#d81b60; margin-bottom:10px;">💖 告白相手の決定対応表</div><ul class="event-table-list">`;

  for (let i = 1; i <= 10; i++) {
    let targetText = '<span style="color:#aaa;">（誰もなし：告白失敗）</span>';

    if (i % 2 === 1 && otherPlayers.length > 0) {
      const idx = Math.floor((i - 1) / 2) % otherPlayers.length;
      targetText = `<span style="color:#e91e63; font-weight:bold;">👤 ${otherPlayers[idx].name} に告白！ (カップル成立)</span>`;
    }

    html += `<li class="event-table-item"><div class="event-table-num-badge">${i}</div><div>${targetText}</div></li>`;
  }
  html += `</ul>`;
  return html;
}

function openPCEventModal(eventType, playerName, activePlayerId) {
  isPCEventMode = true;
  const pcModal = document.getElementById("pc-event-modal");
  if (!pcModal) return;

  const config = GAME_EVENTS[eventType];
  if (!config) return;

  pcModal.className = "event-modal-overlay";
  pcModal.classList.add("active", config.class);

  let tableHTML = "";

  if (eventType === "カップル") {
    tableHTML = `
      <div class="event-table-title">🎯 1回目：運命 of 判定条件</div>
      <ul class="event-table-list">
        <li class="event-table-item" style="border-left: 6px solid #ff4081; background: #fff0f5;"><div class="event-table-num-badge">偶</div> <strong>💕 偶数：告白チャンス突入！ (2回目のスピンへ)</strong></li>
        <li class="event-table-item" style="border-left: 6px solid #555555;"><div class="event-table-num-badge">奇</div> <strong>💦 奇数：失敗... フラれて終了</strong></li>
      </ul>
    `;
  } else if (eventType === "ランクアップ") {
    tableHTML = `
      <div class="event-table-title">🎯 ランクアップ条件</div>
      <ul class="event-table-list">
        <li class="event-table-item" style="border-left: 6px solid #ffca28; background: #fffde7;"><div class="event-table-num-badge">4〜10</div> <strong>🔥 ランクアップ成功！ 上位役職へ昇格！</strong></li>
        <li class="event-table-item" style="border-left: 6px solid #555555;"><div class="event-table-num-badge">1〜3</div> <strong>💦 ランクアップ失敗... 現状維持</strong></li>
      </ul>
    `;
  } else {
    tableHTML = `<div class="event-table-title">👥 出目ごとのターゲットプレイヤー</div><ul class="event-table-list">`;
    const playerNames = players.length > 0 ? players.map((p) => p.name) : ["プレイヤー1"];
    for (let i = 1; i <= 10; i++) {
      let targetText = '<span style="color:#aaa;">（何もなし）</span>';
      if (i % 2 === 1) {
        const playerIndex = Math.floor((i - 1) / 2) % playerNames.length;
        targetText = `<span style="color:#2196f3; font-weight:bold;">👤 ${playerNames[playerIndex]}</span>`;
      }
      tableHTML += `<li class="event-table-item"><div class="event-table-num-badge">${i}</div><div>${targetText}</div></li>`;
    }
    tableHTML += `</ul>`;
  }

  pcModal.innerHTML = `
    <div class="event-card-container">
      <div class="event-title">${config.title}</div>
      <div class="event-desc">${config.desc(playerName)}</div>
      <div class="event-main-flex">
        <div class="event-roulette-area">
          <div class="event-roulette-container">
            <div class="event-roulette-pointer"></div>
            <div class="event-roulette-wheel">
              <div class="roulette-num num-1">1</div>
              <div class="roulette-num num-2">2</div>
              <div class="roulette-num num-3">3</div>
              <div class="roulette-num num-4">4</div>
              <div class="roulette-num num-5">5</div>
              <div class="roulette-num num-6">6</div>
              <div class="roulette-num num-7">7</div>
              <div class="roulette-num num-8">8</div>
              <div class="roulette-num num-9">9</div>
              <div class="roulette-num num-10">10</div>
            </div>
          </div>
          <div class="event-highlight-text" style="margin-top:10px;">スマホからルーレットを回してね！</div>
        </div>
        <div class="event-table-area" id="pc-event-table-dynamic-zone">
          ${tableHTML}
        </div>
      </div>
    </div>
  `;
}

function handleForceStopSquare(player, square) {
  switch (square.id) {
    case 15:
      console.log(`${player.name} が入学式で強制停止しました。`);
      openPCEventModal("入学式", player.name, player.id);
      break;

    case 35:
      console.log(`${player.name} がカップル成立マスで停止しました。イベント開始！`);
      openPCEventModal("カップル", player.name, player.id);
      socket.emit("triggerCoupleEvent", {
        roomCode: roomCode,
        playerId: player.id,
        playerName: player.name,
      });
      break;

    case 52:
      console.log(`${player.name} がランクアップチャンスで強制停止しました。`);
      openPCEventModal("ランクアップ", player.name, player.id);
      break;

    case 78:
      console.log(`${player.name} が引退マスで強制停止しました。`);
      openPCEventModal("引退", player.name, player.id);
      break;

    default:
      console.log(`${player.name} が強制ストップマスで停止しました。`);
      break;
  }
}
