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

    // 🎯 スマホルーレット角度テーブル
  const targetDegrees = [342, 306, 270, 234, 198, 162, 126, 90, 54, 18];
    currentRotation += 1800 + ((targetDegrees[resultNum - 1] - (currentRotation % 360) + 360) % 360);

    isSpinning = true;
    playMobileRouletteAnimation(resultNum, currentRotation, (finalSteps) => {
      isSpinning = false;
      console.log(`📱 [3. ルーレットを回す SUCCESS] スマホ画面の回転終了(出目: ${finalSteps})。大画面側ピンのトコトコ完全着地を静かに待機。`);
    });
  });

  // 🎯 【基本ルーティン：行程①】サーバーから手番交代のバトンを受信した瞬間
  socket.on("applyPlayerAction", (data) => {
    if (data.action === "turnUpdated") {
      window.hasConfirmedThisTurn = false;
      window.isLandedThisTurn = false;
      
      // 🎯 ターン開始時のマス位置を記憶（移動前の誤着火を完全防止）
      const curP = players[data.activePlayerIndex !== undefined ? data.activePlayerIndex : activePlayerIndex];
      window.turnStartPosition = curP ? Number(curP.position) : null;

      activePlayerIndex = data.activePlayerIndex !== undefined ? data.activePlayerIndex : activePlayerIndex;
      // （以下、既存の処理）
      console.log(`\n📱 [1.0 新ターン開始] 手番交代を受信。手番: ${data.activePlayerName}`);

      if (document.getElementById("current-player-banner")) {
        document.getElementById("current-player-banner").textContent = `TURN: ${data.activePlayerName || "プレイヤー"}`;
      }
      
      // 🔒 【重要】開始時イベント（分岐選択等）があるか確認するまで、ルーレットも次へも両方ロック！
      if (document.getElementById("btn-phone-spin")) document.getElementById("btn-phone-spin").disabled = true;
      if (document.getElementById("btn-phone-next")) document.getElementById("btn-phone-next").disabled = true;
      if (document.getElementById("roulette-result-display")) document.getElementById("roulette-result-display").textContent = "進路を選択してください";
      isSpinning = false;
    }
  });

  socket.on("startCustomEventSecondSpin", (data) => {
    const modal = document.getElementById("mobile-couple-event-modal");
    if (modal) {
      // 🎯 タイトルをイベント名に合わせて動的に書き換える
      const titleEl = modal.querySelector("h3") || modal.querySelector(".couple-title");
      if (titleEl) {
        titleEl.innerHTML = `🌸 ${data.nextStepEventName || "チャレンジ"} 🌸`;
      }

      const descEl = modal.querySelector(".couple-desc");
      if (descEl) {
        descEl.innerHTML = `運命の <b>${data.nextStepEventName || "判定"}</b> スピン！<br>ルーレットを回して結果を決定せよ！`;
      }

      const btnSpin = document.getElementById("btn-couple-spin");
      if (btnSpin) {
        btnSpin.style.display = "block";
        btnSpin.textContent = "🎲 判定ルーレットを回す！";
      }
      modal.style.display = "flex";
    }
  });

  socket.on("customEventFinished", (data) => {
    alert(data.message);
    const modal = document.getElementById("mobile-couple-event-modal");
    if (modal) modal.style.display = "none";
    if (document.getElementById("roulette-result-display")) document.getElementById("roulette-result-display").textContent = "🎯 タップして回そう！";
  });
  
  // ==========================================================================
  // 🧭 syncGameState 受信部（ブロック解除・確実実行版）
  // ==========================================================================
  socket.on("syncGameState", (data) => {
    console.log("📱 [DEBUG] syncGameState 受信成功:", data);
    if (!data) return;

    if (data.players && Array.isArray(data.players)) players = data.players;
    if (data.activePlayerIndex !== undefined) activePlayerIndex = data.activePlayerIndex;
    updatePhoneStatusDisplay();

    if (data.currentPhase) window.serverCurrentPhase = data.currentPhase;

    const currentIdx = data.activePlayerIndex !== undefined ? data.activePlayerIndex : activePlayerIndex;
    const p = players[currentIdx];
    if (!p) {
      console.log("🛑 [DEBUG] プレイヤー情報が存在しないため終了");
      return;
    }

    // 保険ボタンの更新
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

    // ------------------------------------------------------------------------
    // 🧭 行程②：ターン開始時イベント（進路選択チェック）
    // ------------------------------------------------------------------------
    const pos = Number(p.position);
    console.log(`📱 [DEBUG] 現在位置: ${pos}番マス, フェーズ: ${window.serverCurrentPhase}`);

    if ((pos === 0 || pos === 49) && !window.hasConfirmedThisTurn) {
      console.log("📱 [DEBUG] 分岐対象マスを検知。モーダル表示関数を直接実行します。");
      checkBranchSquareOnTurnStart(data);
    } else {
      console.log("📱 [DEBUG] 分岐なしマスまたは確定済み。ルーレット待機。");
      if (document.getElementById("btn-phone-spin")) document.getElementById("btn-phone-spin").disabled = false;
      if (document.getElementById("roulette-result-display")) document.getElementById("roulette-result-display").textContent = "🎯 タップして回そう！";
    }

    // ------------------------------------------------------------------------
    // 🧭 行程④：到着イベント（END_CHECK）
    // ------------------------------------------------------------------------
    if ((window.serverCurrentPhase === "4.END_CHECK" || window.serverCurrentPhase === "END_CHECK") && !window.isLandedThisTurn) {
      if (currentIdx !== activePlayerIndex) return;

      const currentPos = Number(p.position);

      // 🎯 【重要】まだルーレット移動前のマス（0番マスなど開始位置）にいる間のフライング電波は無視する！
      if (window.turnStartPosition !== null && currentPos === window.turnStartPosition) {
        console.log(`📱 [到着待機] まだ移動前(位置: ${currentPos})のため、到着判定を保留します。`);
        return;
      }

      window.isLandedThisTurn = true; // 🎯 実際にマスを移動した後の着地時のみ消費！
      console.log(`📱 [4.0 到着イベント] マスID: ${currentPos} のコンポーネント(sq_${currentPos}.js)をロードします...`);

      if (typeof loadAndApplySquareComponent === "function") {
        loadAndApplySquareComponent(currentPos, () => {
          let currentMode = "normal";
          const targetModule = window.SQ_MODULES && window.SQ_MODULES[currentPos] && window.SQ_MODULES[currentPos][currentMode];

          if (!targetModule) {
            console.log(`📱 [4.2 スキップ] マスID: ${currentPos} のモジュールが存在しません。`);
            return;
          }

          // 🚀 【役職マス】type が "jobChallenge" の場合
          if (targetModule.type === "jobChallenge" && targetModule.jobId) {
            // 🎯 既に役職を持っている場合は何もしない（スルー）
            if (p.hasJob === true) {
              console.log(`📱 [役職スキップ] 既に「${p.job}」に就職済みのため、役職マスをスルーします。`);
              socket.emit("playerAction", {
                roomCode: currentRoomCode,
                action: "squareEventFinished",
                updatedPlayer: p
              });
              return;
            }

            const jobName = targetModule.text ? targetModule.text.replace(/【役職マス】/g, "").trim() : "新しい役職";
            console.log(`📱 [4.2 就職モーダル表示] 役職: ${jobName} (ID: ${targetModule.jobId}) を展開！`);
            if (typeof showJobChoiceDialog === "function") {
              showJobChoiceDialog(targetModule.jobId, jobName, p.id);
            }
          }
          // 🚀 特殊マスの場合
          else if (typeof targetModule.event === "function") {
            console.log(`📱 [4.2 固有イベント実行] sq_${currentPos}.js の event() を起動！`);
            targetModule.event(p, targetModule);
          } 
          // 🚀 通常マスの場合
          else {
            console.log(`📱 [4.2 通常マス] イベント無しのマスです。`);
          }
        });
      }
    }
  });

  socket.on("enableNextTurnButton", () => {
    const btnNext = document.getElementById("btn-phone-next");
    if (btnNext) {
      console.log("📱 [⑥. 手動進行ボタン大点灯] ➔ ➔ サーバーから点灯合図(enableNextTurnButton)を受信！ロックマスクを安全に解除しました。");
      btnNext.disabled = false;
    }
  });
});
// 🧭 【一本道リレー：手順1】スマホで「ゲーム開始」が手動タップされた瞬間
socket.on("gameStarted", (data) => {
  if (data && data.players) players = data.players;
  console.log("📱 [①. 新ターン開始] ➔ サーバーからゲーム開始電波(gameStarted)を受信。ここで初めて手動操作権をロードします。");
  showScreen("phone-screen-play");
  activePlayerIndex = 0;
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

// ==========================================================================
// 🧭 【一本道リレー：手順1】スマホ側 ゲーム開始手動トリガー関数（完全修復版）
// サーバーの if (room) 防壁にシカトされてログすら出なくなっていた原因を完全粉砕！
// 手元メモリにある本物の部屋コード（currentRoomCode）を正確に梱包して、
// サーバー側へ 100% 確実に startGame の一本道始動バトンを直撃で叩き込みます！
// ==========================================================================
function sendStartGame() {
  console.log(`📱 [1.0 スマホ発信] ➔ ゲーム開始が手動タップされました。サーバーへ部屋コード [${currentRoomCode}] の一本道始動バトンを発射します！`);
  
  // 🎯 【核心の修正】誤字や文字のすれ違いを完全全廃。currentRoomCode を確実に渡す！
  socket.emit("startGame", { 
    roomCode: String(currentRoomCode).trim() 
  });
}

function requestSpin() {
  if (isSpinning) return;
  if (document.getElementById("btn-phone-spin")) document.getElementById("btn-phone-spin").disabled = true;
  if (document.getElementById("mobile-couple-event-modal")) document.getElementById("mobile-couple-event-modal").style.display = "none";
  console.log("📱 [③. ルーレットを回す Trigger] ➔ サーバーへ requestSpinRoulette 要求を発射します！");
  socket.emit("requestSpinRoulette", { roomCode: currentRoomCode });
}

function playMobileRouletteAnimation(finalSteps, targetRotation, callback) {
  const wheel = document.getElementById("controller-roulette-wheel");
  const resultDisplay = document.getElementById("roulette-result-display");
  if (document.getElementById("btn-phone-next")) document.getElementById("btn-phone-next").disabled = true; 
  if (resultDisplay) resultDisplay.textContent = "🌀 回転中...";
  if (wheel) { wheel.style.transition = "transform 3s cubic-bezier(0.15, 0.9, 0.2, 1)"; wheel.style.transform = `rotate(${targetRotation}deg)`; }
  setTimeout(() => {
    if (resultDisplay) resultDisplay.textContent = `🎯 出目: ${finalSteps}`;
    if (typeof callback === "function") callback(finalSteps);
  }, 3000);
}
function updatePhoneStatusDisplay() {
  const p = players[activePlayerIndex];
  if (!p) return;
  if (document.getElementById("phone-current-name")) document.getElementById("phone-current-name").textContent = p.name;
  if (document.getElementById("phone-current-job")) document.getElementById("phone-current-job").textContent = p.job || "モブ";
  if (document.getElementById("phone-current-hp")) document.getElementById("phone-current-hp").textContent = `${p.currentHp} / ${p.baseCap || 100}`;
  if (document.getElementById("phone-current-happiness")) document.getElementById("phone-current-happiness").textContent = `${p.happiness !== undefined ? p.happiness : 100} pt`;
}

// 🧭 【基本ルーティン：行程⑤】プレイヤーが手動で就職の「はい／いいえ」を確定させた瞬間
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
    const targetP = players[activePlayerIndex];
    if (targetP) {
      console.log(`📱 [⑤. 到着イベント数値処理の確定] ➔ 役職に「はい」が手動確定！サーバーへ squareEventFinished バトンを返送します！`);
      targetP.jobId = jobId; targetP.job = jobName; targetP.hasJob = true;
      socket.emit("playerAction", { roomCode: currentRoomCode, action: "squareEventFinished", updatedPlayer: targetP });
    }
    overlay.style.display = "none";
  });
  newBtnNo.addEventListener("click", () => {
    const targetP = players[activePlayerIndex];
    if (targetP) {
      console.log(`📱 [⑤. 到着イベント数値処理の確定] ➔ 役職に「いいえ」が手動確定！サーバーへ squareEventFinished バトンを返送します！`);
      targetP.hasJob = false;
      socket.emit("playerAction", { roomCode: currentRoomCode, action: "squareEventFinished", updatedPlayer: targetP });
    }
    overlay.style.display = "none";
  });
  overlay.style.display = "flex";
}

// 🧭 【基本ルーティン：行程⑥】手動進行でボタンをタップし、次の手番交代へバトンを繋ぐ瞬間
function sendNextTurn() {
  console.log("📱 [⑥. 手動進行 Trigger] ➔ カチッと手動交代されました！サーバーへ次ターン要求（nextTurn）を発射します。");
  socket.emit("playerAction", { roomCode: currentRoomCode, action: "nextTurn" });
  if (document.getElementById("btn-phone-next")) document.getElementById("btn-phone-next").disabled = true; 
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("#btn-debug-warp");
  if (!btn) return;
  e.preventDefault();
  const targetVal = document.getElementById("input-debug-square")?.value.trim();
  const targetSquareId = parseInt(targetVal, 10);
  if (isNaN(targetSquareId) || targetSquareId < 0 || targetSquareId > 99) { alert("0〜99の範囲で入力してください"); return; }
  console.log(`📱 [PHONE ACTION] 🛠️ デバッグワープ送信要求。ターゲットマスID: ${targetSquareId}`);
  socket.emit("debugWarp", { roomCode: currentRoomCode, targetSquareId: targetSquareId });
});

function checkBranchSquareOnTurnStart(syncData) {
  console.log("🔍 [DEBUG] checkBranchSquareOnTurnStart 実行開始");
  
  if (document.getElementById("route-select-modal")) {
    console.log("🛑 [DEBUG 停止理由] route-select-modal が既に存在するためリターン");
    return;
  }

  const currentIdx = syncData && syncData.activePlayerIndex !== undefined ? syncData.activePlayerIndex : activePlayerIndex;
  const currentPlayers = syncData && syncData.players ? syncData.players : players;
  
  console.log(`🔍 [DEBUG] currentIdx: ${currentIdx}, currentPlayers長: ${currentPlayers ? currentPlayers.length : "無し"}`);
  
  if (!currentPlayers || currentPlayers.length === 0) {
    console.log("🛑 [DEBUG 停止理由] currentPlayers が空のためリターン");
    return;
  }
  
  const pObj = currentPlayers[currentIdx];
  console.log("🔍 [DEBUG] pObj:", pObj, "hasConfirmed:", window.hasConfirmedThisTurn);

  if (!pObj) {
    console.log("🛑 [DEBUG 停止理由] pObj が存在しないためリターン");
    return;
  }
  if (window.hasConfirmedThisTurn === true) {
    console.log("🛑 [DEBUG 停止理由] hasConfirmedThisTurn が true のためリターン");
    return;
  }
  if (Number(pObj.position) !== 0 && Number(pObj.position) !== 49) {
    console.log(`🛑 [DEBUG 停止理由] position が 0 または 49 ではない (${pObj.position}) ためリターン`);
    return;
  }

  console.log("✅ [DEBUG] すべての関門を突破！モーダルを DOM に挿入します。");
  // （以下、HTML生成処理へ続く）
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

  const btnA = document.getElementById("btn-route-a"); const btnB = document.getElementById("btn-route-b"); const btnConfirm = document.getElementById("btn-route-confirm");
  let tempSelectedIdx = null;

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
    console.log(`📱 [2.1 進路確定] ルートインデックス: ${tempSelectedIdx} を選択。ルーレット待機へ。`);
    socket.emit("confirmRouteSelection", { roomCode: currentRoomCode, chosenRouteIdx: tempSelectedIdx });
    document.getElementById("route-select-modal")?.remove();

    // 確定したのでルーレットボタンを点灯
    if (document.getElementById("btn-phone-spin")) document.getElementById("btn-phone-spin").disabled = false;
    if (document.getElementById("roulette-result-display")) document.getElementById("roulette-result-display").textContent = "🎯 タップして回そう！";
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
