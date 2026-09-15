const socket = io();

let roomCode = "";
let players = [];
let activePlayerIndex = 0;
let pcCurrentRotation = 0;
let isPCEventMode = false;

document.addEventListener("DOMContentLoaded", () => {
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
  const hostName = (hostNameInput && hostNameInput.value) ? hostNameInput.value : "やじま";
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
          text: `${window.location.origin}/controller.html?room=${roomCode}`,
          width: 128,
          height: 128
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
    if (data.activePlayerIndex !== undefined) activePlayerIndex = data.activePlayerIndex;
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

    // initSocketListeners() の中に追加してな！
  
  // 偶数が出て2回目に突入した時
  socket.on("startCoupleSecondRoulette", (data) => {
    const eventBox = document.getElementById("event-text");
    if (eventBox) {
      eventBox.innerHTML = `<p class="event-highlight-text" style="color: #d81b60; font-size: 1.5rem;">
        🔥 偶数達成！運命の告白チャンス突入！ 🔥<br>スマホから2回目のスピンを回してね！
      </p>`;
    }
  });

  // カップルイベントが完全に終わった時
  socket.on("coupleEventFinished", (data) => {
    // PC側のカップルモーダルを閉じる
    const pcModal = document.getElementById("pc-couple-event-modal");
    if (pcModal) {
      pcModal.classList.remove("active", "theme-couple");
    }
  isPCEventMode = false; // 通常モードに戻す
    // 結果をPC画面中央のイベントテキストにデカデカと表示
    const eventBox = document.getElementById("event-text");
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
  });

}

function switchScreen(targetId) {
  const screenIds = ["screen-setup", "screen-waiting", "screen-game"];
  screenIds.forEach(id => {
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
  players.forEach(p => {
    const li = document.createElement("li");
    li.textContent = `👤 ${p.name}`;
    ul.appendChild(li);
  });
}

function renderLocationPlayersList() {
  const container = document.getElementById("location-players-list");
  if (!container) return;

  const locationMap = {};
  players.forEach(p => {
    const loc = (p.location && p.location.trim() !== "") ? p.location : "スタート前";
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

  const jobMaster = (typeof JOBS !== 'undefined')
    ? JOBS.find(j => j.id === p.jobId || j.label === p.job || j.title === p.job)
    : null;

  const baseCap = jobMaster ? jobMaster.cap : (p.baseCap || 100);
  const bonusCap = p.bonusCap || 0;
  const maxHp = baseCap + bonusCap;

  if (p.currentHp === undefined) p.currentHp = maxHp;
  const currentHp = Math.max(0, p.currentHp);
  const drunkPercent = Math.min(100, Math.round(((maxHp - currentHp) / maxHp) * 100));

  const nameEl = document.getElementById("current-player-name");
  const jobEl = document.getElementById("current-player-job");
  if (nameEl) nameEl.textContent = p.name;
  if (jobEl) jobEl.textContent = jobMaster ? jobMaster.label : (p.job || "モブ");

// プレイヤーカードの色設定（board.jsのカラー配列と同期）
  const playerColors = [
    "#f44336", // 赤
    "#2196f3", // 青
    "#4caf50", // 緑
    "#ff9800", // オレンジ
    "#9c27b0", // 紫
    "#00bcd4", // シアン
    "#e91e63", // ピンク
    "#795548"  // 茶色
  ];

  const playerCardEl = document.querySelector(".current-player-card");
  if (playerCardEl) {
    // p.color があればそれを使用し、なければインデックスから自動割り当て
    const playerColor = p.color || playerColors[activePlayerIndex % playerColors.length];
    playerCardEl.style.background = `linear-gradient(135deg, ${playerColor} 0%, #2575fc 100%)`;
  }

  // リア充アイコン（❤️）の表示切り替え
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

  const locationEl = document.getElementById("current-player-location");
  if (locationEl) locationEl.textContent = p.location ? p.location : "-";

  renderLocationPlayersList();
}

// ─── pc.js : executeSyncedRoulette の修正 ───
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
  if (eventBox) eventBox.innerHTML = `<p class="event-msg">ルーレット回転中...</p>`;

  // 角度計算用の設定
  const targetDegrees = [342, 306, 270, 234, 198, 162, 126, 90, 54, 18] ;
  const stopAngle = targetDegrees[resultNum - 1];

  const currentMod = pcCurrentRotation % 360;
  pcCurrentRotation += 1800 + ((stopAngle - currentMod + 360) % 360);

  // ★修正：イベント中か通常時かで、回転させるホイール（要素）を100%正確に切り替える
  let wheel;
  if (typeof isPCEventMode !== 'undefined' && isPCEventMode) {
    // 開いている専用モーダル（#pc-event-modal）の中にあるルーレットを狙い撃ち
    wheel = document.querySelector("#pc-event-modal .event-roulette-wheel");
    if (!wheel) wheel = document.querySelector("#pc-couple-event-modal .couple-wheel");
  } else {
    // 通常時はメイン画面の通常ルーレット（※HTMLのIDに合わせて適宜調整してください）
    wheel = document.getElementById("controller-roulette-wheel") || document.getElementById("pc-roulette-wheel");
  }

  if (wheel) {
    console.log("[PCルーレット回転開始]", wheel);
    wheel.style.transition = "transform 3s cubic-bezier(0.15, 0.9, 0.2, 1)";
    wheel.style.transform = `rotate(${pcCurrentRotation}deg)`;
  } else {
    console.error("⚠️ エラー: 回転させるルーレットのHTML要素が見つかりません。");
  }

  // 3秒後に回転が停止した時の処理
  setTimeout(() => {
    if (resEl) resEl.textContent = `🎯 出目: ${resultNum}`;

    // ★修正：イベントモード中の場合は、すごろくの通常移動処理をスキップしてここで終了
    if (typeof isPCEventMode !== 'undefined' && isPCEventMode) {
      console.log(`[PCイベント中] 出目 ${resultNum} で停止。スマホ側の結果判定を待ちます。`);
      return; 
    }

    // ─── ここから下は「通常モード時」のすごろく移動ロジック（既存のコード） ───
    let targetPosition = p.position + resultNum;
    
    if (typeof MAP_SQUARES !== 'undefined') {
      for (let pos = p.position + 1; pos <= targetPosition; pos++) {
        const sq = MAP_SQUARES[pos];
        if (sq && (sq.type === "force_stop" || sq.type === "force_stop_rankup")) {
          targetPosition = pos;
          console.log(`強制ストップマス（ID: ${sq.id}, ${sq.text}）でピタッと停止します。`);
          break;
        }
      }
    }

    p.position = targetPosition;

    let squareLocation = "";
    if (typeof MAP_SQUARES !== 'undefined' && MAP_SQUARES[p.position]) {
      const sq = MAP_SQUARES[p.position];
      squareLocation = sq.location || "";
      
      if (eventBox) {
        eventBox.innerHTML = `<p class="event-msg">${sq.text || "何もないマスです。"}</p>`;
      }

      applySquareEffects(p, sq);

      const isJobSquare = sq.type === "jobChallenge" || sq.jobId || (sq.text && sq.text.includes("【役職マス】"));
      if (isJobSquare && !p.hasJob) {
        const jobId = sq.jobId || sq.type || "unknown_job";
        const jobName = sq.text ? sq.text.replace(/【役職マス】/g, "").trim() : "新しい役職";

        console.log("役職マスに到達しました。スマホへダイアログ表示を要求します:", { jobId, jobName });
        socket.emit("triggerJobChoice", {
          roomCode: roomCode,
          playerId: p.id,
          jobId: jobId,
          jobName: jobName
        });
      }

      if (sq.type === "force_stop" || sq.type === "force_stop_rankup") {
        handleForceStopSquare(p, sq);
      }
    }

    p.location = squareLocation;

    if (window.boardManager) {
      window.boardManager.draw(players, activePlayerIndex);
    }

    renderLocationPlayersList();
    updateCurrentPlayerDisplay();

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

function applySquareEffects(player, square) {
  const drinkAmount = square.drink !== undefined ? square.drink : 0;

  if (drinkAmount > 0) {
    if (!player.drinkCount) player.drinkCount = 0;
    player.drinkCount += drinkAmount;

    if (player.currentHp !== undefined) {
      player.currentHp = Math.max(0, player.currentHp - (drinkAmount * 10));
    }

    console.log(`${player.name} がマス「${square.text}」で ${drinkAmount} 杯飲みました。合計: ${player.drinkCount}杯`);
  }
}

// 🎯 追加：各イベントの共通設定データ（見た目のクラスやテキスト）
const GAME_EVENTS = {
  入学式: {
    class: "theme-entrance", // 入学式用のCSSを作ったらここに指定
    title: "🌸 入学式 🌸",
    desc: (name) => `${name} さんの大学生活がスタート！最初の新歓イベントに向けてルーレットを回そう！`
  },
  カップル: {
    class: "theme-couple",
    title: "💕 カップル成立チャンス！？ 💕",
    desc: (name) => `${name} さんがカップルマスに到着！運命の1回目スピンを回して【偶数】を狙え！`
  },
  ランクアップ: {
    class: "theme-rankup",
    title: "🔥 ランクアップチャンス 🔥",
    desc: (name) => `${name} さんの実力が試される時！ルーレットで【4以上】を出して上位役職へ這い上がれ！`
  },
  引退: {
    class: "theme-retirement",
    title: "🎓 サークル引退式 🎓",
    desc: (name) => `${name} さん、これまでの思い出を胸に引退！最後の特大乾杯イベントが始まる...！`
  }
};

// 🎯 追加：共通モーダルを綺麗に開くためのヘルパー関数
function openPCEventModal(eventType, playerName) {
  isPCEventMode = true; // 👈 前のステップで追加した「PCがイベント中か」のフラグをON
  
  const pcModal = document.getElementById("pc-event-modal");
  if (!pcModal) return;

  const config = GAME_EVENTS[eventType];
  if (!config) return;

  // 1. 一旦ついている可能性のある過去の着せ替えクラスをすべて綺麗に掃除する
  pcModal.className = "event-modal-overlay"; 

  // 2. 表示用のクラス（active）と、今回のイベント用の着せ替えクラス（theme-〇〇）を付与
  pcModal.classList.add("active", config.class);

  // 3. テキストを動的に書き換える
  const titleEl = pcModal.querySelector(".event-title");
  const descEl = pcModal.querySelector(".event-desc");
  if (titleEl) titleEl.textContent = config.title;
  if (descEl) descEl.textContent = config.desc(playerName);
}

// ─── 修正する handleForceStopSquare はここから ───
function handleForceStopSquare(player, square) {
  switch (square.id) {
    case 15:
      console.log(`${player.name} が入学式で強制停止しました。`);
      // 🎯 共通関数で入学式モーダルを開く
      openPCEventModal("入学式", player.name);
      
      // スマホ（子機）側へ入学式イベント開始を通知する場合はここに socket.emit を足す
      break;

    case 35:
      console.log(`${player.name} がカップル成立マスで停止しました。イベント開始！`);
      
      // 🎯 共通関数でスッキリとカップルモーダルを開く
      openPCEventModal("カップル", player.name);

      // スマホ側へカップルイベントの開始を通知する
      socket.emit("triggerCoupleEvent", {
        roomCode: roomCode,
        playerId: player.id,
        playerName: player.name
      });
      break;

    case 52:
      console.log(`${player.name} がランクアップチャンスで強制停止しました。`);
      // 🎯 共通関数でランクアップモーダルを開く
      openPCEventModal("ランクアップ", player.name);
      
      // スマホ（子機）側へランクアップ用の通知を送るならココに追記
      break;

    case 78:
      console.log(`${player.name} が引退マスで強制停止しました。`);
      // 🎯 共通関数で引退モーダルを開く
      openPCEventModal("引退", player.name);
      
      // スマホ（子機）側へ引退用の通知を送るならココに追記
      break;

    default:
      console.log(`${player.name} が強制ストップマスで停止しました。`);
      break;
  }
}
