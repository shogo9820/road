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

    // 🎯 修正：サーバー側で自前生成された画像データURLをそのまま<img>にセットする
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

  // 🎯 完全修正：間違って混入したshowScreenを、元の正しいswitchScreenへ完全修復し、画面崩壊を100%解決します！
  socket.on("gameStarted", (data) => {
    if (data && data.players) players = data.players;
    
    // 💡 壊れていた部分を、PC側の正しい画面切り替え関数に完全修復！
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

  socket.on("applyPlayerAction", (data) => {
    if (data && data.action === "turnUpdated") {
      activePlayerIndex = data.activePlayerIndex;
      updateCurrentPlayerDisplay();
      if (window.boardManager) {
        window.boardManager.draw(players, activePlayerIndex);
      }
    }
  });

  // 🛠️【デバッグ専用】ワープ受信：指定マスに着地させて即座にイベントを起動
  socket.on("executeDebugWarp", (data) => {
    if (data.players) players = data.players;
    if (data.activePlayerIndex !== undefined)
      activePlayerIndex = data.activePlayerIndex;

    const p = players[activePlayerIndex];
    if (!p) return;

    // 盤面描画とステータス表示を更新
    if (window.boardManager) {
      window.boardManager.draw(players, activePlayerIndex);
    }
    updateCurrentPlayerDisplay();

    // ワープ先マスのデータを取得
    const targetSquare =
      typeof MAP_SQUARES !== "undefined"
        ? MAP_SQUARES[data.targetSquareId]
        : null;
    if (!targetSquare) return;

    p.location = targetSquare.location || "";
    applySquareEffects(p, targetSquare);
    updateCurrentPlayerDisplay();

    // マス説明文の更新
    const tileDescEl = document.getElementById("current-tile-desc");
    if (tileDescEl) {
      let drinkInfo = targetSquare.drink
        ? `<br><span style="color:#e74c3c; font-weight:bold;">🍺 飲酒ペナルティ: ${targetSquare.drink} 杯 (HP -${targetSquare.drink * 10})</span>`
        : "";
      let locInfo = targetSquare.location
        ? `<br>📍 場所: ${targetSquare.location}`
        : "";
      tileDescEl.innerHTML = `<strong>${targetSquare.text || "何もないマスです。"}</strong>${drinkInfo}${locInfo}`;
    }

    // マス特性に応じたイベントの直接起動
    if (
      targetSquare.type === "force_stop" ||
      targetSquare.type === "force_stop_rankup"
    ) {
      handleForceStopSquare(p, targetSquare);
    } else if (targetSquare.type === "jobChallenge" || targetSquare.jobId) {
      const jobId = targetSquare.jobId || targetSquare.type || "unknown_job";
      const jobName = targetSquare.text
        ? targetSquare.text.replace(/【役職マス】/g, "").trim()
        : "新しい役職";
      socket.emit("triggerJobChoice", {
        roomCode,
        playerId: p.id,
        jobId,
        jobName,
      });
    }
  });

  // 🎯 1回目偶数達成時：新設ボックスに成功を表示し、右側を表（告白相手）へ切り替え
  socket.on("startCoupleSecondRoulette", (data) => {
    const modalResultBox = document.getElementById("modal-event-result-box");
    if (modalResultBox) {
      modalResultBox.className = "event-result-box success";
      modalResultBox.innerHTML = "🔥 偶数達成！<br>運命の告白チャンス突入！";
      modalResultBox.style.display = "block";
    }

    const dynamicTableZone = document.getElementById(
      "pc-event-table-dynamic-zone",
    );
    if (dynamicTableZone && data.mapping) {
      let html = `<div class="event-title" style="font-size:1.3rem; color:#d81b60; margin-bottom:8px; font-weight:bold; border-bottom:2px solid #ff69b4; padding-bottom:4px;">💖 告白相手の決定対応表</div><ul class="event-table-list">`;

      for (let i = 1; i <= 10; i++) {
        const target = data.mapping[i];
        let targetText =
          '<span style="color:#aaa;">（誰もなし：告白失敗）</span>';

        if (target) {
          targetText = `<span style="color:#e91e63; font-weight:bold;">👤 ${target.name} に告白！ (成立)</span>`;
        }

        html += `<li class="event-table-item"><div class="event-table-num-badge" style="background:#ff4081;">${i}</div><div>${targetText}</div></li>`;
      }
      html += `</ul>`;
      dynamicTableZone.innerHTML = html;
    }
  });

  // 🎯 2回目決着時：新設ボックスに最終結果を表示し、余韻を持たせてからモーダルを閉じる
  socket.on("coupleEventFinished", (data) => {
    isPCEventMode = false;

    // 3秒のルーレット回転完了を待ってから結果テキストをモーダル内に表示
    setTimeout(() => {
      const modalResultBox = document.getElementById("modal-event-result-box");
      if (modalResultBox) {
        modalResultBox.style.display = "block";
        if (data.success) {
          modalResultBox.className = "event-result-box success";
          modalResultBox.innerHTML = `💕 カップル成立！！ 💕<br><span style="font-size:0.95rem;">${data.message || ""}</span>`;
        } else {
          modalResultBox.className = "event-result-box failure";
          modalResultBox.innerHTML =
            '💦 告白失敗... 💦<br><span style="font-size:0.95rem;">運命の人は別にいるさ！ドンマイ！</span>';
        }
      }

      // 結果をしっかり確認できるよう、さらに3秒間余韻を持たせてからモーダルを自動クローズ
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

// ==========================================================================
// 🎯 【完全修正版】複数交際（2股対応）プレイヤーカード表示アップデート
// 恋人が何人いても、すべての恋人の名前を「、」で繋いでリアルタイムに全員分表示します。
// ==========================================================================
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
    "#f44336", "#2196f3", "#4caf50", "#ff9800",
    "#9c27b0", "#00bcd4", "#e91e63", "#795548"
  ];

  const playerCardEl = document.querySelector(".current-player-card");
  if (playerCardEl) {
    const playerColor = p.color || playerColors[activePlayerIndex % playerColors.length];
    playerCardEl.style.background = `linear-gradient(135deg, ${playerColor} 0%, #2575fc 100%)`;
  }

  // 💕 【2股・複数交際対応表示システム】
  const loverIconEl = document.getElementById("current-player-lover-icon");
  if (loverIconEl) {
    if (p.isLover && p.lovers && p.lovers.length > 0) {
      // 💡 恋人たちの名前を「、」で綺麗に結合して、人数に関わらず全員分大画面に表示！
      const loversListText = p.lovers.join("、");
      loverIconEl.innerHTML = `<span style="font-size: 0.95rem; font-weight: bold; color: #ffeb3b; background: rgba(0,0,0,0.2); padding: 2px 8px; border-radius: 20px;">💕 恋人: ${loversListText}</span>`;
      loverIconEl.style.display = "inline-block";
    } else if (p.isLover) {
      // 万が一名前データが無い場合の古い仕様へのフォールバック（ハートアイコン点灯）
      loverIconEl.innerHTML = "❤️";
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

  const happinessEl = document.getElementById("current-player-happiness");
  if (happinessEl) {
    const hpVal = p.happiness !== undefined ? p.happiness : 100;
    happinessEl.textContent = `${hpVal} pt`;
    if (hpVal >= 100) happinessEl.style.color = "#ffeb3b";
    else if (hpVal >= 50) happinessEl.style.color = "#ffffff";
    else hospitalityEl.style.color = "#ff8a80";
  }

  const locationEl = document.getElementById("current-player-location");
  if (locationEl) locationEl.textContent = p.location ? p.location : "-";

  renderLocationPlayersList();
}

// ─── pc.js : 選択ルートを自動判別して1歩ずつ進む移動探索システム ───
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
  if (eventBox) {
    eventBox.innerHTML = `<p class="event-msg" style="color: #666; font-weight: bold; animation: pulse 1s infinite;">🌀 ルーレット回転中... どこに止まるかな？ 🌀</p>`;
  }

  const targetDegrees = [342, 306, 270, 234, 198, 162, 126, 90, 54, 18];
  const stopAngle = targetDegrees[resultNum - 1];
  const currentMod = pcCurrentRotation % 360;
  pcCurrentRotation += 1800 + ((stopAngle - currentMod + 360) % 360);

  let wheel;
  if (typeof isPCEventMode !== "undefined" && isPCEventMode) {
    wheel = document.querySelector("#pc-event-modal .event-roulette-wheel") || 
            document.querySelector("#pc-couple-event-modal .event-roulette-wheel") ||
            document.querySelector("#pc-couple-event-modal .couple-wheel");
  } else {
    wheel = document.getElementById("controller-roulette-wheel") || document.getElementById("pc-roulette-wheel");
  }

  if (wheel) {
    wheel.style.transition = "transform 3s cubic-bezier(0.15, 0.9, 0.2, 1)";
    wheel.style.transform = `rotate(${pcCurrentRotation}deg)`;
  }

  if (typeof isPCEventMode !== "undefined" && isPCEventMode) {
    triggerDelayedDisplay(resultNum, null);
    return;
  }

  setTimeout(() => {
    if (resEl) resEl.textContent = `出目: ${resultNum}`;

    let stepsMoved = 0;

    const moveTimer = setInterval(() => {
      const currentSquare = MAP_SQUARES[p.position];

      if (stepsMoved > 0 && currentSquare && (currentSquare.type === "force_stop" || currentSquare.type === "force_stop_rankup")) {
        clearInterval(moveTimer);
        finalizeMovement();
        return;
      }

      if (stepsMoved >= resultNum || !currentSquare || !currentSquare.nextId || currentSquare.nextId.length === 0) {
        clearInterval(moveTimer);
        finalizeMovement();
        return;
      }

      // 🎯 【完全修正版】複数プレイヤー個別進路トレースロジック
      // サーバーから同期されたプレイヤー個人が持つ chosenRouteIdx を100%信用して進みます。
      const nextIdArray = currentSquare.nextId;
      if (Array.isArray(nextIdArray) && nextIdArray.length > 1) {
        // プレイヤー自身が持っている確定ルートインデックスを最優先で参照
        const routeIdx = (p.chosenRouteIdx !== undefined && p.chosenRouteIdx !== null) ? Number(p.chosenRouteIdx) : 0;
        p.position = Number(nextIdArray[routeIdx]); 
      } else {
        // 分岐ではない通常マスは、そのまま単一の接続先へ進む
        p.position = Number(Array.isArray(nextIdArray) ? nextIdArray[0] : nextIdArray);
      }
      
      stepsMoved++;
      if (window.boardManager) window.boardManager.draw(players, activePlayerIndex);
    }, 250);

    // 🎯 【完全復元】着地瞬間のイベント起動ロジック
    function finalizeMovement() {
      let targetSquare = null;
      if (typeof MAP_SQUARES !== "undefined" && MAP_SQUARES[p.position]) {
        targetSquare = MAP_SQUARES[p.position];
        p.location = targetSquare.location || "";
        applySquareEffects(p, targetSquare); 
      }

      if (window.boardManager) window.boardManager.draw(players, activePlayerIndex);
      renderLocationPlayersList();
      updateCurrentPlayerDisplay();

      if (targetSquare && (targetSquare.type === "jobChallenge" || targetSquare.jobId)) {
        const jobId = targetSquare.jobId || targetSquare.type || "unknown_job";
        const jobName = targetSquare.text ? targetSquare.text.replace(/【役職マス】/g, "").trim() : "新しい役職";
        console.log(`[役職マス通常着地] スマホへ直接役職モーダル出現を指示します: ${jobName}`);
        socket.emit("triggerJobChoice", { roomCode: roomCode, playerId: p.id, jobId, jobName });
      }

      if (p.chosenRouteIdx !== undefined) delete p.chosenRouteIdx; 

      if (targetSquare && (targetSquare.type === "force_stop" || targetSquare.type === "force_stop_rankup")) {
        handleForceStopSquare(p, targetSquare);
      }

      // 💡 ここで着地完了通知をキックする（この中に新システムを逃がします）
      triggerDelayedDisplay(resultNum, targetSquare);
    }
  }, 3000);
}

// ==========================================================================
// 🎯 【完全決定版】手番交代時の場所リセットバグ完全修正コード
// ルームにいる全プレイヤーの最新の滞在場所（location）をサーバーへ100%完璧に同期し、
// 他人の場所が「スタート前」に巻き戻るフリーズ現象を物理的に完全消滅させます。
// ==========================================================================
function triggerDelayedDisplay(resultNum, targetSquare) {
  if (!targetSquare) return;

  const eventBox = document.getElementById("event-text");
  if (eventBox) {
    eventBox.innerHTML = `<p class="event-msg" style="color: #2c3e50; font-weight: bold; font-size: 1.15rem;">🎲 ${targetSquare.text || "何もないマスのようです。"}</p>`;
  }

  // 🎯 【大修正】手番本人だけでなく、現在PC画面（メモリ）が持っている
  // ルームにいる「全員の最新の滞在場所（pl.location）」を何一つ落とさずにそのままサーバーへ送る！
  socket.emit("updateGameState", {
    roomCode: roomCode,
    activePlayerIndex: activePlayerIndex,
    players: players.map(pl => ({
      id: pl.id, 
      position: pl.position, 
      location: pl.location ? pl.location : "スタート前", // 👈 🎯ここ！全員の最新の滞在場所を確実に保護して送信！
      currentHp: pl.currentHp, 
      drinkCount: pl.drinkCount,
      happiness: pl.happiness !== undefined ? pl.happiness : 100, 
      isLover: pl.isLover, 
      skipTurn: pl.skipTurn,
      hasJob: pl.hasJob !== undefined ? pl.hasJob : false, 
      jobId: pl.jobId || null, 
      job: pl.job || "モブ"
    }))
  });

  if (targetSquare.type === "force_stop" || targetSquare.type === "force_stop_rankup" || targetSquare.type === "jobChallenge") {
    socket.emit("playerAction", {
      roomCode: roomCode,
      action: "squareEvent",
      targetSquare: targetSquare
    });
  }

  // すべての処理が終わったあとに先回りで非同期ロード（安全な既存システム）
  if (typeof loadAndApplySquareComponent === "function" && players && players[activePlayerIndex]) {
    const currentPosition = players[activePlayerIndex].position;
    loadAndApplySquareComponent(currentPosition, () => {
      console.log(`[先回り完了] マス ${currentPosition} のコンポーネントのロードに成功しました。`);
    });
  }
}

// 🎯 1箇所目：pc.js の112行目付近の syncGameState を、余計な割り込みを消して元の綺麗な状態に完全修復！
socket.on("syncGameState", (data) => {
  if (data.players && Array.isArray(data.players)) players = data.players;
  if (data.activePlayerIndex !== undefined) activePlayerIndex = data.activePlayerIndex;
  updateCurrentPlayerDisplay();
  if (window.boardManager) window.boardManager.draw(players, activePlayerIndex);
});

// ==========================================================================
// 🍻 【完全修正版】場所自動スキャン型・一斉乾杯モーダルシステム
// 同じ場所に2人以上が集まった瞬間、名前を自動集計して大画面中央に特大モーダルを展開！
// 巻き込まれた全員のお酒を＋1杯し、他の全ゲーム機能を完璧に保護します。
// ==========================================================================
function applySquareEffects(player, square) {
  // 1. お酒ペナルティの適用（元からある完璧な処理）
  const drinkAmount = square.drink !== undefined ? square.drink : 0;
  if (drinkAmount > 0) {
    if (!player.drinkCount) player.drinkCount = 0;
    player.drinkCount += drinkAmount;
    if (player.currentHp !== undefined) {
      player.currentHp = Math.max(0, player.currentHp - drinkAmount * 10);
    }
  }

  // 2. マスの幸福度増減を適用（元からある完璧な処理）
  const happinessChange = square.happiness !== undefined ? square.happiness : 0;
  if (happinessChange !== 0) {
    if (player.happiness === undefined) player.happiness = 100;
    player.happiness += happinessChange;
    console.log(`[幸福度変動] ${player.name}: ${happinessChange > 0 ? "+" : ""}${happinessChange} (現在値: ${player.happiness})`);
  }

  // 3. 肝臓HPが0（潰れた）場合のペナルティ・全回復処理（元からある完璧な処理）
  if (player.currentHp !== undefined && player.currentHp <= 0) {
    if (player.happiness === undefined) player.happiness = 100;
    player.happiness = Math.max(0, player.happiness - 30);
    player.skipTurn = true;
    const maxHp = (player.baseCap || 80) + (player.bonusCap || 0);
    player.currentHp = maxHp;
    alert(`🚨 【急性アルコール中毒！？】\n${player.name} は飲みすぎて潰れてしまった！\n・幸福度 -30\n・次のターンは1回休み（介抱）\n・肝臓HPが全回復しました。`);
  }

  // 🎯 4. 【新規追加】同じ場所にいる人で一斉乾杯＆特大モーダル出現システム
  // ※ 除外する場所パターン（「家」「スタート前」「-」または空っぽは除外）
  const loc = square.location ? square.location.trim() : "";
  if (loc !== "" && loc !== "家" && loc !== "スタート前" && loc !== "-") {
    
    // 現在同じ場所に滞在しているプレイヤー（手番プレイヤー自身を含む）を自動でスキャンして集計
    const drinkingBuddies = players.filter(p => p && p.location && p.location.trim() === loc);
    
    // 自分を含めて2人以上がその場所に揃った場合、特大乾杯イベントを発動！
    if (drinkingBuddies.length >= 2) {
      const pcModal = document.getElementById("pc-event-modal");
      if (pcModal) {
        isPCEventMode = true;

        // ターン交代の次へボタンを一旦無効化（乾杯をちゃんと確認させるため）
        const btnNext = document.getElementById("btn-next-turn");
        if (btnNext) {
          btnNext.disabled = true;
          btnNext.style.display = "none";
        }

        // 🍻 乾杯に参加する全員の名前を綺麗にリストアップ
        const buddyNames = drinkingBuddies.map(p => `👤 ${p.name}`).join("、");

        // モーダルのテーマをド派手なランクアップカラー（オレンジ）に強制着せ替え
        pcModal.className = "event-modal-overlay active theme-rankup";

        // HTML要素を動的に書き換えて特大ポップアップを中央に生成！
        const titleEl = document.getElementById("modal-event-title");
        const descEl = document.getElementById("modal-event-desc");
        if (titleEl) titleEl.textContent = "🍻 特大乾杯イベント発生！ 🍻";
        if (descEl) {
          descEl.innerHTML = `
            <div style="font-size: 1.25rem; line-height: 1.8; color: #fff; text-shadow: 1px 1px 3px rgba(0,0,0,0.5);">
              ${buddyNames} が<br>
              <span style="color: #ffeb3b; font-size: 2.2rem; font-weight: 900; display: inline-block; margin: 10px 0; padding: 4px 20px; background: rgba(0,0,0,0.3); border-radius: 10px;">📍 ${loc}</span> で<br>
              <span style="font-size: 2.5rem; font-weight: 900; color: #ffff00; animation: pulse 0.5s infinite;">✨🍻 乾杯！！！ 🍻✨</span>
            </div>
          `;
        }

        // 🎯 巻き込まれた全員のお酒の杯数をプラス1杯（肝臓HPマイナス10）するペナルティ！
        drinkingBuddies.forEach(p => {
          if (!p.drinkCount) p.drinkCount = 0;
          p.drinkCount += 1;
          if (p.currentHp !== undefined) {
            p.currentHp = Math.max(0, p.currentHp - 10);
          }
          
          // もしこの巻き込み乾杯で肝臓HPが0になって潰れた人がいたら、安全に潰れペナルティを起動
          if (p.currentHp !== undefined && p.currentHp <= 0) {
            if (p.happiness === undefined) p.happiness = 100;
            p.happiness = Math.max(0, p.happiness - 30);
            p.skipTurn = true;
            const maxHp = (p.baseCap || 80) + (p.bonusCap || 0);
            p.currentHp = maxHp;
            console.log(`[乾杯潰れ] ${p.name} が巻き込み乾杯により急性アルコール中毒で潰れました。`);
          }
        });

        // 3秒間しっかり大画面で乾杯の余韻を楽しませてから、手元の操作や次へボタンを自動復旧させる
        setTimeout(() => {
          pcModal.className = "event-modal-overlay";
          pcModal.style.display = "none";
          isPCEventMode = false;

          if (btnNext) {
            btnNext.disabled = false;
            btnNext.style.display = "block";
          }
          // 最新の乾杯ペナルティ数値を全員の画面へ反映
          updateCurrentPlayerDisplay();
        }, 3500);

        pcModal.style.display = "flex";
      }
    }
  }
}

const GAME_EVENTS = {
  入学式: {
    class: "theme-entrance",
    title: "🌸 入学式 🌸",
    desc: (name) =>
      `${name} さんの大学生活がスタート！最初の新歓イベントに向けてルーレットを回そう！`,
  },
  カップル: {
    class: "theme-couple",
    title: "💕 カップル成立チャンス！？ 💕",
    desc: (name) =>
      `${name} さんがカップルマスに到着！運命 of 1回目スピンを回して【偶数】を狙え！`,
  },
  ランクアップ: {
    class: "theme-rankup",
    title: "🔥 ランクアップチャンス 🔥",
    desc: (name) =>
      `${name} さんの実力が試される時！ルーレットで【4以上】を出して上位役職へ這い上がれ！`,
  },
  引退: {
    class: "theme-retirement",
    title: "🎓 サークル引退式 🎓",
    desc: (name) =>
      `${name} さん、これまでの思い出を胸に引退！最後の特大乾杯イベントが始まる...！`,
  },
  // 🎯 追加：元からあるイベントモーダル雛形へ、卒業判定専用のテーマとテキストを完全同期！
  卒業判定: {
    class: "theme-retirement", // 引退式と同じ格式高い重厚なテーマクラスを適用
    title: "🎓 運命の卒業判定チャンス 🎓",
    desc: (name) => `${name} さんの卒業を決める運命のルーレット！【6単位以上】取れたら卒業！`
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

  const btnNext = document.getElementById("btn-next-turn");
  if (btnNext) {
    btnNext.disabled = true;
    btnNext.style.display = "none";
  }

  const config = GAME_EVENTS[eventType];
  if (!config) return;

  pcModal.className = "event-modal-overlay";
  pcModal.classList.add("active", config.class);

  const titleEl = document.getElementById("modal-event-title");
  const descEl = document.getElementById("modal-event-desc");
  if (titleEl) titleEl.textContent = config.title;
  if (descEl) descEl.textContent = config.desc(playerName);

  const resultBox = document.getElementById("modal-event-result-box");
  if (resultBox) {
    resultBox.style.display = "none";
    resultBox.className = "event-result-box";
    resultBox.textContent = "";
  }

  let tableHTML = "";

  if (eventType === "カップル") {
    tableHTML = `
      <div class="event-table-title" style="font-size:1.3rem; color:#d81b60; margin-bottom:8px; font-weight:bold; border-bottom:2px solid #ff69b4; padding-bottom:4px;">
        🎯 1回目スピン：運命 of 判定条件表
      </div>
      <ul class="event-table-list">`;
    for (let i = 1; i <= 10; i++) {
      const isEven = i % 2 === 0;
      const badgeBg = isEven ? "#ff4081" : "#78909c";
      const text = isEven
        ? '<span style="color:#d81b60; font-weight:bold;">💕 偶数：告白チャンス突入！</span>'
        : '<span style="color:#546e7a;">💦 奇数：フラれて終了...</span>';
      tableHTML += `<li class="event-table-item"><div class="event-table-num-badge" style="background:${badgeBg};">${i}</div><div>${text}</div></li>`;
    }
    tableHTML += `</ul>`;
  } 
  // 🎯【追加：卒業判定の条件表】元からあるリストの見た目に100%合わせて、1〜10の条件を大画面に流し込む
  else if (eventType === "卒業判定") {
    tableHTML = `
      <div class="event-table-title" style="font-size:1.3rem; color:#e65100; margin-bottom:8px; font-weight:bold; border-bottom:2px solid #ff9800; padding-bottom:4px;">
        🎓 卒業判定：運命の単位数対応表
      </div>
      <ul class="event-table-list">`;
    for (let i = 1; i <= 10; i++) {
      const isPass = i >= 6;
      const badgeBg = isPass ? "#4caf50" : "#f44336";
      const text = isPass
        ? '<span style="color:#2e7d32; font-weight:bold;">🎓 6以上：【卒業】</span>'
        : '<span style="color:#c62828; font-weight:bold;">🚨 5以下：【留年】</span>';
      tableHTML += `<li class="event-table-item"><div class="event-table-num-badge" style="background:${badgeBg};">${i}</div><div>${text}</div></li>`;
    }
    tableHTML += `</ul>`;
  } 
  else {
    tableHTML = `<div class="event-table-title">👥 判定条件</div><p>イベントの準備中...</p>`;
  }

  const dynamicTableZone = document.getElementById("pc-event-table-dynamic-zone");
  if (dynamicTableZone) {
    dynamicTableZone.innerHTML = tableHTML;
  }

  const modalResEl = document.getElementById("modal-roulette-result-display");
  if (modalResEl) modalResEl.textContent = "🎯 スマホから運命の卒業スピンを回してね！";
}

// 🎯 完全修復：HTMLに存在しないIDエラーによるフリーズを完全粉砕！お指示の通り、99番(GOAL)着地時は元々ある完璧な着地処理(triggerDelayedDisplay)へ100%綺麗に流し込みます！
function handleForceStopSquare(player, square) {
  // 💡 完璧だった元の仕様：89番マス着地時は何もせず静かにピンを止めます
  if (square && square.id === 89) {
    console.log(`[卒業判定マス着地] 着地時は何もせず待機。次のターン開始時のイベント起動へ繋ぎます。`);
    return;
  }

  switch (square.id) {
    case 41:
      console.log(`${player.name} がカップル成立マスで停止しました。イベント開始！`);
      openPCEventModal("カップル", player.name, player.id);
      socket.emit("triggerCoupleEvent", {
        roomCode: roomCode,
        playerId: player.id,
        playerName: player.name,
      });
      break;

    // 💡【大修正】勝手なIDテキスト書き換えは全て消去！
    // 99番(GOAL)にピンが着地した瞬間に、元からある正しい着地処理(triggerDelayedDisplay)をキックして画面を100%綺麗に連動させます！
    case 99:
      console.log(`[ゴールマスイベント起動] ${player.name} 氏が99番GOALマスへ着地しました。`);
      
      // 💡 あなたが元から一番最初に作ってくれていた、正しいHTMLのIDを自動で書き換える関数をそのまま通過させる！
      if (typeof triggerDelayedDisplay === "function") {
        triggerDelayedDisplay(1, square);
      }

      // スマホ（手元）側へ向けて「➡ 次のプレイヤーへ」ボタンだけを出せと独立電波を送信！
      socket.emit("playerAction", {
        roomCode: roomCode,
        action: "showGraduateNextButton"
      });
      break;

    case 18: // 入学式
    case 30: // 生命保険
    case 49: // ランクアップ
    case 80: // 引退/ギャンブル
    default:
      console.log(`[開発デバッグ] マスID: ${square.id} は仕様未定のため、自動でスキップ処理を行います。`);

      const eventName =
        square.id === 18
          ? "入学式"
          : square.id === 30
            ? "生命保険"
            : square.id === 49
              ? "ランクアップ"
              : "引退";
      openPCEventModal(eventName, player.name, player.id);

      setTimeout(() => {
        console.log(`[開発デバッグ] 仕様未定マスのため、自動でモーダルをクローズして次の番へ進めます。`);
        socket.emit("playerAction", {
          roomCode: roomCode,
          action: "nextTurn",
        });

        const pcModal = document.getElementById("pc-event-modal");
        if (pcModal) {
          pcModal.classList.remove(
            "active",
            "theme-couple",
            "theme-entrance",
            "theme-rankup",
            "theme-retirement",
          );
          pcModal.style.display = "none";
        }
        isPCEventMode = false;
      }, 300);
      break;
  }
}

// 🎯 2箇所目：pc.js の【ファイルの本当の一番最後（最下部）】へ、以下の独立アンテナコードを丸ごとそのまま追記！
if (typeof socket !== "undefined") {
  // 💡 サーバーからの独立指示を受け取って、大画面モーダルを100%確実に強制展開させる！
  socket.on("showGraduateEvent", (data) => {
    console.log(`[大画面イベント強制起動] サーバーからの独立信号を受信しました。手番: ${data.playerName}`);
    if (typeof openPCEventModal === "function" && data) {
      openPCEventModal("卒業判定", data.playerName, data.playerId);
    }
  });

  // 💡 スマホでルーレットが止まった瞬間、大画面のイベントモーダルを100%確実に直接消去する！
  socket.on("closeGraduateModal", (data) => {
    console.log("[大画面イベント終了] 卒業判定モーダルをクローズします。");
    isPCEventMode = false;
    const pcModal = document.getElementById("pc-event-modal");
    if (pcModal) {
      pcModal.classList.remove("active", "theme-couple", "theme-entrance", "theme-rankup", "theme-retirement");
      pcModal.style.display = "none"; // 確実に非表示消去！
    }
  });
}

// ==========================================================================
// 🎯 【新規追記】マスコンポーネント自動実行ハブエンジン
// 既存のシステムや通信タイミングを1ミリも壊さずに、裏側でJSファイルを動的ロードします。
// ==========================================================================
function loadAndApplySquareComponent(squareId, callback) {
  // 現在のゲームモード（"normal", "short" 等）を取得（なければデフォルトは "normal"）
  let currentMode = "normal";
  if (typeof roomCode !== "undefined" && typeof rooms !== "undefined" && rooms[roomCode]) {
    currentMode = rooms[roomCode].mode || "normal";
  }

  // すでにブラウザがそのマスのJSをロード済みなら、そのまま即座に次の処理へ
  if (window.SQ_MODULES && window.SQ_MODULES[squareId] && window.SQ_MODULES[squareId][currentMode]) {
    if (typeof callback === "function") callback();
    return;
  }

  // まだ読み込まれていない場合は、非同期で public/squares/ フォルダからJSスクリプトを動的生成してロード
  const script = document.createElement("script");
  script.src = `/squares/sq_${squareId}.js`;
  
  script.onload = () => {
    console.log(`[コンポーネント読込成功] sq_${squareId}.js がシステムに結合されました (Mode: ${currentMode})`);
    // ロードが完了したら、バトンを既存の処理（callback）へ戻して完全に同じタイミングで実行
    if (typeof callback === "function") callback();
  };

  script.onerror = () => {
    // 万が一、ファイルがまだ空っぽだったり、読み込みエラーが起きてもゲームを絶対にフリーズさせない最強の防壁
    console.warn(`[ℹ️通知] sq_${squareId}.js がまだ未作成かロードできません。既存のマスターデータで進行します。`);
    if (typeof callback === "function") callback();
  };

  document.head.appendChild(script);
}
    // 5. コマが目的のマスに着地した瞬間に、ラグなしで同期と各種イベントを起動
    function finalizeMovement() {
      // 🎯 【新規配線】着地したマスのコンポーネントJSファイルを裏側で安全に動的ロードさせる！
      loadAndApplySquareComponent(p.position, () => {
        
        // 💡 ロード完了後に、元々あった完璧な着地処理を100%全く同じタイミングで実行します
        let targetSquare = null;
        if (typeof MAP_SQUARES !== "undefined" && MAP_SQUARES[p.position]) {
          targetSquare = MAP_SQUARES[p.position];
          p.location = targetSquare.location || "";
          applySquareEffects(p, targetSquare); // お酒や幸福度の効果計算
        }

        if (window.boardManager) window.boardManager.draw(players, activePlayerIndex);
        renderLocationPlayersList();
        updateCurrentPlayerDisplay();

        // スマホ役職モーダル大復活
        if (targetSquare && (targetSquare.type === "jobChallenge" || targetSquare.jobId)) {
          const jobId = targetSquare.jobId || targetSquare.type || "unknown_job";
          const jobName = targetSquare.text ? targetSquare.text.replace(/【役職マス】/g, "").trim() : "新しい役職";
          console.log(`[役職マス通常着地] スマホへ直接役職モーダル出現を指示します: ${jobName}`);
          socket.emit("triggerJobChoice", { roomCode: roomCode, playerId: p.id, jobId, jobName });
        }

        if (p.chosenRouteIdx !== undefined) delete p.chosenRouteIdx; // プレビューリセット

        // 強制ストップマスならPCモーダルを表示
        if (targetSquare && (targetSquare.type === "force_stop" || targetSquare.type === "force_stop_rankup")) {
          handleForceStopSquare(p, targetSquare);
        }

        // 位置データと通常イベント通知をサーバーへ送信
        triggerDelayedDisplay(resultNum, targetSquare);
      });
    }
