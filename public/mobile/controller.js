const socket = io();
let currentRoomCode = "";
let activePlayerIndex = 0;
let players = [];
let isSpinning = false;
let currentRotation = 0;

// カップルイベントの状態管理用
let coupleEventState = {
  active: false,
  step: 1, // 1: 最初の判定, 2: 相手を決定する2回目
  targetPlayerId: null,
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

  // 🎯 修正：HTML側の「参加する」ボタン（ID: btn-join-room）のクリックイベントを確実に登録！
  // これが記述されていなかったため、コードを打ってボタンを押しても完全に無反応になっていました。
  const btnJoin = document.getElementById("btn-join-room");
  if (btnJoin) {
    console.log(
      "[スマホ] 参加するボタンを発見。クリックイベントを登録します。",
    );
    btnJoin.addEventListener("click", (e) => {
      e.preventDefault();
      joinRoom(); // 記述されていた入室処理関数を確実に呼び出す
    });
  } else {
    console.error(
      "⚠️ エラー: スマホのHTML内に 'btn-join-room' というIDのボタンが見つかりません。",
    );
  }

  document
    .getElementById("btn-phone-add-player")
    ?.addEventListener("click", addPlayerRow);
  document
    .getElementById("btn-phone-start")
    ?.addEventListener("click", sendStartGame);
  document
    .getElementById("btn-phone-spin")
    ?.addEventListener("click", requestSpin);
  document
    .getElementById("btn-phone-next")
    ?.addEventListener("click", sendNextTurn);

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
    if (
      data.players &&
      Array.isArray(data.players) &&
      data.players.length > 0
    ) {
      const activeEl = document.activeElement;
      const isUserTyping =
        activeEl &&
        activeEl.tagName === "INPUT" &&
        activeEl.closest("#phone-player-list");
      if (!isUserTyping) {
        players = data.players;
        renderPlayerInputs();
      } else {
        players = data.players;
      }
    }

    const targetMode = data.mode || data.gameMode;
    if (targetMode) {
      const targetRadio = document.querySelector(
        `input[name="phone-mode"][value="${targetMode}"]`,
      );
      if (targetRadio) targetRadio.checked = true;
    }
  });

  // 🎯【サーバー主導】出目が確定してサーバーから回転合図が飛んできた時の処理
  socket.on("spinRoulette", (data) => {
    if (!data) return;
    const resultNum = data.result !== undefined ? data.result : 1;

    // 0秒目：即座に回転の角度を計算してアニメーションを開始させる
    const targetDegrees = [342, 306, 270, 234, 198, 162, 126, 90, 54, 18];
    const stopAngle = targetDegrees[resultNum - 1];
    const currentMod = currentRotation % 360;
    currentRotation += 1800 + ((stopAngle - currentMod + 360) % 360);

    isSpinning = true;
    playMobileRouletteAnimation(resultNum, currentRotation, (finalSteps) => {
      isSpinning = false;

      // ─── ★ここからは3秒後（ルーレットが完全に止まった瞬間）に実行する処理 ───
      if (coupleEventState.active) {
        const p = players[activePlayerIndex];
        if (p) {
          if (coupleEventState.step === 1) {
            // 1回目：偶数・奇数の判定結果をサーバーへ事後報告
            socket.emit("coupleRouletteResult", {
              roomCode: currentRoomCode,
              playerId: p.id,
              result: finalSteps,
            });
          } else if (coupleEventState.step === 2) {
            // 2回目：実際の出目（1〜10）を細工せずストレートにサーバーへ事後報告（合否はサーバー側で一元管理）
            socket.emit("coupleSecondRouletteResult", {
              roomCode: currentRoomCode,
              playerId: p.id,
              result: finalSteps,
            });
          }
        }
      } else {
        // 通常時：ルーレットが止まったので、手元のデータを進めて「次へ」ボタンを普通に表示
        handleRouletteStop(finalSteps);
      }
    });
  });
  socket.on("applyPlayerAction", (data) => {
    if (data.action === "turnUpdated") {
      activePlayerIndex =
        data.activePlayerIndex !== undefined
          ? data.activePlayerIndex
          : activePlayerIndex;
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
    showJobChoiceDialog(data.jobId, data.jobName, data.playerId);
  });

  // カップルイベント受取（1回目スタート）
  socket.on("showCoupleEvent", (data) => {
    console.log("サーバーからカップルイベント開始指示を受信しました:", data);
    coupleEventState = {
      active: true,
      step: 1,
      targetPlayerId: null,
    };

    // スマホのカードや全体コンテナに 'theme-couple' を付与して見た目をピンクに変身させる
    document.body.classList.add("theme-couple");
    document
      .querySelector(".phone-screen .card")
      ?.classList.add("theme-couple");
    document.querySelector(".phone-card")?.classList.add("theme-couple");

    const resultDisplay = document.getElementById("roulette-result-display");
    if (resultDisplay) {
      resultDisplay.innerHTML = `<span style="color: #d81b60; font-weight: bold; font-size: 1.1rem;">
        💖 カップルチャンス（1回目）<br>偶数を出して告白に進め！
      </span>`;
    }
  });

  // 偶数だった場合：サーバーから2回目のルーレット開始指示（対応表データ付き）を受信
  socket.on("startCoupleSecondRoulette", (data) => {
    console.log("スマホ側：告白チャンス！2回目のルーレット指示を受信", data);

    coupleEventState = {
      active: true,
      step: 2,
      targetPlayerId: data.targetPlayerId,
    };

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

  // カップルイベントが完全に終了した時
  socket.on("coupleEventFinished", (data) => {
    alert(data.message);

    coupleEventState.active = false;
    coupleEventState.step = 1;

    // イベントが終わったら着せ替えクラスを外して元の通常デザインに戻す
    document.body.classList.remove("theme-couple");
    document
      .querySelector(".phone-screen .card")
      ?.classList.remove("theme-couple");
    document.querySelector(".phone-card")?.classList.remove("theme-couple");

    // モーダルが開いていたら閉じる
    const modal = document.getElementById("mobile-couple-event-modal");
    if (modal) modal.style.display = "none";

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
    if (data.activePlayerIndex !== undefined)
      activePlayerIndex = data.activePlayerIndex;
    updatePhoneStatusDisplay();
    // 🎯 追加：データ同期が走るたびに、自分が分岐マスにいるか自動チェックする
    if (typeof checkBranchSquareOnTurnStart === "function") {
      checkBranchSquareOnTurnStart();
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
  const screens = [
    "phone-screen-join",
    "phone-screen-setup",
    "phone-screen-play",
  ];
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

// 🎯 修正：スマホ側は「IDと名前」のみを身軽に管理（ステータスはサーバーのcreatePlayerに一任）
function addPlayerRow() {
  const newId = "p_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  players.push({
    id: newId,
    name: `プレイヤー${players.length + 1}`,
  });
  renderPlayerInputs();
  syncSettingsToServer();
}

function syncSettingsToServer() {
  if (!currentRoomCode) return;
  const selectedMode =
    document.querySelector('input[name="phone-mode"]:checked')?.value ||
    "normal";
  socket.emit("updateSettings", {
    roomCode: currentRoomCode,
    players: players,
    mode: selectedMode,
    gameMode: selectedMode,
  });
}

function sendStartGame() {
  socket.emit("startGame", { roomCode: currentRoomCode });
  showScreen("phone-screen-play");
}

function requestSpin() {
  if (isSpinning) return;

  const spinBtn = document.getElementById("btn-phone-spin");
  if (spinBtn) spinBtn.disabled = true;

  const modal = document.getElementById("mobile-couple-event-modal");
  if (modal) modal.style.display = "none";

  socket.emit("requestSpinRoulette", { roomCode: currentRoomCode });
}

function playMobileRouletteAnimation(finalSteps, targetRotation, callback) {
  const wheel = document.getElementById("controller-roulette-wheel");
  const resultDisplay = document.getElementById("roulette-result-display");
  const nextBtn = document.getElementById("btn-phone-next");

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
    if (typeof callback === "function") {
      callback(finalSteps);
    }
  }, 3000);
}

function handleRouletteStop(steps) {
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

  // 🎯 スマホ側の幸福度表示を反映
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
    socket.emit("playerAction", {
      roomCode: currentRoomCode,
      action: "chooseJob",
      choice: "yes",
      jobId: jobId,
      jobName: jobName,
      playerId: playerId,
    });
    overlay.style.display = "none";
  });

  newBtnNo.addEventListener("click", () => {
    socket.emit("playerAction", {
      roomCode: currentRoomCode,
      action: "chooseJob",
      choice: "no",
      playerId: playerId,
    });
    overlay.style.display = "none";
  });

  overlay.style.display = "flex";
}

function sendNextTurn() {
  socket.emit("playerAction", {
    roomCode: currentRoomCode,
    action: "nextTurn",
  });

  const nextBtn = document.getElementById("btn-phone-next");
  if (nextBtn) {
    nextBtn.disabled = true;
    nextBtn.classList.add("hidden");
    nextBtn.style.display = "none";
  }
}

// ─── controller.js : 開発デバッグ用メニューの指定マスワープ処理（イベント外れ防止・常時監視版） ───
document.addEventListener("click", (e) => {
  // クリックされた要素が「ワープボタン」またはその子要素か判定
  const btn = e.target.closest("#btn-debug-warp");
  if (!btn) return;

  e.preventDefault();

  const inputDebugSquare = document.getElementById("input-debug-square");
  if (!inputDebugSquare) return;

  const targetVal = inputDebugSquare.value.trim();
  if (targetVal === "") {
    alert("ワープ先のマス番号（0〜99）を入力してください");
    return;
  }

  const targetSquareId = parseInt(targetVal, 10);
  if (isNaN(targetSquareId) || targetSquareId < 0 || targetSquareId > 99) {
    alert("0〜99の範囲で数値を入力してください");
    return;
  }

  // ルームコードを確実に取得（変数またはURLパラメータから取得）
  const roomCodeToSend =
    currentRoomCode ||
    new URLSearchParams(window.location.search).get("room") ||
    "";

  console.log(
    `[デバッグワープ発動] マス: ${targetSquareId}, ルーム: ${roomCodeToSend}`,
  );
  socket.emit("debugWarp", {
    roomCode: roomCodeToSend,
    targetSquareId: targetSquareId,
  });
});

// 🎯 完全修正：重複していた古い関数を削除し、サーバーから届く生の「syncData」をダイレクトに読み込んで0番・49番マスでの先走りを100%確実に阻止します
function checkBranchSquareOnTurnStart(syncData) {
  // 💡 サーバーから届いた最新のデータから、現在アクティブなプレイヤーの情報を確実に抽出
  const currentIdx = (syncData && syncData.activePlayerIndex !== undefined) ? syncData.activePlayerIndex : activePlayerIndex;
  const currentPlayers = (syncData && syncData.players) ? syncData.players : players;
  
  const p = currentPlayers[currentIdx];
  if (!p) return;

  // 💡 socket.idとの厳密一致チェックの型ズレを防ぐため、徹底検証して「自分が手番か」を正確にジャッジ
  const isMyTurn = (p.id === socket.id); 
  if (!isMyTurn) return;

  // 分岐マス（0番マスまたは49番マス）にいる場合のみ強制割り込み
  if (p.position !== 0 && p.position !== 49) return;

  console.log(`[進路選択起動] ${p.name} さんが分岐マス（${p.position}番）にいるため、スマホ画面をロックしてモーダルを強制表示します`);

  // 役職選択モーダルと100%同じ構造のHTML要素を最前面（z-index: 99999）に動的生成
  let modalHtml = `
    <div id="route-select-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); display:flex; justify-content:center; align-items:center; z-index:99999; font-family:sans-serif;">
      <div style="background:#fff; width:90%; max-width:320px; padding:25px; border-radius:16px; text-align:center; box-box:border-box; box-shadow: 0 8px 24px rgba(0,0,0,0.3);">
        <h3 style="margin-top:0; color:#222; font-size:1.25rem; font-weight:bold;">🧭 運命の進路選択</h3>
        <p style="font-size:0.85rem; color:#666; margin-bottom:20px; line-height:1.4;">進むルートをタップすると、PC大画面のマップ上で選ばれなかった道に影が落ちます。</p>
        
        <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:22px;">
          <button id="btn-route-a" style="padding:14px; font-size:1rem; font-weight:bold; border:2px solid #ddd; border-radius:10px; background:#fff; color:#333; cursor:pointer; outline:none; transition:0.2s;">Aルート（通常進路）</button>
          <button id="btn-route-b" style="padding:14px; font-size:1rem; font-weight:bold; border:2px solid #ddd; border-radius:10px; background:#fff; color:#333; cursor:pointer; outline:none; transition:0.2s;">Bルート（特殊進路）</button>
        </div>
        
        <button id="btn-route-confirm" disabled style="width:100%; padding:14px; font-size:1.05rem; font-weight:bold; border:none; border-radius:10px; background:#ccc; color:#fff; cursor:not-allowed; transition:0.2s;">進路を確定してルーレットへ</button>
      </div>
    </div>
  `;

  // 重複表示を防ぐため、既存の古いモーダルを確実に消去してから画面に注入
  const oldModal = document.getElementById("route-select-modal");
  if (oldModal) oldModal.remove();
  document.body.insertAdjacentHTML("beforeend", modalHtml);

  let tempSelectedIdx = null; // 0:A, 1:B
  const btnA = document.getElementById("btn-route-a");
  const btnB = document.getElementById("btn-route-b");
  const btnConfirm = document.getElementById("btn-route-confirm");

  // 💡 Aルートをタップした瞬間（PC画面へリアルタイム影落とし信号を送信）
  btnA.onclick = () => {
    tempSelectedIdx = 0;
    btnA.style.borderColor = "#00cb75"; btnA.style.background = "#e6f9f1"; btnA.style.color = "#00cb75";
    btnB.style.borderColor = "#ddd";    btnB.style.background = "#fff";    btnB.style.color = "#333";
    btnConfirm.disabled = false;        btnConfirm.style.background = "#00cb75"; btnConfirm.style.cursor = "pointer";
    socket.emit("previewRouteSelection", { roomCode: currentRoomCode, selectedRouteIndex: 0 });
  };

  // 💡 Bルートをタップした瞬間（PC画面へリアルタイム影落とし信号を送信）
  btnB.onclick = () => {
    tempSelectedIdx = 1;
    btnB.style.borderColor = "#00cb75"; btnB.style.background = "#e6f9f1"; btnB.style.color = "#00cb75";
    btnA.style.borderColor = "#ddd";    btnA.style.background = "#fff";    btnA.style.color = "#333";
    btnConfirm.disabled = false;        btnConfirm.style.background = "#00cb75"; btnConfirm.style.cursor = "pointer";
    socket.emit("previewRouteSelection", { roomCode: currentRoomCode, selectedRouteIndex: 1 });
  };

  // 💡 決定ボタンを押した瞬間
  btnConfirm.onclick = () => {
    if (tempSelectedIdx === null) return;
    socket.emit("confirmRouteSelection", { roomCode: currentRoomCode, selectedRouteIndex: tempSelectedIdx });
    const modalEl = document.getElementById("route-select-modal");
    if (modalEl) modalEl.remove(); // モーダルを閉じて通常のルーレット操作へ復帰
  };
}

// 🎯【完全復旧】サーバーからの最新データ（data）を確実に引数に渡して自動起動させます
socket.on("syncGameState", (data) => {
  if (data.players && Array.isArray(data.players)) players = data.players;
  if (data.activePlayerIndex !== undefined) activePlayerIndex = data.activePlayerIndex;
  updatePhoneStatusDisplay();

  // 💡 描画ラグや通信ラグを完全に吸収するため、100ミリ秒後に生のdataを渡して強制割り込みチェック
  setTimeout(() => {
    if (typeof checkBranchSquareOnTurnStart === "function") {
      checkBranchSquareOnTurnStart(data);
    }
  }, 100);
});
