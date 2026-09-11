const socket = io();
let currentRoomCode = "";
let activePlayerIndex = 0;
let players = [
  { id: "p1", name: "プレイヤー1", jobId: "mob", job: "モブ", baseCap: 80, bonusCap: 0, currentHp: 90, drinkCount: 0, position: 0, location: "スタート前", isLover: false, skipTurn: false, hasJob: false },
  { id: "p2", name: "プレイヤー2", jobId: "mob", job: "モブ", baseCap: 80, bonusCap: 0, currentHp: 90, drinkCount: 0, position: 0, location: "スタート前", isLover: false, skipTurn: false, hasJob: false },
  { id: "p3", name: "プレイヤー3", jobId: "mob", job: "モブ", baseCap: 80, bonusCap: 0, currentHp: 90, drinkCount: 0, position: 0, location: "スタート前", isLover: false, skipTurn: false, hasJob: false },
  { id: "p4", name: "プレイヤー4", jobId: "mob", job: "モブ", baseCap: 80, bonusCap: 0, currentHp: 90, drinkCount: 0, position: 0, location: "スタート前", isLover: false, skipTurn: false, hasJob: false }
];
let isSpinning = false;
let currentRotation = 0;

// カップルイベントの状態管理用（1回目か、偶数後の2回目か）
let coupleEventState = {
  active: false,
  step: 1, // 1: 最初の判定, 2: 相手を決定する2回目
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
  document.getElementById("btn-phone-spin")?.addEventListener("click", sendSpin);
  document.getElementById("btn-phone-next")?.addEventListener("click", sendNextTurn);

  // カップル用モーダルの「ルーレットを回す」ボタン設定
  document.getElementById("btn-couple-spin")?.addEventListener("click", prepareCoupleRouletteTheme);

  document.querySelectorAll('input[name="phone-mode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
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
  
  socket.on("applyPlayerAction", (data) => {
    if (data.action === "turnUpdated") {
      activePlayerIndex = data.activePlayerIndex !== undefined ? data.activePlayerIndex : activePlayerIndex;
      const activeName = data.activePlayerName || `プレイヤー`;
      
      const banner = document.getElementById("current-player-banner");
      if (banner) banner.textContent = `TURN: ${activeName}`;
      
      const spinBtn = document.getElementById("btn-phone-spin");
      if (spinBtn) spinBtn.disabled = false;

      const nextBtn = document.getElementById("btn-phone-next");
      if (nextBtn) {
        nextBtn.disabled = true;
        nextBtn.classList.add("hidden");
        nextBtn.style.display = "none";
      }

      const resultDisplay = document.getElementById("roulette-result-display");
      if (resultDisplay) resultDisplay.textContent = "🎯 タップして回そう！";
      isSpinning = false;
    }
  });

  // 役職選択ダイアログ受取
  socket.on("showJobChoice", (data) => {
    console.log("サーバーから役職選択指示を受信しました:", data);
    showJobChoiceDialog(data.jobId, data.jobName, data.playerId);
  });

  // カップルイベント受取（1回目スタート）
  socket.on("showCoupleEvent", (data) => {
    console.log("サーバーからカップルイベント開始指示を受信しました:", data);
    coupleEventState = {
      active: true,
      step: 1,
      targetPlayerId: null
    };

    // 🎯 修正：スマホのカードに 'theme-couple' を付与して見た目を変身させる
    // 画面全体に反映させるため、body やメインのコンテナに付与するのが一番確実です
    document.body.classList.add("theme-couple");

    // スマホ側の「🎯 タップして回そう！」のテキストをイベント用に書き換える
    const resultDisplay = document.getElementById("roulette-result-display");
    if (resultDisplay) {
      resultDisplay.innerHTML = `<span style="color: #d81b60; font-weight: bold; font-size: 1.1rem;">
        💖 カップルチャンス（1回目）<br>偶数を出して告白に進め！
      </span>`;
    }

    // もし古い文字だけのモーダル（mobile-couple-event-modal）を開く処理が残っていたら、
    // 画面がゴチャつくので、その処理はコメントアウトするか消してしまって大丈夫です！
  });

  // 偶数だった場合：2回目のルーレット開始指示を受信
  socket.on("startCoupleSecondRoulette", (data) => {
    console.log("スマホ側：告白チャンス！2回目のルーレット指示を受信", data);
    
    // 状態をステップ2（相手決定/告白スピン）に更新
    coupleEventState = {
      active: true,
      step: 2,
      targetPlayerId: data.targetPlayerId
    };

    // スマホの画面（モーダル）を2回目用に書き換えて再表示
    const modal = document.getElementById("mobile-couple-event-modal");
    if (modal) {
      const descEl = modal.querySelector(".couple-desc");
      if (descEl) {
        descEl.innerHTML = `💕 偶数が出た！告白チャンス発動！<br>もう一度ルーレットを回して【偶数】ならカップル成立！`;
      }
      // ボタンをもう一度押せるように表示
      const btn = document.getElementById("btn-couple-spin");
      if (btn) btn.style.display = "block";
      modal.style.display = "flex";
    }
  });

  // カップルイベントが終了した時（通常スピンに戻る時）
  socket.on("coupleEventFinished", (data) => {
    alert(data.message);
    
    coupleEventState.active = false;
    coupleEventState.step = 1;
    
    // 🎯 修正：イベントが終わったら着せ替えクラスを外して元のデザインに戻す
    document.body.classList.remove("theme-couple");

    const resultDisplay = document.getElementById("roulette-result-display");
    if (resultDisplay) resultDisplay.textContent = "🎯 タップして回そう！";

    const nextBtn = document.getElementById("btn-phone-next");
    if (nextBtn) {
      nextBtn.disabled = false;
      nextBtn.classList.remove("hidden");
      nextBtn.style.display = "block";
    }
  });

  socket.on("syncGameState", (data) => {
    if (data.players && Array.isArray(data.players)) players = data.players;
    if (data.activePlayerIndex !== undefined) activePlayerIndex = data.activePlayerIndex;
    updatePhoneStatusDisplay();
  });

    // 開発用：ボタンを押したら即座に35マス目の手前（34マス目）にプレイヤーを移動させて同期する
  document.getElementById("btn-debug-warp-couple")?.addEventListener("click", () => {
    const p = players[activePlayerIndex];
    if (p) {
      // 次に「1」を出せば35マス目に止まるように、34マス目にセット
      p.position = 34; 
      p.location = "とりき"; // マス目データに合わせておく
      
      // サーバーに現在の状態を強制同期
      socket.emit("updateGameState", {
        roomCode: currentRoomCode,
        activePlayerIndex: activePlayerIndex,
        players: players
      });
      alert("34マス目にワープしました！次スピンで確定でカップルマスです。");
    }
  });

});

// --- イベントに応じたルーレット画面のテーマ切り替え関数 ---
function applyRouletteTheme(themeClass) {
  const phoneCard = document.querySelector('.phone-screen .card') || document.querySelector('.phone-card');
  if (!phoneCard) return;

  phoneCard.classList.remove('theme-couple');

  if (themeClass) {
    phoneCard.classList.add(themeClass);
  }
}

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
  screens.forEach(id => {
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
  players.push({
    id: newId,
    name: `プレイヤー${players.length + 1}`,
    jobId: "mob",
    job: "モブ",
    baseCap: 80,
    bonusCap: 0,
    currentHp: 80,
    drinkCount: 0,
    position: 0,
    location: "スタート前",
    isLover: false,
    skipTurn: false,
    hasJob: false
  });
  renderPlayerInputs();
  syncSettingsToServer();
}

function syncSettingsToServer() {
  if (!currentRoomCode) return;
  const selectedMode = document.querySelector('input[name="phone-mode"]:checked')?.value || "normal";
  socket.emit("updateSettings", {
    roomCode: currentRoomCode,
    players: players,
    mode: selectedMode,
    gameMode: selectedMode
  });
}

function sendStartGame() {
  socket.emit("startGame", { roomCode: currentRoomCode });
  showScreen("phone-screen-play");
}

function playMobileRouletteAnimation(finalSteps, targetRotation, callback) {
  const wheel = document.getElementById("controller-roulette-wheel");
  const spinBtn = document.getElementById("btn-phone-spin");
  const resultDisplay = document.getElementById("roulette-result-display");
  const nextBtn = document.getElementById("btn-phone-next");

  if (spinBtn) spinBtn.disabled = true;
  if (nextBtn) {
    nextBtn.classList.add("hidden");
    nextBtn.style.display = "none";
  }
  if (resultDisplay) resultDisplay.textContent = "🌀 回転中...";

  if (wheel) {
    wheel.style.transition = "transform 3s cubic-bezier(0.15, 0.9, 0.2, 1)";
    wheel.style.transform = `rotate(${targetRotation}deg)`;
  }

  setTimeout(() => {
    if (resultDisplay) resultDisplay.textContent = `🎯 出目: ${finalSteps}`;
    if (spinBtn) spinBtn.disabled = false;
    if (typeof callback === "function") {
      callback(finalSteps);
    }
  }, 3000);
}

function handleRouletteStop(steps) {
  const p = players[activePlayerIndex];
  if (!p) return;

  if (coupleEventState.active) {
    return;
  }

  p.position = (p.position || 0) + steps;
  if (typeof MAP_SQUARES !== 'undefined' && MAP_SQUARES[p.position]) {
    p.location = MAP_SQUARES[p.position].location || "";
  }

  const nextBtn = document.getElementById("btn-phone-next");
  if (nextBtn) {
    nextBtn.disabled = false;
    nextBtn.classList.remove("hidden");
    nextBtn.style.display = "block";
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
}

// 役職選択ダイアログを表示
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
    socket.emit("playerAction", {
      roomCode: currentRoomCode,
      action: "chooseJob",
      choice: "yes",
      jobId: jobId,
      jobName: jobName,
      playerId: playerId
    });
    overlay.style.display = "none";
  });

  newBtnNo.addEventListener("click", () => {
    socket.emit("playerAction", {
      roomCode: currentRoomCode,
      action: "chooseJob",
      choice: "no",
      playerId: playerId
    });
    overlay.style.display = "none";
  });

  overlay.style.display = "flex";
}

// ステップ1: モーダルのボタンを押した瞬間（モーダルを閉じ、色を切り替える。この時点では回らない）
function prepareCoupleRouletteTheme() {
  const modal = document.getElementById("mobile-couple-event-modal");
  if (modal) modal.style.display = "none"; // モーダルを閉じる

  // ★ここでスマホのルーレット画面のテーマ（色）を専用カラーに変更する（まだ回らない）
  applyRouletteTheme('theme-couple');
}

// ステップ2: 色が変わった後に、通常の「ルーレットを回す」ボタンが押されたときの処理
function sendSpin() {
  if (isSpinning) return;
  isSpinning = true;

  const steps = Math.floor(Math.random() * 10) + 1;
  const targetDegrees = [342, 306, 270, 234, 198, 162, 126, 90, 54, 18];
  const stopAngle = targetDegrees[steps - 1];

  const currentMod = currentRotation % 360;
  currentRotation += 1800 + ((stopAngle - currentMod + 360) % 360);

  // スマホ側のルーレットアニメーション開始
  playMobileRouletteAnimation(steps, currentRotation, (finalSteps) => {
    isSpinning = false;
    handleRouletteStop(finalSteps);
  });

  // カップルイベント中であれば、サーバーへカップル用の結果を送信（これによりPC側も連動する）
  if (coupleEventState.active) {
    const p = players[activePlayerIndex];
    if (p) {
      if (coupleEventState.step === 1) {
        socket.emit("coupleRouletteResult", {
          roomCode: currentRoomCode,
          playerId: p.id,
          result: steps // ★修正：finalSteps ではなく正しく steps を渡す
        });
      } else if (coupleEventState.step === 2) {
        socket.emit("coupleSecondRouletteResult", {
          roomCode: currentRoomCode,
          playerId: p.id,
          targetPlayerId: coupleEventState.targetPlayerId,
          result: steps // ★修正：finalSteps ではなく正しく steps を渡す
        });
        // イベント終了後にテーマを通常に戻す
        coupleEventState.active = false;
        applyRouletteTheme('');
      }
    }
  } else {
    // 通常時のスピン
    socket.emit("spinRoulette", {
      roomCode: currentRoomCode,
      result: steps
    });
  }
}

function sendNextTurn() {
  socket.emit("playerAction", { 
    roomCode: currentRoomCode, 
    action: "nextTurn" 
  });
  
  const nextBtn = document.getElementById("btn-phone-next");
  if (nextBtn) {
    nextBtn.disabled = true;
    nextBtn.classList.add("hidden");
    nextBtn.style.display = "none";
  }
}