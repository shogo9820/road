import React, { useState, useEffect, memo } from "react";
import { createRoot } from "react-dom/client";
import jsQR from "jsqr";

const socket = io();

// 📲 PWAインストールプロンプト（Android/Chrome）の保持
let deferredInstallPrompt: any = null;
let setInstallAvailableRef: ((v: boolean) => void) | null = null;
window.addEventListener("beforeinstallprompt", (e: any) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (setInstallAvailableRef) setInstallAvailableRef(true);
});
window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  if (setInstallAvailableRef) setInstallAvailableRef(false);
});

// 📷 QRコードの中身（参加URL または 4桁コード）からルームコードを取り出す
function extractRoomCodeFromQR(text: string): string | null {
  if (!text) return null;
  try {
    const u = new URL(text);
    const r = u.searchParams.get("room");
    if (r && /^\d{4}$/.test(r)) return r;
  } catch (_e) {}
  const m = text.match(/room=(\d{4})/) || text.match(/^\s*(\d{4})\s*$/);
  return m ? m[1] : null;
}
let currentRoomCode = "";
let activePlayerIndex = 0;
let players: any[] = [];
let isSpinning = false;
let currentRotation = 0;
let currentGameMode = "normal";

let syncMobileReactStateRef: (() => void) | null = null;
let setMobileScreenRef: ((screenId: string) => void) | null = null;
let setRoomInputRef: ((code: string) => void) | null = null;

Object.defineProperties(window, {
  socket: { get: () => socket, configurable: true },
  currentRoomCode: {
    get: () => currentRoomCode,
    set: (v) => {
      currentRoomCode = v;
      if (syncMobileReactStateRef) syncMobileReactStateRef();
    },
    configurable: true,
  },
  activePlayerIndex: {
    get: () => activePlayerIndex,
    set: (v) => {
      activePlayerIndex = v;
      if (syncMobileReactStateRef) syncMobileReactStateRef();
    },
    configurable: true,
  },
  players: {
    get: () => players,
    set: (v) => {
      players = v;
      if (syncMobileReactStateRef) syncMobileReactStateRef();
    },
    configurable: true,
  },
  isSpinning: {
    get: () => isSpinning,
    set: (v) => {
      isSpinning = v;
    },
    configurable: true,
  },
  currentRotation: {
    get: () => currentRotation,
    set: (v) => {
      currentRotation = v;
    },
    configurable: true,
  },
  currentGameMode: {
    get: () => currentGameMode,
    set: (v) => {
      currentGameMode = v;
      if (syncMobileReactStateRef) syncMobileReactStateRef();
    },
    configurable: true,
  },
});

function showScreen(targetId: string) {
  if (setMobileScreenRef) {
    setMobileScreenRef(targetId);
  }
}

function renderPlayerInputs() {
  if (syncMobileReactStateRef) syncMobileReactStateRef();
}

function updatePhoneStatusDisplay() {
  if (syncMobileReactStateRef) syncMobileReactStateRef();
  const activeP = players && players[activePlayerIndex];
  syncKoreanDOMMode(Boolean(activeP && activeP.koreanModeThisTurn));
}

// ==========================================================================
// 🇰🇷 【イ専用必殺技：한국어로 변환（韓国語モード）】DOM自動変換＆完全復元エンジン
// ==========================================================================
const KOREAN_DICT: [string, string][] = [
  ["スマホからルーレットを回してください！", "스마트폰에서 룰렛을 돌려주세요!"],
  ["スマホから運命のスピンを回してね！", "스마트폰에서 운명의 스핀을 돌려주세요!"],
  ["スマホから回してね！", "스마트폰에서 돌려주세요!"],
  ["完了！次のターンへ進んでください", "완료! 다음 턴으로 진행해주세요"],
  ["進路を確定してルーレットへ", "진로를 확정하고 룰렛으로"],
  ["進むルートをタップしてください。", "진행할 루트를 탭해주세요."],
  ["進路を選択してください", "진로를 선택해주세요"],
  ["運命の進路選択", "운명의 진로 선택"],
  ["タップして回そう！", "탭해서 돌려보자!"],
  ["ルーレット回転要求中...", "룰렛 회전 요청 중..."],
  ["ルーレット回転中...", "룰렛 회전 중..."],
  ["ルーレットを回す！", "룰렛 돌리기!"],
  ["生命保険を利用する", "생명보험 사용하기"],
  ["必殺技を発動", "필살기 발동"],
  ["次のプレイヤーへ", "다음 플레이어로"],
  ["次の人のターンへ", "다음 턴으로 넘기기"],
  ["いかれバーテンダー", "미친 바텐더"],
  ["おもしろキャラ", "개그 캐릭터"],
  ["いじられキャラ", "괴롭힘 캐릭터"],
  ["サッカーキャラ", "축구 캐릭터"],
  ["松竹所属芸人", "쇼치쿠 소속 연예인"],
  ["代表or副代表", "대표or부대표"],
  ["ミス龍大", "미스 류코쿠"],
  ["比嘉んちゅ", "히가시 사람"],
  ["沖縄出身", "오키나와 출신"],
  ["サイコパス", "사이코패스"],
  ["イケメン", "꽃미남"],
  ["ブサイク", "못생김"],
  ["韓国人", "한국인"],
  ["平安生", "헤이안생"],
  ["龍大生", "류코쿠대생"],
  ["副代表", "부대표"],
  ["代表", "대표"],
  ["モブ", "모브"],
  ["美人", "미인"],
  ["おもちゃ", "장난감"],
  ["雑魚", "잔챙이"],
  ["酒豪", "주호"],
  ["回転中...", "회전 중..."],
  ["幸福度", "행복도"],
  ["現在地", "현재 위치"],
  ["生命保険", "생명보험"],
  ["飲んだ杯数", "마신 잔 수"],
  ["体力", "체력"],
  ["役職", "직업"],
  ["恋人", "연인"],
  ["残り", "남은 횟수 "],
  ["結果", "결과"],
  ["出目", "나온 눈"],
  ["ワープ", "워프"],
  ["1回休み", "1회 휴식"],
  ["スタート前", "출발 전"],
  ["卒業式（ゴール）", "졸업식 (골)"],
  ["宅飲み", "홈파티"],
  ["とりき", "토리키"],
  ["ももじ", "모모지"],
  ["ぱいぱい", "파이파이"],
  ["家", "집"],
  ["なし", "없음"],
  ["あり", "있음"],
  ["はい", "예"],
  ["いいえ", "아니오"],
  ["マス", "칸"],
  ["回", "회"],
  ["杯", "잔"],
  ["枚", "장"],
  ["番", "번"],
  ["人", "명"],
];

const KANA_TO_HANGUL: Record<string, string> = {
  きゃ: "캬", きゅ: "큐", きょ: "쿄",
  しゃ: "샤", しゅ: "슈", しょ: "쇼",
  ちゃ: "차", ちゅ: "추", ちょ: "초",
  にゃ: "냐", にゅ: "뉴", にょ: "뇨",
  ひゃ: "햐", ひゅ: "휴", ひょ: "효",
  みゃ: "먀", みゅ: "뮤", みょ: "묘",
  りゃ: "랴", りゅ: "류", りょ: "료",
  ぎゃ: "갸", ぎゅ: "규", ぎょ: "교",
  じゃ: "자", じゅ: "주", じょ: "조",
  びゃ: "뱌", びゅ: "뷰", びょ: "뵤",
  ぴゃ: "퍄", ぴゅ: "퓨", ぴょ: "표",
  あ: "아", い: "이", う: "우", え: "에", お: "오",
  か: "카", き: "키", く: "쿠", け: "케", こ: "코",
  さ: "사", し: "시", す: "스", せ: "세", そ: "소",
  た: "타", ち: "치", つ: "츠", て: "테", と: "토",
  な: "나", に: "니", ぬ: "누", ね: "네", の: "노",
  は: "하", ひ: "히", ふ: "후", へ: "헤", ほ: "호",
  ま: "마", み: "미", む: "무", め: "메", も: "모",
  や: "야", ゆ: "유", よ: "요",
  ら: "라", り: "리", る: "루", れ: "레", ろ: "로",
  わ: "와", を: "오", ん: "응",
  が: "가", ぎ: "기", ぐ: "구", げ: "게", ご: "고",
  ざ: "자", じ: "지", ず: "즈", ぜ: "제", ぞ: "조",
  だ: "다", ぢ: "지", づ: "즈", で: "데", ど: "도",
  ば: "바", び: "비", ぶ: "부", べ: "베", ぼ: "보",
  ぱ: "파", ぴ: "피", ぷ: "푸", ぺ: "페", ぽ: "포",
  ぁ: "아", ぃ: "이", ぅ: "우", ぇ: "에", ぉ: "오",
  ゃ: "야", ゅ: "유", ょ: "요", っ: "ㅅ", ー: "-",
};

const DIGIT_TO_HANGUL: Record<string, string> = {
  "0": "영",
  "1": "일",
  "2": "이",
  "3": "삼",
  "4": "사",
  "5": "오",
  "6": "육",
  "7": "칠",
  "8": "팔",
  "9": "구",
};

function translateTextToKorean(raw: string): string {
  if (!raw || !raw.trim()) return raw;
  let s = raw;
  for (const [jp, ko] of KOREAN_DICT) {
    if (s.includes(jp)) {
      s = s.split(jp).join(ko);
    }
  }
  // カタカナをひらがなに寄せてからハングル音写
  s = s.replace(/[\u30A1-\u30F6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60),
  );
  for (const [k, h] of Object.entries(KANA_TO_HANGUL)) {
    if (s.includes(k)) {
      s = s.split(k).join(h);
    }
  }
  // 10 を先に 십 へ変換し、残りの数字 0〜9 をハングル数字へ
  s = s.replace(/10/g, "십");
  s = s.replace(/[0-9]/g, (d) => DIGIT_TO_HANGUL[d] || d);
  s = s.replace(/TURN:/gi, "턴:");
  s = s.replace(/HP:/gi, "체력:");
  s = s.replace(/pt/gi, "점");
  return s;
}

let isKoreanDOMActive = false;
let isApplyingKoreanMutation = false;
let koreanDOMObserver: MutationObserver | null = null;
const koreanNodeBackups = new Map<Text, { jp: string; ko: string }>();

function applyKoreanToSubtree(root: Node) {
  if (!isKoreanDOMActive) return;
  isApplyingKoreanMutation = true;
  try {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode() as Text | null;
    while (node) {
      const parentTag = node.parentElement?.tagName;
      if (parentTag !== "SCRIPT" && parentTag !== "STYLE") {
        const val = node.nodeValue || "";
        if (val.trim()) {
          const existing = koreanNodeBackups.get(node);
          if (!existing || val !== existing.ko) {
            const ko = translateTextToKorean(val);
            if (ko !== val) {
              koreanNodeBackups.set(node, { jp: val, ko });
              node.nodeValue = ko;
            }
          }
        }
      }
      node = walker.nextNode() as Text | null;
    }
  } finally {
    isApplyingKoreanMutation = false;
  }
}

function syncKoreanDOMMode(active: boolean) {
  if (active) {
    isKoreanDOMActive = true;
    applyKoreanToSubtree(document.body);
    if (!koreanDOMObserver) {
      koreanDOMObserver = new MutationObserver(() => {
        if (isApplyingKoreanMutation || !isKoreanDOMActive) return;
        applyKoreanToSubtree(document.body);
      });
      koreanDOMObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
  } else if (isKoreanDOMActive) {
    isKoreanDOMActive = false;
    if (koreanDOMObserver) {
      koreanDOMObserver.disconnect();
      koreanDOMObserver = null;
    }
    isApplyingKoreanMutation = true;
    try {
      koreanNodeBackups.forEach((backup, textNode) => {
        if (textNode.nodeValue === backup.ko) {
          textNode.nodeValue = backup.jp;
        }
      });
      koreanNodeBackups.clear();
    } finally {
      isApplyingKoreanMutation = false;
    }
  }
}

function syncSettingsToServer() {
  if (!currentRoomCode) return;

  const selectedMode =
    (
      document.querySelector(
        'input[name="phone-mode"]:checked',
      ) as HTMLInputElement
    )?.value ||
    currentGameMode ||
    "normal";
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

function playMobileRouletteAnimation(
  finalSteps: number,
  targetRotation: number,
  callback: (steps: number) => void,
) {
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

// 🧭 【基本ルーティン：行程⑤】プレイヤーが手動で就職の「はい／いいえ」を確定させた瞬間
function showJobChoiceDialog(jobId: string, jobName: string, playerId: string) {
  const overlay = document.getElementById("job-modal-overlay");
  const descEl = document.getElementById("job-modal-desc");
  if (!overlay || !descEl) return;

  descEl.textContent = `新しい役職「${jobName}」に就職しますか？`;
  const btnYesEl = document.getElementById("btn-job-yes");
  const btnNoEl = document.getElementById("btn-job-no");
  if (!btnYesEl || !btnNoEl || !btnYesEl.parentNode || !btnNoEl.parentNode)
    return;

  const newBtnYes = btnYesEl.cloneNode(true);
  const newBtnNo = btnNoEl.cloneNode(true);
  btnYesEl.parentNode.replaceChild(newBtnYes, btnYesEl);
  btnNoEl.parentNode.replaceChild(newBtnNo, btnNoEl);

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
        const jobObj = JOBS.find((j: any) => j.id === jobId);
        if (jobObj) {
          targetP.baseCap = jobObj.cap;
          targetP.currentHp = jobObj.cap + (targetP.bonusCap || 0);
        }
      }
      updatePhoneStatusDisplay();
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
      updatePhoneStatusDisplay();
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

// 📱 PC上のモーダル閉じるボタンの表示/非表示ヘルパー
function showPhoneClosePcModalBtn() {
  const btn = document.getElementById("btn-phone-close-pc-modal");
  if (btn) btn.style.display = "block";
}
function hidePhoneClosePcModalBtn() {
  const btn = document.getElementById("btn-phone-close-pc-modal");
  if (btn) btn.style.display = "none";
}

// 🧭 【基本ルーティン：行程⑥】手動進行でボタンをタップし、次の手番交代へバトンを繋ぐ瞬間
function sendNextTurn() {
  console.log(
    "📱 [⑥. 手動進行 Trigger] ➔ カチッと手動交代されました！サーバーへ次ターン要求（nextTurn）を発射します。",
  );
  socket.emit("closePcModal", { roomCode: currentRoomCode });
  hidePhoneClosePcModalBtn();
  socket.emit("playerAction", {
    roomCode: currentRoomCode,
    action: "nextTurn",
  });
  if (document.getElementById("btn-phone-next"))
    (document.getElementById("btn-phone-next") as HTMLButtonElement).disabled =
      true;
}

function checkBranchSquareOnTurnStart(syncData: any) {
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
  const pos = Number(pObj.position);
  if (pos !== 0 && pos !== 49) {
    return;
  }

  // sq_0.js / sq_49.js の routeConfig からルート選択モーダルの文言を参照
  const modObj = window.SQ_MODULES && window.SQ_MODULES[pos];
  const targetModule = modObj
    ? modObj[currentGameMode] || modObj.normal
    : null;
  const rCfg = (targetModule && targetModule.routeConfig) || {};
  const modalTitle = rCfg.title || "🧭 運命の進路選択";
  const modalDesc = rCfg.desc || "進むルートをタップしてください。";
  const routeALabel = rCfg.routeALabel || "Aルート（通常進路）";
  const routeBLabel = rCfg.routeBLabel || "Bルート（特殊進路）";
  const confirmLabel = rCfg.confirmLabel || "進路を確定してルーレットへ";

  let modalHtml = `
    <div id="route-select-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); display:flex; justify-content:center; align-items:center; z-index:999999; font-family:sans-serif;">
      <div style="background:#fff; width:90%; max-width:320px; padding:25px; border-radius:16px; text-align:center; box-sizing:border-box;">
        <h3 style="margin-top:0; color:#222; font-size:1.25rem; font-weight:bold;">${modalTitle}</h3>
        <p style="font-size:0.85rem; color:#666; margin-bottom:20px; line-height:1.4;">${modalDesc}</p>
        <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:22px;">
          <button id="btn-route-a" style="padding:14px; font-size:1rem; font-weight:bold; border:2px solid #ddd; border-radius:10px; background:#fff; color:#333; cursor:pointer; outline:none;">${routeALabel}</button>
          <button id="btn-route-b" style="padding:14px; font-size:1rem; font-weight:bold; border:2px solid #ddd; border-radius:10px; background:#fff; color:#333; cursor:pointer; outline:none;">${routeBLabel}</button>
        </div>
        <button id="btn-route-confirm" disabled style="width:100%; padding:14px; font-size:1.05rem; font-weight:bold; border:none; border-radius:10px; background:#ccc; color:#fff; cursor:not-allowed;">${confirmLabel}</button>
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
  let tempSelectedIdx: number | null = null;

  if (btnA && btnB && btnConfirm) {
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
}

function loadAndApplySquareComponent(squareId: number, callback: () => void) {
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
  script.src = `/squares/sq_${squareId}.js`;
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

// グローバルへの関数公開（sq_XX.js やインラインイベントから直接呼ばれるため必須）
(window as any).requestSpin = requestSpin;
(window as any).playMobileRouletteAnimation = playMobileRouletteAnimation;
(window as any).showJobChoiceDialog = showJobChoiceDialog;
(window as any).updatePhoneStatusDisplay = updatePhoneStatusDisplay;
window.loadAndApplySquareComponent = loadAndApplySquareComponent;

// sq_18.js / sq_30.js / sq_41.js が cloneNode & replaceChild を行うルーレット・ボタン領域を保護するメモ化コンポーネント
const MobileRouletteZone = memo(
  () => (
    <>
      <div className="player-banner-zone" id="current-player-banner">
        TURN: ----
      </div>

      <div
        className="roulette-section-container"
        style={{ width: "100%", maxWidth: "340px", margin: "0 auto" }}
      >
        <div className="result-display-zone" id="roulette-result-display">
          🎯 タップして回そう！
        </div>

        <div className="controller-roulette-container">
          <div className="event-roulette-pointer"></div>
          <div className="roulette-wheel-board" id="controller-roulette-wheel">
            <div className="roulette-num num-1">1</div>
            <div className="roulette-num num-2">2</div>
            <div className="roulette-num num-3">3</div>
            <div className="roulette-num num-4">4</div>
            <div className="roulette-num num-5">5</div>
            <div className="roulette-num num-6">6</div>
            <div className="roulette-num num-7">7</div>
            <div className="roulette-num num-8">8</div>
            <div className="roulette-num num-9">9</div>
            <div className="roulette-num num-10">10</div>
          </div>
        </div>
      </div>
    </>
  ),
  () => true,
);

const MobileActionButtonsZone = memo(
  () => {
    useEffect(() => {
      const spinBtn = document.getElementById("btn-phone-spin");
      if (spinBtn) {
        spinBtn.addEventListener("click", requestSpin);
      }
      const nextBtn = document.getElementById("btn-phone-next");
      if (nextBtn) {
        nextBtn.addEventListener("click", sendNextTurn);
      }
      const returnBtn = document.getElementById("btn-phone-return-title");
      if (returnBtn) {
        returnBtn.addEventListener("click", () => {
          console.log("📱 [PHONE ACTION] タイトル画面に戻るボタンが押されました");
          socket.emit("returnToTitle", { roomCode: currentRoomCode });
          try {
            sessionStorage.removeItem("salmons_room_code");
            sessionStorage.removeItem("salmons_player_name");
          } catch (_e) {}
          window.location.reload();
        });
      }
      const closePcBtn = document.getElementById("btn-phone-close-pc-modal");
      if (closePcBtn) {
        closePcBtn.addEventListener("click", () => {
          console.log("📱 [PHONE ACTION] PCモーダル閉じるボタンが押されました");
          socket.emit("closePcModal", { roomCode: currentRoomCode });
          closePcBtn.style.display = "none";
        });
      }
    }, []);

    return (
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          alignItems: "center",
          marginTop: "4px",
        }}
      >
        <button id="btn-phone-spin" className="btn-orange">
          ⚡ ルーレットを回す！
        </button>
        {/* 🛡️ 生命保険利用ボタン（常時表示仕様） */}
        <button id="btn-phone-use-insurance" disabled>
          🛡️ 生命保険を利用する
        </button>

        {/* ⚡ 必殺技発動ボタン（ランクアップ後のみ表示） */}
        <button
          id="btn-phone-use-skill"
          disabled
          style={{
            display: "none",
            background: "linear-gradient(135deg, #d84315 0%, #ff8f00 100%)",
            color: "#fff",
            fontWeight: "bold",
            border: "2px solid #ffd54f",
          }}
        >
          ⚡ 必殺技を発動（残り1回）
        </button>

        <button id="btn-phone-next" className="btn-blue">
          ➡ 次のプレイヤーへ
        </button>

        {/* ✖ PC画面のモーダルを手動で閉じるボタン */}
        <button
          id="btn-phone-close-pc-modal"
          style={{
            display: "none",
            background: "linear-gradient(135deg, #37474f 0%, #212121 100%)",
            color: "#ffffff",
            fontWeight: "bold",
            fontSize: "1.1rem",
            padding: "13px 20px",
            borderRadius: "30px",
            border: "2px solid #78909c",
            boxShadow: "0 4px 15px rgba(0, 0, 0, 0.4)",
            cursor: "pointer",
            width: "100%",
            textAlign: "center",
          }}
        >
          ✖ PC画面のモーダルを閉じる
        </button>

        {/* 🏠 ゲーム終了時のタイトル画面に戻るボタン */}
        <button
          id="btn-phone-return-title"
          style={{
            display: "none",
            background: "linear-gradient(135deg, #ff5722 0%, #ff9800 100%)",
            color: "#ffffff",
            fontWeight: "bold",
            fontSize: "1.15rem",
            padding: "14px 20px",
            borderRadius: "30px",
            border: "none",
            boxShadow: "0 6px 18px rgba(255, 87, 34, 0.4)",
            cursor: "pointer",
            width: "100%",
            textAlign: "center",
          }}
        >
          🏠 タイトル画面に戻る
        </button>
      </div>
    );
  },
  () => true,
);

const MobileModalsZone = memo(
  () => (
    <>
      {/* 🎯 役職選択用ダイアログ（モーダルオーバーレイ） */}
      <div
        id="job-modal-overlay"
        className="event-modal-overlay"
        style={{
          display: "none",
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "rgba(0, 0, 0, 0.6)",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 99999,
        }}
      >
        <div
          className="card"
          style={{
            background: "#fff",
            width: "85%",
            maxWidth: "340px",
            padding: "20px",
            borderRadius: "16px",
            textAlign: "center",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
          }}
        >
          <h3 style={{ marginTop: 0, color: "#9c27b0", fontSize: "1.3rem" }}>
            ✨ 役職マス発見！
          </h3>
          <p
            id="job-modal-desc"
            style={{
              fontWeight: "bold",
              fontSize: "0.95rem",
              whiteSpace: "pre-wrap",
              lineHeight: 1.5,
              marginBottom: "20px",
            }}
          >
            就職しますか？
          </p>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              id="btn-job-yes"
              className="btn-orange"
              style={{ padding: "10px", fontSize: "1.1rem" }}
            >
              はい
            </button>
            <button
              id="btn-job-no"
              className="btn-blue"
              style={{
                padding: "10px",
                fontSize: "1.1rem",
                backgroundColor: "#78909c",
              }}
            >
              いいえ
            </button>
          </div>
        </div>
      </div>

      {/* 🎯 スマホ側カップルイベント専用サブモーダル */}
      <div
        id="mobile-couple-event-modal"
        className="event-modal-overlay"
        style={{
          display: "none",
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "rgba(0, 0, 0, 0.6)",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 99998,
          boxSizing: "border-box",
          padding: "12px",
        }}
      >
        <div
          className="card theme-couple"
          style={{
            background: "#fff0f5",
            border: "3px solid #ff69b4",
            width: "100%",
            maxWidth: "360px",
            padding: "16px",
            borderRadius: "16px",
            textAlign: "center",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
          }}
        >
          <h3 style={{ marginTop: 0, color: "#d81b60", fontSize: "1.3rem" }}>
            💕 カップルイベント 💕
          </h3>
          <p
            className="couple-desc"
            style={{
              fontWeight: "bold",
              fontSize: "0.9rem",
              lineHeight: 1.4,
              marginBottom: "12px",
              color: "#333",
            }}
          >
            運命のルーレットを回そう！
          </p>
          <button
            id="btn-couple-spin"
            className="btn-pink"
            onClick={() => requestSpin()}
            style={{
              margin: "0 auto",
              maxWidth: "280px",
              backgroundColor: "#ff4081",
              color: "#fff",
            }}
          >
            💖 ルーレットを回す！
          </button>
        </div>
      </div>
    </>
  ),
  () => true,
);

// 📷 QRコード読み取りオーバーレイ（カメラ起動→QR検出→ルームコード通知）
function QRScannerOverlay({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [hint, setHint] = useState<string>("PC画面のQRコードを枠に合わせてください");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let rafId = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const Detector = (window as any).BarcodeDetector;
    const detector = Detector ? new Detector({ formats: ["qr_code"] }) : null;

    const handleText = (text: string): boolean => {
      const code = extractRoomCodeFromQR(text);
      if (code) {
        stopped = true;
        onDetected(code);
        return true;
      }
      setHint("このQRコードは参加用ではありません。PC画面のQRを読み取ってください");
      return false;
    };

    const tick = async () => {
      if (stopped) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        try {
          if (detector) {
            const found = await detector.detect(video);
            if (found && found.length > 0 && handleText(found[0].rawValue)) return;
          } else if (ctx) {
            const w = video.videoWidth;
            const h = video.videoHeight;
            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(video, 0, 0, w, h);
            const img = ctx.getImageData(0, 0, w, h);
            const res = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
            if (res && res.data && handleText(res.data)) return;
          }
        } catch (_e) {}
      }
      rafId = requestAnimationFrame(tick);
    };

    (async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMsg(
          "この接続（http）ではカメラを使えません。HTTPS接続またはlocalhostで開いてください。ルームコードの手入力は可能です。",
        );
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.setAttribute("playsinline", "true");
          await video.play();
        }
        rafId = requestAnimationFrame(tick);
      } catch (_e) {
        setErrorMsg(
          "カメラを起動できませんでした。ブラウザのカメラ許可を確認してください。",
        );
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div
      id="qr-scanner-overlay"
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        zIndex: 1000000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ position: "relative", width: "100%", flex: 1 }}>
        <video
          ref={videoRef}
          muted
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "62vw",
            maxWidth: "280px",
            aspectRatio: "1 / 1",
            transform: "translate(-50%, -50%)",
            border: "4px solid #ffeb3b",
            borderRadius: "18px",
            boxShadow: "0 0 0 100vmax rgba(0,0,0,0.5)",
            pointerEvents: "none",
          }}
        />
      </div>
      <div
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "16px",
          background: "#222",
          color: "#fff",
          textAlign: "center",
          fontWeight: "bold",
        }}
      >
        <div style={{ marginBottom: "12px", fontSize: "0.95rem", lineHeight: 1.5 }}>
          {errorMsg ? `⚠️ ${errorMsg}` : `📷 ${hint}`}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: "100%",
            maxWidth: "320px",
            padding: "12px",
            fontSize: "1rem",
            fontWeight: "bold",
            border: "none",
            borderRadius: "10px",
            background: "#eee",
            color: "#333",
            cursor: "pointer",
          }}
        >
          ✖ 閉じる
        </button>
      </div>
    </div>
  );
}

function ControllerApp() {
  const [activeScreen, setActiveScreen] =
    useState<string>("phone-screen-join");
  const [roomInput, setRoomInput] = useState<string>("");
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [installAvailable, setInstallAvailable] = useState<boolean>(
    Boolean(deferredInstallPrompt),
  );
  const [playersState, setPlayersState] = useState<any[]>([]);
  const [activeIdxState, setActiveIdxState] = useState<number>(0);
  const [modeState, setModeState] = useState<string>("normal");
  const [debugSquareInput, setDebugSquareInput] = useState<string>("");

  useEffect(() => {
    setMobileScreenRef = (screenId: string) => {
      setActiveScreen(screenId);
    };
    setRoomInputRef = (code: string) => {
      setRoomInput(code);
    };
    setInstallAvailableRef = (v: boolean) => setInstallAvailable(v);
    syncMobileReactStateRef = () => {
      setPlayersState([...players]);
      setActiveIdxState(activePlayerIndex);
      setModeState(currentGameMode);
    };

    initMobileListeners();

    return () => {
      setMobileScreenRef = null;
      setRoomInputRef = null;
      setInstallAvailableRef = null;
      syncMobileReactStateRef = null;
    };
  }, []);

  const handleQRDetected = (code: string) => {
    setIsScanning(false);
    setRoomInput(code);
    currentRoomCode = String(code);
    socket.emit("joinRoom", { roomCode: currentRoomCode });
  };

  const handleInstallApp = async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    try {
      await deferredInstallPrompt.userChoice;
    } catch (_e) {}
    deferredInstallPrompt = null;
    setInstallAvailable(false);
  };

  const handleJoinRoom = (e: React.MouseEvent | React.FormEvent) => {
    e.preventDefault();
    const codeInput = roomInput.trim();
    if (!codeInput) {
      alert("ルームコードを入力してください");
      return;
    }
    currentRoomCode = String(codeInput);
    socket.emit("joinRoom", { roomCode: currentRoomCode });
  };

  const handlePlayerNameChange = (idx: number, newName: string) => {
    if (players[idx]) {
      players[idx].name = newName;
      setPlayersState([...players]);
      syncSettingsToServer();
    }
  };

  const handleDeletePlayer = (idx: number) => {
    if (players.length <= 1) {
      alert("最低1人必要です");
      return;
    }
    players.splice(idx, 1);
    setPlayersState([...players]);
    syncSettingsToServer();
  };

  const handleAddPlayerRow = () => {
    const newId = "p_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    players.push({ id: newId, name: `プレイヤー${players.length + 1}` });
    setPlayersState([...players]);
    syncSettingsToServer();
  };

  const handleModeChange = (newMode: string) => {
    currentGameMode = newMode;
    setModeState(newMode);
    socket.emit("updateSettings", {
      roomCode: currentRoomCode,
      players: players,
      mode: newMode,
      gameMode: newMode,
    });
  };

  // 現在手番プレイヤーのステータス計算
  const p = playersState[activeIdxState];
  const jobMaster =
    p && typeof JOBS !== "undefined"
      ? JOBS.find(
          (j: any) => j.id === p.jobId || j.label === p.job || j.title === p.job,
        )
      : null;
  const baseCap = p ? (jobMaster ? jobMaster.cap : p.baseCap || 80) : 80;
  const maxHp = p ? baseCap + (p.bonusCap || 0) : 80;
  const currentHp = p
    ? p.currentHp !== undefined
      ? Math.max(0, p.currentHp)
      : maxHp
    : 80;
  const jobLabel = p
    ? p.isRankedUp && (p.job === "代表" || p.job === "副代表")
      ? p.job
      : (p.isRankedUp || (jobMaster && p.job === jobMaster.title)) && jobMaster
        ? jobMaster.title
        : jobMaster
          ? jobMaster.label
          : p.job || "モブ"
    : "モブ";
  const happinessVal = p && p.happiness !== undefined ? p.happiness : 100;

  return (
    <>
      <div className="phone-screen">
        {/* 【1】ルーム接続画面 */}
        <div
          id="phone-screen-join"
          className={`card phone-card ${activeScreen === "phone-screen-join" ? "active" : ""}`}
          style={{
            display: activeScreen === "phone-screen-join" ? "block" : "none",
          }}
        >
          <h1
            style={{ textAlign: "center", fontSize: "1.6rem", marginTop: 0 }}
          >
            📱 コントローラー
          </h1>
          <p
            style={{
              fontSize: "0.9rem",
              color: "#666",
              textAlign: "center",
              marginBottom: "20px",
            }}
          >
            PC画面に表示されているルームコードを入力してください
          </p>

          <form
            id="form-join-room"
            onSubmit={handleJoinRoom}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              width: "100%",
              alignItems: "center",
            }}
          >
            <div style={{ width: "100%", maxWidth: "340px" }}>
              <label
                style={{
                  display: "block",
                  fontWeight: "bold",
                  marginBottom: "6px",
                  fontSize: "0.95rem",
                }}
              >
                ルームコード（4桁）
              </label>
              <input
                type="number"
                id="input-room-code"
                placeholder="例: 1234"
                pattern="\d*"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                style={{
                  width: "100%",
                  padding: "14px",
                  fontSize: "1.3rem",
                  borderRadius: "12px",
                  border: "2px solid #ccc",
                  textAlign: "center",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <button
              type="button"
              id="btn-scan-qr"
              className="btn-blue"
              onClick={() => setIsScanning(true)}
            >
              📷 QRコードを読み取って参加
            </button>
            <button
              id="btn-join-room"
              className="btn-orange"
              onClick={handleJoinRoom}
            >
              🔑 ルームに接続する
            </button>
            {installAvailable && (
              <button
                type="button"
                id="btn-install-pwa"
                onClick={handleInstallApp}
                style={{
                  background: "#fff",
                  color: "#6a11cb",
                  border: "2px solid #6a11cb",
                  fontWeight: "bold",
                }}
              >
                📲 アプリとしてホーム画面に追加
              </button>
            )}
          </form>
        </div>

        {isScanning && (
          <QRScannerOverlay
            onDetected={handleQRDetected}
            onClose={() => setIsScanning(false)}
          />
        )}

        {/* 【2】ゲーム設定・参加待機画面 */}
        <div
          id="phone-screen-setup"
          className={`card phone-card ${activeScreen === "phone-screen-setup" ? "active" : ""}`}
          style={{
            display: activeScreen === "phone-screen-setup" ? "block" : "none",
          }}
        >
          <h2
            style={{
              marginTop: 0,
              borderBottom: "2px solid #e0e0e0",
              paddingBottom: "6px",
            }}
          >
            ⚙ 設定
          </h2>

          <div style={{ marginBottom: "16px", width: "100%" }}>
            <label
              style={{
                display: "block",
                fontWeight: "bold",
                marginBottom: "8px",
              }}
            >
              参加プレイヤー設定
            </label>
            <div id="phone-player-list">
              {playersState.map((pl, idx) => (
                <div
                  key={pl.id || idx}
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginBottom: "8px",
                  }}
                >
                  <input
                    type="text"
                    value={pl.name}
                    onChange={(e) =>
                      handlePlayerNameChange(idx, e.target.value)
                    }
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "6px",
                      border: "1px solid #ccc",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleDeletePlayer(idx)}
                    style={{
                      width: "auto",
                      padding: "8px 12px",
                      background: "#d9534f",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                    }}
                  >
                    ❌
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              id="btn-phone-add-player"
              className="btn-blue"
              onClick={handleAddPlayerRow}
              style={{
                fontSize: "1rem",
                padding: "10px",
                marginTop: "8px",
                maxWidth: "100%",
              }}
            >
              ➕ プレイヤーを追加
            </button>
          </div>

          <div style={{ marginBottom: "24px", width: "100%" }}>
            <label
              style={{
                display: "block",
                fontWeight: "bold",
                marginBottom: "6px",
              }}
            >
              ゲームモード:
            </label>
            <div
              style={{
                display: "flex",
                gap: "16px",
                background: "#f5f5f5",
                padding: "10px",
                borderRadius: "10px",
                justifyContent: "space-around",
              }}
            >
              <label style={{ fontWeight: "bold", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="phone-mode"
                  value="normal"
                  checked={modeState === "normal"}
                  onChange={() => handleModeChange("normal")}
                />{" "}
                通常
              </label>
              <label style={{ fontWeight: "bold", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="phone-mode"
                  value="short"
                  checked={modeState === "short"}
                  onChange={() => handleModeChange("short")}
                />{" "}
                ショート
              </label>
            </div>
          </div>

          <button
            id="btn-phone-start"
            className="btn-orange"
            onClick={sendStartGame}
          >
            🎮 ゲームスタート！
          </button>
        </div>

        {/* 【3】メインゲーム操作画面（プレイ中） */}
        <div
          id="phone-screen-play"
          className={`card phone-card ${activeScreen === "phone-screen-play" ? "active" : ""}`}
          style={{
            display: activeScreen === "phone-screen-play" ? "block" : "none",
            width: "100%",
          }}
        >
          {/* 1, 2, 3. バナー＆スマホ用ルーレットコンテナ */}
          <MobileRouletteZone />

          {/* 4. プレイヤーの簡易ステータス表示板 */}
          <div
            className="current-tile-or-event-status-box"
            style={{
              flexDirection: "column",
              gap: "4px",
              padding: "10px",
              fontSize: "0.95rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <span>
                👤 <span id="phone-current-name">{p ? p.name : "----"}</span> (
                <span id="phone-current-job">{jobLabel}</span>)
              </span>
              <span style={{ fontWeight: 900, color: "#e74c3c" }}>
                ❤ HP:{" "}
                <span id="phone-current-hp">
                  {p ? `${currentHp} / ${maxHp}` : "-- / --"}
                </span>
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                width: "100%",
                fontSize: "0.9rem",
                fontWeight: "bold",
                color: "#f39c12",
              }}
            >
              <span>
                😊 幸福度:{" "}
                <span id="phone-current-happiness">{`${happinessVal} pt`}</span>
              </span>
            </div>
          </div>

          {/* 5 & 6. メインアクション操作ボタン */}
          <MobileActionButtonsZone />

          {/* 🛠️ 開発デバッグ専用隠しメニューパネル */}
          <div
            className="developer-debug-zone-panel"
            style={{
              marginTop: "20px",
              paddingTop: "12px",
              borderTop: "2px dashed #ccc",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "8px",
                width: "100%",
                maxWidth: "280px",
              }}
            >
              <input
                type="number"
                id="input-debug-square"
                placeholder="マス番号 (0〜99)"
                min="0"
                max="99"
                value={debugSquareInput}
                onChange={(e) => setDebugSquareInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: "8px",
                  fontSize: "1rem",
                  borderRadius: "8px",
                  border: "1px solid #ccc",
                  textAlign: "center",
                }}
              />
              <button
                type="button"
                id="btn-debug-warp"
                className="btn-dark-debug"
                style={{
                  width: "auto",
                  padding: "8px 16px",
                  margin: 0,
                  fontSize: "0.95rem",
                }}
              >
                ワープ
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 役職モーダル ＆ カップル・イベントモーダル */}
      <MobileModalsZone />
    </>
  );
}

let hasBoundDocumentClicks = false;

function initMobileListeners() {
  const urlParams = new URLSearchParams(window.location.search);
  let savedRoom: string | null = null;
  try {
    savedRoom = sessionStorage.getItem("salmons_room_code");
  } catch (_e) {}
  const roomParam = urlParams.get("room") || savedRoom;

  if (roomParam) {
    if (setRoomInputRef) setRoomInputRef(roomParam);
    currentRoomCode = String(roomParam).trim();
    const doJoin = () => {
      socket.emit("joinRoom", { roomCode: currentRoomCode });
    };
    if (socket.connected) doJoin();
    else socket.once("connect", doJoin);
  }

  socket.off("joinedSuccess");
  socket.on("joinedSuccess", (data: any) => {
    currentRoomCode = data.roomCode;
    try {
      sessionStorage.setItem("salmons_room_code", String(data.roomCode));
    } catch (_e) {}

    if (data && data.isGameInProgress) {
      return;
    }

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

  socket.off("errorMsg");
  socket.on("errorMsg", (data: any) => {
    try {
      sessionStorage.removeItem("salmons_room_code");
    } catch (_e) {}
    showScreen("phone-screen-join");
    alert("エラー: " + data.message);
  });

  socket.off("applySettings");
  socket.on("applySettings", (data: any) => {
    if (
      data.players &&
      Array.isArray(data.players) &&
      data.players.length > 0
    ) {
      players = data.players;
      renderPlayerInputs();
    }
    const targetMode = data.mode || data.gameMode;
    if (targetMode) {
      currentGameMode = targetMode;
      if (syncMobileReactStateRef) syncMobileReactStateRef();
    }
  });

  // ==========================================================================
  // 🧭 【一本道リレー：行程④】サーバーからの着地号令（startSquareEvent）受信
  // スマホ側は「操作専任」として、役職モーダルやボタンUIを手元に展開します。
  // ==========================================================================
  socket.off("startSquareEvent");
  socket.on("startSquareEvent", (data: any) => {
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
      // 🚀 パターンB-2：宅飲みマスの場合（スマホに全員の敗者選択ボタンを展開）
      else if (p.location === "宅飲み") {
        console.log(
          `📱 [4.2 宅飲みミニゲーム] マスID: ${currentPos}。敗者選択画面を展開します。`,
        );
        const resDisplay = document.getElementById("roulette-result-display");
        const spinBtn = document.getElementById("btn-phone-spin");
        const playScreen =
          document.getElementById("phone-screen-play") || document.body;

        if (spinBtn) spinBtn.style.display = "none";
        if (resDisplay) {
          resDisplay.textContent = `🍻 ${p.name} からスタート！負けた人を選択してください`;
        }

        document.getElementById("takunomi-loser-zone")?.remove();

        const buttonsHtml = (players || [])
          .map((pl) => {
            let penaltyDrinks =
              targetModule.drink && Number(targetModule.drink) > 0
                ? Number(targetModule.drink)
                : 1;
            if (currentPos === 45) {
              penaltyDrinks = pl.jobId === "busaiku" ? 2 : 1;
            } else if (currentPos === 78) {
              penaltyDrinks = pl.isRankedUp ? 2 : 1;
            } else if (currentPos === 96) {
              penaltyDrinks = 2;
            }
            return `<button type="button" class="btn-takunomi-select btn-orange" data-player-id="${pl.id}" data-player-name="${pl.name}" data-drinks="${penaltyDrinks}" style="width:100%; max-width:300px; padding:12px; font-weight:bold; font-size:1.05rem; border-radius:10px; cursor:pointer;">🚨 ${pl.name} アウト！（🍺 ＋${penaltyDrinks}杯）</button>`;
          })
          .join("");

        const inlineZoneHtml = `
          <div id="takunomi-loser-zone" style="width:100%; display:flex; flex-direction:column; gap:8px; margin:10px auto; align-items:center;">
            <div style="font-weight:bold; font-size:1.05rem; color:#e65100; margin-bottom:4px; text-align:center;">
              🎲 ${targetModule.text || "宅飲みゲーム！"}<br>
              <span style="font-size:0.9rem; color:#333;">👉 <strong>${p.name}</strong> から始まる！負けた人をタップ👇</span>
            </div>
            ${buttonsHtml}
          </div>
        `;

        if (spinBtn) {
          spinBtn.insertAdjacentHTML("beforebegin", inlineZoneHtml);
        } else {
          playScreen.insertAdjacentHTML("beforeend", inlineZoneHtml);
        }

        const selectBtns = document.querySelectorAll(
          "#takunomi-loser-zone .btn-takunomi-select",
        );
        selectBtns.forEach((btn) => {
          (btn as HTMLButtonElement).onclick = (e) => {
            e.preventDefault();
            const targetEl = e.currentTarget as HTMLElement;
            const loserId = targetEl.getAttribute("data-player-id") || "";
            const loserName =
              targetEl.getAttribute("data-player-name") || "プレイヤー";
            const drinkAmt = parseInt(
              targetEl.getAttribute("data-drinks") || "1",
              10,
            );
            const sqHappiness =
              targetModule.happiness !== undefined
                ? Number(targetModule.happiness)
                : 0;

            document.getElementById("takunomi-loser-zone")?.remove();
            if (spinBtn) {
              spinBtn.style.display = "block";
              (spinBtn as HTMLButtonElement).disabled = true;
            }
            if (resDisplay) {
              resDisplay.textContent = `🚨 ${loserName} アウト！（🍺 ＋${drinkAmt}杯）`;
            }

            socket.emit("takunomiLoserSelected", {
              roomCode: currentRoomCode,
              squareId: currentPos,
              loserId,
              loserName,
              drinkAmount: drinkAmt,
              squareHappiness: sqHappiness,
              activePlayerId: p.id,
            });
          };
        });
      }
      // 🚀 パターンC：通常・回復・留年・分岐マスの扱い（効果計算後に完了通知を返して次へ）
      else {
        console.log(
          `📱 [4.2 通常マス] 特殊イベント無しのマスです。効果を適用して完了通知を送信します。`,
        );

        const jobMaster =
          typeof JOBS !== "undefined"
            ? JOBS.find(
                (j: any) =>
                  j.id === p.jobId || j.label === p.job || j.title === p.job,
              )
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
          p.currentHp = maxHp;
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

  socket.off("spinRoulette");
  socket.on("spinRoulette", (data: any) => {
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
  socket.off("applyPlayerAction");
  socket.on("applyPlayerAction", (data: any) => {
    if (data.action === "turnUpdated") {
      hidePhoneClosePcModalBtn();
      document.body.classList.remove(
        "theme-couple",
        "theme-entrance",
        "theme-insurance",
        "theme-rankup",
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
      if (spinBtn && spinBtn.parentNode) {
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
      document.getElementById("takunomi-loser-zone")?.remove();
      document.getElementById("skill-confirm-modal")?.remove();
      document.getElementById("skill-target-modal")?.remove();

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
      updatePhoneStatusDisplay();
    } else if (data.action === "turnSkipped") {
      hidePhoneClosePcModalBtn();
      if (data.activePlayerIndex !== undefined) {
        activePlayerIndex = data.activePlayerIndex;
      }
      const curP = players[activePlayerIndex];
      if (curP && curP.isRepeat) {
        document.body.classList.add("theme-repeat-dark");
      } else {
        document.body.classList.remove("theme-repeat-dark");
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
      updatePhoneStatusDisplay();
    } else if (data.action === "insuranceUsed") {
      if (document.getElementById("roulette-result-display")) {
        document.getElementById("roulette-result-display").textContent =
          "🛡️ 生命保険を発動！飲酒ペナルティを無効化しました！";
      }
      updatePhoneStatusDisplay();
    }
  });

  // 🎯 汎用モーダルの展開指示を受信（80番引退ギャンブル等）
  socket.off("openCustomRouletteModal");
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

  // 🎯 決着通知（手元のモーダルを閉じる ＆ PCモーダル閉じるボタン表示）
  socket.off("customRouletteFinished");
  socket.on("customRouletteFinished", (data: any) => {
    const modal = document.getElementById("mobile-couple-event-modal");
    if (modal) modal.style.display = "none";
    if (
      document.getElementById("roulette-result-display") &&
      data &&
      data.message
    ) {
      document.getElementById("roulette-result-display").textContent =
        `🎯 結果: ${data.message}`;
    }
    showPhoneClosePcModalBtn();
  });

  socket.off("skillEffectResolved");
  socket.on("skillEffectResolved", (data: any) => {
    if (
      document.getElementById("roulette-result-display") &&
      data &&
      data.resultMessage
    ) {
      document.getElementById("roulette-result-display").textContent =
        `⚡ ${data.resultMessage}`;
    }
    showPhoneClosePcModalBtn();
  });

  socket.off("skillUsed");
  socket.on("skillUsed", () => {
    showPhoneClosePcModalBtn();
  });

  // ==========================================================================
  // 🧭 syncGameState 受信部（ステータス同期・ターン開始制御 専用版）
  // ==========================================================================
  socket.off("syncGameState");
  socket.on("syncGameState", (data: any) => {
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

    // 保険ボタンの更新（このターンに飲酒が発生し、交代待ちフェーズ中のときのみ利用可能）
    const insuranceBtn = document.getElementById(
      "btn-phone-use-insurance",
    ) as HTMLButtonElement;
    if (insuranceBtn) {
      const insuranceCount = p.insurance !== undefined ? p.insurance : 0;
      const isAutoInsuranceSquare =
        Number(p.position) === 80 &&
        window.serverCurrentPhase === "4.SQUARE_LANDED";
      const isWaitNextPhase = window.serverCurrentPhase === "6.WAIT_NEXT";
      const turnStartDrinks =
        p.turnStartDrinkCount !== undefined ? p.turnStartDrinkCount : 0;
      const hasDrunkThisTurn =
        (p.drinkCount || 0) > turnStartDrinks && Number(p.position) !== 30;

      if (isAutoInsuranceSquare) {
        insuranceBtn.disabled = true;
        insuranceBtn.textContent =
          insuranceCount > 0
            ? `🛡️ 生命保険 全${insuranceCount}枚 自動発動中！`
            : `🛡️ 生命保険を利用する (0枚)`;
      } else if (
        insuranceCount > 0 &&
        currentIdx === activePlayerIndex &&
        isWaitNextPhase &&
        hasDrunkThisTurn
      ) {
        insuranceBtn.disabled = false;
        insuranceBtn.textContent = `🛡️ 生命保険を利用する (${insuranceCount}枚所持)`;
      } else {
        insuranceBtn.disabled = true;
        insuranceBtn.textContent = `🛡️ 生命保険を利用する (${insuranceCount}枚)`;
      }
    }

    // ⚡ 必殺技ボタンの更新（ランクアップ後のみ表示し、効果ごとのタイミングで有効化）
    const skillBtn = document.getElementById(
      "btn-phone-use-skill",
    ) as HTMLButtonElement;
    if (skillBtn) {
      if (!p.isRankedUp) {
        skillBtn.style.display = "none";
      } else {
        skillBtn.style.display = "block";
        const jobMaster =
          typeof JOBS !== "undefined" && Array.isArray(JOBS)
            ? JOBS.find(
                (j: any) =>
                  j.id === p.jobId || j.label === p.job || j.title === p.job,
              )
            : null;
        const skillCfg = jobMaster && jobMaster.skill ? jobMaster.skill : null;
        const defaultMaxUses =
          skillCfg && skillCfg.maxUses ? Number(skillCfg.maxUses) : 1;
        const skillUses =
          p.skillUsesLeft !== undefined
            ? Number(p.skillUsesLeft)
            : defaultMaxUses;
        const timing = skillCfg ? skillCfg.timing : "any";
        const isWaitSpin = window.serverCurrentPhase === "2.WAIT_SPIN";
        const isWaitNext = window.serverCurrentPhase === "6.WAIT_NEXT";
        const turnStartDrinks =
          p.turnStartDrinkCount !== undefined ? p.turnStartDrinkCount : 0;
        const drunkThisTurn = Math.max(0, (p.drinkCount || 0) - turnStartDrinks);
        const hasDrunkThisTurn =
          drunkThisTurn >= 1 && Number(p.position) !== 30;
        const hasMultiDrunkThisTurn =
          drunkThisTurn >= 2 && Number(p.position) !== 30;

        let canUseTiming = false;
        if (p.usedSkillThisTurn) {
          canUseTiming = false;
        } else if (timing === "before_spin") {
          canUseTiming = isWaitSpin;
        } else if (timing === "after_land_multi_drink") {
          canUseTiming = isWaitNext && hasMultiDrunkThisTurn;
        } else if (timing === "after_land_drink") {
          canUseTiming = isWaitNext && hasDrunkThisTurn;
        } else if (timing === "after_land") {
          canUseTiming = isWaitNext;
        } else {
          canUseTiming = isWaitSpin || isWaitNext;
        }

        if (skillUses <= 0) {
          skillBtn.disabled = true;
          skillBtn.textContent = `⚡ 必殺技を発動（残り0回）`;
          skillBtn.style.opacity = "0.5";
        } else if (currentIdx === activePlayerIndex && canUseTiming) {
          skillBtn.disabled = false;
          skillBtn.textContent = `⚡ 必殺技を発動（残り${skillUses}回）`;
          skillBtn.style.opacity = "1";
        } else {
          skillBtn.disabled = true;
          skillBtn.textContent = `⚡ 必殺技を発動（残り${skillUses}回）`;
          skillBtn.style.opacity = "0.6";
        }
      }
    }

    // 🇰🇷 イの韓国語変換モード同期
    syncKoreanDOMMode(Boolean(p && p.koreanModeThisTurn));

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
        loadAndApplySquareComponent(pos, () => {
          checkBranchSquareOnTurnStart(data);
        });
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

  socket.off("enableNextTurnButton");
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

  socket.off("gameAllFinished");
  socket.on("gameAllFinished", (data: any) => {
    if (data && data.players) players = data.players;
    const spinBtn = document.getElementById(
      "btn-phone-spin",
    ) as HTMLButtonElement;
    if (spinBtn) spinBtn.style.display = "none";
    const nextBtn = document.getElementById(
      "btn-phone-next",
    ) as HTMLButtonElement;
    if (nextBtn) nextBtn.style.display = "none";
    const insBtn = document.getElementById(
      "btn-phone-use-insurance",
    ) as HTMLButtonElement;
    if (insBtn) insBtn.style.display = "none";
    const skillBtn = document.getElementById(
      "btn-phone-use-skill",
    ) as HTMLButtonElement;
    if (skillBtn) skillBtn.style.display = "none";

    const returnBtn = document.getElementById("btn-phone-return-title");
    if (returnBtn) returnBtn.style.display = "block";

    if (document.getElementById("current-player-banner")) {
      document.getElementById("current-player-banner").textContent =
        "🎊 全員卒業！ゲーム終了！ 🎊";
    }
    if (document.getElementById("roulette-result-display")) {
      // 最多飲酒プレイヤー（酒豪王）
      const maxDrinks = Math.max(
        0,
        ...players.map((pl) => pl.drinkCount || 0),
      );
      const topDrinkers =
        maxDrinks > 0
          ? players
              .filter((pl) => (pl.drinkCount || 0) === maxDrinks)
              .map((pl) => pl.name)
          : [];
      const kingText =
        topDrinkers.length > 0
          ? `\n🍺 酒豪王: ${topDrinkers.join("・")}（${maxDrinks}杯）`
          : "";
      document.getElementById("roulette-result-display").textContent =
        `🎉 全員ゴール達成！お疲れ様でした！${kingText}`;
    }
    updatePhoneStatusDisplay();
  });

  // 🏠 サーバーからのタイトル画面復帰号令を受信
  socket.off("returnToTitle");
  socket.on("returnToTitle", () => {
    console.log("📱 [PHONE SOCKET] returnToTitle 受信 ➔ タイトル画面へ戻ります");
    try {
      sessionStorage.removeItem("salmons_room_code");
      sessionStorage.removeItem("salmons_player_name");
    } catch (_e) {}
    window.location.reload();
  });

  // 🧭 【一本道リレー：手順1】スマホで「ゲーム開始」が手動タップされた瞬間
  socket.off("gameStarted");
  socket.on("gameStarted", (data: any) => {
    if (data && data.players) players = data.players;
    if (data && (data.mode || data.gameMode)) {
      currentGameMode = data.mode || data.gameMode;
    }
    console.log(
      "📱 [①. 新ターン開始] ➔ サーバーからゲーム開始電波(gameStarted)を受信。ここで初めて手動操作権をロードします。",
    );
    showScreen("phone-screen-play");
    activePlayerIndex =
      data && data.activePlayerIndex !== undefined
        ? data.activePlayerIndex
        : 0;
    updatePhoneStatusDisplay();
  });

  socket.off("fireTornadoSpin");
  socket.on("fireTornadoSpin", (data: any) => {
    const resNum = data && data.result !== undefined ? data.result : 1;
    const targetDegrees = [342, 306, 270, 234, 198, 162, 126, 90, 54, 18];
    currentRotation +=
      1800 + ((targetDegrees[resNum - 1] - (currentRotation % 360) + 360) % 360);
    playMobileRouletteAnimation(resNum, currentRotation, () => {
      showPhoneClosePcModalBtn();
    });
  });

  // ✖ サーバーからPCモーダル手動クローズ号令を受信
  socket.off("closePcModal");
  socket.on("closePcModal", () => {
    console.log("📱 [PHONE SOCKET] closePcModal 受信 ➔ 閉じるボタンを非表示");
    hidePhoneClosePcModalBtn();
  });

  // 乾杯イベント受信時：スマホに「PCモーダルを閉じる」ボタンを表示
  socket.off("showKanpaiModal");
  socket.on("showKanpaiModal", () => {
    showPhoneClosePcModalBtn();
  });
  socket.off("openBijinKanpaiModal");
  socket.on("openBijinKanpaiModal", () => {
    showPhoneClosePcModalBtn();
  });

  // 宅飲みミニゲーム終了時
  socket.off("takunomiEventFinished");
  socket.on("takunomiEventFinished", () => {
    showPhoneClosePcModalBtn();
  });

  // ゴール祝福時
  socket.off("showGoalModal");
  socket.on("showGoalModal", () => {
    showPhoneClosePcModalBtn();
  });
  socket.off("triggerGoalCelebration");
  socket.on("triggerGoalCelebration", () => {
    showPhoneClosePcModalBtn();
  });

  // 卒業判定（89番）
  socket.off("showGraduateNextButton");
  socket.on("showGraduateNextButton", () => {
    showPhoneClosePcModalBtn();
  });
  socket.off("graduateFailedRepeat");
  socket.on("graduateFailedRepeat", () => {
    showPhoneClosePcModalBtn();
  });

  // ドキュメントクリックイベント（生命保険確認モーダル ＆ デバッグワープ）
  if (!hasBoundDocumentClicks) {
    hasBoundDocumentClicks = true;

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

    // ⚡ 【必殺技の発動確認 ＆ 対象選択モーダル】
    document.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest(
        "#btn-phone-use-skill",
      ) as HTMLButtonElement;
      if (!btn || btn.disabled) return;
      e.preventDefault();

      const p = players[activePlayerIndex];
      if (!p || !p.isRankedUp) return;
      const skillUses =
        p.skillUsesLeft !== undefined ? Number(p.skillUsesLeft) : 1;
      if (skillUses <= 0) return;

      const jobMaster =
        typeof JOBS !== "undefined" && Array.isArray(JOBS)
          ? JOBS.find(
              (j: any) =>
                j.id === p.jobId || j.label === p.job || j.title === p.job,
            )
          : null;
      const skillCfg =
        jobMaster && jobMaster.skill
          ? jobMaster.skill
          : {
              name: "必殺技",
              desc: "上位役職の必殺技を発動します！",
              timing: "any",
              targetType: "none",
            };
      const jobTitle =
        p.job === "代表" || p.job === "副代表"
          ? p.job
          : jobMaster
            ? jobMaster.title
            : p.job || "上位役職";

      const displaySkillName =
        p.jobId === "mob" && p.job === "代表"
          ? "代表権限"
          : p.jobId === "mob" && p.job === "副代表"
            ? "副代表権限"
            : skillCfg.name;
      const displaySkillDesc =
        p.jobId === "mob" && p.job === "代表"
          ? "指名した相手から生命保険を2枚もらう"
          : p.jobId === "mob" && p.job === "副代表"
            ? "指名した相手から生命保険を1枚もらう"
            : skillCfg.desc;

      const timingLabel =
        skillCfg.timing === "before_spin"
          ? "ターン開始時（ルーレットを回す前）"
          : skillCfg.timing === "after_land_multi_drink"
            ? "複数杯飲むマスに止まった時"
            : skillCfg.timing === "after_land_drink"
              ? "マス到着・飲酒発生時"
              : "ルーレット前 / マス到着後";

      const confirmHtml = `
        <div id="skill-confirm-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); display:flex; justify-content:center; align-items:center; z-index:999999; font-family:sans-serif;">
          <div style="background:#fff; width:92%; max-width:340px; padding:22px; border-radius:16px; text-align:center; box-sizing:border-box; border:3px solid #ff8f00;">
            <div style="font-size:0.85rem; font-weight:bold; color:#e65100; margin-bottom:4px;">👑 ${jobTitle} 専用必殺技</div>
            <h3 style="margin:0 0 10px 0; color:#d84315; font-size:1.3rem; font-weight:900;">⚡ ${displaySkillName}</h3>
            <div style="background:#fff8e1; border:1px solid #ffe082; border-radius:10px; padding:12px; font-size:0.9rem; color:#333; margin-bottom:12px; line-height:1.5; font-weight:bold;">
              ${displaySkillDesc}
            </div>
            <div style="font-size:0.78rem; color:#666; margin-bottom:14px;">使用タイミング: ${timingLabel}</div>
            <p style="font-size:0.95rem; font-weight:bold; color:#222; margin:0 0 16px 0;">必殺技を発動しますか？（残り${skillUses}回）</p>
            <div style="display:flex; gap:10px;">
              <button id="btn-skill-yes" style="flex:1; padding:12px; font-weight:bold; background:linear-gradient(135deg, #d84315 0%, #ff8f00 100%); color:#fff; border:none; border-radius:10px; cursor:pointer; font-size:1rem;">はい</button>
              <button id="btn-skill-no" style="flex:1; padding:12px; font-weight:bold; background:#eee; color:#333; border:none; border-radius:10px; cursor:pointer; font-size:1rem;">いいえ</button>
            </div>
          </div>
        </div>
      `;

      const playScreen =
        document.getElementById("phone-screen-play") || document.body;
      document.getElementById("skill-confirm-modal")?.remove();
      playScreen.insertAdjacentHTML("beforeend", confirmHtml);

      const btnNo = document.getElementById("btn-skill-no");
      if (btnNo) {
        btnNo.onclick = () => {
          document.getElementById("skill-confirm-modal")?.remove();
        };
      }

      const btnYes = document.getElementById("btn-skill-yes");
      if (btnYes) {
        btnYes.onclick = () => {
          document.getElementById("skill-confirm-modal")?.remove();

          // ブサイク必殺技「みちづれ」で恋人がいるリア充がいるか事前判定
          let effectiveTargetType = skillCfg.targetType || "none";
          if (effectiveTargetType === "busaiku_special") {
            const hasRiajuu = (players || []).some(
              (op) =>
                op &&
                String(op.id) !== String(p.id) &&
                (op.isLover || (Array.isArray(op.lovers) && op.lovers.length > 0)),
            );
            effectiveTargetType = hasRiajuu ? "none" : "single";
          }

          // 1. PC大画面に「〇〇が必殺技を発動！」モーダルを表示させる
          socket.emit("skillActivated", {
            roomCode: currentRoomCode,
            playerId: p.id,
            playerName: p.name,
            jobId: p.jobId,
            jobTitle: jobTitle,
            skillName: displaySkillName,
            skillDesc: displaySkillDesc,
            targetType: effectiveTargetType,
          });

          // 2. 対象選択が不要な技はそのまま効果発動
          if (effectiveTargetType === "none") {
            socket.emit("executeSkillEffect", {
              roomCode: currentRoomCode,
              playerId: p.id,
            });
            return;
          }

          // 3. 効果に応じたスマホ専用ターゲット選択モーダルを展開
          openSkillTargetSelectionModal(
            p,
            skillCfg,
            effectiveTargetType,
            playScreen,
          );
        };
      }
    });

    function openSkillTargetSelectionModal(
      p: any,
      skillCfg: any,
      targetType: string,
      container: HTMLElement,
    ) {
      document.getElementById("skill-target-modal")?.remove();

      // パターンA-0: ファイアトルネード専用ルーレット発射モーダル（soccer）
      if (targetType === "fire_tornado") {
        const html = `
          <div id="skill-target-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); display:flex; justify-content:center; align-items:center; z-index:999999; font-family:sans-serif;">
            <div style="background:#fff; width:92%; max-width:340px; padding:24px; border-radius:16px; text-align:center; box-sizing:border-box; border:3px solid #ff3d00;">
              <h3 style="margin:0 0 8px 0; color:#d84315; font-size:1.3rem; font-weight:900;">⚽🔥 ${skillCfg.name}</h3>
              <p style="font-size:0.92rem; color:#333; margin:0 0 18px 0; font-weight:bold; line-height:1.5;">PC画面のルーレットにプレイヤーが均等配置されました！<br>当たったプレイヤーが <span style="color:#d84315; font-size:1.1rem;">3杯</span> 飲みます！</p>
              <button type="button" id="btn-fire-tornado-spin" style="width:100%; padding:16px; font-size:1.1rem; font-weight:900; background:linear-gradient(135deg, #d84315 0%, #ff8f00 100%); color:#fff; border:none; border-radius:12px; cursor:pointer; box-shadow:0 4px 12px rgba(216,67,21,0.4);">🌪️ ファイアトルネードを放つ！</button>
            </div>
          </div>
        `;
        container.insertAdjacentHTML("beforeend", html);
        const fireBtn = document.getElementById(
          "btn-fire-tornado-spin",
        ) as HTMLButtonElement;
        if (fireBtn) {
          fireBtn.onclick = () => {
            fireBtn.disabled = true;
            document.getElementById("skill-target-modal")?.remove();
            socket.emit("executeSkillEffect", {
              roomCode: currentRoomCode,
              playerId: p.id,
            });
          };
        }
        return;
      }

      // パターンA: 出目（1〜10）を指定するモーダル（龍大生）
      if (targetType === "dice") {
        let diceBtns = "";
        for (let d = 1; d <= 10; d++) {
          diceBtns += `<button type="button" class="btn-skill-dice" data-dice="${d}" style="padding:14px 0; font-size:1.2rem; font-weight:bold; background:#ff8f00; color:#fff; border:none; border-radius:10px; cursor:pointer;">${d}マス</button>`;
        }
        const html = `
          <div id="skill-target-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); display:flex; justify-content:center; align-items:center; z-index:999999; font-family:sans-serif;">
            <div style="background:#fff; width:92%; max-width:340px; padding:22px; border-radius:16px; text-align:center; box-sizing:border-box;">
              <h3 style="margin:0 0 8px 0; color:#d84315; font-size:1.2rem;">⚡ ${skillCfg.name}</h3>
              <p style="font-size:0.9rem; color:#333; margin:0 0 14px 0; font-weight:bold;">進むマス数（1〜10）を選択してください</p>
              <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:8px;">
                ${diceBtns}
              </div>
            </div>
          </div>
        `;
        container.insertAdjacentHTML("beforeend", html);
        document.querySelectorAll("#skill-target-modal .btn-skill-dice").forEach((b) => {
          (b as HTMLButtonElement).onclick = (ev) => {
            const diceVal = parseInt(
              (ev.currentTarget as HTMLElement).getAttribute("data-dice") || "1",
              10,
            );
            document.getElementById("skill-target-modal")?.remove();
            socket.emit("executeSkillEffect", {
              roomCode: currentRoomCode,
              playerId: p.id,
              chosenDice: diceVal,
            });
          };
        });
        return;
      }

      // パターンA-2: 代表（副代表）権限で相手から生命保険をもらうモーダル（mob）
      if (targetType === "mob_insurance") {
        const candidates = (players || []).filter(
          (pl) => pl && String(pl.id) !== String(p.id),
        );
        const listToUse = candidates.length > 0 ? candidates : players || [];
        let currentMobRole =
          p.job === "副代表" ? "副代表" : "代表";
        const showRoleToggle =
          p.job !== "代表" && p.job !== "副代表";

        const roleToggleHtml = showRoleToggle
          ? `<div style="display:flex; gap:8px; margin-bottom:12px;">
               <button type="button" id="btn-mob-role-rep" style="flex:1; padding:8px; font-weight:bold; border:2px solid #d84315; background:#fbe9e7; color:#d84315; border-radius:8px; cursor:pointer;">👑 代表 (2枚)</button>
               <button type="button" id="btn-mob-role-vice" style="flex:1; padding:8px; font-weight:bold; border:2px solid #ccc; background:#fff; color:#555; border-radius:8px; cursor:pointer;">🛡️ 副代表 (1枚)</button>
             </div>`
          : "";

        const buttonsHtml = listToUse
          .map(
            (pl) =>
              `<button type="button" class="btn-skill-mob-target" data-id="${pl.id}" style="padding:13px; font-size:1rem; font-weight:bold; border:none; border-radius:10px; background:linear-gradient(135deg, #d84315 0%, #ff8f00 100%); color:#fff; cursor:pointer;">🎯 ${pl.name} からもらう（保有: 🛡️${pl.insurance || 0}枚）</button>`,
          )
          .join("");

        const html = `
          <div id="skill-target-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); display:flex; justify-content:center; align-items:center; z-index:999999; font-family:sans-serif;">
            <div style="background:#fff; width:92%; max-width:340px; padding:22px; border-radius:16px; text-align:center; box-sizing:border-box;">
              <h3 style="margin:0 0 8px 0; color:#d84315; font-size:1.2rem;">⚡ ${p.job === "代表" ? "代表権限" : p.job === "副代表" ? "副代表権限" : skillCfg.name}</h3>
              <p style="font-size:0.9rem; color:#333; margin:0 0 12px 0; font-weight:bold;">生命保険をもらう相手を1人指名してください</p>
              ${roleToggleHtml}
              <div style="display:flex; flex-direction:column; gap:10px;">
                ${buttonsHtml}
              </div>
            </div>
          </div>
        `;
        container.insertAdjacentHTML("beforeend", html);

        const repBtn = document.getElementById("btn-mob-role-rep");
        const viceBtn = document.getElementById("btn-mob-role-vice");
        if (repBtn && viceBtn) {
          repBtn.onclick = () => {
            currentMobRole = "代表";
            repBtn.style.borderColor = "#d84315";
            repBtn.style.background = "#fbe9e7";
            repBtn.style.color = "#d84315";
            viceBtn.style.borderColor = "#ccc";
            viceBtn.style.background = "#fff";
            viceBtn.style.color = "#555";
          };
          viceBtn.onclick = () => {
            currentMobRole = "副代表";
            viceBtn.style.borderColor = "#d84315";
            viceBtn.style.background = "#fbe9e7";
            viceBtn.style.color = "#d84315";
            repBtn.style.borderColor = "#ccc";
            repBtn.style.background = "#fff";
            repBtn.style.color = "#555";
          };
        }

        document
          .querySelectorAll("#skill-target-modal .btn-skill-mob-target")
          .forEach((b) => {
            (b as HTMLButtonElement).onclick = (ev) => {
              const targetId =
                (ev.currentTarget as HTMLElement).getAttribute("data-id") || "";
              document.getElementById("skill-target-modal")?.remove();
              socket.emit("executeSkillEffect", {
                roomCode: currentRoomCode,
                playerId: p.id,
                targetIds: [targetId],
                mobRole: currentMobRole,
              });
            };
          });
        return;
      }

      // パターンB-1: 一発ギャグで笑った人全員を選択するモーダル（松竹所属芸人：NOスリップ）
      if (targetType === "multi_laugh") {
        const candidates = (players || []).filter(
          (pl) => pl && String(pl.id) !== String(p.id),
        );
        const listToUse = candidates.length > 0 ? candidates : players || [];
        const buttonsHtml = listToUse
          .map(
            (pl) =>
              `<button type="button" class="btn-skill-laugh-target" data-id="${pl.id}" style="padding:12px; font-size:1rem; font-weight:bold; border:2px solid #ccc; border-radius:10px; background:#fff; color:#333; cursor:pointer;">🤣 ${pl.name}</button>`,
          )
          .join("");
        const html = `
          <div id="skill-target-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); display:flex; justify-content:center; align-items:center; z-index:999999; font-family:sans-serif;">
            <div style="background:#fff; width:92%; max-width:340px; padding:22px; border-radius:16px; text-align:center; box-sizing:border-box;">
              <h3 style="margin:0 0 8px 0; color:#d84315; font-size:1.2rem;">⚡ ${skillCfg.name}</h3>
              <p style="font-size:0.9rem; color:#333; margin:0 0 14px 0; font-weight:bold;">一発ギャグを披露して笑った人をすべて選択してください</p>
              <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:14px;">
                ${buttonsHtml}
              </div>
              <button type="button" id="btn-skill-laugh-confirm" style="width:100%; padding:12px; font-size:1rem; font-weight:bold; background:#d84315; color:#fff; border:none; border-radius:10px; cursor:pointer;">決定（誰も笑わなければそのまま決定）</button>
            </div>
          </div>
        `;
        container.insertAdjacentHTML("beforeend", html);
        const selectedIds: string[] = [];
        const confirmBtn = document.getElementById(
          "btn-skill-laugh-confirm",
        ) as HTMLButtonElement;
        document
          .querySelectorAll("#skill-target-modal .btn-skill-laugh-target")
          .forEach((b) => {
            (b as HTMLButtonElement).onclick = (ev) => {
              const el = ev.currentTarget as HTMLButtonElement;
              const id = el.getAttribute("data-id") || "";
              const idx = selectedIds.indexOf(id);
              if (idx >= 0) {
                selectedIds.splice(idx, 1);
                el.style.borderColor = "#ccc";
                el.style.background = "#fff";
                el.style.color = "#333";
              } else {
                selectedIds.push(id);
                el.style.borderColor = "#d84315";
                el.style.background = "#fbe9e7";
                el.style.color = "#d84315";
              }
              if (confirmBtn) {
                confirmBtn.textContent =
                  selectedIds.length > 0
                    ? `笑った ${selectedIds.length}人 に1杯ずつ飲ませる`
                    : "決定（誰も笑わなかった）";
              }
            };
          });
        if (confirmBtn) {
          confirmBtn.onclick = () => {
            document.getElementById("skill-target-modal")?.remove();
            socket.emit("executeSkillEffect", {
              roomCode: currentRoomCode,
              playerId: p.id,
              targetIds: selectedIds,
            });
          };
        }
        return;
      }

      // パターンB-2: 杯数とプレイヤー1人を指定して同量乾杯するモーダル（おもちゃ：「Who let the dogs out?」）
      if (targetType === "cups_and_single") {
        const candidates = (players || []).filter(
          (pl) => pl && String(pl.id) !== String(p.id),
        );
        const listToUse = candidates.length > 0 ? candidates : players || [];
        let selectedCups = 1;

        const buttonsHtml = listToUse
          .map(
            (pl) =>
              `<button type="button" class="btn-skill-cups-target" data-id="${pl.id}" style="padding:13px; font-size:1rem; font-weight:bold; border:none; border-radius:10px; background:linear-gradient(135deg, #d84315 0%, #ff8f00 100%); color:#fff; cursor:pointer;">🍻 ${pl.name} と乾杯する</button>`,
          )
          .join("");

        const html = `
          <div id="skill-target-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); display:flex; justify-content:center; align-items:center; z-index:999999; font-family:sans-serif;">
            <div style="background:#fff; width:92%; max-width:340px; padding:22px; border-radius:16px; text-align:center; box-sizing:border-box;">
              <h3 style="margin:0 0 8px 0; color:#d84315; font-size:1.15rem;">⚡ ${skillCfg.name}</h3>
              <p style="font-size:0.88rem; color:#333; margin:0 0 8px 0; font-weight:bold;">① 一緒に飲む杯数を選択してください</p>
              <div style="display:flex; gap:8px; margin-bottom:14px;">
                <button type="button" class="btn-cup-choice" data-cups="1" style="flex:1; padding:10px; font-weight:bold; border:2px solid #d84315; background:#fbe9e7; color:#d84315; border-radius:8px; cursor:pointer;">1杯</button>
                <button type="button" class="btn-cup-choice" data-cups="2" style="flex:1; padding:10px; font-weight:bold; border:2px solid #ccc; background:#fff; color:#555; border-radius:8px; cursor:pointer;">2杯</button>
                <button type="button" class="btn-cup-choice" data-cups="3" style="flex:1; padding:10px; font-weight:bold; border:2px solid #ccc; background:#fff; color:#555; border-radius:8px; cursor:pointer;">3杯</button>
              </div>
              <p style="font-size:0.88rem; color:#333; margin:0 0 10px 0; font-weight:bold;">② 一緒に乾杯する相手を選択してください</p>
              <div style="display:flex; flex-direction:column; gap:10px;">
                ${buttonsHtml}
              </div>
            </div>
          </div>
        `;
        container.insertAdjacentHTML("beforeend", html);

        document
          .querySelectorAll("#skill-target-modal .btn-cup-choice")
          .forEach((cb) => {
            (cb as HTMLButtonElement).onclick = (ev) => {
              const el = ev.currentTarget as HTMLButtonElement;
              selectedCups = parseInt(el.getAttribute("data-cups") || "1", 10);
              document
                .querySelectorAll("#skill-target-modal .btn-cup-choice")
                .forEach((other) => {
                  const oEl = other as HTMLButtonElement;
                  oEl.style.borderColor = "#ccc";
                  oEl.style.background = "#fff";
                  oEl.style.color = "#555";
                });
              el.style.borderColor = "#d84315";
              el.style.background = "#fbe9e7";
              el.style.color = "#d84315";
            };
          });

        document
          .querySelectorAll("#skill-target-modal .btn-skill-cups-target")
          .forEach((b) => {
            (b as HTMLButtonElement).onclick = (ev) => {
              const targetId =
                (ev.currentTarget as HTMLElement).getAttribute("data-id") || "";
              document.getElementById("skill-target-modal")?.remove();
              socket.emit("executeSkillEffect", {
                roomCode: currentRoomCode,
                playerId: p.id,
                targetIds: [targetId],
                chosenCups: selectedCups,
              });
            };
          });
        return;
      }

      // パターンB-3: 番長とタイマン（1人を指名して飲み会ゲーム ➔ 負けた方を選択して2杯飲む）
      if (targetType === "taiman") {
        const candidates = (players || []).filter(
          (pl) => pl && String(pl.id) !== String(p.id),
        );
        const listToUse = candidates.length > 0 ? candidates : players || [];
        const buttonsHtml = listToUse
          .map(
            (pl) =>
              `<button type="button" class="btn-skill-taiman-opp" data-id="${pl.id}" data-name="${pl.name}" style="padding:13px; font-size:1rem; font-weight:bold; border:none; border-radius:10px; background:linear-gradient(135deg, #d84315 0%, #ff8f00 100%); color:#fff; cursor:pointer;">🔥 ${pl.name} にタイマンを挑む</button>`,
          )
          .join("");

        const html = `
          <div id="skill-target-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); display:flex; justify-content:center; align-items:center; z-index:999999; font-family:sans-serif;">
            <div id="skill-taiman-inner" style="background:#fff; width:92%; max-width:340px; padding:22px; border-radius:16px; text-align:center; box-sizing:border-box;">
              <h3 style="margin:0 0 8px 0; color:#d84315; font-size:1.2rem;">⚡ ${skillCfg.name}</h3>
              <p style="font-size:0.9rem; color:#333; margin:0 0 14px 0; font-weight:bold;">タイマン勝負する相手を1人指名してください</p>
              <div style="display:flex; flex-direction:column; gap:10px;">
                ${buttonsHtml}
              </div>
            </div>
          </div>
        `;
        container.insertAdjacentHTML("beforeend", html);

        document
          .querySelectorAll("#skill-target-modal .btn-skill-taiman-opp")
          .forEach((b) => {
            (b as HTMLButtonElement).onclick = (ev) => {
              const el = ev.currentTarget as HTMLElement;
              const oppId = el.getAttribute("data-id") || "";
              const oppName = el.getAttribute("data-name") || "相手";

              socket.emit("skillTaimanStarted", {
                roomCode: currentRoomCode,
                challengerName: p.name,
                opponentName: oppName,
              });

              const inner = document.getElementById("skill-taiman-inner");
              if (inner) {
                inner.innerHTML = `
                  <h3 style="margin:0 0 8px 0; color:#d84315; font-size:1.2rem;">🔥 ${p.name} vs ${oppName}</h3>
                  <p style="font-size:0.9rem; color:#333; margin:0 0 14px 0; font-weight:bold;">飲み会ゲームを行い、負けた方を選択してください（負けた方が2杯飲む）</p>
                  <div style="display:flex; flex-direction:column; gap:10px;">
                    <button type="button" class="btn-taiman-loser" data-id="${p.id}" style="padding:14px; font-size:1.05rem; font-weight:bold; border:none; border-radius:10px; background:#e53935; color:#fff; cursor:pointer;">💀 ${p.name} が負けた（+2杯）</button>
                    <button type="button" class="btn-taiman-loser" data-id="${oppId}" style="padding:14px; font-size:1.05rem; font-weight:bold; border:none; border-radius:10px; background:#e53935; color:#fff; cursor:pointer;">💀 ${oppName} が負けた（+2杯）</button>
                  </div>
                `;
                inner
                  .querySelectorAll(".btn-taiman-loser")
                  .forEach((loserBtn) => {
                    (loserBtn as HTMLButtonElement).onclick = (lev) => {
                      const loserId =
                        (lev.currentTarget as HTMLElement).getAttribute(
                          "data-id",
                        ) || "";
                      document.getElementById("skill-target-modal")?.remove();
                      socket.emit("executeSkillEffect", {
                        roomCode: currentRoomCode,
                        playerId: p.id,
                        targetIds: [loserId],
                      });
                    };
                  });
              }
            };
          });
        return;
      }

      // パターンB: プレイヤー2人を指名するモーダル（パパ：花火乱射）
      if (targetType === "double") {
        const otherPlayers = (players || []).filter(
          (pl) => pl && String(pl.id) !== String(p.id),
        );
        const candidates =
          otherPlayers.length > 0 ? otherPlayers : players || [];
        const buttonsHtml = candidates
          .map(
            (pl) =>
              `<button type="button" class="btn-skill-double-target" data-id="${pl.id}" style="padding:12px; font-size:1rem; font-weight:bold; border:2px solid #ccc; border-radius:10px; background:#fff; color:#333; cursor:pointer;">🎆 ${pl.name}</button>`,
          )
          .join("");
        const html = `
          <div id="skill-target-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); display:flex; justify-content:center; align-items:center; z-index:999999; font-family:sans-serif;">
            <div style="background:#fff; width:92%; max-width:340px; padding:22px; border-radius:16px; text-align:center; box-sizing:border-box;">
              <h3 style="margin:0 0 8px 0; color:#d84315; font-size:1.2rem;">⚡ ${skillCfg.name}</h3>
              <p style="font-size:0.9rem; color:#333; margin:0 0 14px 0; font-weight:bold;">1杯ずつ飲ませるプレイヤーを2人選択してください</p>
              <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:14px;">
                ${buttonsHtml}
              </div>
              <button type="button" id="btn-skill-double-confirm" disabled style="width:100%; padding:12px; font-size:1rem; font-weight:bold; background:#ccc; color:#fff; border:none; border-radius:10px;">2人選択して決定</button>
            </div>
          </div>
        `;
        container.insertAdjacentHTML("beforeend", html);
        const selectedIds: string[] = [];
        const confirmBtn = document.getElementById(
          "btn-skill-double-confirm",
        ) as HTMLButtonElement;
        document
          .querySelectorAll("#skill-target-modal .btn-skill-double-target")
          .forEach((b) => {
            (b as HTMLButtonElement).onclick = (ev) => {
              const el = ev.currentTarget as HTMLButtonElement;
              const id = el.getAttribute("data-id") || "";
              const idx = selectedIds.indexOf(id);
              if (idx >= 0) {
                selectedIds.splice(idx, 1);
                el.style.borderColor = "#ccc";
                el.style.background = "#fff";
                el.style.color = "#333";
              } else if (selectedIds.length < 2) {
                selectedIds.push(id);
                el.style.borderColor = "#d84315";
                el.style.background = "#fbe9e7";
                el.style.color = "#d84315";
              }
              if (confirmBtn) {
                const ok =
                  selectedIds.length === 2 ||
                  (candidates.length === 1 && selectedIds.length === 1);
                confirmBtn.disabled = !ok;
                confirmBtn.style.background = ok ? "#d84315" : "#ccc";
              }
            };
          });
        if (confirmBtn) {
          confirmBtn.onclick = () => {
            document.getElementById("skill-target-modal")?.remove();
            socket.emit("executeSkillEffect", {
              roomCode: currentRoomCode,
              playerId: p.id,
              targetIds: selectedIds,
            });
          };
        }
        return;
      }

      // パターンC: 1人を指名するモーダル（single / single_any）
      const includeSelf = targetType === "single_any";
      const candidates = (players || []).filter(
        (pl) => pl && (includeSelf || String(pl.id) !== String(p.id)),
      );
      const listToUse = candidates.length > 0 ? candidates : players || [];
      const promptText =
        targetType === "single_any"
          ? "タイマン勝負で負けたプレイヤーを選択してください"
          : "対象にするプレイヤーを1人指名してください";

      const buttonsHtml = listToUse
        .map(
          (pl) =>
            `<button type="button" class="btn-skill-single-target" data-id="${pl.id}" style="padding:13px; font-size:1.05rem; font-weight:bold; border:none; border-radius:10px; background:linear-gradient(135deg, #d84315 0%, #ff8f00 100%); color:#fff; cursor:pointer;">🎯 ${pl.name} を選択</button>`,
        )
        .join("");

      const html = `
        <div id="skill-target-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); display:flex; justify-content:center; align-items:center; z-index:999999; font-family:sans-serif;">
          <div style="background:#fff; width:92%; max-width:340px; padding:22px; border-radius:16px; text-align:center; box-sizing:border-box;">
            <h3 style="margin:0 0 8px 0; color:#d84315; font-size:1.2rem;">⚡ ${skillCfg.name}</h3>
            <p style="font-size:0.9rem; color:#333; margin:0 0 14px 0; font-weight:bold;">${promptText}</p>
            <div style="display:flex; flex-direction:column; gap:10px;">
              ${buttonsHtml}
            </div>
          </div>
        </div>
      `;
      container.insertAdjacentHTML("beforeend", html);
      document
        .querySelectorAll("#skill-target-modal .btn-skill-single-target")
        .forEach((b) => {
          (b as HTMLButtonElement).onclick = (ev) => {
            const targetId =
              (ev.currentTarget as HTMLElement).getAttribute("data-id") || "";
            document.getElementById("skill-target-modal")?.remove();
            socket.emit("executeSkillEffect", {
              roomCode: currentRoomCode,
              playerId: p.id,
              targetIds: [targetId],
            });
          };
        });
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
  }
}

const mountController = () => {
  const rootEl = document.getElementById("root");
  if (rootEl) {
    const root = createRoot(rootEl);
    root.render(<ControllerApp />);
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountController);
} else {
  mountController();
}

