const socket = io();
let currentRoomCode = "";
let activePlayerIndex = 0;
let players = [];
let isSpinning = false;
let currentRotation = 0;

let coupleEventState = {
  active: false,
  step: 1,
  targetPlayerId: null
};

window.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get("room");

  if (roomParam) {
    const inputEl = document.getElementById("input-room-code");
    if (inputEl) inputEl.value = roomParam;
    currentRoomCode = String(roomParam).trim();

    const doJoin = () => {
      socket.emit("joinRoom", { roomCode: currentRoomCode });
    };

    if (socket.connected) {
      doJoin();
    } else {
      socket.once("connect", doJoin);
    }
  }

  const btnJoin = document.getElementById("btn-join-room");
  if (btnJoin) {
    btnJoin.addEventListener("click", (e) => {
      e.preventDefault();
      joinRoom();
    });
  }

  document.getElementById("btn-phone-add-player")?.addEventListener("click", addPlayerRow);
  document.getElementById("btn-phone-start")?.addEventListener("click", sendStartGame);
  document.getElementById("btn-phone-spin")?.addEventListener("click", requestSpin);
  document.getElementById("btn-phone-next")?.addEventListener("click", sendNextTurn);

  document.querySelectorAll('input[name="phone-mode"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      e.target.checked = true;
      syncSettingsToServer();
    });
  });

  socket.on("joinedSuccess", (data) => {
    currentRoomCode = data.roomCode;
    showScreen("phone-screen-setup");
    renderPlayerInputs();
    syncSettingsToServer();
  });

  socket.on("errorMsg", (data) => {
    alert("エラー: " + data.message);
  });
  socket.on("applySettings", (data) => {
    if (data.players && Array.isArray(data.players) && data.players.length > 0) {
      const activeEl = document.activeElement;
      const isUserTyping = activeEl && activeEl.tagName === "INPUT" && activeEl.closest("#phone-player-list");
      if (!isUserTyping) {
        players = data.players;
        renderPlayerInputs();
      } else {
        players = data.players;
      }
    }

    const targetMode = data.mode || data.gameMode;
    if (targetMode) {
      const targetRadio = document.querySelector(`input[name="phone-mode"][value="${targetMode}"]`);
      if (targetRadio) targetRadio.checked = true;
    }
  });

  socket.on("spinRoulette", (data) => {
    if (!data) return;
    const resultNum = data.result !== undefined ? data.result : 1;

  const targetDegrees = [342, 306, 270, 234, 198, 162, 126, 90, 54, 18];
    const stopAngle = targetDegrees[resultNum - 1];
    const currentMod = currentRotation % 360;
    currentRotation += 1800 + ((stopAngle - currentMod + 360) % 360);

    isSpinning = true;
    playMobileRouletteAnimation(resultNum, currentRotation, (finalSteps) => {
      isSpinning = false;

      if (coupleEventState.active) {
        const p = players[activePlayerIndex];
        if (p) {
          if (coupleEventState.step === 1) {
            socket.emit("coupleRouletteResult", { roomCode: currentRoomCode, playerId: p.id, result: finalSteps });
          } else if (coupleEventState.step === 2) {
            socket.emit("coupleSecondRouletteResult", { roomCode: currentRoomCode, playerId: p.id, result: finalSteps });
          }
        }
      } 
      else if (players[activePlayerIndex] && players[activePlayerIndex].position === 89 && players[activePlayerIndex].graduateChecked !== true) {
        const p = players[activePlayerIndex];
        socket.emit("playerAction", { roomCode: currentRoomCode, action: "graduateRouletteResult", playerId: p.id, result: finalSteps });
      } else {
        handleRouletteStop(finalSteps);
      }
    });
  });

  // 🎯 【完全修正版】display/hiddenの切り替えを1文字残さず完全撤去・全廃
  // ボタンは100%永久に常時表示。影（opacity）と触れるか（disabled）だけで完璧に制御します。
  socket.on("applyPlayerAction", (data) => {
    if (data.action === "turnUpdated") {
      window.hasConfirmedThisTurn = false;

      activePlayerIndex = data.activePlayerIndex !== undefined ? data.activePlayerIndex : activePlayerIndex;
      const activeName = data.activePlayerName || `プレイヤー`;

      const banner = document.getElementById("current-player-banner");
      if (banner) banner.textContent = `TURN: ${activeName}`;

      const spinBtn = document.getElementById("btn-phone-spin");
      if (spinBtn) spinBtn.disabled = false;

      // 🎯 新しいターンが始まった瞬間：ボタンは消さずに常時表示！
      // まだルーレットを回していない（触ってはいけない時）なので、半透明の影をかけるだけ
      const nextBtn = document.getElementById("btn-phone-next");
      if (nextBtn) {
        nextBtn.disabled = true;
        nextBtn.style.opacity = "0.35";          // 💡 半透明の影をかける
        nextBtn.style.pointerEvents = "none";    // 💡 物理的に触れなくする
        nextBtn.style.filter = "grayscale(80%)"; // 💡 視覚的に影であることを強調
      }

      const resultDisplay = document.getElementById("roulette-result-display");
      if (resultDisplay) resultDisplay.textContent = "🎯 タップして回そう！";
      isSpinning = false;
    }
  });

  // 役職選択ダイアログ受取
  socket.on("showJobChoice", (data) => {
    showJobChoiceDialog(data.jobId, data.jobName, data.playerId);
  });

  // カップルイベント受取
  socket.on("showCoupleEvent", (data) => {
    coupleEventState = { active: true, step: 1, targetPlayerId: null };

    document.body.classList.add("theme-couple");
    document.querySelector(".phone-screen .card")?.classList.add("theme-couple");
    document.querySelector(".phone-card")?.classList.add("theme-couple");

    const resultDisplay = document.getElementById("roulette-result-display");
    if (resultDisplay) {
      resultDisplay.innerHTML = `<span style="color: #d81b60; font-weight: bold; font-size: 1.1rem;">💖 カップルチャンス（1回目）<br>偶数を出して告白に進め！</span>`;
    }
  });

  socket.on("startCoupleSecondRoulette", (data) => {
    coupleEventState = { active: true, step: 2, targetPlayerId: data.targetPlayerId };
    const modal = document.getElementById("mobile-couple-event-modal");
    if (modal) {
      const descEl = modal.querySelector(".couple-desc");
      if (descEl) {
        descEl.innerHTML = `💕 偶数が出た！告白チャンス発動！<br>もう一度ルーレットを回して【割り振られたプレイヤー】に当たればカップル成立！`;
      }
      const btn = document.getElementById("btn-couple-spin");
      if (btn) btn.style.display = "block";
      modal.style.display = "flex";
    }
  });

  socket.on("coupleEventFinished", (data) => {
    alert(data.message);
    coupleEventState.active = false;
    coupleEventState.step = 1;

    document.body.classList.remove("theme-couple");
    document.querySelector(".phone-screen .card")?.classList.remove("theme-couple");
    document.querySelector(".phone-card")?.classList.remove("theme-couple");

    const modal = document.getElementById("mobile-couple-event-modal");
    if (modal) modal.style.display = "none";

    const resultDisplay = document.getElementById("roulette-result-display");
    if (resultDisplay) resultDisplay.textContent = "🎯 タップして回そう！";

    const nextBtn = document.getElementById("btn-phone-next");
    if (nextBtn) {
      nextBtn.disabled = false;
      nextBtn.style.opacity = "1.0";
      nextBtn.style.pointerEvents = "auto";
      nextBtn.style.filter = "none";
    }
  });

  socket.on("syncGameState", (data) => {
    if (data.players && Array.isArray(data.players)) players = data.players;
    if (data.activePlayerIndex !== undefined) activePlayerIndex = data.activePlayerIndex;
    updatePhoneStatusDisplay();
    if (typeof checkBranchSquareOnTurnStart === "function") {
      checkBranchSquareOnTurnStart();
    }
  });

  socket.on("enableNextTurnButton", () => {
    const btnNext = document.getElementById("btn-phone-next");
    if (btnNext) {
      console.log("[スマホ一元制御] 影マスクを解除してボタンを点灯します。");
      btnNext.disabled = false;
      btnNext.style.opacity = "1.0";
      btnNext.style.pointerEvents = "auto";
      btnNext.style.filter = "none";
    }
  });
});

function joinRoom() {
  const inputEl = document.getElementById("input-room-code");
  if (!inputEl) return;
  const codeInput = inputEl.value.trim();
  if (!codeInput) {
    alert("ルームコードを入力してください");
    return;
  }
  currentRoomCode = String(codeInput);
  socket.emit("joinRoom", { roomCode: currentRoomCode });
}

function showScreen(targetId) {
  const screens = ["phone-screen-join", "phone-screen-setup", "phone-screen-play"];
  screens.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      if (id === targetId) {
        el.style.display = "block";
        el.classList.add("active");
      } else {
        el.style.display = "none";
        el.classList.remove("active");
      }
    }
  });
}
function renderPlayerInputs() {
  const container = document.getElementById("phone-player-list");
  if (!container) return;
  container.innerHTML = "";

  players.forEach((p, idx) => {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "8px";
    row.style.marginBottom = "8px";

    const input = document.createElement("input");
    input.type = "text";
    input.value = p.name;
    input.style.flex = "1";
    input.style.padding = "10px";
    input.style.borderRadius = "6px";
    input.style.border = "1px solid #ccc";

    input.addEventListener("input", (e) => {
      players[idx].name = e.target.value;
      syncSettingsToServer();
    });

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.textContent = "❌";
    delBtn.style.padding = "8px 12px";
    delBtn.style.background = "#d9534f";
    delBtn.style.color = "#fff";
    delBtn.style.border = "none";
    delBtn.style.borderRadius = "6px";
    delBtn.onclick = () => {
      if (players.length <= 1) {
        alert("最低1人必要です");
        return;
      }
      players.splice(idx, 1);
      renderPlayerInputs();
      syncSettingsToServer();
    };

    row.appendChild(input);
    row.appendChild(delBtn);
    container.appendChild(row);
  });
}

function addPlayerRow() {
  const newId = "p_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  players.push({ id: newId, name: `プレイヤー${players.length + 1}` });
  renderPlayerInputs();
  syncSettingsToServer();
}

function syncSettingsToServer() {
  if (!currentRoomCode) return;
  const selectedMode = document.querySelector('input[name="phone-mode"]:checked')?.value || "normal";
  socket.emit("updateSettings", { roomCode: currentRoomCode, players: players, mode: selectedMode, gameMode: selectedMode });
}
function sendStartGame() {
  socket.emit("startGame", { roomCode: currentRoomCode });
  showScreen("phone-screen-play");
  activePlayerIndex = 0;
  setTimeout(() => {
    if (typeof checkBranchSquareOnTurnStart === "function") checkBranchSquareOnTurnStart(null);
  }, 150);
}

function requestSpin() {
  if (isSpinning) return;
  const spinBtn = document.getElementById("btn-phone-spin");
  if (spinBtn) spinBtn.disabled = true;
  const modal = document.getElementById("mobile-couple-event-modal");
  if (modal) modal.style.display = "none";
  socket.emit("requestSpinRoulette", { roomCode: currentRoomCode });
}

// 🎯 ルーレットが回り始めた瞬間（通常・デバッグ共通）のボタン常時表示ロック
function playMobileRouletteAnimation(finalSteps, targetRotation, callback) {
  const wheel = document.getElementById("controller-roulette-wheel");
  const resultDisplay = document.getElementById("roulette-result-display");
  const nextBtn = document.getElementById("btn-phone-next");

  // 🎯 ルーレット回転中：ボタンは1ミリも消さずに常時表示！
  // まだ移動が終わっていない（触ってはいけない時）なので、半透明の影マスク状態をガチッとキープ
  if (nextBtn) {
    nextBtn.disabled = true;
    nextBtn.style.opacity = "0.35";
    nextBtn.style.pointerEvents = "none";
  }
  
  if (resultDisplay) resultDisplay.textContent = "🌀 回転中...";

  if (wheel) {
    wheel.style.transition = "transform 3s cubic-bezier(0.15, 0.9, 0.2, 1)";
    wheel.style.transform = `rotate(${targetRotation}deg)`;
  }

  setTimeout(() => {
    if (resultDisplay) resultDisplay.textContent = `🎯 出目: ${finalSteps}`;
    if (typeof callback === "function") callback(finalSteps);
  }, 3000);
}

// 🎯 コマの通常移動アニメーションが完了した瞬間（押すべき時）
function handleRouletteStop(steps) {
  const nextBtn = document.getElementById("btn-phone-next");
  if (nextBtn) {
    console.log("[スマホ] 移動完了を検知。ボタンの影マスクを解除してピカッと点灯させます。");
    // 🎯 押すべき時：影をパッと消して、本来の明るさに戻して点灯！
    nextBtn.disabled = false;
    nextBtn.style.opacity = "1.0";
    nextBtn.style.pointerEvents = "auto";
    nextBtn.style.filter = "none";
  }
}

function updatePhoneStatusDisplay() {
  const p = players[activePlayerIndex];
  if (!p) return;

  const nameEl = document.getElementById("phone-current-name");
  if (nameEl) nameEl.textContent = p.name;

  const jobEl = document.getElementById("phone-current-job");
  if (jobEl) jobEl.textContent = p.job || "モブ";

  const hpEl = document.getElementById("phone-current-hp");
  if (hpEl) hpEl.textContent = `${p.currentHp} / ${p.baseCap || 100}`;

  const happinessEl = document.getElementById("phone-current-happiness");
  if (happinessEl) {
    happinessEl.textContent = `${p.happiness !== undefined ? p.happiness : 100} pt`;
  }
}
function showJobChoiceDialog(jobId, jobName, playerId) {
  const overlay = document.getElementById("job-modal-overlay");
  const descEl = document.getElementById("job-modal-desc");
  const btnYes = document.getElementById("btn-job-yes");
  const btnNo = document.getElementById("btn-job-no");

  if (!overlay || !descEl) return;

  descEl.textContent = `新しい役職「${jobName}」に就職しますか？\n（※一度就職すると、今後このイベントは発生しません）`;

  const newBtnYes = btnYes.cloneNode(true);
  const newBtnNo = btnNo.cloneNode(true);
  btnYes.parentNode.replaceChild(newBtnYes, btnYes);
  btnNo.parentNode.replaceChild(newBtnNo, btnNo);

  newBtnYes.addEventListener("click", () => {
    socket.emit("playerAction", { roomCode: currentRoomCode, action: "chooseJob", choice: "yes", jobId: jobId, jobName: jobName, playerId: playerId });
    overlay.style.display = "none";
  });

  newBtnNo.addEventListener("click", () => {
    socket.emit("playerAction", { roomCode: currentRoomCode, action: "chooseJob", choice: "no", playerId: playerId });
    overlay.style.display = "none";
  });

  overlay.style.display = "flex";
}

// 🎯 次のプレイヤーへ手動クリック時
// ※元の display: none 命令を完全抹消！タップされた瞬間は即座に半透明の影マスクロックに戻します
function sendNextTurn() {
  socket.emit("playerAction", { roomCode: currentRoomCode, action: "nextTurn" });

  const nextBtn = document.getElementById("btn-phone-next");
  if (nextBtn) {
    nextBtn.disabled = true;
    nextBtn.style.opacity = "0.35";
    nextBtn.style.pointerEvents = "none";
    nextBtn.style.filter = "grayscale(80%)";
  }
}

// 🛠 開発用デバッグワープ
document.addEventListener("click", (e) => {
  const btn = e.target.closest("#btn-debug-warp");
  if (!btn) return;

  e.preventDefault();
  const inputDebugSquare = document.getElementById("input-debug-square");
  if (!inputDebugSquare) return;

  const targetVal = inputDebugSquare.value.trim();
  if (targetVal === "") {
    alert("ワープ先のマス番号を入力してください");
    return;
  }

  const targetSquareId = parseInt(targetVal, 10);
  if (isNaN(targetSquareId) || targetSquareId < 0 || targetSquareId > 99) {
    alert("0〜99の範囲で数値を入力してください");
    return;
  }

  const roomCodeToSend = currentRoomCode || new URLSearchParams(window.location.search).get("room") || "";
  socket.emit("debugWarp", { roomCode: roomCodeToSend, targetSquareId: targetSquareId });
});

function checkBranchSquareOnTurnStart(syncData) {
  if (document.getElementById("route-select-modal")) return;

  const currentIdx = syncData && syncData.activePlayerIndex !== undefined ? syncData.activePlayerIndex : activePlayerIndex;
  const currentPlayers = syncData && syncData.players ? syncData.players : players;

  if (!currentPlayers || currentPlayers.length === 0) return;
  const p = currentPlayers[currentIdx];
  if (!p) return;

  if (window.hasConfirmedThisTurn === true) return;

  const playerPos = p.position !== undefined && p.position !== null ? Number(p.position) : 0;
  if (playerPos !== 0 && playerPos !== 49) return;

  let modalHtml = `
    <div id="route-select-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); display:flex; justify-content:center; align-items:center; z-index:999999; font-family:sans-serif;">
      <div style="background:#fff; width:90%; max-width:320px; padding:25px; border-radius:16px; text-align:center; box-sizing:border-box; box-shadow: 0 8px 24px rgba(0,0,0,0.3);">
        <h3 style="margin-top:0; color:#222; font-size:1.25rem; font-weight:bold;">🧭 運命の進路選択</h3>
        <p style="font-size:0.85rem; color:#666; margin-bottom:20px; line-height:1.4;">進むルートをタップすると、PC大画面のマップ上で選ばれなかった道に影が落ちます。</p>
        <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:22px;">
          <button id="btn-route-a" style="padding:14px; font-size:1rem; font-weight:bold; border:2px solid #ddd; border-radius:10px; background:#fff; color:#333; cursor:pointer; outline:none;">Aルート（通常進路）</button>
          <button id="btn-route-b" style="padding:14px; font-size:1rem; font-weight:bold; border:2px solid #ddd; border-radius:10px; background:#fff; color:#333; cursor:pointer; outline:none;">Bルート（特殊進路）</button>
        </div>
        <button id="btn-route-confirm" disabled style="width:100%; padding:14px; font-size:1.05rem; font-weight:bold; border:none; border-radius:10px; background:#ccc; color:#fff; cursor:not-allowed;">進路を確定してルーレットへ</button>
      </div>
    </div>
  `;

  const playScreenContainer = document.getElementById("phone-screen-play") || document.body;
  const oldModal = document.getElementById("route-select-modal");
  if (oldModal) oldModal.remove();
  playScreenContainer.insertAdjacentHTML("beforeend", modalHtml);

  let tempSelectedIdx = null;
  const btnA = document.getElementById("btn-route-a");
  const btnB = document.getElementById("btn-route-b");
  const btnConfirm = document.getElementById("btn-route-confirm");

  btnA.onclick = () => {
    tempSelectedIdx = 0;
    btnA.style.borderColor = "#00cb75"; btnA.style.background = "#e6f9f1"; btnA.style.color = "#00cb75";
    btnB.style.borderColor = "#ddd"; btnB.style.background = "#fff"; btnB.style.color = "#333";
    btnConfirm.disabled = false; btnConfirm.style.background = "#00cb75"; btnConfirm.style.cursor = "pointer";
    socket.emit("previewRouteSelection", { roomCode: currentRoomCode, selectedRouteIndex: 0 });
  };

  btnB.onclick = () => {
    tempSelectedIdx = 1;
    btnB.style.borderColor = "#00cb75"; btnB.style.background = "#e6f9f1"; btnB.style.color = "#00cb75";
    btnA.style.borderColor = "#ddd"; btnA.style.background = "#fff"; btnA.style.color = "#333";
    btnConfirm.disabled = false; btnConfirm.style.background = "#00cb75"; btnConfirm.style.cursor = "pointer";
    socket.emit("previewRouteSelection", { roomCode: currentRoomCode, selectedRouteIndex: 1 });
  };

  btnConfirm.onclick = () => {
    if (tempSelectedIdx === null) return;
    window.hasConfirmedThisTurn = true;
    socket.emit("confirmRouteSelection", { roomCode: currentRoomCode, chosenRouteIdx: tempSelectedIdx });
    const modalEl = document.getElementById("route-select-modal");
    if (modalEl) modalEl.remove();
  };
}

socket.on("syncGameState", (data) => {
  if (data.players && Array.isArray(data.players)) players = data.players;
  if (data.activePlayerIndex !== undefined) activePlayerIndex = data.activePlayerIndex;
  updatePhoneStatusDisplay();
  setTimeout(() => {
    if (typeof checkBranchSquareOnTurnStart === "function") checkBranchSquareOnTurnStart(data);
  }, 100);
});

socket.on("showGraduateNextButton", () => {
  const nextBtn = document.getElementById("btn-phone-next");
  if (nextBtn) {
    nextBtn.disabled = false;
    nextBtn.style.opacity = "1.0";
    nextBtn.style.pointerEvents = "auto";
    nextBtn.style.filter = "none";
  }
  const resultDisplay = document.getElementById("roulette-result-display");
  if (resultDisplay) resultDisplay.textContent = "🎉 卒業確定！交代してね！";
});
