const socket = io();
let currentRoomCode = "";
let activePlayerIndex = 0;
let players = [];
let isSpinning = false;
let currentRotation = 0;
let currentGameMode = "normal";

window.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get("room");

  if (roomParam) {
    const inputEl = document.getElementById(
      "input-room-code",
    ) as HTMLInputElement;
    if (inputEl) inputEl.value = roomParam;
    currentRoomCode = String(roomParam).trim();
    const doJoin = () => {
      socket.emit("joinRoom", { roomCode: currentRoomCode });
    };
    if (socket.connected) doJoin();
    else socket.once("connect", doJoin);
  }

  const btnJoin = document.getElementById("btn-join-room");
  if (btnJoin)
    btnJoin.addEventListener("click", (e) => {
      e.preventDefault();
      joinRoom();
    });
  if (document.getElementById("btn-phone-add-player"))
    document
      .getElementById("btn-phone-add-player")
      .addEventListener("click", addPlayerRow);
  if (document.getElementById("btn-phone-start"))
    document
      .getElementById("btn-phone-start")
      .addEventListener("click", sendStartGame);
  if (document.getElementById("btn-phone-spin"))
    document
      .getElementById("btn-phone-spin")
      .addEventListener("click", requestSpin);
  if (document.getElementById("btn-phone-next"))
    document
      .getElementById("btn-phone-next")
      .addEventListener("click", sendNextTurn);

  document.querySelectorAll('input[name="phone-mode"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      if (e.target) {
        (e.target as HTMLInputElement).checked = true;
      }
      syncSettingsToServer();
    });
  });

  socket.on("joinedSuccess", (data) => {
    currentRoomCode = data.roomCode;
    if (!players || players.length === 0) {
      const now = Date.now();
      players = [
        { id: `p_${now}_1`, name: "プレイヤー1" },
        { id: `p_${now}_2`, name: "プレイヤー2" },
      ];
    }
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
      if (
        !(
          document.activeElement &&
          document.activeElement.tagName === "INPUT" &&
          document.activeElement.closest("#phone-player-list")
        )
      ) {
        players = data.players;
        renderPlayerInputs();
      } else {
        players = data.players;
      }
    }
    const targetMode = data.mode || data.gameMode;
    if (targetMode) {
      currentGameMode = targetMode;
      const radioEl = document.querySelector(
        `input[name="phone-mode"][value="${targetMode}"]`,
      ) as HTMLInputElement;
      if (radioEl) radioEl.checked = true;
    }
  });

  // ==========================================================================
  // 🧭 【一本道リレー：行程④】サーバーからの着地号令（startSquareEvent）受信
  // スマホ側は「操作専任」として、役職モーダルやボタンUIを手元に展開します。
  // ==========================================================================
  socket.on("startSquareEvent", (data) => {
    if (!data || data.position === undefined) return;

    if (data.activePlayerIndex !== undefined) {
      activePlayerIndex = data.activePlayerIndex;
    }

    const currentIdx = activePlayerIndex;
    const p = players[currentIdx];
    if (!p) return;

    // 手番プレイヤー以外は何もしない
    if (p.id !== data.playerId) return;

    const currentPos = Number(data.position);
    p.position = currentPos;
    if (data.location) p.location = data.location;

    console.log(
      `📱 [4.0 到着イベント開始] サーバー号令を受信。マスID: ${currentPos} のコンポーネントをロードします...`,
    );

    loadAndApplySquareComponent(currentPos, () => {
      // 1. 個別モジュール（sq_XX.js）を取得
      const modObj = window.SQ_MODULES && window.SQ_MODULES[currentPos];
      let targetModule = modObj
        ? modObj[currentGameMode] || modObj.normal
        : null;

      // 2. マスタデータ（MAP_SQUARES）からのフォールバック取得
      if (
        !targetModule &&
        typeof MAP_SQUARES !== "undefined" &&
        MAP_SQUARES[currentPos]
      ) {
        targetModule = MAP_SQUARES[currentPos];
      }

      if (!targetModule) {
        console.log(
          `📱 [4.2 スキップ] マスID: ${currentPos} のモジュールが存在しません。完了通知を送信します。`,
        );
        socket.emit("playerAction", {
          roomCode: currentRoomCode,
          action: "squareEventFinished",
          updatedPlayer: p,
        });
        return;
      }

      if (targetModule.location) {
        p.location = targetModule.location;
      }

      // 🚀 パターンA：役職マスの場合（就職ダイアログを確実に展開）
      if (targetModule.type === "jobChallenge" && targetModule.jobId) {
        if (p.hasJob === true) {
          console.log(
            `📱 [役職スキップ] 既に「${p.job}」に就職済みのためスルー。`,
          );
          socket.emit("playerAction", {
            roomCode: currentRoomCode,
            action: "squareEventFinished",
            updatedPlayer: p,
          });
          return;
        }

        const jobName = targetModule.text
          ? targetModule.text.replace(/【役職マス】/g, "").trim()
          : "新しい役職";
        console.log(
          `📱 [4.2 就職モーダル表示] 役職: ${jobName} (ID: ${targetModule.jobId}) を展開！`,
        );
        if (typeof showJobChoiceDialog === "function") {
          showJobChoiceDialog(targetModule.jobId, jobName, p.id);
        }
      }
      // 🚀 パターンB：特殊イベントマスの場合（各sq_XX.jsのevent()を実行）
      else if (typeof targetModule.event === "function") {
        console.log(
          `📱 [4.2 固有イベント実行] sq_${currentPos}.js の event() を起動！`,
        );
        targetModule.event(p, targetModule);
      }
      // 🚀 パターンC：通常・回復・留年・分岐マスの扱い（効果計算後に完了通知を返して次へ）
      else {
        console.log(
          `📱 [4.2 通常マス] 特殊イベント無しのマスです。効果を適用して完了通知を送信します。`,
        );

        const jobMaster =
          typeof JOBS !== "undefined"
            ? JOBS.find((j) => j.id === p.jobId || j.label === p.job)
            : null;
        const baseCap = jobMaster ? jobMaster.cap : p.baseCap || 80;
        const maxHp = baseCap + (p.bonusCap || 0);
        if (p.currentHp === undefined) p.currentHp = maxHp;

        const drinkAmount =
          targetModule.drink !== undefined ? Number(targetModule.drink) : 0;
        if (drinkAmount > 0) {
          p.drinkCount = (p.drinkCount || 0) + drinkAmount;
          p.currentHp = Math.max(0, p.currentHp - drinkAmount * 10);
        } else if (targetModule.type === "heal") {
          p.currentHp = Math.min(maxHp, p.currentHp + 30);
        }

        const happinessChange =
          targetModule.happiness !== undefined
            ? Number(targetModule.happiness)
            : 0;
        if (happinessChange !== 0) {
          if (p.happiness === undefined) p.happiness = 100;
          p.happiness += happinessChange;
        }

        if (p.currentHp <= 0) {
          if (p.happiness === undefined) p.happiness = 100;
          p.happiness = Math.max(0, p.happiness - 30);
          p.skipTurn = true;
          p.currentHp = maxHp;
        }

        const resDisplay = document.getElementById("roulette-result-display");
        if (resDisplay && targetModule.text) {
          resDisplay.textContent = `🎲 ${targetModule.text}`;
        }

        updatePhoneStatusDisplay();

        socket.emit("playerAction", {
          roomCode: currentRoomCode,
          action: "squareEventFinished",
          updatedPlayer: p,
        });
      }
    });
  });

  socket.on("spinRoulette", (data) => {
    if (!data) return;
    const resultNum = data.result !== undefined ? data.result : 1;

    // 🎯 スマホルーレット角度テーブル
    const targetDegrees = [342, 306, 270, 234, 198, 162, 126, 90, 54, 18];
    currentRotation +=
      1800 +
      ((targetDegrees[resultNum - 1] - (currentRotation % 360) + 360) % 360);

    isSpinning = true;
    playMobileRouletteAnimation(resultNum, currentRotation, (finalSteps) => {
      isSpinning = false;
      console.log(
        `📱 [3. ルーレットを回す SUCCESS] スマホ画面の回転終了(出目: ${finalSteps})。大画面側ピンのトコトコ完全着地を静かに待機。`,
      );
    });
  });

  // 🎯 【基本ルーティン：行程①】サーバーから手番交代のバトンを受信した瞬間
  socket.on("applyPlayerAction", (data) => {
    if (data.action === "turnUpdated") {
      document.body.classList.remove(
        "theme-couple",
        "theme-entrance",
        "theme-insurance",
      );

      activePlayerIndex =
        data.activePlayerIndex !== undefined
          ? data.activePlayerIndex
          : activePlayerIndex;
      const curP = players[activePlayerIndex];

      if (curP && curP.isRepeat) {
        document.body.classList.add("theme-repeat-dark");
      } else {
        document.body.classList.remove("theme-repeat-dark");
      }

      // スピンボタンを標準状態に安全リセット
      const spinBtn = document.getElementById(
        "btn-phone-spin",
      ) as HTMLButtonElement;
      if (spinBtn) {
        spinBtn.style.display = "block";
        const cleanedBtn = spinBtn.cloneNode(true) as HTMLButtonElement;
        spinBtn.parentNode.replaceChild(cleanedBtn, spinBtn);
        cleanedBtn.disabled = true;
        if (curP && curP.isRepeat) {
          cleanedBtn.textContent = "💀 留年ルートへ進む！";
          cleanedBtn.style.background =
            "linear-gradient(135deg, #4a148c 0%, #000000 100%)";
          cleanedBtn.style.color = "#ff80ab";
          cleanedBtn.style.border = "2px solid #ea80fc";
        } else {
          cleanedBtn.textContent = "⚡ ルーレットを回す！";
          cleanedBtn.style.background = "";
          cleanedBtn.style.color = "";
          cleanedBtn.style.border = "";
        }
        cleanedBtn.addEventListener("click", requestSpin);
      }

      window.hasConfirmedThisTurn = false;
      window.isLandedThisTurn = false;
      window.turnStartPosition = curP ? Number(curP.position) : null;

      // 🎯 手元のアクティブモーダルを全消去
      document.getElementById("job-modal-overlay") &&
        (document.getElementById("job-modal-overlay").style.display = "none");
      document.getElementById("mobile-couple-event-modal") &&
        (document.getElementById("mobile-couple-event-modal").style.display =
          "none");
      document.getElementById("route-select-modal")?.remove();
      document.getElementById("insurance-inline-zone")?.remove();
      document.getElementById("insurance-confirm-modal")?.remove();

      console.log(
        `\n📱 [1.0 新ターン開始] 手番交代を受信。手番: ${data.activePlayerName}`,
      );

      if (document.getElementById("current-player-banner")) {
        document.getElementById("current-player-banner").textContent =
          `TURN: ${data.activePlayerName || "プレイヤー"}`;
      }

      if (document.getElementById("btn-phone-next"))
        (
          document.getElementById("btn-phone-next") as HTMLButtonElement
        ).disabled = true;
      if (document.getElementById("roulette-result-display"))
        document.getElementById("roulette-result-display").textContent =
          "進路を選択してください";
      isSpinning = false;
    } else if (data.action === "turnSkipped") {
      if (data.activePlayerIndex !== undefined) {
        activePlayerIndex = data.activePlayerIndex;
      }
      if (document.getElementById("current-player-banner")) {
        document.getElementById("current-player-banner").textContent =
          `TURN: ${data.activePlayerName || "プレイヤー"} (1回休み)`;
      }
      if (document.getElementById("btn-phone-spin"))
        (
          document.getElementById("btn-phone-spin") as HTMLButtonElement
        ).disabled = true;
      if (document.getElementById("btn-phone-next"))
        (
          document.getElementById("btn-phone-next") as HTMLButtonElement
        ).disabled = false;
      if (document.getElementById("roulette-result-display"))
        document.getElementById("roulette-result-display").textContent =
          "💤 二日酔い（1回休み）のためスキップ！「次のプレイヤーへ」を押してね";
      isSpinning = false;
    } else if (data.action === "insuranceUsed") {
      if (document.getElementById("roulette-result-display")) {
        document.getElementById("roulette-result-display").textContent =
          "🛡️ 生命保険を発動！飲酒ペナルティを無効化しました！";
      }
    }
  });

  // 🎯 汎用モーダルの展開指示を受信（80番引退ギャンブル等）
  socket.on("openCustomRouletteModal", (data: any) => {
    const modal = document.getElementById("mobile-couple-event-modal");
    if (!modal) return;

    const titleEl = (modal.querySelector("h3") ||
      modal.querySelector(".couple-title")) as HTMLElement;
    if (titleEl) titleEl.innerHTML = `🌸 ${data.eventName} 🌸`;

    const descEl = modal.querySelector(".couple-desc") as HTMLElement;
    if (descEl)
      descEl.innerHTML = `出目に応じて結果が決まる！<br>ボタンをタップしてルーレットを回そう！`;

    const btnSpin = document.getElementById(
      "btn-couple-spin",
    ) as HTMLButtonElement;
    if (btnSpin) {
      btnSpin.style.display = "block";
      btnSpin.textContent = "⚡ ルーレットを回す！";
      btnSpin.disabled = false;

      btnSpin.onclick = () => {
        btnSpin.disabled = true;
        socket.emit("startCustomRouletteEvent", {
          roomCode: currentRoomCode,
          eventName: data.eventName,
          mapping: data.mapping,
        });
      };
    }
    modal.style.display = "flex";
  });

  // 🎯 決着通知（手元のモーダルを閉じる）
  socket.on("customRouletteFinished", (data: any) => {
    const modal = document.getElementById("mobile-couple-event-modal");
    if (modal) modal.style.display = "none";
    if (document.getElementById("roulette-result-display") && data && data.message) {
      document.getElementById("roulette-result-display").textContent =
        `🎯 結果: ${data.message}`;
    }
  });

  // ==========================================================================
  // 🛡️ 生命保険利用ボタン（#btn-phone-use-insurance）タップ時の確認モーダル
  // ==========================================================================
  document.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest(
      "#btn-phone-use-insurance",
    ) as HTMLButtonElement;
    if (!btn || btn.disabled) return;
    e.preventDefault();

    const p = players[activePlayerIndex];
    if (!p || !p.insurance || p.insurance <= 0) return;

    const confirmHtml = `
      <div id="insurance-confirm-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); display:flex; justify-content:center; align-items:center; z-index:999999; font-family:sans-serif;">
        <div style="background:#fff; width:90%; max-width:320px; padding:25px; border-radius:16px; text-align:center; box-sizing:border-box;">
          <h3 style="margin-top:0; color:#9c27b0; font-size:1.2rem; font-weight:bold;">🛡️ 生命保険の発動確認</h3>
          <p style="font-size:0.85rem; color:#333; margin-bottom:20px; line-height:1.5;">生命保険を1枚消費して、飲酒ペナルティ（1杯分）を完全に無効化しますか？<br><span style="color:#666;">(現在所持: ${p.insurance}枚)</span></p>
          <div style="display:flex; gap:10px;">
            <button id="btn-insurance-yes" style="flex:1; padding:12px; font-weight:bold; background:#9c27b0; color:#fff; border:none; border-radius:10px; cursor:pointer;">はい（発動）</button>
            <button id="btn-insurance-no" style="flex:1; padding:12px; font-weight:bold; background:#eee; color:#333; border:none; border-radius:10px; cursor:pointer;">いいえ</button>
          </div>
        </div>
      </div>
    `;

    const playScreen =
      document.getElementById("phone-screen-play") || document.body;
    document.getElementById("insurance-confirm-modal")?.remove();
    playScreen.insertAdjacentHTML("beforeend", confirmHtml);

    const btnYes = document.getElementById("btn-insurance-yes");
    if (btnYes) {
      btnYes.onclick = () => {
        p.insurance = Math.max(0, p.insurance - 1);
        socket.emit("playerAction", {
          roomCode: currentRoomCode,
          action: "insuranceUsed",
          playerId: p.id,
          nextInsuranceCount: p.insurance,
        });
        document.getElementById("insurance-confirm-modal")?.remove();
      };
    }

    const btnNo = document.getElementById("btn-insurance-no");
    if (btnNo) {
      btnNo.onclick = () => {
        document.getElementById("insurance-confirm-modal")?.remove();
      };
    }
  });

  // ==========================================================================
  // 🧭 syncGameState 受信部（ステータス同期・ターン開始制御 専用版）
  // ==========================================================================
  socket.on("syncGameState", (data) => {
    console.log("📱 [DEBUG] syncGameState 受信成功:", data);
    if (!data) return;

    if (data.players && Array.isArray(data.players)) players = data.players;
    if (data.activePlayerIndex !== undefined)
      activePlayerIndex = data.activePlayerIndex;
    updatePhoneStatusDisplay();

    if (data.currentPhase) window.serverCurrentPhase = data.currentPhase;

    const currentIdx =
      data.activePlayerIndex !== undefined
        ? data.activePlayerIndex
        : activePlayerIndex;
    const p = players[currentIdx];
    if (!p) {
      console.log("🛑 [DEBUG] プレイヤー情報が存在しないため終了");
      return;
    }

    // 保険ボタンの更新
    const insuranceBtn = document.getElementById(
      "btn-phone-use-insurance",
    ) as HTMLButtonElement;
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
    // 🧭 行程②：ターン開始時イベント（進路選択チェック＆スピン待機制御）
    // ------------------------------------------------------------------------
    const pos = Number(p.position);
    console.log(
      `📱 [DEBUG] 現在位置: ${pos}番マス, フェーズ: ${window.serverCurrentPhase}`,
    );

    // 🎯 1. ターン開始前確認フェーズ（1.TURN_START）
    const isStartPhase =
      window.serverCurrentPhase === "1.TURN_START" ||
      window.serverCurrentPhase === "1-2.START_CHECK" ||
      window.serverCurrentPhase === "START_CHECK";

    if (isStartPhase && currentIdx === activePlayerIndex) {
      // 🎓 【89番マス】卒業判定マスにいるターン開始時（sq_89.js へ委譲）
      if (pos === 89 && !p.isRepeat) {
        loadAndApplySquareComponent(89, () => {
          const modObj = window.SQ_MODULES && window.SQ_MODULES[89];
          const targetModule = modObj
            ? modObj[currentGameMode] || modObj.normal
            : null;
          if (targetModule && typeof targetModule.event === "function") {
            targetModule.event(p, { ...targetModule, isTurnStart: true });
          }
        });
        return;
      }
      if ((pos === 0 || pos === 49) && !window.hasConfirmedThisTurn) {
        console.log(
          "📱 [DEBUG] 分岐対象マスを検知。進路選択モーダルを表示します。",
        );
        checkBranchSquareOnTurnStart(data);
      }
    }

    // 🎯 2. スピン待機フェーズ（2.WAIT_SPIN）
    const isWaitSpinPhase = window.serverCurrentPhase === "2.WAIT_SPIN";
    if (isWaitSpinPhase && currentIdx === activePlayerIndex) {
      console.log(
        "📱 [DEBUG] スピン待機フェーズを検知。ルーレットボタンを点灯します。",
      );
      if (document.getElementById("btn-phone-spin"))
        (
          document.getElementById("btn-phone-spin") as HTMLButtonElement
        ).disabled = false;
      if (document.getElementById("roulette-result-display")) {
        document.getElementById("roulette-result-display").textContent =
          p.isRepeat ? "💀 5年生編スタート..." : "🎯 タップして回そう！";
      }
    }
  });

  socket.on("enableNextTurnButton", () => {
    const btnNext = document.getElementById(
      "btn-phone-next",
    ) as HTMLButtonElement;
    if (btnNext) {
      console.log(
        "📱 [⑥. 手動進行ボタン大点灯] ➔ ➔ サーバーから点灯合図(enableNextTurnButton)を受信！ロックマスクを安全に解除しました。",
      );
      btnNext.disabled = false;
    }
  });

  socket.on("gameAllFinished", (data) => {
    if (data && data.players) players = data.players;
    const spinBtn = document.getElementById(
      "btn-phone-spin",
    ) as HTMLButtonElement;
    if (spinBtn) spinBtn.disabled = true;
    const nextBtn = document.getElementById(
      "btn-phone-next",
    ) as HTMLButtonElement;
    if (nextBtn) nextBtn.disabled = true;
    if (document.getElementById("current-player-banner")) {
      document.getElementById("current-player-banner").textContent =
        "🎊 全員卒業！ゲーム終了！ 🎊";
    }
    if (document.getElementById("roulette-result-display")) {
      document.getElementById("roulette-result-display").textContent =
        "🎉 全員ゴール達成！お疲れ様でした！ 🎉";
    }
  });
});

// 🧭 【一本道リレー：手順1】スマホで「ゲーム開始」が手動タップされた瞬間
socket.on("gameStarted", (data) => {
  if (data && data.players) players = data.players;
  if (data && (data.mode || data.gameMode)) {
    currentGameMode = data.mode || data.gameMode;
  }
  console.log(
    "📱 [①. 新ターン開始] ➔ サーバーからゲーム開始電波(gameStarted)を受信。ここで初めて手動操作権をロードします。",
  );
  showScreen("phone-screen-play");
  activePlayerIndex = 0;
});

function joinRoom() {
  const inputEl = document.getElementById(
    "input-room-code",
  ) as HTMLInputElement;
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
      if (e.target) {
        players[idx].name = (e.target as HTMLInputElement).value;
      }
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

  const selectedMode =
    (
      document.querySelector(
        'input[name="phone-mode"]:checked',
      ) as HTMLInputElement
    )?.value || "normal";
  currentGameMode = selectedMode;

  socket.emit("updateSettings", {
    roomCode: currentRoomCode,
    players: players,
    mode: selectedMode,
    gameMode: selectedMode,
  });
}

function sendStartGame() {
  console.log(
    `📱 [1.0 スマホ発信] ➔ ゲーム開始が手動タップされました。サーバーへ部屋コード [${currentRoomCode}] の一本道始動バトンを発射します！`,
  );

  socket.emit("startGame", {
    roomCode: String(currentRoomCode).trim(),
  });
}

function requestSpin() {
  if (isSpinning) return;
  if (document.getElementById("btn-phone-spin"))
    (document.getElementById("btn-phone-spin") as HTMLButtonElement).disabled =
      true;
  if (document.getElementById("mobile-couple-event-modal"))
    document.getElementById("mobile-couple-event-modal").style.display = "none";
  console.log(
    "📱 [③. ルーレットを回す Trigger] ➔ サーバーへ requestSpinRoulette 要求を発射します！",
  );
  socket.emit("requestSpinRoulette", { roomCode: currentRoomCode });
}

function playMobileRouletteAnimation(finalSteps, targetRotation, callback) {
  const wheel = document.getElementById("controller-roulette-wheel");
  const resultDisplay = document.getElementById("roulette-result-display");
  if (document.getElementById("btn-phone-next"))
    (document.getElementById("btn-phone-next") as HTMLButtonElement).disabled =
      true;
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

function updatePhoneStatusDisplay() {
  const p = players[activePlayerIndex];
  if (!p) return;
  const jobMaster =
    typeof JOBS !== "undefined"
      ? JOBS.find(
          (j) => j.id === p.jobId || j.label === p.job || j.title === p.job,
        )
      : null;
  const baseCap = jobMaster ? jobMaster.cap : p.baseCap || 80;
  const maxHp = baseCap + (p.bonusCap || 0);
  const currentHp = p.currentHp !== undefined ? Math.max(0, p.currentHp) : maxHp;

  if (document.getElementById("phone-current-name"))
    document.getElementById("phone-current-name").textContent = p.name;
  if (document.getElementById("phone-current-job"))
    document.getElementById("phone-current-job").textContent =
      jobMaster ? jobMaster.label : p.job || "モブ";
  if (document.getElementById("phone-current-hp"))
    document.getElementById("phone-current-hp").textContent =
      `${currentHp} / ${maxHp}`;
  if (document.getElementById("phone-current-happiness"))
    document.getElementById("phone-current-happiness").textContent =
      `${p.happiness !== undefined ? p.happiness : 100} pt`;
}

// 🧭 【基本ルーティン：行程⑤】プレイヤーが手動で就職の「はい／いいえ」を確定させた瞬間
function showJobChoiceDialog(jobId, jobName, playerId) {
  const overlay = document.getElementById("job-modal-overlay");
  const descEl = document.getElementById("job-modal-desc");
  if (!overlay || !descEl) return;

  descEl.textContent = `新しい役職「${jobName}」に就職しますか？`;
  const newBtnYes = document.getElementById("btn-job-yes").cloneNode(true);
  const newBtnNo = document.getElementById("btn-job-no").cloneNode(true);
  document
    .getElementById("btn-job-yes")
    .parentNode.replaceChild(newBtnYes, document.getElementById("btn-job-yes"));
  document
    .getElementById("btn-job-no")
    .parentNode.replaceChild(newBtnNo, document.getElementById("btn-job-no"));

  newBtnYes.addEventListener("click", () => {
    const targetP = players[activePlayerIndex];
    if (targetP) {
      console.log(
        `📱 [⑤. 到着イベント数値処理の確定] ➔ 役職に「はい」が手動確定！サーバーへ squareEventFinished バトンを返送します！`,
      );
      targetP.jobId = jobId;
      targetP.job = jobName;
      targetP.hasJob = true;
      if (typeof JOBS !== "undefined") {
        const jobObj = JOBS.find((j) => j.id === jobId);
        if (jobObj) {
          targetP.baseCap = jobObj.cap;
          targetP.currentHp = jobObj.cap + (targetP.bonusCap || 0);
        }
      }
      socket.emit("playerAction", {
        roomCode: currentRoomCode,
        action: "squareEventFinished",
        updatedPlayer: targetP,
      });
    }
    overlay.style.display = "none";
  });
  newBtnNo.addEventListener("click", () => {
    const targetP = players[activePlayerIndex];
    if (targetP) {
      console.log(
        `📱 [⑤. 到着イベント数値処理の確定] ➔ 役職に「いいえ」が手動確定！サーバーへ squareEventFinished バトンを返送します！`,
      );
      targetP.hasJob = false;
      socket.emit("playerAction", {
        roomCode: currentRoomCode,
        action: "squareEventFinished",
        updatedPlayer: targetP,
      });
    }
    overlay.style.display = "none";
  });
  overlay.style.display = "flex";
}

// 🧭 【基本ルーティン：行程⑥】手動進行でボタンをタップし、次の手番交代へバトンを繋ぐ瞬間
function sendNextTurn() {
  console.log(
    "📱 [⑥. 手動進行 Trigger] ➔ カチッと手動交代されました！サーバーへ次ターン要求（nextTurn）を発射します。",
  );
  socket.emit("playerAction", {
    roomCode: currentRoomCode,
    action: "nextTurn",
  });
  if (document.getElementById("btn-phone-next"))
    (document.getElementById("btn-phone-next") as HTMLButtonElement).disabled =
      true;
}

// 🛠️ 【デバッグ機能】
document.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest("#btn-debug-warp");
  if (!btn) return;
  e.preventDefault();

  const parentContainer = btn.closest("div") || document.body;
  const inputEl = (parentContainer.querySelector("input[type='number']") ||
    parentContainer.querySelector("input")) as HTMLInputElement;

  const targetVal = inputEl ? inputEl.value.trim() : "";

  const targetSquareId = parseInt(targetVal, 10);
  if (isNaN(targetSquareId) || targetSquareId < 0 || targetSquareId > 99) {
    alert("0〜99の範囲で有効な数字を入力してください");
    return;
  }

  console.log(
    `📱 [PHONE ACTION] 🛠️ デバッグワープ送信。ターゲットマスID: ${targetSquareId}`,
  );

  socket.emit("debugWarp", {
    roomCode: String(currentRoomCode).trim(),
    targetSquareId: Number(targetSquareId),
  });
});

function checkBranchSquareOnTurnStart(syncData) {
  console.log("🔍 [DEBUG] checkBranchSquareOnTurnStart 実行開始");

  if (document.getElementById("route-select-modal")) {
    return;
  }

  const currentIdx =
    syncData && syncData.activePlayerIndex !== undefined
      ? syncData.activePlayerIndex
      : activePlayerIndex;
  const currentPlayers =
    syncData && syncData.players ? syncData.players : players;

  if (!currentPlayers || currentPlayers.length === 0) {
    return;
  }

  const pObj = currentPlayers[currentIdx];
  if (!pObj) {
    return;
  }
  if (window.hasConfirmedThisTurn === true) {
    return;
  }
  if (Number(pObj.position) !== 0 && Number(pObj.position) !== 49) {
    return;
  }

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
  const playScreenContainer =
    document.getElementById("phone-screen-play") || document.body;
  playScreenContainer.insertAdjacentHTML("beforeend", modalHtml);

  const btnA = document.getElementById("btn-route-a");
  const btnB = document.getElementById("btn-route-b");
  const btnConfirm = document.getElementById(
    "btn-route-confirm",
  ) as HTMLButtonElement;
  let tempSelectedIdx = null;

  btnA.onclick = () => {
    tempSelectedIdx = 0;
    btnA.style.borderColor = "#00cb75";
    btnA.style.background = "#e6f9f1";
    btnA.style.color = "#00cb75";
    btnB.style.borderColor = "#ddd";
    btnB.style.background = "#fff";
    btnB.style.color = "#333";
    btnConfirm.disabled = false;
    btnConfirm.style.background = "#00cb75";
    btnConfirm.style.cursor = "pointer";
    socket.emit("previewRouteSelection", {
      roomCode: currentRoomCode,
      selectedRouteIndex: 0,
    });
  };
  btnB.onclick = () => {
    tempSelectedIdx = 1;
    btnB.style.borderColor = "#00cb75";
    btnB.style.background = "#e6f9f1";
    btnB.style.color = "#00cb75";
    btnA.style.borderColor = "#ddd";
    btnA.style.background = "#fff";
    btnA.style.color = "#333";
    btnConfirm.disabled = false;
    btnConfirm.style.background = "#00cb75";
    btnConfirm.style.cursor = "pointer";
    socket.emit("previewRouteSelection", {
      roomCode: currentRoomCode,
      selectedRouteIndex: 1,
    });
  };
  btnConfirm.onclick = () => {
    if (tempSelectedIdx === null) return;
    window.hasConfirmedThisTurn = true;
    console.log(
      `📱 [2.1 進路確定] ルートインデックス: ${tempSelectedIdx} を選択。ルーレット待機へ。`,
    );
    socket.emit("confirmRouteSelection", {
      roomCode: currentRoomCode,
      chosenRouteIdx: tempSelectedIdx,
    });
    document.getElementById("route-select-modal")?.remove();

    // 確定したのでルーレットボタンを点灯
    if (document.getElementById("btn-phone-spin"))
      (
        document.getElementById("btn-phone-spin") as HTMLButtonElement
      ).disabled = false;
    if (document.getElementById("roulette-result-display"))
      document.getElementById("roulette-result-display").textContent =
        "🎯 タップして回そう！";
  };
}

function loadAndApplySquareComponent(squareId, callback) {
  // 1. 既にメモリ上にロード済みであれば即時実行
  if (
    window.SQ_MODULES &&
    window.SQ_MODULES[squareId] &&
    (window.SQ_MODULES[squareId][currentGameMode] ||
      window.SQ_MODULES[squareId].normal)
  ) {
    if (typeof callback === "function") callback();
    return;
  }

  // 2. スクリプトの動的生成と確実な読み込み待ち
  const script = document.createElement("script");
  script.src = `/squares/sq_${squareId}.js?t=${Date.now()}`;
  script.onload = () => {
    setTimeout(() => {
      if (typeof callback === "function") callback();
    }, 10);
  };
  script.onerror = (err) => {
    console.error(
      `🚨 [LOAD ERROR] /squares/sq_${squareId}.js の読み込みに失敗しました。`,
      err,
    );
    if (typeof callback === "function") callback();
  };
  document.head.appendChild(script);
}
