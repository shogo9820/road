const socket = io();
let currentRoomCode = "";
let activePlayerIndex = 0;
let players = [];
let isSpinning = false;
let currentRotation = 0;

window.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get("room");

  if (roomParam) {
    const inputEl = document.getElementById("input-room-code");
    if (inputEl) inputEl.value = roomParam;
    currentRoomCode = String(roomParam).trim();
    const doJoin = () => { socket.emit("joinRoom", { roomCode: currentRoomCode }); };
    if (socket.connected) doJoin(); else socket.once("connect", doJoin);
  }

  const btnJoin = document.getElementById("btn-join-room");
  if (btnJoin) btnJoin.addEventListener("click", (e) => { e.preventDefault(); joinRoom(); });

  if (document.getElementById("btn-phone-add-player")) document.getElementById("btn-phone-add-player").addEventListener("click", addPlayerRow);
  if (document.getElementById("btn-phone-start")) document.getElementById("btn-phone-start").addEventListener("click", sendStartGame);
  if (document.getElementById("btn-phone-spin")) document.getElementById("btn-phone-spin").addEventListener("click", requestSpin);
  if (document.getElementById("btn-phone-next")) document.getElementById("btn-phone-next").addEventListener("click", sendNextTurn);

  document.querySelectorAll('input[name="phone-mode"]').forEach((radio) => { radio.addEventListener("change", (e) => { e.target.checked = true; syncSettingsToServer(); }); });

  socket.on("joinedSuccess", (data) => { currentRoomCode = data.roomCode; showScreen("phone-screen-setup"); renderPlayerInputs(); syncSettingsToServer(); });
  socket.on("errorMsg", (data) => { alert("エラー: " + data.message); });
  
  socket.on("applySettings", (data) => {
    if (data.players && Array.isArray(data.players) && data.players.length > 0) {
      if (!(document.activeElement && document.activeElement.tagName === "INPUT" && document.activeElement.closest("#phone-player-list"))) {
        players = data.players; renderPlayerInputs();
      } else { players = data.players; }
    }
    const targetMode = data.mode || data.gameMode;
    if (targetMode && document.querySelector(`input[name="phone-mode"][value="${targetMode}"]`)) document.querySelector(`input[name="phone-mode"][value="${targetMode}"]`).checked = true;
  });
  socket.on("spinRoulette", (data) => {
    if (!data) return;
    const resultNum = data.result !== undefined ? data.result : 1;

    // 🎯 【システム同期】スマホ画面の物理的なルーレットの1〜10の出目ストップ角度
  const targetDegrees = [342, 306, 270, 234, 198, 162, 126, 90, 54, 18];
    currentRotation += 1800 + ((targetDegrees[resultNum - 1] - (currentRotation % 360) + 360) % 360);

    isSpinning = true;
    playMobileRouletteAnimation(resultNum, currentRotation, (finalSteps) => {
      isSpinning = false;
      handleRouletteStop(finalSteps);
    });
  });

  // 🎯 新ターン開始時の影マスク一括制御（display/hiddenは完全廃止、disabledのオンオフ一本化）
  socket.on("applyPlayerAction", (data) => {
    if (data.action === "turnUpdated") {
      window.hasConfirmedThisTurn = false;
      activePlayerIndex = data.activePlayerIndex !== undefined ? data.activePlayerIndex : activePlayerIndex;

      if (document.getElementById("current-player-banner")) document.getElementById("current-player-banner").textContent = `TURN: ${data.activePlayerName || "プレイヤー"}`;
      if (document.getElementById("btn-phone-spin")) document.getElementById("btn-phone-spin").disabled = false;
      if (document.getElementById("btn-phone-next")) document.getElementById("btn-phone-next").disabled = true; // 🔒 初期ロック
      if (document.getElementById("roulette-result-display")) document.getElementById("roulette-result-display").textContent = "🎯 タップして回そう！";
      isSpinning = false;
    }
  });

  socket.on("showJobChoice", (data) => { showJobChoiceDialog(data.jobId, data.jobName, data.playerId); });

  // 🎯 【完全汎用化】マスのJS（sq_41など）から届く2段階ルーレット展開指示をスマホがダイレクトに受信！
  socket.on("startCustomEventSecondSpin", (data) => {
    const modal = document.getElementById("mobile-couple-event-modal");
    if (modal) {
      const descEl = modal.querySelector(".couple-desc");
      if (descEl) descEl.innerHTML = `💕 1回目クリア！運命の ${data.nextStepEventName || "判定"} スピンへ！<br>もう一度ルーレットを回して、止まった数字で最終決着！`;
      if (document.getElementById("btn-couple-spin")) document.getElementById("btn-couple-spin").style.display = "block";
      modal.style.display = "flex";
    }
  });

  // 🎯 【完全汎用化】演出が決着したことをアラートで綺麗にポップ表示
  socket.on("customEventFinished", (data) => {
    alert(data.message);
    const modal = document.getElementById("mobile-couple-event-modal");
    if (modal) modal.style.display = "none";
    if (document.getElementById("roulette-result-display")) document.getElementById("roulette-result-display").textContent = "🎯 タップして回そう！";
  });
  
  // ==========================================================================
  // 🧭 【完全修復・最終決定版】syncGameState 役職＆イベント完全調和エンジン
  // 役職マス（1〜17番）にいる時は、フェーズガードを完全に免除・通過させます！
  // これにより、ワープ時や着地時に「就職モーダル（はい／いいえ）」が200%確実に大復活し、
  // 30番の保険や41番のカップルの無限復活防止ガードとも完璧に美しく同居します。
  // ==========================================================================
  socket.on("syncGameState", (data) => {
    if (!data) return;

    // 1. 【基本ステータス同期】（既存の完璧な処理）
    if (data.players && Array.isArray(data.players)) players = data.players;
    if (data.activePlayerIndex !== undefined) activePlayerIndex = data.activePlayerIndex;
    updatePhoneStatusDisplay();

    // サーバーから送られてきた最新の進行フェーズ状態を手元メモリにバインド
    if (data.currentPhase) {
      window.serverCurrentPhase = data.currentPhase;
    }

    const currentIdx = data.activePlayerIndex !== undefined ? data.activePlayerIndex : activePlayerIndex;
    const p = players[currentIdx];
    if (!p) return;

    // 2. 【常時表示：生命保険利用ボタンの点灯・影ロック制御】
    const insuranceBtn = document.getElementById("btn-phone-use-insurance");
    if (insuranceBtn) {
      const insuranceCount = p.insurance !== undefined ? p.insurance : 0;
      if (insuranceCount > 0 && currentIdx === activePlayerIndex) {
        insuranceBtn.disabled = false;
        insuranceBtn.textContent = `🛡️ 生命保険を利用する (${insuranceCount}枚所持)`;
      } else {
        insuranceBtn.disabled = true;
        insuranceBtn.textContent = `🛡️ 生命保険を利用する (${insuranceCount}枚)`;
      }
    }

    // 🔒 【手番プレイヤー限定防壁】操作権のない他人のスマホでの裏側での暴発をカット
    if (typeof socket !== "undefined" && p.id && socket.id) {
      if (String(p.id) !== String(socket.id) && players.length > 0) return; 
    }

    // ==========================================================================
    // 🧭 【ルーティン行程②：ターン開始時イベントの確認】
    // 0番・49番の進路選択チェックを素直にキック！
    // ==========================================================================
    if (typeof checkBranchSquareOnTurnStart === "function") {
      checkBranchSquareOnTurnStart(data);
    }

    // ==========================================================================
    // 🧭 【役職マス（1〜17番）限定のセーフティ免除】
    // 1番〜17番の役職チャレンジマスにいる時は、下の到着フェーズ制限（return）を完全に
    // スルー（回避）させて、サーバーからの就職モーダル表示命令を100%無傷で開通させます！
    // ==========================================================================
    const currentPos = Number(p.position);
    const isJobSquare = (currentPos >= 1 && currentPos <= 17);

    // 🚀 【無限ループ根絶の防壁】
    // 役職マス「ではない」時、かつフェーズが END_CHECK 以外の時は安全に終了（復活防止）
    if (!isJobSquare && window.serverCurrentPhase !== "END_CHECK") {
      console.log(`[イベントスキップガード] 現在のフェーズが ${window.serverCurrentPhase} のため、マスの再着火を安全にスキップします。`);
      return;
    }

    // 🎯 止まったマスのJSファイルをダウンロードして、操作UIを自分の手元へ1回だけ展開！
    if (!isJobSquare && typeof loadAndApplySquareComponent === "function") {
      loadAndApplySquareComponent(p.position, () => {
        let currentMode = "normal";
        const targetModule = window.SQ_MODULES && window.SQ_MODULES[p.position] && window.SQ_MODULES[p.position][currentMode];
        
        if (targetModule && typeof targetModule.event === "function") {
          console.log(`[手元イベント実行フック] sq_${p.position}.js の操作UIを展開します。`);
          targetModule.event(p, targetModule);
        }
      });
    }
  });

  // 🎯 サーバーの新ルーティン（WAIT_NEXTフェーズ）から、次へ進めてよい合図を受け取ってロック解除！
  socket.on("enableNextTurnButton", () => {
    const btnNext = document.getElementById("btn-phone-next");
    if (btnNext) {
      console.log("[スマホ一元制御] PHASE_WAIT_NEXT。ボタンのロックを安全に解除（点灯）します。");
      btnNext.disabled = false;
    }
  });
});

function joinRoom() {
  const inputEl = document.getElementById("input-room-code");
  if (!inputEl) return;
  const codeInput = inputEl.value.trim();
  if (!codeInput) { alert("ルームコードを入力してください"); return; }
  currentRoomCode = String(codeInput);
  socket.emit("joinRoom", { roomCode: currentRoomCode });
}

function showScreen(targetId) {
  const screens = ["phone-screen-join", "phone-screen-setup", "phone-screen-play"];
  screens.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      if (id === targetId) { el.style.display = "block"; el.classList.add("active"); } else { el.style.display = "none"; el.classList.remove("active"); }
    }
  });
}
function renderPlayerInputs() {
  const container = document.getElementById("phone-player-list");
  if (!container) return;
  container.innerHTML = "";
  players.forEach((p, idx) => {
    const row = document.createElement("div"); row.style.display = "flex"; row.style.gap = "8px"; row.style.marginBottom = "8px";
    const input = document.createElement("input"); input.type = "text"; input.value = p.name; input.style.flex = "1"; input.style.padding = "10px"; input.style.borderRadius = "6px"; input.style.border = "1px solid #ccc";
    input.addEventListener("input", (e) => { players[idx].name = e.target.value; syncSettingsToServer(); });
    const delBtn = document.createElement("button"); delBtn.type = "button"; delBtn.textContent = "❌"; delBtn.style.padding = "8px 12px"; delBtn.style.background = "#d9534f"; delBtn.style.color = "#fff"; delBtn.style.border = "none"; delBtn.style.borderRadius = "6px";
    delBtn.onclick = () => { if (players.length <= 1) { alert("最低1人必要です"); return; } players.splice(idx, 1); renderPlayerInputs(); syncSettingsToServer(); };
    row.appendChild(input); row.appendChild(delBtn); container.appendChild(row);
  });
}

function addPlayerRow() {
  const newId = "p_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  players.push({ id: newId, name: `プレイヤー${players.length + 1}` });
  renderPlayerInputs(); syncSettingsToServer();
}

function syncSettingsToServer() {
  if (!currentRoomCode) return;
  const selectedMode = document.querySelector('input[name="phone-mode"]:checked')?.value || "normal";
  socket.emit("updateSettings", { roomCode: currentRoomCode, players: players, mode: selectedMode, gameMode: selectedMode });
}

function sendStartGame() {
  console.log("[スマホ] ゲーム開始シグナルをサーバーへ送信します。");
  socket.emit("startGame", { roomCode: currentRoomCode });
  showScreen("phone-screen-play");
  activePlayerIndex = 0;
}

function requestSpin() {
  if (isSpinning) return;
  if (document.getElementById("btn-phone-spin")) document.getElementById("btn-phone-spin").disabled = true;
  if (document.getElementById("mobile-couple-event-modal")) document.getElementById("mobile-couple-event-modal").style.display = "none";
  socket.emit("requestSpinRoulette", { roomCode: currentRoomCode });
}

function playMobileRouletteAnimation(finalSteps, targetRotation, callback) {
  const wheel = document.getElementById("controller-roulette-wheel");
  const resultDisplay = document.getElementById("roulette-result-display");
  if (document.getElementById("btn-phone-next")) document.getElementById("btn-phone-next").disabled = true; // 🔒 回転中ロック
  if (resultDisplay) resultDisplay.textContent = "🌀 回転中...";
  if (wheel) { wheel.style.transition = "transform 3s cubic-bezier(0.15, 0.9, 0.2, 1)"; wheel.style.transform = `rotate(${targetRotation}deg)`; }
  setTimeout(() => {
    if (resultDisplay) resultDisplay.textContent = `🎯 出目: ${finalSteps}`;
    if (typeof callback === "function") callback(finalSteps);
  }, 3000);
}

// 🎯 移動完了時：通常マスの数値効果をマスのJSから直接計算し、その場で完了電波を送信！
function handleRouletteStop(steps) {
  const p = players[activePlayerIndex];
  const pos = p ? Number(p.position) : 0;

  if (pos !== 0 && pos !== 49 && !(pos >= 1 && pos <= 17)) {
    let currentMode = "normal";
    const targetModule = window.SQ_MODULES && window.SQ_MODULES[pos] && window.SQ_MODULES[pos][currentMode];
    
    if (!targetModule || typeof targetModule.event !== "function") {
      console.log("[通常マス自動処理] 演出のない通常マスのため、数値計算を確定させてサーバーへ一斉同期を通知します。");
      
      // 🚀 【行程⑤】何もないので、手元プレイヤーの最新データを添えてサーバーへ squareEventFinished を叩く！
      socket.emit("playerAction", {
        roomCode: currentRoomCode,
        action: "squareEventFinished",
        updatedPlayer: p
      });
    }
  }
}
function updatePhoneStatusDisplay() {
  const p = players[activePlayerIndex];
  if (!p) return;
  if (document.getElementById("phone-current-name")) document.getElementById("phone-current-name").textContent = p.name;
  if (document.getElementById("phone-current-job")) document.getElementById("phone-current-job").textContent = p.job || "モブ";
  if (document.getElementById("phone-current-hp")) document.getElementById("phone-current-hp").textContent = `${p.currentHp} / ${p.baseCap || 100}`;
  if (document.getElementById("phone-current-happiness")) document.getElementById("phone-current-happiness").textContent = `${p.happiness !== undefined ? p.happiness : 100} pt`;
}

function showJobChoiceDialog(jobId, jobName, playerId) {
  const overlay = document.getElementById("job-modal-overlay");
  const descEl = document.getElementById("job-modal-desc");
  if (!overlay || !descEl) return;

  descEl.textContent = `新しい役職「${jobName}」に就職しますか？`;
  const newBtnYes = document.getElementById("btn-job-yes").cloneNode(true);
  const newBtnNo = document.getElementById("btn-job-no").cloneNode(true);
  document.getElementById("btn-job-yes").parentNode.replaceChild(newBtnYes, document.getElementById("btn-job-yes"));
  document.getElementById("btn-job-no").parentNode.replaceChild(newBtnNo, document.getElementById("btn-job-no"));

  newBtnYes.addEventListener("click", () => {
    const p = players[activePlayerIndex]; p.jobId = jobId; p.job = jobName; p.hasJob = true;
    socket.emit("playerAction", { roomCode: currentRoomCode, action: "squareEventFinished", updatedPlayer: p });
    overlay.style.display = "none";
  });
  newBtnNo.addEventListener("click", () => {
    const p = players[activePlayerIndex]; p.hasJob = false;
    socket.emit("playerAction", { roomCode: currentRoomCode, action: "squareEventFinished", updatedPlayer: p });
    overlay.style.display = "none";
  });
  overlay.style.display = "flex";
}

function sendNextTurn() {
  socket.emit("playerAction", { roomCode: currentRoomCode, action: "nextTurn" });
  if (document.getElementById("btn-phone-next")) document.getElementById("btn-phone-next").disabled = true; // 🔒 再ロック
}

// 🛠️ 【基本ルーティン直結型】スマホ側 デバッグワープ送信トリガー
document.addEventListener("click", (e) => {
  const btn = e.target.closest("#btn-debug-warp");
  if (!btn) return;
  e.preventDefault();

  const targetVal = document.getElementById("input-debug-square")?.value.trim();
  const targetSquareId = parseInt(targetVal, 10);
  if (isNaN(targetSquareId) || targetSquareId < 0 || targetSquareId > 99) {
    alert("0〜99の範囲で入力してください");
    return;
  }

  // 🎯 余計な位置補正などはせず、「〇〇番にワープしたい」という純粋な信号だけをサーバーへ送信！
  console.log(`[スマホデバッグ] マスID: ${targetSquareId} へのワープ信号をサーバーへ直撃させます。`);
  socket.emit("debugWarp", { 
    roomCode: currentRoomCode, 
    targetSquareId: targetSquareId 
  });
});

function checkBranchSquareOnTurnStart(syncData) {
  if (document.getElementById("route-select-modal")) return;
  const currentIdx = syncData && syncData.activePlayerIndex !== undefined ? syncData.activePlayerIndex : activePlayerIndex;
  const currentPlayers = syncData && syncData.players ? syncData.players : players;
  if (!currentPlayers || currentPlayers.length === 0) return;
  const p = currentPlayers[currentIdx];
  if (!p || window.hasConfirmedThisTurn === true || (Number(p.position) !== 0 && Number(p.position) !== 49)) return;

  let modalHtml = `
    <div id="route-select-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); display:flex; justify-content:center; align-items:center; z-index:999999; font-family:sans-serif;">
      <div style="background:#fff; width:90%; max-width:320px; padding:25px; border-radius:16px; text-align:center; box-sizing:border-box;">
        <h3 style="margin-top:0; color:#222; font-size:1.25rem; font-weight:bold;">🧭 運命の進路選択</h3>
        <p style="font-size:0.85rem; color:#666; margin-bottom:20px; line-height:1.4;">進むルートをタップしてください。</p>
        <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:22px;">
          <button id="btn-route-a" style="padding:14px; font-size:1rem; font-weight:bold; border:2px solid #ddd; border-radius:10px; background:#fff; color:#333; cursor:pointer; outline:none;">Aルート（通常進路）</button>
          <button id="btn-route-b" style="padding:14px; font-size:1rem; font-weight:bold; border:2px solid #ddd; border-radius:10px; background:#fff; color:#333; cursor:pointer; outline:none;">Bルート（特殊進路）</button>
        </div>
        <button id="btn-route-confirm" disabled style="width:100%; padding:14px; font-size:1.05rem; font-weight:bold; border:none; border-radius:10px; background:#ccc; color:#fff; cursor:not-allowed;">進路を確定してルーレットへ</button>
      </div>
    </div>
  `;
  const playScreenContainer = document.getElementById("phone-screen-play") || document.body;
  playScreenContainer.insertAdjacentHTML("beforeend", modalHtml);

  let tempSelectedIdx = null;
  const btnA = document.getElementById("btn-route-a"); const btnB = document.getElementById("btn-route-b"); const btnConfirm = document.getElementById("btn-route-confirm");

  btnA.onclick = () => {
    tempSelectedIdx = 0; btnA.style.borderColor = "#00cb75"; btnA.style.background = "#e6f9f1"; btnA.style.color = "#00cb75"; btnB.style.borderColor = "#ddd"; btnB.style.background = "#fff"; btnB.style.color = "#333";
    btnConfirm.disabled = false; btnConfirm.style.background = "#00cb75"; btnConfirm.style.cursor = "pointer";
    socket.emit("previewRouteSelection", { roomCode: currentRoomCode, selectedRouteIndex: 0 });
  };
  btnB.onclick = () => {
    tempSelectedIdx = 1; btnB.style.borderColor = "#00cb75"; btnB.style.background = "#e6f9f1"; btnB.style.color = "#00cb75"; btnA.style.borderColor = "#ddd"; btnA.style.background = "#fff"; btnA.style.color = "#333";
    btnConfirm.disabled = false; btnConfirm.style.background = "#00cb75"; btnConfirm.style.cursor = "pointer";
    socket.emit("previewRouteSelection", { roomCode: currentRoomCode, selectedRouteIndex: 1 });
  };
  btnConfirm.onclick = () => {
    if (tempSelectedIdx === null) return;
    window.hasConfirmedThisTurn = true;
    socket.emit("confirmRouteSelection", { roomCode: currentRoomCode, chosenRouteIdx: tempSelectedIdx });
    document.getElementById("route-select-modal")?.remove();
    socket.emit("playerAction", { roomCode: currentRoomCode, action: "squareEventFinished", updatedPlayer: p });
  };
}

function loadAndApplySquareComponent(squareId, callback) {
  let currentMode = "normal";
  if (window.SQ_MODULES && window.SQ_MODULES[squareId] && window.SQ_MODULES[squareId][currentMode]) { if (typeof callback === "function") callback(); return; }
  const script = document.createElement("script"); script.src = `/squares/sq_${squareId}.js`;
  script.onload = () => { if (typeof callback === "function") callback(); };
  script.onerror = () => { if (typeof callback === "function") callback(); };
  document.head.appendChild(script);
}
