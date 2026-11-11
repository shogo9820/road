import React, { useState, useEffect, memo } from "react";
import { createRoot } from "react-dom/client";

const socket = io();

let roomCode = "";
let players: any[] = [];
let activePlayerIndex = 0;
let pcCurrentRotation = 0;
let isPCEventMode = false;
let currentGameMode = "normal";

// 🎯 カラーパレット定義（インデックス順）
const PLAYER_COLOR_PALETTE = [
  "#f44336",
  "#2196f3",
  "#4caf50",
  "#ff9800",
  "#9c27b0",
  "#00bcd4",
  "#e91e63",
  "#795548",
];

// 🗺️ ゲーム内に存在する全ロケーション一覧の定義
const ALL_GAME_LOCATIONS = [
  "スタート前",
  "家",
  "とりき",
  "ももじ",
  "ぱいぱい",
  "宅飲み",
];

const GAME_EVENTS: Record<
  string,
  { class: string; title: string; desc: (name: string) => string }
> = {
  入学式: {
    class: "theme-entrance",
    title: "🌸 入学式 🌸",
    desc: (name) => `${name} さんの大学生活がスタート！`,
  },
  ランクアップ: {
    class: "theme-rankup",
    title: "🔥 ランクアップチャンス 🔥",
    desc: (name) => `${name} さんの実力が試される時！`,
  },
  引退: {
    class: "theme-retirement",
    title: "🎓 サークル引退式 🎓",
    desc: (name) => `${name} さん、これまでの思い出を胸に引退！`,
  },
};

// 外部スクリプト（board.js / sq_XX.js）との完全互換用グローバルブリッジ
let syncReactStateRef: (() => void) | null = null;
let setScreenRef: ((screenId: string) => void) | null = null;
let setQrCodeRef: ((url: string) => void) | null = null;

Object.defineProperties(window, {
  socket: { get: () => socket, configurable: true },
  roomCode: {
    get: () => roomCode,
    set: (v) => {
      roomCode = v;
      if (syncReactStateRef) syncReactStateRef();
    },
    configurable: true,
  },
  players: {
    get: () => players,
    set: (v) => {
      players = v;
      if (syncReactStateRef) syncReactStateRef();
    },
    configurable: true,
  },
  activePlayerIndex: {
    get: () => activePlayerIndex,
    set: (v) => {
      activePlayerIndex = v;
      if (syncReactStateRef) syncReactStateRef();
    },
    configurable: true,
  },
  pcCurrentRotation: {
    get: () => pcCurrentRotation,
    set: (v) => {
      pcCurrentRotation = v;
    },
    configurable: true,
  },
  isPCEventMode: {
    get: () => isPCEventMode,
    set: (v) => {
      isPCEventMode = v;
    },
    configurable: true,
  },
  currentGameMode: {
    get: () => currentGameMode,
    set: (v) => {
      currentGameMode = v;
      if (syncReactStateRef) syncReactStateRef();
    },
    configurable: true,
  },
});

function switchScreen(targetId: string) {
  if (setScreenRef) {
    setScreenRef(targetId);
  }
}

function renderPlayerWaitingList() {
  if (syncReactStateRef) syncReactStateRef();
}

function renderLocationPlayersList() {
  if (syncReactStateRef) syncReactStateRef();
}

function updateCurrentPlayerDisplay() {
  if (syncReactStateRef) syncReactStateRef();
  const activeP = players && players[activePlayerIndex];
  syncPCKoreanDOMMode(Boolean(activeP && activeP.koreanModeThisTurn));
}

// ==========================================================================
// 🇰🇷 【イ専用必殺技：한국어로 변환（PC画面韓国語モード）】
// 右下の「現在のマスの内容（.tile-event-card）」以外をすべて韓国語に変換＆ターン終了時完全復元
// ==========================================================================
const PC_KOREAN_DICT: [string, string][] = [
  ["スマホからルーレットを回してください！", "스마트폰에서 룰렛을 돌려주세요!"],
  ["スマホから運命のスピンを回してね！", "스마트폰에서 운명의 스핀을 돌려주세요!"],
  ["スマホから最終決着スピンを回してね！", "스마트폰에서 최종 결판 스핀을 돌려주세요!"],
  ["スマホで対象を選択中...", "스마트폰에서 대상을 선택 중..."],
  ["スマホ画面で対象を選択中...", "스마트폰 화면에서 대상을 선택 중..."],
  ["スマホから回してね！", "스마트폰에서 돌려주세요!"],
  ["タップして回そう！", "탭해서 돌려보자!"],
  ["現在のプレイヤー", "현재 플레이어"],
  ["全プレイヤーステータス", "전체 플레이어 상태"],
  ["ロケーション別滞在状況", "장소별 체류 현황"],
  ["誰もいません", "아무도 없습니다"],
  ["が必殺技を発動！", " 필살기 발동!"],
  ["必殺技効果を発動中...！", "필살기 효과 발동 중...!"],
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
  ["入学式", "입학식"],
  ["生命保険", "생명보험"],
  ["カップル", "커플"],
  ["ランクUP", "랭크UP"],
  ["引退勝負", "은퇴승부"],
  ["卒業判定", "졸업판정"],
  ["飲んだ杯数", "마신 잔 수"],
  ["幸福度", "행복도"],
  ["現在地", "현재 위치"],
  ["体力", "체력"],
  ["役職", "직업"],
  ["恋人", "연인"],
  ["回転中...", "회전 중..."],
  ["出目", "나온 눈"],
  ["結果", "결과"],
  ["スタート前", "출발 전"],
  ["卒業式（ゴール）", "졸업식 (골)"],
  ["宅飲み", "홈파티"],
  ["とりき", "토리키"],
  ["ももじ", "모모지"],
  ["ぱいぱい", "파이파이"],
  ["家", "집"],
  ["なし", "없음"],
  ["あり", "있음"],
  ["マス", "칸"],
  ["回", "회"],
  ["杯", "잔"],
  ["枚", "장"],
  ["番", "번"],
  ["人", "명"],
];

const PC_KANA_TO_HANGUL: Record<string, string> = {
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

const PC_DIGIT_TO_HANGUL: Record<string, string> = {
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

function translatePCTextToKorean(raw: string): string {
  if (!raw || !raw.trim()) return raw;
  let s = raw;
  for (const [jp, ko] of PC_KOREAN_DICT) {
    if (s.includes(jp)) {
      s = s.split(jp).join(ko);
    }
  }
  s = s.replace(/[\u30A1-\u30F6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60),
  );
  for (const [k, h] of Object.entries(PC_KANA_TO_HANGUL)) {
    if (s.includes(k)) {
      s = s.split(k).join(h);
    }
  }
  s = s.replace(/10/g, "십");
  s = s.replace(/[0-9]/g, (d) => PC_DIGIT_TO_HANGUL[d] || d);
  s = s.replace(/START/g, "출발");
  s = s.replace(/GOAL!/g, "골!");
  s = s.replace(/HP/g, "체력");
  s = s.replace(/pt/gi, "점");
  return s;
}

let isPCKoreanActive = false;
let isApplyingPCKorean = false;
let pcKoreanObserver: MutationObserver | null = null;
const pcKoreanBackups = new Map<Text, { jp: string; ko: string }>();

function applyPCKoreanToSubtree(root: Node) {
  if (!isPCKoreanActive) return;
  isApplyingPCKorean = true;
  try {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode() as Text | null;
    while (node) {
      const parentEl = node.parentElement;
      const parentTag = parentEl?.tagName;
      // 🎯 右下のマスの内容カード（.tile-event-card）は翻訳対象から除外して日本語を維持！
      if (
        parentTag !== "SCRIPT" &&
        parentTag !== "STYLE" &&
        !parentEl?.closest(".tile-event-card")
      ) {
        const val = node.nodeValue || "";
        if (val.trim()) {
          const existing = pcKoreanBackups.get(node);
          if (!existing || val !== existing.ko) {
            const ko = translatePCTextToKorean(val);
            if (ko !== val) {
              pcKoreanBackups.set(node, { jp: val, ko });
              node.nodeValue = ko;
            }
          }
        }
      }
      node = walker.nextNode() as Text | null;
    }
  } finally {
    isApplyingPCKorean = false;
  }
}

function patchBoardCanvasForKorean(enable: boolean) {
  const bm = (window as any).boardManager;
  if (!bm || !bm.ctx) return;
  const ctx = bm.ctx;
  if (!ctx._origFillText) {
    ctx._origFillText = ctx.fillText.bind(ctx);
  }
  if (enable) {
    ctx.fillText = (text: string, x: number, y: number, maxWidth?: number) => {
      const translated = translatePCTextToKorean(String(text));
      if (maxWidth !== undefined) {
        return ctx._origFillText(translated, x, y, maxWidth);
      }
      return ctx._origFillText(translated, x, y);
    };
  } else {
    ctx.fillText = ctx._origFillText;
  }
  bm.draw(players, activePlayerIndex);
}

function syncPCKoreanDOMMode(active: boolean) {
  if (active) {
    const changed = !isPCKoreanActive;
    isPCKoreanActive = true;
    applyPCKoreanToSubtree(document.body);
    patchBoardCanvasForKorean(true);
    if (!pcKoreanObserver) {
      pcKoreanObserver = new MutationObserver(() => {
        if (isApplyingPCKorean || !isPCKoreanActive) return;
        applyPCKoreanToSubtree(document.body);
      });
      pcKoreanObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
    if (changed && window.boardManager) {
      window.boardManager.draw(players, activePlayerIndex);
    }
  } else if (isPCKoreanActive) {
    isPCKoreanActive = false;
    if (pcKoreanObserver) {
      pcKoreanObserver.disconnect();
      pcKoreanObserver = null;
    }
    isApplyingPCKorean = true;
    try {
      pcKoreanBackups.forEach((backup, textNode) => {
        if (textNode.nodeValue === backup.ko) {
          textNode.nodeValue = backup.jp;
        }
      });
      pcKoreanBackups.clear();
    } finally {
      isApplyingPCKorean = false;
    }
    patchBoardCanvasForKorean(false);
  }
}

// 🎯 【基本ルーティン：行程③＆④】物理角度盤面スピン・トコトコ移動・100%無差別着地信号
function executeSyncedRoulette(resultNum: number) {
  const p = players[activePlayerIndex];
  if (!p) return;

  const resEl = document.getElementById("roulette-result-display");
  if (resEl) resEl.textContent = "🎯 回転中...";
  const descEl =
    document.getElementById("event-text") ||
    document.getElementById("current-tile-desc");
  if (descEl && !isPCEventMode)
    descEl.innerHTML = `<p class="event-msg" style="color: #666; font-weight: bold; animation: pulse 1s infinite;">🌀 ルーレット回転中... どこに止まるかな？ 🌀</p>`;

  const targetDegrees = [342, 306, 270, 234, 198, 162, 126, 90, 54, 18];
  const stopAngle = targetDegrees[resultNum - 1];
  pcCurrentRotation +=
    1800 + ((stopAngle - (pcCurrentRotation % 360) + 360) % 360);

  let wheel = (
    isPCEventMode
      ? document.querySelector("#pc-event-modal .event-roulette-wheel") ||
        document.querySelector("#pc-couple-event-modal .event-roulette-wheel")
      : document.getElementById("controller-roulette-wheel") ||
        document.getElementById("pc-roulette-wheel")
  ) as HTMLElement;
  if (wheel) {
    wheel.style.transition = "transform 3s cubic-bezier(0.15, 0.9, 0.2, 1)";
    wheel.style.transform = `rotate(${pcCurrentRotation}deg)`;
  }

  if (isPCEventMode) {
    return;
  }

  setTimeout(() => {
    if (resEl) resEl.textContent = `出目: ${resultNum}`;
    let stepsMoved = 0;
    console.log(`💻 [PC MOVEMENT] ピン movements を開始。歩数: ${resultNum}歩`);

    const moveTimer = setInterval(() => {
      const currentSquare = MAP_SQUARES[p.position];
      if (
        stepsMoved > 0 &&
        currentSquare &&
        (currentSquare.type === "branch" ||
          currentSquare.type === "force_stop" ||
          currentSquare.type === "force_stop_rankup")
      ) {
        console.log(
          `💻 [PC MOVEMENT] 強制ストップマス(ID: ${p.position})を発見！着地へ。`,
        );
        clearInterval(moveTimer);
        finalizeMovement();
        return;
      }
      if (
        stepsMoved >= resultNum ||
        !currentSquare ||
        !currentSquare.nextId ||
        currentSquare.nextId.length === 0
      ) {
        console.log(
          `💻 [PC MOVEMENT] 指定歩数完了。目的地(ID: ${p.position})へ着地。`,
        );
        clearInterval(moveTimer);
        finalizeMovement();
        return;
      }

      const nextIdArray = currentSquare.nextId;
      if (Number(p.position) === 89 && p.isRepeat) {
        // 🎯 留年フラグがある時は強制的に 90番マス（留年ルート）へ！
        p.position = 90;
      } else if (Array.isArray(nextIdArray) && nextIdArray.length > 1) {
        p.position = Number(
          nextIdArray[
            p.chosenRouteIdx !== undefined && p.chosenRouteIdx !== null
              ? Number(p.chosenRouteIdx)
              : 0
          ],
        );
      } else {
        p.position = Number(
          Array.isArray(nextIdArray) ? nextIdArray[0] : nextIdArray,
        );
      }
      stepsMoved++;
      if (window.boardManager)
        window.boardManager.draw(players, activePlayerIndex);
    }, 250);

    function finalizeMovement() {
      console.log(
        `💻 [PC FINALIZE] ➔ マスID: ${p.position} に到着。サーバーへ着地通知を送信します。`,
      );

      socket.emit("squareLanded", {
        roomCode: roomCode,
        position: p.position,
      });
    }
  }, 3000);
}

// 📢 右下「現在のマスの内容」を、杯数・条件が一目で分かる表示に整形
function buildTileHtml(text: string, drink: number, happiness: number): string {
  let cleaned = String(text);

  // 1. drink > 0 の場合（上に「○杯飲む！」が出る場合）、下のテキストの（）の中（杯数表記など）を削除
  if (drink > 0) {
    cleaned = cleaned.replace(
      /[（(]\s*[0-9０-９]+杯(?:飲む)?\s*(【[^】]+】[^）)]*)[）)]/g,
      "$1",
    );
    cleaned = cleaned.replace(
      /[（(][^）)]*(?:[0-9０-９]+杯|飲む|乾杯)[^）)]*[）)]/g,
      "",
    );
  }

  // 条件マスで外側に（【...】...）がついている場合、外側の（）を外す
  cleaned = cleaned.replace(/[（(]\s*(【[^】]+】[^）)]*)[）)]/g, "$1");
  // 残った空の（）を削除
  cleaned = cleaned.replace(/[（(]\s*[)）]/g, "").trim();

  // 2. 【】がある場合、そこで改行
  // 先頭の【...】の直後にテキストが続く場合は直後で改行
  cleaned = cleaned.replace(/^(【[^】]+】)\s*/, "$1<br>");
  // 途中に現れる【...】の手前で改行（直前が<br>でない場合）
  cleaned = cleaned.replace(/([^\n>])\s*(【[^】]+】)/g, "$1<br>$2");

  const body = cleaned
    .replace(
      /(【[^】]*(?:場合|回避)[^】]*】)/g,
      '<span class="tile-cond">$1</span>',
    )
    .replace(/([0-9０-９]+杯)/g, '<span class="tile-cups">$1</span>');

  const hasCondition = /場合|回避/.test(text);
  const hasCupsInText = /[0-9０-９]+杯/.test(text);

  let badge = "";
  if (drink > 0) {
    badge = `<div class="tile-badge tile-badge-drink"><span class="tile-badge-icon">🍺</span><span class="tile-badge-num">${drink}</span><span class="tile-badge-unit">杯 飲む！</span></div>`;
  } else if (hasCondition || hasCupsInText) {
    badge = `<div class="tile-badge tile-badge-cond">⚠️ 条件に当てはまる人は飲む！（下の文を確認）</div>`;
  } else {
    badge = `<div class="tile-badge tile-badge-safe">飲まない！</div>`;
  }

  let happy = "";
  if (happiness > 0) {
    happy = `<div class="tile-happy tile-happy-up">😊 幸福度 +${happiness}pt</div>`;
  } else if (happiness < 0) {
    happy = `<div class="tile-happy tile-happy-down">😢 幸福度 ${happiness}pt</div>`;
  }

  return `<div class="tile-info">${badge}<div class="tile-text">🎲 ${body}</div>${happy}</div>`;
}

function triggerDelayedDisplay(resultNum: number, targetSquare: any) {
  const p = players[activePlayerIndex];
  if (!p) return;

  const modObj = window.SQ_MODULES && window.SQ_MODULES[p.position];
  const targetModule = modObj
    ? modObj[currentGameMode] || modObj.normal
    : null;

  const detectedText =
    targetModule && targetModule.text
      ? targetModule.text
      : targetSquare && targetSquare.text
        ? targetSquare.text
        : "通常マス";

  const detectedLocation =
    targetModule && targetModule.location
      ? targetModule.location
      : targetSquare && targetSquare.location
        ? targetSquare.location
        : "家";
  p.location = detectedLocation;

  const eventTextEl =
    document.getElementById("event-text") ||
    document.getElementById("current-tile-desc");
  const eventCardEl = document.querySelector(".tile-event-card");

  const tileDrink = Number(
    (targetModule && targetModule.drink !== undefined
      ? targetModule.drink
      : targetSquare && targetSquare.drink) || 0,
  );
  const tileHappy = Number(
    (targetModule && targetModule.happiness !== undefined
      ? targetModule.happiness
      : targetSquare && targetSquare.happiness) || 0,
  );
  const tileHtml = buildTileHtml(detectedText, tileDrink, tileHappy);

  if (eventTextEl) {
    eventTextEl.innerHTML = tileHtml;
  } else if (eventCardEl) {
    eventCardEl.innerHTML = `
      <div class="card-title" style="border-bottom: 2px solid #e0e0e0; padding-bottom: 4px; margin-bottom: 8px;">📢 現在のマスの内容</div>
      <div id="current-tile-desc">${tileHtml}</div>
    `;
  }

  updateCurrentPlayerDisplay();

  // サーバーへ位置と場所のみを通知（スマホ側のHP・杯数・就職判定を上書きしない）
  socket.emit("updateGameState", {
    roomCode: roomCode,
    activePlayerIndex: activePlayerIndex,
    players: [
      {
        id: p.id,
        position: p.position,
        location: p.location,
      },
    ],
  });
}

function openPCEventModal(
  eventType: string,
  playerName: string,
  activePlayerId: any,
) {
  isPCEventMode = true;
  const pcModal = document.getElementById("pc-event-modal");
  if (!pcModal) return;

  const btnNext = document.getElementById("btn-next-turn") as HTMLButtonElement;
  if (btnNext) {
    btnNext.disabled = true;
    btnNext.style.display = "none";
  }

  const config = GAME_EVENTS[eventType];
  if (!config) return;
  pcModal.className = "event-modal-overlay active " + config.class;

  if (document.getElementById("modal-event-title"))
    document.getElementById("modal-event-title").textContent = config.title;

  if (document.getElementById("modal-event-desc"))
    document.getElementById("modal-event-desc").textContent =
      config.desc(playerName);

  const resultBox = document.getElementById(
    "modal-event-result-box",
  ) as HTMLElement;
  if (resultBox) {
    resultBox.style.display = "none";
  }
}

function handleForceStopSquare(player: any, square: any) {
  if (!square) return;
  if (Number(square.id) === 89) return;

  const modObj = window.SQ_MODULES && window.SQ_MODULES[square.id];
  const targetModule = modObj
    ? modObj[currentGameMode] || modObj.normal
    : null;

  if (targetModule && typeof targetModule.event === "function") {
    console.log(`💻 [PC SIGNAL] sq_${square.id}.js の固有event()を起動。`);
    targetModule.event(player, square);
    return;
  }
}

function loadAndApplySquareComponent(squareId: number, callback: () => void) {
  if (
    window.SQ_MODULES &&
    window.SQ_MODULES[squareId] &&
    (window.SQ_MODULES[squareId][currentGameMode] ||
      window.SQ_MODULES[squareId].normal)
  ) {
    if (typeof callback === "function") callback();
    return;
  }
  const script = document.createElement("script");
  script.src = `/squares/sq_${squareId}.js`;
  script.onload = () => {
    if (typeof callback === "function") callback();
  };
  script.onerror = () => {
    if (typeof callback === "function") callback();
  };
  document.head.appendChild(script);
}

// 💻 全PCモーダルを一括クローズする共通関数
function closeAllPCModals() {
  isPCEventMode = false;
  const pcModal = document.getElementById("pc-event-modal");
  if (pcModal) {
    pcModal.className = "event-modal-overlay";
    pcModal.style.display = "none";
    pcModal.classList.remove("active");
  }
  const closeBtn = document.getElementById("pc-event-modal-close-btn");
  if (closeBtn) closeBtn.style.display = "none";

  const kanpaiModal = document.getElementById("pc-kanpai-modal");
  if (kanpaiModal) {
    const finalResult = document.getElementById("pc-final-result-body");
    // 全員ゴール時の最終結果発表画面でなければ閉じる
    if (!finalResult || finalResult.style.display !== "block") {
      kanpaiModal.style.display = "none";
    }
  }

  const takunomiModal = document.getElementById("pc-takunomi-modal");
  if (takunomiModal) {
    takunomiModal.style.display = "none";
  }

  const skillModal = document.getElementById("pc-skill-modal");
  if (skillModal) {
    skillModal.style.display = "none";
    const skillBackBtn = document.getElementById("pc-skill-back-btn");
    if (skillBackBtn) skillBackBtn.style.display = "none";
  }
}

// グローバル関数の公開
(window as any).closeAllPCModals = closeAllPCModals;
window.loadAndApplySquareComponent = loadAndApplySquareComponent;
window.executeSyncedRoulette = executeSyncedRoulette;
window.triggerDelayedDisplay = triggerDelayedDisplay;
window.switchScreen = switchScreen;
window.renderPlayerWaitingList = renderPlayerWaitingList;
window.updateCurrentPlayerDisplay = updateCurrentPlayerDisplay;
window.renderLocationPlayersList = renderLocationPlayersList;
window.handleForceStopSquare = handleForceStopSquare;

// sq_XX.js やルーレットアニメーションが直接DOM操作する領域を保護するメモ化コンポーネント
const RouletteAndTileZone = memo(
  ({ currentLocation }: { currentLocation: string }) => {
    useEffect(() => {
      const locEl = document.querySelector(".roulette-card #current-player-location");
      if (locEl) locEl.textContent = currentLocation || "-";
    }, [currentLocation]);

    return (
      <div className="layout-right">
        <div className="card roulette-card">
          <div className="roulette-result-display" id="roulette-result-display">
            🎯 タップして回そう！
          </div>

          <div
            style={{
              position: "relative",
              width: "200px",
              height: "200px",
              margin: "0 auto",
            }}
          >
            <div className="event-roulette-pointer"></div>
            <div className="roulette-wheel-board" id="pc-roulette-wheel">
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
          <div
            id="current-player-location"
            style={{
              fontWeight: "bold",
              marginTop: "8px",
              color: "#555",
              fontSize: "1.1rem",
            }}
          >
            スタート前
          </div>
        </div>

        {/* 止まったマスの内容テキストエリア */}
        <div
          className="card tile-event-card"
          style={{ flex: 1, minHeight: "150px" }}
        >
          <div
            className="card-title"
            style={{
              borderBottom: "2px solid #e0e0e0",
              paddingBottom: "4px",
              marginBottom: "8px",
            }}
          >
            📢 現在のマスの内容
          </div>
          <div
            id="current-tile-desc"
            style={{
              fontSize: "1.1rem",
              lineHeight: 1.6,
              fontWeight: "bold",
              color: "#2c3e50",
            }}
          >
            スマホからルーレットを回してください！
          </div>
        </div>
      </div>
    );
  },
  (prev, next) => prev.currentLocation === next.currentLocation,
);

const PCModalsZone = memo(
  () => (
    <>
      {/* PC側特大イベントモーダル */}
      <div id="pc-event-modal" className="event-modal-overlay">
        <div className="event-card-container">
          <h1 className="event-title" id="modal-event-title">
            💕 イベントタイトル 💕
          </h1>
          <p className="event-desc" id="modal-event-desc">
            イベントの説明文がここに表示されます。
          </p>

          <div className="event-main-flex">
            {/* 左カラム：ルーレット ＋ 下部に結果テキストボックスを縦並び配置 */}
            <div className="event-roulette-area">
              <div className="event-roulette-container">
                <div className="event-roulette-pointer"></div>
                <div className="event-roulette-wheel">
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
              <div
                className="result-display-zone"
                id="modal-roulette-result-display"
              >
                🎯 スマホから回してね！
              </div>

              {/* 🎯 1回目・2回目の成否を大きく伝える専用結果テキストボックス */}
              <div
                id="modal-event-result-box"
                className="event-result-box"
                style={{ display: "none" }}
              ></div>
            </div>

            <div
              className="event-table-area"
              id="pc-event-table-dynamic-zone"
            ></div>
          </div>

          {/* PC画面直接操作用 閉じるボタン */}
          <div style={{ textAlign: "center", marginTop: "16px" }}>
            <button
              id="pc-event-modal-close-btn"
              style={{
                display: "none",
                background: "linear-gradient(135deg, #455a64 0%, #263238 100%)",
                color: "#ffffff",
                border: "2px solid #90a4ae",
                fontSize: "1.15rem",
                fontWeight: "bold",
                padding: "10px 36px",
                borderRadius: "30px",
                cursor: "pointer",
                boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
              }}
            >
              ✖ モーダルを閉じる
            </button>
          </div>
        </div>
      </div>

      {/* 🍻 一斉乾杯＆結果発表 特大デザインモーダル */}
      <div
        id="pc-kanpai-modal"
        className="kanpai-overlay"
        style={{ display: "none" }}
      >
        <div className="kanpai-window">
          <div className="kanpai-glow"></div>
          {/* 通常乾杯イベント用 */}
          <div id="pc-kanpai-body">
            <h1 className="kanpai-header">🍻 特大乾杯イベント発生！ 🍻</h1>
            <div id="pc-kanpai-members" className="kanpai-buddies"></div>
            <div className="kanpai-at">が</div>
            <div id="pc-kanpai-location" className="kanpai-spot"></div>
            <div className="kanpai-at">で</div>
            <div className="kanpai-shout">🍻 乾杯！！！ 🍻</div>
            <div className="kanpai-footer-nav">
              ※スマホの「➡ 次のプレイヤーへ」ボタンを押して進めてください
            </div>
            <div style={{ textAlign: "center", marginTop: "16px" }}>
              <button
                id="pc-kanpai-close-btn"
                style={{
                  background: "rgba(0, 0, 0, 0.4)",
                  color: "#ffffff",
                  border: "2px solid rgba(255, 255, 255, 0.7)",
                  fontSize: "1.15rem",
                  fontWeight: "bold",
                  padding: "10px 32px",
                  borderRadius: "30px",
                  cursor: "pointer",
                }}
              >
                ✖ モーダルを閉じる
              </button>
            </div>
          </div>

          {/* 🎊 全員ゴール・最終結果発表用 */}
          <div id="pc-final-result-body" style={{ display: "none", width: "100%" }}>
            <h1 className="kanpai-header" style={{ fontSize: "2.3rem", marginBottom: "16px" }}>
              🎊 全員卒業！最終結果発表！ 🎊
            </h1>
            <div id="pc-final-ranking-list" style={{ width: "100%", maxWidth: "580px", margin: "0 auto" }}></div>
            <div id="pc-final-result-cheer" style={{ fontSize: "1.4rem", fontWeight: "bold", margin: "16px 0", color: "#fff" }}>
              最高の宅飲み人生に乾杯！！！🍻
            </div>
            <div style={{ marginTop: "24px", textAlign: "center" }}>
              <button
                id="btn-back-to-title-pc"
                style={{
                  background: "linear-gradient(135deg, #ff5722 0%, #ff9800 100%)",
                  color: "#ffffff",
                  border: "none",
                  fontSize: "1.4rem",
                  fontWeight: "bold",
                  padding: "14px 44px",
                  borderRadius: "50px",
                  cursor: "pointer",
                  boxShadow: "0 8px 24px rgba(255, 87, 34, 0.4)",
                  transition: "all 0.2s ease-in-out",
                }}
              >
                🏠 タイトル画面に戻る
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 🎲 宅飲みゲーム専用 特大モーダル */}
      <div
        id="pc-takunomi-modal"
        className="kanpai-overlay"
        style={{ display: "none" }}
      >
        <div
          className="kanpai-window"
          style={{
            background: "linear-gradient(135deg, #ff6f00 0%, #f57c00 50%, #ffb300 100%)",
          }}
        >
          <div className="kanpai-glow"></div>
          <h1 className="kanpai-header">🍻 宅飲みミニゲーム発生！ 🍻</h1>
          <div
            id="pc-takunomi-desc"
            style={{
              fontSize: "1.5rem",
              fontWeight: "bold",
              color: "#fff8e1",
              background: "rgba(0, 0, 0, 0.25)",
              padding: "10px 24px",
              borderRadius: "16px",
              margin: "12px auto",
              maxWidth: "85%",
            }}
          ></div>
          <div
            id="pc-takunomi-main"
            className="kanpai-shout"
            style={{ margin: "18px 0", fontSize: "3.2rem" }}
          >
            プレイヤーから始まる！
          </div>
          <div
            id="pc-takunomi-sub"
            className="kanpai-footer-nav"
            style={{ fontSize: "1.25rem", color: "#fff" }}
          >
            ※実際にゲームをして、負けた人をスマホ画面で選択してください
          </div>
          <div style={{ textAlign: "center", marginTop: "16px" }}>
            <button
              id="pc-takunomi-close-btn"
              style={{
                background: "rgba(0, 0, 0, 0.4)",
                color: "#ffffff",
                border: "2px solid rgba(255, 255, 255, 0.7)",
                fontSize: "1.15rem",
                fontWeight: "bold",
                padding: "10px 32px",
                borderRadius: "30px",
                cursor: "pointer",
              }}
            >
              ✖ モーダルを閉じる
            </button>
          </div>
        </div>
      </div>

      {/* ⚡ 必殺技発動専用 特大モーダル */}
      <div
        id="pc-skill-modal"
        className="kanpai-overlay"
        style={{ display: "none" }}
      >
        <div
          className="kanpai-window"
          style={{
            background:
              "linear-gradient(135deg, #1a237e 0%, #4a148c 50%, #b71c1c 100%)",
            border: "4px solid #ffd54f",
          }}
        >
          <div className="kanpai-glow"></div>
          <h1
            id="pc-skill-header"
            className="kanpai-header"
            style={{ color: "#ffd54f", fontSize: "2.3rem" }}
          >
            ⚡ 必殺技を発動！ ⚡
          </h1>
          <div
            id="pc-skill-name"
            className="kanpai-shout"
            style={{ margin: "12px 0", fontSize: "2.8rem", color: "#ffffff" }}
          >
            🔥 必殺技名 🔥
          </div>
          <div
            id="pc-skill-desc"
            style={{
              fontSize: "1.45rem",
              fontWeight: "bold",
              color: "#fff8e1",
              background: "rgba(0, 0, 0, 0.35)",
              padding: "14px 24px",
              borderRadius: "16px",
              margin: "12px auto",
              maxWidth: "88%",
              lineHeight: 1.5,
            }}
          ></div>
          <div
            id="pc-skill-result"
            className="kanpai-footer-nav"
            style={{
              fontSize: "1.6rem",
              fontWeight: "bold",
              color: "#ffeb3b",
              marginTop: "16px",
            }}
          >
            📱 スマホで対象を選択中...
          </div>
          <button
            type="button"
            id="pc-skill-back-btn"
            onClick={() => {
              const m = document.getElementById("pc-skill-modal");
              if (m) m.style.display = "none";
              const b = document.getElementById("pc-skill-back-btn");
              if (b) b.style.display = "none";
            }}
            style={{
              display: "none",
              margin: "24px auto 0",
              padding: "16px 48px",
              fontSize: "1.6rem",
              fontWeight: 900,
              color: "#d84315",
              background: "#fff",
              border: "4px solid #ffeb3b",
              borderRadius: "16px",
              cursor: "pointer",
              boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
            }}
          >
            ↩ ターンに戻る
          </button>
        </div>
      </div>
    </>
  ),
  () => true,
);

function PCApp() {
  const [activeScreen, setActiveScreen] = useState<string>("screen-setup");
  const [hostName, setHostName] = useState<string>("やじま");
  const [roomCodeState, setRoomCodeState] = useState<string>("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [playersState, setPlayersState] = useState<any[]>([]);
  const [activeIdxState, setActiveIdxState] = useState<number>(0);
  const [gameModeState, setGameModeState] = useState<string>("normal");

  useEffect(() => {
    setScreenRef = (screenId: string) => {
      setActiveScreen(screenId);
    };
    setQrCodeRef = (url: string) => {
      setQrCodeUrl(url);
    };
    syncReactStateRef = () => {
      setRoomCodeState(roomCode);
      setPlayersState([...players]);
      setActiveIdxState(activePlayerIndex);
      setGameModeState(currentGameMode);
    };

    console.log("\n=========================================");
    console.log("💻 [PC DOM_LOAD] 大画面初期化を開始します...");
    initSocketListeners();
    appendSocketListeners();
    console.log("=========================================");

    return () => {
      syncReactStateRef = null;
      setScreenRef = null;
      setQrCodeRef = null;
    };
  }, []);

  // 画面切り替えやプレイヤー更新時にCanvas盤面を再描画
  useEffect(() => {
    if (
      (activeScreen === "screen-waiting" || activeScreen === "screen-game") &&
      window.boardManager
    ) {
      if (!window.boardManager.canvas) {
        window.boardManager.init(100);
      }
      window.boardManager.draw(players, activePlayerIndex);
    }
  }, [activeScreen, playersState, activeIdxState]);

  const handleCreateRoom = (e: React.MouseEvent) => {
    if (e) e.preventDefault();
    const targetHostName = hostName ? hostName : "やじま";
    console.log(
      `💻 [PC ACTION] ルーム作成要求を発射。ホスト名: ${targetHostName}`,
    );
    socket.emit("createRoom", { hostName: targetHostName });
  };

  // 現在手番プレイヤーのステータス計算
  const p = playersState[activeIdxState];
  const jobMaster =
    p && typeof JOBS !== "undefined"
      ? JOBS.find(
          (j: any) => j.id === p.jobId || j.label === p.job || j.title === p.job,
        )
      : null;
  const baseCap = p ? (jobMaster ? jobMaster.cap : p.baseCap || 100) : 100;
  const maxHp = p ? baseCap + (p.bonusCap || 0) : 100;
  const rawCurrentHp =
    p && p.currentHp !== undefined ? p.currentHp : maxHp;
  const currentHp = Math.max(0, rawCurrentHp);
  const jobLabel = p
    ? p.isRankedUp && (p.job === "代表" || p.job === "副代表")
      ? p.job
      : (p.isRankedUp || (jobMaster && p.job === jobMaster.title)) && jobMaster
        ? jobMaster.title
        : jobMaster
          ? jobMaster.label
          : p.job || "モブ"
    : "モブ";
  const playerColor = p
    ? p.color ||
      PLAYER_COLOR_PALETTE[activeIdxState % PLAYER_COLOR_PALETTE.length]
    : "#6a11cb";
  const hpVal = p && p.happiness !== undefined ? p.happiness : 100;
  const happinessColor =
    hpVal >= 100 ? "#ffeb3b" : hpVal >= 50 ? "#ffffff" : "#ff8a80";
  const currentLocation = p && p.location ? p.location : "-";

  // ロケーション別滞在プレイヤー集計
  const locationMap: Record<string, { index: number; name: string; color: string }[]> = {};
  ALL_GAME_LOCATIONS.forEach((loc) => (locationMap[loc] = []));
  playersState.forEach((pl, idx) => {
    const loc =
      pl.location && pl.location.trim() !== "" ? pl.location : "スタート前";
    if (!locationMap[loc]) locationMap[loc] = [];
    locationMap[loc].push({
      index: idx + 1,
      name: pl.name,
      color:
        pl.color || PLAYER_COLOR_PALETTE[idx % PLAYER_COLOR_PALETTE.length],
    });
  });

  return (
    <div className="app-container">
      {/* 【1】ルーム作成（初期画面） */}
      <div
        id="screen-setup"
        className={activeScreen === "screen-setup" ? "active" : ""}
        style={{ display: activeScreen === "screen-setup" ? "" : "none" }}
      >
        <div className="pc-card">
          <h1>🍻 宅飲み人生ゲーム 🍺</h1>
          <p>〜 サークル生活の思い出とアルコール 〜</p>
          <div style={{ margin: "20px 0" }}>
            <label>
              ホストプレイヤー名:{" "}
              <input
                type="text"
                id="pc-host-name"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                style={{
                  padding: "8px",
                  fontSize: "1.1rem",
                  borderRadius: "6px",
                  border: "1px solid #ccc",
                  textAlign: "center",
                }}
              />
            </label>
          </div>
          <button
            id="btn-create-room"
            className="btn-orange"
            style={{ margin: "0 auto", maxWidth: "300px" }}
            onClick={handleCreateRoom}
          >
            🚀 ルームを作成する
          </button>
        </div>
      </div>

      {/* 【2】参加待機室画面 */}
      <div
        id="screen-waiting"
        className={activeScreen === "screen-waiting" ? "active" : ""}
        style={{ display: activeScreen === "screen-waiting" ? "" : "none" }}
      >
        <div
          className="card"
          style={{ maxWidth: "800px", margin: "40px auto" }}
        >
          <div className="room-info-header">
            <h2>ROOM CODE</h2>
            <div className="room-code-display" id="display-room-code">
              {roomCodeState || "----"}
            </div>
          </div>
          <div className="waiting-grid">
            <div className="qr-panel">
              <img
                id="qrcode-img"
                src={qrCodeUrl}
                alt="参加用QRコード"
                style={{
                  width: "150px",
                  height: "150px",
                  display: "block",
                  background: "#eee",
                }}
              />
              <p style={{ fontWeight: "bold", margin: "5px 0 0 0" }}>
                スマホでQRコードを読み取って参加！
              </p>
            </div>
            <div>
              <h3>👥 参加メンバー</h3>
              <ul
                id="player-list"
                style={{
                  fontSize: "1.3rem",
                  fontWeight: "bold",
                  lineHeight: 2,
                }}
              >
                {playersState.map((pl, idx) => (
                  <li key={pl.id || idx}>{`👤 ${pl.name}`}</li>
                ))}
              </ul>
              <p
                style={{
                  color: "#e67e22",
                  fontWeight: "bold",
                  marginTop: "15px",
                  animation: "pulse 1s infinite",
                }}
              >
                ※ ゲームスタートはスマホ（コントローラー）から操作してください
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 【3】ゲームプレイ本番画面（盤面最大化） */}
      <div
        id="screen-game"
        className={activeScreen === "screen-game" ? "active" : ""}
        style={{ display: activeScreen === "screen-game" ? "" : "none" }}
      >
        <div className="game-layout">
          {/* 【左カラム】300px固定：操作プレイヤーのステータス */}
          <div className="layout-left">
            {/* 1. 現在プレイヤーのステータスカード */}
            <div
              className="card current-player-card"
              style={{
                background: `linear-gradient(135deg, ${playerColor} 0%, #2575fc 100%)`,
              }}
            >
              <div className="player-header">
                <div className="player-avatar" id="current-player-avatar">
                  👤
                </div>
                <div className="player-meta">
                  <h2 id="current-player-name">
                    {p ? p.name : "プレイヤー名"}
                  </h2>
                  <span className="job-badge" id="current-player-job">
                    {jobLabel}
                  </span>
                  <div
                    id="current-player-lover-icon"
                    style={{
                      display: p && p.isLover ? "inline-block" : "none",
                    }}
                  >
                    {p && p.isLover && p.lovers && p.lovers.length > 0 ? (
                      <span
                        style={{
                          fontSize: "0.95rem",
                          fontWeight: "bold",
                          color: "#ffeb3b",
                          background: "rgba(0,0,0,0.2)",
                          padding: "2px 8px",
                          borderRadius: "20px",
                        }}
                      >
                        {`💕 恋人: ${p.lovers.join("、")}`}
                      </span>
                    ) : p && p.isLover ? (
                      "❤️"
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="player-stats">
                <div className="stat-item">
                  <span>🍺 杯数</span>
                  <span id="current-player-drinks">
                    {`${p ? p.drinkCount || 0 : 0} 杯`}
                  </span>
                </div>
                <div className="stat-item">
                  <span>❤️ 体力</span>
                  <span id="current-player-hp">{`${currentHp} / ${maxHp}`}</span>
                </div>
                <div className="stat-item">
                  <span>✨ 幸福度</span>
                  <span
                    id="current-player-happiness"
                    style={{ color: happinessColor }}
                  >
                    {`${hpVal} pt`}
                  </span>
                </div>
                <div className="stat-item">
                  <span>🛡️ 保険</span>
                  <span id="current-player-insurance">
                    {`${p ? p.insurance || 0 : 0} 枚`}
                  </span>
                </div>
                <div className="stat-item">
                  <span>📍 現在地</span>
                  <span id="current-player-location">{currentLocation}</span>
                </div>
              </div>
            </div>

            {/* 2. 全員分のステータス＆カラー一覧カード */}
            <div className="card player-color-legend-card">
              <div
                className="card-title"
                style={{
                  fontWeight: "bold",
                  fontSize: "0.95rem",
                  marginBottom: "8px",
                  color: "#555",
                }}
              >
                👥 全員ステータス一覧
              </div>
              <div
                id="player-color-legend-list"
                className="color-legend-container"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                {playersState.map((pl, idx) => {
                  const pColor =
                    pl.color ||
                    PLAYER_COLOR_PALETTE[idx % PLAYER_COLOR_PALETTE.length];
                  const isCurrent = idx === activeIdxState;
                  const plDrinks = pl.drinkCount || 0;
                  const plHappy =
                    pl.happiness !== undefined ? pl.happiness : 100;
                  const plIns = pl.insurance || 0;
                  return (
                    <div
                      key={pl.id || idx}
                      className="color-legend-item"
                      style={{
                        width: "100%",
                        justifyContent: "space-between",
                        padding: "6px 10px",
                        borderRadius: "10px",
                        boxSizing: "border-box",
                        background: isCurrent ? "#fff8e1" : "#f5f5f5",
                        border: isCurrent
                          ? `2px solid ${pColor}`
                          : "1px solid #e0e0e0",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          minWidth: 0,
                        }}
                      >
                        <span
                          className="color-piece-dot"
                          style={{
                            background: pColor,
                            width: "16px",
                            height: "16px",
                            fontSize: "0.7rem",
                            color: "#fff",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: "bold",
                            flexShrink: 0,
                          }}
                        >
                          {idx + 1}
                        </span>
                        <span
                          style={{
                            fontWeight: "bold",
                            fontSize: "0.88rem",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {pl.name || `P${idx + 1}`}
                          {pl.hasFinished
                            ? " 🎓"
                            : pl.skipTurn
                              ? " 💤"
                              : pl.isRepeat
                                ? " 💀"
                                : ""}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "0.78rem",
                          fontWeight: "bold",
                          flexShrink: 0,
                        }}
                      >
                        <span style={{ color: "#e65100" }}>🍺{plDrinks}</span>
                        <span style={{ color: "#f57f17" }}>✨{plHappy}</span>
                        {plIns > 0 && (
                          <span style={{ color: "#8e24aa" }}>🛡️{plIns}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. 全場所対照表カード（駒を並べるエリア） */}
            <div className="card location-board-card">
              <div
                className="card-title"
                style={{
                  fontWeight: "bold",
                  fontSize: "0.95rem",
                  marginBottom: "8px",
                  color: "#555",
                }}
              >
                📍 エリア別 滞在状況
              </div>
              <div className="location-table-wrapper">
                <table className="location-table">
                  <thead>
                    <tr>
                      <th style={{ width: "45%" }}>エリア</th>
                      <th style={{ width: "55%" }}>滞在中の駒</th>
                    </tr>
                  </thead>
                  <tbody id="location-table-body">
                    {ALL_GAME_LOCATIONS.map((locName) => {
                      const stayingPlayers = locationMap[locName] || [];
                      return (
                        <tr key={locName}>
                          <td className="location-name-cell">{locName}</td>
                          <td className="location-pieces-cell">
                            {stayingPlayers.length > 0 ? (
                              stayingPlayers.map((pObj) => (
                                <span
                                  key={pObj.index}
                                  className="board-mini-piece"
                                  style={{ backgroundColor: pObj.color }}
                                  title={`${pObj.name} (P${pObj.index})`}
                                >
                                  {pObj.index}
                                </span>
                              ))
                            ) : (
                              <span
                                style={{ color: "#ccc", fontSize: "0.75rem" }}
                              >
                                -
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 【中央カラム】残りの画面幅（1fr）を限界まで使い切ってすごろくを最大化 */}
          <div className="layout-center">
            <div className="map-card-maximized">
              <div className="map-header">
                <span className="map-title-text">🗺️ すごろくマップ</span>
                <span className="mode-badge" id="pc-game-mode-badge">
                  {gameModeState === "short" ? "ショートモード" : "通常モード"}
                </span>
              </div>
              <canvas id="board-canvas"></canvas>
            </div>
          </div>

          {/* 【右カラム】300px固定：スマホと完全シンクロするルーレット ＆ マス内容 */}
          <RouletteAndTileZone currentLocation={currentLocation} />
        </div>
      </div>

      {/* 特大イベントモーダル ＆ 乾杯モーダル */}
      <PCModalsZone />
    </div>
  );
}

function initSocketListeners() {
  socket.off("connect");
  socket.on("connect", () => {
    console.log(
      "💻 [PC SOCKET] Socket.io サーバーに正常接続完了。ID:",
      socket.id,
    );
  });

  socket.off("roomCreated");
  socket.on("roomCreated", (data: any) => {
    roomCode = data.roomCode;
    if (data.players) players = data.players;
    console.log(
      `💻 [PC RECEIVE] roomCreated 受信。作成された部屋コード: ${roomCode}`,
    );

    if (setQrCodeRef && data.qrCodeDataUrl) {
      setQrCodeRef(data.qrCodeDataUrl);
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

  socket.off("applySettings");
  socket.on("applySettings", (data: any) => {
    console.log(
      "💻 [PC RECEIVE] applySettings 受信。参加者リストを同期します。",
    );
    const targetMode = data && (data.mode || data.gameMode);
    if (targetMode) {
      currentGameMode = targetMode;
    }
    if (data.players && Array.isArray(data.players)) {
      players = data.players;
      renderPlayerWaitingList();
      updateCurrentPlayerDisplay();
      renderLocationPlayersList();
      if (window.boardManager)
        window.boardManager.draw(players, activePlayerIndex);
    } else if (syncReactStateRef) {
      syncReactStateRef();
    }
  });

  // ==========================================================================
  // 🧭 【ルーティン行程②：ゲーム開始・ターン開始時イベント確認（1.TURN_START）】
  // ==========================================================================
  socket.off("gameStarted");
  socket.on("gameStarted", (data: any) => {
    if (data && data.players) players = data.players;
    if (data && data.activePlayerIndex !== undefined)
      activePlayerIndex = data.activePlayerIndex;
    const targetMode = data && (data.mode || data.gameMode);
    if (targetMode) {
      currentGameMode = targetMode;
    }

    switchScreen("screen-game");

    setTimeout(() => {
      if (window.boardManager) {
        window.boardManager.init(100);
        window.boardManager.draw(players, activePlayerIndex);
      }
    }, 0);
    updateCurrentPlayerDisplay();
    renderLocationPlayersList();

    const p = players[activePlayerIndex];
    if (p && typeof loadAndApplySquareComponent === "function") {
      console.log(
        `💻 [2.1 PC受信] ➔ 開始時イベント確認。手番プレイヤーが ${p.position} 番マスにいるため、コンポーネントをロードします。`,
      );

      loadAndApplySquareComponent(p.position, () => {
        let targetSquare =
          typeof MAP_SQUARES !== "undefined" && MAP_SQUARES[p.position]
            ? MAP_SQUARES[p.position]
            : null;
        if (targetSquare) {
          console.log(
            `💻 [2.1.1 PC内部処理] sq_${p.position}.js のロード完了。自動進行をせき止めて待機ロックを掛けます。`,
          );
          handleForceStopSquare(p, targetSquare);
        }
      });
    }
  });
}

function appendSocketListeners() {
  // ==========================================================================
  // 🧭 【基本ルーティン：行程③】サーバーから出目配信を受信した瞬間
  // ==========================================================================
  socket.off("spinRoulette");
  socket.on("spinRoulette", (data: any) => {
    if (data) {
      if (data.activePlayerIndex !== undefined)
        activePlayerIndex = data.activePlayerIndex;

      if (data.players && Array.isArray(data.players)) {
        players = data.players;
      }

      if (syncReactStateRef) syncReactStateRef();
      if (window.boardManager) {
        window.boardManager.draw(players, activePlayerIndex);
      }

      const resultNum = data.result !== undefined ? data.result : 1;
      console.log(
        `💻 [3.3 PC受信] ➔ サーバーから出目 ${resultNum} を受信。大画面のルーレット回転とピンのトコトコ前進を開始します！`,
      );
      executeSyncedRoulette(resultNum);
    }
  });

  // 🎯 【重要】マス着地時：サーバーから合図を受け取り、PC大画面モーダルを即座に表示！
  socket.off("openCustomRouletteModal");
  socket.on("openCustomRouletteModal", (data: any) => {
    console.log(`💻 [PC 着地時モーダル展開] イベント: ${data.eventName}`);
    isPCEventMode = true;

    const pcModal = document.getElementById("pc-event-modal");
    if (pcModal) {
      pcModal.className = "event-modal-overlay active theme-entrance";
      pcModal.style.display = "flex";
    }

    const titleEl = document.getElementById("modal-event-title");
    if (titleEl) titleEl.textContent = `🌸 ${data.eventName} 🌸`;

    const descEl = document.getElementById("modal-event-desc");
    if (descEl)
      descEl.textContent = "出目に応じて結果が決まる！スマホから回してね！";

    const modalResultBox = document.getElementById("modal-event-result-box");
    if (modalResultBox) modalResultBox.style.display = "none";

    // 判定対応表を描画
    const dynamicTableZone = document.getElementById(
      "pc-event-table-dynamic-zone",
    );
    if (dynamicTableZone && data.mapping) {
      let html = `<div class="event-title" style="font-size:1.3rem; color:#d81b60; margin-bottom:8px; font-weight:bold; border-bottom:2px solid #ff69b4; padding-bottom:4px;">💖 判定対応表</div><ul class="event-table-list">`;
      for (let i = 1; i <= 10; i++) {
        const target = data.mapping[i];
        let targetText = '<span style="color:#aaa;">-</span>';
        if (target)
          targetText = `<span style="color:#e91e63; font-weight:bold;">${target.name}</span>`;
        html += `<li class="event-table-item"><div class="event-table-num-badge" style="background:#ff4081;">${i}</div><div>${targetText}</div></li>`;
      }
      html += `</ul>`;
      dynamicTableZone.innerHTML = html;
    }
  });

  // 🎯 【確定版】美人入学式の乾杯モーダルを受信して大画面に表示（「と」で繋ぐプレイヤー名仕様）
  socket.off("openBijinKanpaiModal");
  socket.on("openBijinKanpaiModal", (data: any) => {
    console.log(`💻 [PC 乾杯モーダル展開] プレイヤー: ${data.playerName}`);
    const pcModal = document.getElementById("pc-kanpai-modal");
    if (pcModal) {
      const kanpaiBody = document.getElementById("pc-kanpai-body");
      if (kanpaiBody) kanpaiBody.style.display = "block";
      const resultBody = document.getElementById("pc-final-result-body");
      if (resultBody) resultBody.style.display = "none";

      const titleEl = pcModal.querySelector(".kanpai-header");
      const membersEl = document.getElementById("pc-kanpai-members");
      const locationEl = document.getElementById("pc-kanpai-location");

      if (titleEl) titleEl.textContent = "🌸 美人さん大歓迎！ 🌸";

      // 🎯 手元の全プレイヤー配列から、美人以外の名前だけを抽出し「と」で結合する
      if (membersEl && Array.isArray(players) && players.length > 0) {
        const otherPlayerNames = players
          .filter((p) => p && p.name !== data.playerName)
          .map((p) => p.name);

        if (otherPlayerNames.length > 0) {
          membersEl.textContent = otherPlayerNames.join("と");
        } else {
          membersEl.textContent = "周囲のサークル員";
        }
      } else if (membersEl) {
        membersEl.textContent = "周囲のサークル員";
      }

      if (locationEl) locationEl.textContent = "美人にモテたいの";

      pcModal.style.display = "flex";
    }
  });

  // ==========================================================================
  // 🧭 【一本道リレー：行程④】サーバーからの着地号令（startSquareEvent）受信
  // PC側は「表示・演出」専任として、マスのロードと画面更新のみを行います。
  // ==========================================================================
  socket.off("startSquareEvent");
  socket.on("startSquareEvent", (data: any) => {
    if (!data || data.position === undefined) return;

    if (data.activePlayerIndex !== undefined) {
      activePlayerIndex = data.activePlayerIndex;
    }

    const p = players[activePlayerIndex];
    if (!p) return;

    p.position = Number(data.position);
    p.location = data.location || "家";
    if (data.rankupFails) {
      p._rankupFails = data.rankupFails;
    }

    console.log(
      `💻 [PC ROUTINE-演出開始] サーバーから着地号令(startSquareEvent)を受信。マスID: ${p.position}`,
    );

    // 着地先コンポーネントをロードして表示を更新
    loadAndApplySquareComponent(p.position, () => {
      const modObj = window.SQ_MODULES && window.SQ_MODULES[p.position];
      const targetModule = modObj
        ? modObj[currentGameMode] || modObj.normal
        : null;
      const targetSquare =
        typeof MAP_SQUARES !== "undefined" && MAP_SQUARES[p.position]
          ? MAP_SQUARES[p.position]
          : null;

      // マスの場所を最優先で確定させる（乾杯判定の前に確定！）
      const detectedLocation =
        targetModule && targetModule.location
          ? targetModule.location
          : targetSquare && targetSquare.location
            ? targetSquare.location
            : data.location || "家";
      p.location = detectedLocation;

      // 1. マス固有のイベント表示があれば起動（PC側のモーダル展開など）
      if (targetModule && typeof targetModule.event === "function") {
        console.log(`💻 [sq_${p.position}.js] 大画面側 event() を起動します。`);
        targetModule.event(p, targetSquare || targetModule);
      }

      // 1.5. 🎲 宅飲みマスの場合はPC画面に「〇〇から始まる！」モーダルを展開
      if (p.location === "宅飲み") {
        const takunomiModal = document.getElementById("pc-takunomi-modal");
        if (takunomiModal) {
          const descEl = document.getElementById("pc-takunomi-desc");
          const mainEl = document.getElementById("pc-takunomi-main");
          const subEl = document.getElementById("pc-takunomi-sub");
          const sqText =
            (targetModule && targetModule.text) ||
            (targetSquare && targetSquare.text) ||
            "宅飲みゲームスタート！";
          if (descEl) descEl.textContent = `🎲 ${sqText}`;
          if (mainEl) {
            mainEl.textContent = `👉 ${p.name} から始まる！`;
            mainEl.style.color = "#ffffff";
          }
          if (subEl) {
            subEl.textContent =
              "※実際にゲームをして、負けた人をスマホ画面で選択してください";
          }
          takunomiModal.style.display = "flex";
        }
      }

      // 2. 盤面Canvas、ステータス、凡例・エリア表を即座に再描画
      if (window.boardManager) {
        window.boardManager.draw(players, activePlayerIndex);
      }
      updateCurrentPlayerDisplay();

      // 3. 🍻 同じ場所乾杯判定（宅飲みは除外）
      if (
        p.location &&
        p.location !== "家" &&
        p.location !== "スタート前" &&
        p.location !== "-" &&
        p.location !== "宅飲み" &&
        p.position !== 99
      ) {
        const samePlaceBuddies = players
          .filter(
            (otherP) =>
              otherP &&
              otherP.id !== p.id &&
              otherP.location === p.location,
          )
          .map((otherP) => otherP.name);

        if (samePlaceBuddies.length > 0) {
          console.log(
            `💻 [PC 乾杯検知] 場所「${p.location}」に先客を発見:`,
            samePlaceBuddies,
          );
          const allKanpaiMembers = [p.name, ...samePlaceBuddies];
          // サーバー側の現在地を先に確定させてから乾杯を発火（順序保証）
          socket.emit("updateGameState", {
            roomCode: roomCode,
            activePlayerIndex: activePlayerIndex,
            players: [{ id: p.id, position: p.position, location: p.location }],
          });
          socket.emit("triggerKanpaiEvent", {
            roomCode: roomCode,
            members: allKanpaiMembers.join("と"),
            location: p.location,
            title: "🍻 特大乾杯イベント発生！ 🍻",
          });
        }
      }

      if (p.chosenRouteIdx !== undefined) delete p.chosenRouteIdx;

      // 4. 右下の「現在のマスの内容」枠にテキストを反映
      const mockSquare = targetModule ||
        targetSquare || { text: "通常マス", location: p.location };
      triggerDelayedDisplay(1, mockSquare);
    });
  });

  // 🎯 【復元】サーバーから乾杯合図を受け取り、PC大画面の乾杯モーダルを表示！
  socket.off("showKanpaiModal");
  socket.on("showKanpaiModal", (data: any) => {
    console.log(
      `💻 [PC 乾杯モーダル表示] メンバー: ${data.members} / 場所: ${data.location}`,
    );
    const pcModal = document.getElementById("pc-kanpai-modal");
    if (pcModal) {
      const kanpaiBody = document.getElementById("pc-kanpai-body");
      if (kanpaiBody) kanpaiBody.style.display = "block";
      const resultBody = document.getElementById("pc-final-result-body");
      if (resultBody) resultBody.style.display = "none";

      const titleEl = pcModal.querySelector(".kanpai-header");
      const membersEl = document.getElementById("pc-kanpai-members");
      const locationEl = document.getElementById("pc-kanpai-location");

      if (titleEl && data.title) titleEl.textContent = data.title;
      if (membersEl && data.members) membersEl.textContent = data.members;
      if (locationEl && data.location) locationEl.textContent = data.location;

      pcModal.style.display = "flex";
    }
  });

  // 🎯 汎用ルーレット回転同期
  socket.off("spinCustomRoulette");
  socket.on("spinCustomRoulette", (data: any) => {
    console.log(
      `💻 [PC ROUTINE] ルーレット回転同期を受信: 出目 ${data.result}`,
    );
    isPCEventMode = true;

    if (typeof executeSyncedRoulette === "function") {
      executeSyncedRoulette(data.result);
    }
  });

  // 🎯 汎用ルーレット決着（結果テキスト表示）
  socket.off("customRouletteFinished");
  socket.on("customRouletteFinished", (data: any) => {
    const pcModal = document.getElementById("pc-event-modal");
    if (pcModal && pcModal.classList.contains("theme-couple")) {
      // 41番マス1回目スピンが奇数で失敗だった場合はPC画面にも失敗表示を出して閉じる
      if (
        data &&
        data.eventName === "💕 カップル成立チャンス 💕" &&
        data.result !== undefined &&
        data.result % 2 !== 0
      ) {
        isPCEventMode = false;
        const modalResultBox = document.getElementById(
          "modal-event-result-box",
        );
        if (modalResultBox) {
          modalResultBox.style.display = "block";
          modalResultBox.className = "event-result-box failure";
          modalResultBox.innerHTML = `
            <div style="font-size:1.8rem; font-weight:bold; margin-bottom:6px; color:#d81b60;">出目: ${data.result}</div>
            <div style="font-size:1.4rem; font-weight:bold; color:#e91e63;">💔 奇数：タイミングが悪い...</div>
          `;
        }
        const pcCloseBtn = document.getElementById("pc-event-modal-close-btn");
        if (pcCloseBtn) pcCloseBtn.style.display = "inline-block";
      } else {
        console.log(
          "💻 [PC GUARD] カップルイベント進行中のため、専用の通知を待ちます。",
        );
      }
      return;
    }

    // ─── 通常の入学式・ランクアップ・引退ギャンブルマスなどの処理 ───
    isPCEventMode = false;
    const modalResultBox = document.getElementById("modal-event-result-box");
    if (modalResultBox) {
      modalResultBox.style.display = "block";
      const isSuccess =
        data.outcome && data.outcome.isRankUp !== undefined
          ? data.outcome.isRankUp
          : data.outcome && data.outcome.drinks === 0;
      modalResultBox.className = isSuccess
        ? "event-result-box success"
        : "event-result-box failure";
      modalResultBox.innerHTML = `
        <div style="font-size:1.8rem; font-weight:bold; margin-bottom:6px;">出目: ${data.result}</div>
        <div style="font-size:1.4rem; font-weight:bold;">${data.message}</div>
      `;
    }
  });

  // 🎯 2段階目（または多段階）イベント：モーダルのテーマを維持し、文字・対応表だけを動的差し替え
  socket.off("startCustomEventSecondSpin");
  socket.on("startCustomEventSecondSpin", (data: any) => {
    console.log("💻 [PC HUB] イベント更新通知を受信:", data.nextStepEventName);

    const pcModal = document.getElementById("pc-event-modal");
    if (pcModal) {
      pcModal.classList.add("active");
      pcModal.style.display = "flex";
    }

    // 1. タイトル
    const titleEl = document.getElementById("modal-event-title");
    if (titleEl && data.nextStepEventName)
      titleEl.textContent = `💕 ${data.nextStepEventName} 💕`;

    // 2. 説明文
    const descEl = document.getElementById("modal-event-desc");
    if (descEl)
      descEl.textContent =
        data.pcSecondDesc || "スマホから最終決着スピンを回してね！";

    // 🎯 3. 1回目の結果文言を左下に表示
    const modalResultBox = document.getElementById("modal-event-result-box");
    if (modalResultBox) {
      modalResultBox.style.display = "block";
      modalResultBox.className = "event-result-box success";
      const rollNum =
        data.result !== undefined ? `【出目:${data.result}】` : "";
      modalResultBox.innerHTML = `
        <div style="font-size:1.1rem; color:#d81b60; font-weight:bold;">${rollNum} 💕 偶数達成！</div>
        <div style="font-size:1.3rem; font-weight:900; color:#e91e63; margin-top:2px;">告白チャンス獲得！</div>
      `;
    }

    // 4. 対応表の差し替え
    const dynamicTableZone = document.getElementById(
      "pc-event-table-dynamic-zone",
    );
    if (dynamicTableZone && data.mapping) {
      let html = `<div class="event-title" style="font-size:1.3rem; color:#d81b60; margin-bottom:8px; font-weight:bold; border-bottom:2px solid #ff69b4; padding-bottom:4px;">💘 告白対象スロット</div><ul class="event-table-list">`;
      for (let i = 1; i <= 10; i++) {
        const target = data.mapping[i];
        let targetText = '<span style="color:#aaa;">(該当なし)</span>';
        if (target && target.name) {
          targetText = `<span style="color:#e91e63; font-weight:bold;">${target.name}</span>`;
        }
        html += `<li class="event-table-item"><div class="event-table-num-badge" style="background:#ff4081;">${i}</div><div>${targetText}</div></li>`;
      }
      html += `</ul>`;
      dynamicTableZone.innerHTML = html;
    }
  });

  socket.off("customEventFinished");
  socket.on("customEventFinished", (data: any) => {
    console.log("💻 [PC RECEIVE] 2段階カスタムイベントの決着通知を受信:", data);
    isPCEventMode = false;

    const modalResultBox = document.getElementById("modal-event-result-box");
    if (!modalResultBox) return;

    modalResultBox.style.display = "block";

    if (data.success) {
      modalResultBox.className = "event-result-box couple-success";
      modalResultBox.innerHTML = `
        <div class="couple-congrats-title">🎉 おめでとう！！！ 🎉</div>
        <div class="couple-names-highlight">${data.targetA || "告白者"} と ${data.targetB || "意中の相手"}</div>
        <div class="couple-kanpai-shout">🍻 成立記念！全員で乾杯！ 🍻</div>
      `;
    } else {
      modalResultBox.className = "event-result-box failure";
      modalResultBox.innerHTML = `
        <div style="font-size:1.3rem; font-weight:bold; color:#546e7a;">💔 チャレンジ失敗...</div>
        <div style="font-size:1rem; color:#78909c; margin-top:4px;">今回はご縁がありませんでした...</div>
      `;
    }

    // 手動で閉じるボタンを表示（自動タイマークローズを撤廃）
    const pcCloseBtn = document.getElementById("pc-event-modal-close-btn");
    if (pcCloseBtn) pcCloseBtn.style.display = "inline-block";
    const btnNext = document.getElementById(
      "btn-next-turn",
    ) as HTMLButtonElement;
    if (btnNext) {
      btnNext.disabled = false;
    }
  });

  // 🎓 89番マス：卒業判定イベント（sq_89.js へ委譲）
  socket.off("showGraduateEvent");
  socket.on("showGraduateEvent", (data: any) => {
    loadAndApplySquareComponent(89, () => {
      const modObj = window.SQ_MODULES && window.SQ_MODULES[89];
      const targetModule = modObj
        ? modObj[currentGameMode] || modObj.normal
        : null;
      if (targetModule && typeof targetModule.event === "function") {
        const p = players[activePlayerIndex] || {
          name: data && data.playerName ? data.playerName : "プレイヤー",
        };
        targetModule.event(p, { ...targetModule, isTurnStart: true });
      }
    });
  });

  // 🎉 99番マス到着時：PC大画面にゴール祝賀モーダルを展開！
  const displayGoalModal = (data: any) => {
    if (!data || !data.player) return;
    console.log(`💻 [PC ゴール祝賀展開] プレイヤー: ${data.player.name}`);
    isPCEventMode = false;
    document.body.classList.remove("theme-repeat-dark");

    const pcEventModal = document.getElementById("pc-event-modal");
    if (pcEventModal) {
      pcEventModal.className = "event-modal-overlay";
      pcEventModal.style.display = "none";
    }

    const kanpaiModal = document.getElementById("pc-kanpai-modal");
    if (kanpaiModal) {
      const titleEl = kanpaiModal.querySelector(".kanpai-header");
      const membersEl = document.getElementById("pc-kanpai-members");
      const locationEl = document.getElementById("pc-kanpai-location");

      if (titleEl) titleEl.textContent = "🎉 祝・大学卒業ゴール！！！ 🎉";
      if (membersEl)
        membersEl.textContent = `🎓 ${data.player.name} が見事卒業達成！`;
      if (locationEl) locationEl.textContent = "社会への輝かしい旅立ち";

      kanpaiModal.style.display = "flex";
    }

    if (window.boardManager)
      window.boardManager.draw(players, activePlayerIndex);
  };

  socket.off("showGoalModal");
  socket.on("showGoalModal", displayGoalModal);
  socket.off("triggerGoalCelebration");
  socket.on("triggerGoalCelebration", displayGoalModal);

  // 🎊 全員ゴール完了（ゲーム終了・最終ランキング発表）
  socket.off("gameAllFinished");
  socket.on("gameAllFinished", (data: any) => {
    if (data && data.players) players = data.players;
    isPCEventMode = false;
    document.body.classList.remove("theme-repeat-dark");

    const pcEventModal = document.getElementById("pc-event-modal");
    if (pcEventModal) {
      pcEventModal.className = "event-modal-overlay";
      pcEventModal.style.display = "none";
    }

    const kanpaiModal = document.getElementById("pc-kanpai-modal");
    if (kanpaiModal) {
      const kanpaiBody = document.getElementById("pc-kanpai-body");
      if (kanpaiBody) kanpaiBody.style.display = "none";
      const resultBody = document.getElementById("pc-final-result-body");
      if (resultBody) resultBody.style.display = "block";

      const rankingListEl = document.getElementById("pc-final-ranking-list");
      if (rankingListEl) {
        // 幸福度順で総合ランキング作成
        const sortedByHappy = [...players].sort(
          (a, b) =>
            (b.happiness !== undefined ? b.happiness : 100) -
            (a.happiness !== undefined ? a.happiness : 100),
        );
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

        const medals = ["🥇 1位", "🥈 2位", "🥉 3位"];
        const rowsHtml = sortedByHappy
          .map((pl, i) => {
            const rankLabel = medals[i] || `${i + 1}位`;
            const hp = pl.happiness !== undefined ? pl.happiness : 100;
            const dr = pl.drinkCount || 0;
            return `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.18); padding:10px 18px; border-radius:12px; margin-bottom:8px; font-size:1.35rem;">
              <span>${rankLabel} <strong>${pl.name}</strong></span>
              <span>✨ ${hp}pt ／ 🍺 ${dr}杯</span>
            </div>`;
          })
          .join("");

        const drinkKingHtml =
          topDrinkers.length > 0
            ? `<div style="margin-top:14px; padding:10px 16px; background:rgba(0,0,0,0.28); border-radius:12px; font-size:1.25rem; color:#ffeb3b;">
                🍺 <strong>本日の酒豪王:</strong> ${topDrinkers.join("・")}（${maxDrinks}杯）
              </div>`
            : "";

        rankingListEl.innerHTML = `<div style="width:100%; max-width:560px; margin:0 auto;">${rowsHtml}${drinkKingHtml}</div>`;
      }

      const btnBack = document.getElementById("btn-back-to-title-pc");
      if (btnBack) {
        btnBack.onclick = () => {
          console.log("💻 [PC ACTION] タイトル画面に戻るボタンがクリックされました");
          socket.emit("returnToTitle", { roomCode });
          window.location.reload();
        };
      }

      kanpaiModal.style.display = "flex";
    }

    updateCurrentPlayerDisplay();
    if (window.boardManager)
      window.boardManager.draw(players, activePlayerIndex);
  });

  // 🏠 サーバーからのタイトル画面復帰号令を受信
  socket.off("returnToTitle");
  socket.on("returnToTitle", () => {
    console.log("💻 [PC SOCKET] returnToTitle 受信 ➔ タイトル画面へ戻ります");
    window.location.reload();
  });

  // 🎲 宅飲みゲーム決着：スマホで選択された敗者をPCモーダルに表示
  socket.off("takunomiEventFinished");
  socket.on("takunomiEventFinished", (data: any) => {
    if (!data) return;
    const takunomiModal = document.getElementById("pc-takunomi-modal");
    if (takunomiModal) {
      takunomiModal.style.display = "flex";
      const mainEl = document.getElementById("pc-takunomi-main");
      const subEl = document.getElementById("pc-takunomi-sub");
      if (mainEl) {
        mainEl.textContent = `🚨 ${data.loserName} アウト！ 🚨`;
        mainEl.style.color = "#ffeb3b";
      }
      if (subEl) {
        subEl.textContent = `🍺 ${data.loserName} さんが ＋${data.drinkAmount || 1}杯 飲む！（※スマホの「➡ 次のプレイヤーへ」で進行）`;
      }
    }
  });

  // ⚡ 必殺技発動開始：PC画面にカットインモーダルを表示
  socket.off("skillActivated");
  socket.on("skillActivated", (data: any) => {
    if (!data) return;

    // ⚽ 13. ファイアトルネードの場合はルーレット＆均等配置表モーダル（#pc-event-modal）を展開
    if (data.targetType === "fire_tornado" && data.fireTornadoMapping) {
      const pcModal = document.getElementById("pc-event-modal");
      if (pcModal) {
        isPCEventMode = true;
        pcModal.className = "event-modal-overlay active theme-rankup";
        pcModal.style.display = "flex";
        const titleEl = document.getElementById("modal-event-title");
        const descEl = document.getElementById("modal-event-desc");
        const resultBox = document.getElementById("modal-event-result-box");
        const rDisp = document.getElementById("modal-roulette-result-display");
        const tableZone = document.getElementById(
          "pc-event-table-dynamic-zone",
        );

        if (titleEl) {
          titleEl.textContent = `⚽🔥 【${data.jobTitle || "上位役職"}】${data.playerName || "プレイヤー"} のファイアトルネード！ 🔥⚽`;
        }
        if (descEl) {
          descEl.textContent =
            data.skillDesc ||
            "ルーレットにプレイヤーを均等に配置して当たったプレイヤーが３杯飲む！";
        }
        if (resultBox) {
          resultBox.style.display = "none";
          resultBox.textContent = "";
        }
        if (rDisp) {
          rDisp.textContent = "🎯 スマホからファイアトルネードを放て！";
        }
        if (tableZone) {
          let html = `<div class="event-title" style="font-size:1.3rem; color:#d84315; margin-bottom:8px; font-weight:bold; border-bottom:2px solid #ff8f00; padding-bottom:4px;">🌪️ ファイアトルネード対象表（均等配置）</div><ul class="event-table-list">`;
          for (let i = 1; i <= 10; i++) {
            const slot = data.fireTornadoMapping[i];
            const badgeBg = slot ? "#d84315" : "#90a4ae";
            const rowText = slot
              ? `<span style="color:#d84315; font-weight:bold;">🔥 ${slot.name} （直撃で 3杯 飲む！）</span>`
              : `<span style="color:#90a4ae;">（枠外）</span>`;
            html += `<li class="event-table-item"><div class="event-table-num-badge" style="background:${badgeBg};">${i}</div><div>${rowText}</div></li>`;
          }
          html += `</ul>`;
          tableZone.innerHTML = html;
        }
        return;
      }
    }

    const skillModal = document.getElementById("pc-skill-modal");
    if (skillModal) {
      const headerEl = document.getElementById("pc-skill-header");
      const nameEl = document.getElementById("pc-skill-name");
      const descEl = document.getElementById("pc-skill-desc");
      const resEl = document.getElementById("pc-skill-result");

      if (headerEl) {
        headerEl.textContent = `⚡ 【${data.jobTitle || "上位役職"}】${data.playerName || "プレイヤー"} が必殺技を発動！ ⚡`;
      }
      if (nameEl) {
        nameEl.textContent = `🔥 ${data.skillName || "必殺技"} 🔥`;
      }
      if (descEl) {
        descEl.textContent = data.skillDesc || "";
      }
      if (resEl) {
        resEl.textContent =
          data.targetType && data.targetType !== "none"
            ? "📱 スマホ画面で対象を選択中..."
            : "⚡ 必殺技効果を発動中...！";
      }
      const prevBack = document.getElementById("pc-skill-back-btn");
      if (prevBack) prevBack.style.display = "none";
      skillModal.style.display = "flex";
    }
  });

  socket.off("fireTornadoSpin");
  socket.on("fireTornadoSpin", (data: any) => {
    if (!data) return;
    const resNum = data.result !== undefined ? data.result : 1;
    const rDisp = document.getElementById("modal-roulette-result-display");
    if (rDisp) rDisp.textContent = "🌀 ファイアトルネード回転中...";
    const pcWheel = document.querySelector(
      "#pc-event-modal .event-roulette-wheel",
    ) as HTMLElement;
    if (pcWheel) {
      const targetDegrees = [342, 306, 270, 234, 198, 162, 126, 90, 54, 18];
      pcCurrentRotation +=
        1800 +
        ((targetDegrees[resNum - 1] - (pcCurrentRotation % 360) + 360) % 360);
      pcWheel.style.transition = "transform 3s cubic-bezier(0.15, 0.9, 0.2, 1)";
      pcWheel.style.transform = `rotate(${pcCurrentRotation}deg)`;
    }
  });

  socket.off("skillTaimanStarted");
  socket.on("skillTaimanStarted", (data: any) => {
    if (!data) return;
    const resEl = document.getElementById("pc-skill-result");
    if (resEl) {
      resEl.textContent = `🔥 ${data.challengerName} vs ${data.opponentName} 飲み会ゲームでタイマン勝負！（負けた方をスマホで選択）`;
    }
  });

  // ⚡ 必殺技効果の確定通知：結果をPCモーダルに表示して一定時間後にクローズ
  socket.off("skillEffectResolved");
  socket.on("skillEffectResolved", (data: any) => {
    if (!data) return;

    const descCardEl =
      document.getElementById("event-text") ||
      document.getElementById("current-tile-desc");
    if (descCardEl && data.resultMessage) {
      descCardEl.innerHTML = `<p class="event-msg" style="color: #d84315; font-weight: bold; font-size: 1.15rem; margin: 0;">⚡ 【必殺技】${data.resultMessage}</p>`;
    }

    if (data.isFireTornado) {
      isPCEventMode = false;
      const rDisp = document.getElementById("modal-roulette-result-display");
      if (rDisp && data.resultNum !== undefined) {
        rDisp.textContent = `🎯 出目: ${data.resultNum}`;
      }
      const resultBox = document.getElementById("modal-event-result-box");
      if (resultBox) {
        resultBox.style.display = "block";
        resultBox.className = "event-result-box success";
        resultBox.innerHTML = `<div style="font-size:1.35rem; font-weight:900; color:#d84315;">${data.resultMessage}</div><button type="button" id="pc-tornado-back-btn" style="margin-top:12px; padding:12px 36px; font-size:1.3rem; font-weight:900; color:#fff; background:#d84315; border:none; border-radius:12px; cursor:pointer;">↩ ターンに戻る</button>`;
        const tBack = document.getElementById("pc-tornado-back-btn");
        if (tBack) {
          tBack.onclick = () => {
            const pcModal = document.getElementById("pc-event-modal");
            if (pcModal) {
              pcModal.className = "event-modal-overlay";
              pcModal.style.display = "none";
            }
          };
        }
      }
      return;
    }

    const skillModal = document.getElementById("pc-skill-modal");
    if (skillModal) {
      skillModal.style.display = "flex";
      const resEl = document.getElementById("pc-skill-result");
      if (resEl && data.resultMessage) {
        resEl.textContent = `🎯 ${data.resultMessage}`;
      }
      const backBtn = document.getElementById("pc-skill-back-btn");
      if (backBtn) backBtn.style.display = "block";
    }
  });

  // ✖ PC上のモーダル手動クローズ要求を受信（スマホからの操作など）
  socket.off("closePcModal");
  socket.on("closePcModal", () => {
    console.log("💻 [PC SOCKET] closePcModal 受信 ➔ モーダルを全クローズ");
    closeAllPCModals();
  });

  // PC画面上の閉じるボタンのクリックハンドラ登録
  const btnEventClose = document.getElementById("pc-event-modal-close-btn");
  if (btnEventClose) {
    btnEventClose.onclick = () => {
      socket.emit("closePcModal", { roomCode });
      closeAllPCModals();
    };
  }
  const btnKanpaiClose = document.getElementById("pc-kanpai-close-btn");
  if (btnKanpaiClose) {
    btnKanpaiClose.onclick = () => {
      socket.emit("closePcModal", { roomCode });
      closeAllPCModals();
    };
  }
  const btnTakunomiClose = document.getElementById("pc-takunomi-close-btn");
  if (btnTakunomiClose) {
    btnTakunomiClose.onclick = () => {
      socket.emit("closePcModal", { roomCode });
      closeAllPCModals();
    };
  }
  const btnSkillClose = document.getElementById("pc-skill-back-btn");
  if (btnSkillClose) {
    btnSkillClose.onclick = () => {
      socket.emit("closePcModal", { roomCode });
      closeAllPCModals();
    };
  }

  socket.off("enableNextTurnButton");
  socket.on("enableNextTurnButton", () => {
    const pcModal = document.getElementById("pc-event-modal");
    if (pcModal && pcModal.classList.contains("theme-insurance")) {
      pcModal.className = "event-modal-overlay";
      pcModal.style.display = "none";
      isPCEventMode = false;
    }
  });

  socket.off("syncGameState");
  socket.on("syncGameState", (data: any) => {
    if (data.players && Array.isArray(data.players)) players = data.players;
    if (data.activePlayerIndex !== undefined)
      activePlayerIndex = data.activePlayerIndex;
    updateCurrentPlayerDisplay();
    const curP = players && players[activePlayerIndex];
    syncPCKoreanDOMMode(Boolean(curP && curP.koreanModeThisTurn));
    if (window.boardManager)
      window.boardManager.draw(players, activePlayerIndex);
  });

  socket.off("applyPlayerAction");
  socket.on("applyPlayerAction", (data: any) => {
    if (data && data.action === "turnUpdated") {
      console.log(
        "💻 [PC 新ターン開始] 全アクティブモーダルを一括クローズします。",
      );
      isPCEventMode = false;

      if (data.activePlayerIndex !== undefined) {
        activePlayerIndex = data.activePlayerIndex;
      }
      const curP = players[activePlayerIndex];
      if (curP && curP.isRepeat) {
        document.body.classList.add("theme-repeat-dark");
      } else {
        document.body.classList.remove("theme-repeat-dark");
      }

      const pcModal = document.getElementById("pc-event-modal");
      if (pcModal) {
        pcModal.style.display = "none";
        pcModal.classList.remove("active");
      }

      const kanpaiModal = document.getElementById("pc-kanpai-modal");
      if (kanpaiModal) {
        kanpaiModal.style.display = "none";
      }

      const takunomiModal = document.getElementById("pc-takunomi-modal");
      if (takunomiModal) {
        takunomiModal.style.display = "none";
      }

      const skillModal = document.getElementById("pc-skill-modal");
      if (skillModal) {
        skillModal.style.display = "none";
      }

      const coupleModal = document.getElementById("pc-couple-event-modal");
      if (coupleModal) {
        coupleModal.style.display = "none";
      }
      updateCurrentPlayerDisplay();
    } else if (data && data.action === "turnSkipped") {
      isPCEventMode = false;
      if (data.activePlayerIndex !== undefined) {
        activePlayerIndex = data.activePlayerIndex;
      }
      const curP = players[activePlayerIndex];
      if (curP && curP.isRepeat) {
        document.body.classList.add("theme-repeat-dark");
      } else {
        document.body.classList.remove("theme-repeat-dark");
      }
      const pcModal = document.getElementById("pc-event-modal");
      if (pcModal) {
        pcModal.style.display = "none";
        pcModal.classList.remove("active");
      }
      const kanpaiModal = document.getElementById("pc-kanpai-modal");
      if (kanpaiModal) {
        kanpaiModal.style.display = "none";
      }
      const takunomiModal = document.getElementById("pc-takunomi-modal");
      if (takunomiModal) {
        takunomiModal.style.display = "none";
      }

      const skillModal = document.getElementById("pc-skill-modal");
      if (skillModal) {
        skillModal.style.display = "none";
      }
      const descEl =
        document.getElementById("event-text") ||
        document.getElementById("current-tile-desc");
      if (descEl) {
        descEl.innerHTML = `<p class="event-msg" style="color: #e67e22; font-weight: bold; font-size: 1.15rem; margin: 0;">💤 ${data.activePlayerName || "プレイヤー"} さんは二日酔い（1回休み）のためターンをスキップします！</p>`;
      }
      updateCurrentPlayerDisplay();
    } else if (data && data.action === "insuranceUsed") {
      const p = players.find((pl) => String(pl.id) === String(data.playerId));
      if (p) {
        p.insurance = data.nextInsuranceCount;
        const descEl =
          document.getElementById("event-text") ||
          document.getElementById("current-tile-desc");
        if (descEl) {
          descEl.innerHTML = `
          <p class="event-msg" style="color: #9c27b0; font-weight: bold; font-size: 1.2rem; margin: 0;">
            🛡️ 生命保険発動！！！ 🛡️<br>
            ${p.name} は保険を1枚消費し、このターンの飲酒ペナルティを無効化した！<br>
            <span style="font-size: 0.9rem; color: #666;">(残り保険枚数: ${p.insurance}枚)</span>
          </p>
        `;
        }
        updateCurrentPlayerDisplay();
      }
    }
  });
}

window.appendSocketListeners = appendSocketListeners;

const mountPC = () => {
  const rootEl = document.getElementById("root");
  if (rootEl) {
    const root = createRoot(rootEl);
    root.render(<PCApp />);
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountPC);
} else {
  mountPC();
}

