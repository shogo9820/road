/**
 * 🎯 マスコンポーネント: 49番マス（【強制ストップ】ランクアップチャンス！）
 *
 * [設計思想]
 * 1. 着地時（startSquareEvent）：18番や41番と同様にPC・スマホ連動のイベントモーダル＆ルーレットを展開。
 *    出目6以上でマスタ（JOBS）の title（上位役職名）へランクアップし、5以下は現状維持。
 * 2. 次ターン開始時（1.TURN_START）：0番マス（sq_0.js）と完全に同じ「shadowTargets」「routeConfig」構造により、
 *    Aルート / Bルートの進路選択と影描画がそのまま機能します。
 */

window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES[49] = {
  // 🌸 現行：宅飲み人生ゲーム（サークル生活モード）
  normal: {
    id: 49,
    type: "branch", // 🎯 進路選択＆強制ストップ共通の型指定
    text: "【強制ストップ】ランクアップチャンス！",
    drink: 0,
    happiness: 0,
    location: "家",

    // 🧭 進路選択モーダルの文言設定
    routeConfig: {
      title: "🧭 運命の進路選択",
      desc: "進むルートをタップしてください。",
      routeALabel: "Aルート（激シャバルート）",
      routeBLabel: "Bルート（激おもろ一生の思い出ルート）",
      confirmLabel: "進路を確定してルーレットへ"
    },

    // 🧭 0番マス（sq_0.js）と完全に一致させた、影を落とすマスのID配列指定
    shadowTargets: {
      // 💡 Aルート（50〜58）選択時、Bルート側の道（59〜79番）に影を落とす
      routeA: [
        59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69,
        70, 71, 72, 73, 74, 75, 76, 77, 78, 79
      ],
      // 💡 Bルート（59〜79）選択時、Aルート側の道（50〜58番）に影を落とす
      routeB: [
        50, 51, 52, 53, 54, 55, 56, 57, 58
      ]
    },

    config: {
      themeClass: "theme-rankup",
      pcTitle: "🔥 ランクアップチャンス 🔥",
      pcDesc: "さんの実力が試される時！1と4以外（80%）を出して役職ランクアップを掴み取れ！",
      mobileDisplay: "🎯 1・4以外（80%）を出して役職ランクアップを狙え！",
      mobileBtn: "🔥 運命のランクアップスピンを回す！"
    },

    event: function (player, square) {
      const cfg = this.config;
      const mod = this;
      const targetRoom =
        typeof currentRoomCode !== "undefined"
          ? currentRoomCode
          : typeof roomCode !== "undefined"
            ? roomCode
            : "";

      // マスタ（JOBS）から現在の役職とランクアップ後の役職名（title）を参照
      const jobMaster =
        typeof JOBS !== "undefined" && Array.isArray(JOBS)
          ? JOBS.find(
              (j) =>
                j.id === player.jobId ||
                j.label === player.job ||
                j.title === player.job
            )
          : null;
      const currentJobName = jobMaster
        ? jobMaster.label
        : player.job || "モブ";
      const rankUpJobName = jobMaster
        ? jobMaster.title
        : player.job || "代表or副代表";

      console.log(
        `🔥 [49番マス: ランクアップチャンス] ${player.name} (${currentJobName} ➔ ${rankUpJobName}) のイベント開始`
      );

      // 💻 ① 【PC大画面側の直接処理】
      const pcModal = document.getElementById("pc-event-modal");
      if (pcModal) {
        if (typeof isPCEventMode !== "undefined") isPCEventMode = true;

        const btnNext = document.getElementById("btn-next-turn");
        if (btnNext) {
          btnNext.disabled = true;
          btnNext.style.display = "none";
        }

        pcModal.className = "event-modal-overlay active " + cfg.themeClass;
        pcModal.style.display = "flex";
        document.getElementById("modal-event-title").textContent = cfg.pcTitle;
        document.getElementById("modal-event-desc").textContent =
          `${player.name} ${cfg.pcDesc}（現在: ${currentJobName} ➔ 成功時: ${rankUpJobName}）`;

        const resultBox = document.getElementById("modal-event-result-box");
        if (resultBox) {
          resultBox.style.display = "none";
          resultBox.className = "event-result-box";
          resultBox.textContent = "";
        }

        let tableHTML = `
          <div class="event-title" style="font-size:1.3rem; color:#b78103; margin-bottom:8px; font-weight:bold; border-bottom:2px solid #f5a623; padding-bottom:4px;">👑 ランクアップ判定対応表</div>
          <ul class="event-table-list">`;
        for (let i = 1; i <= 10; i++) {
          const isRankUp = i !== 1 && i !== 4;
          const targetTitle =
            (player.jobId === "mob" || currentJobName === "モブ")
              ? i % 2 === 0
                ? "代表"
                : "副代表"
              : rankUpJobName;
          const badgeBg = isRankUp ? "#f5a623" : "#78909c";
          const rowText = isRankUp
            ? `<span style="color:#d84315; font-weight:bold;">🔥 ランクアップ！【${targetTitle}】に昇格！</span>`
            : `<span style="color:#546e7a; font-weight:bold;">💦 現状維持（${currentJobName} のまま）</span>`;
          tableHTML += `<li class="event-table-item"><div class="event-table-num-badge" style="background:${badgeBg};">${i}</div><div>${rowText}</div></li>`;
        }
        tableHTML += `</ul>`;
        document.getElementById("pc-event-table-dynamic-zone").innerHTML =
          tableHTML;
        document.getElementById("modal-roulette-result-display").textContent =
          "🎯 スマホから運命のスピンを回してね！";
        return;
      }

      // 📱 ② 【スマホ手元側の直接処理】
      if (typeof socket !== "undefined") {
        const spinBtn = document.getElementById("btn-phone-spin");
        const resultDisplay = document.getElementById(
          "roulette-result-display"
        );

        document.body.classList.add(cfg.themeClass);
        if (resultDisplay) resultDisplay.textContent = cfg.mobileDisplay;

        if (spinBtn) {
          const newSpinBtn = spinBtn.cloneNode(true);
          spinBtn.parentNode.replaceChild(newSpinBtn, spinBtn);
          newSpinBtn.disabled = false;
          newSpinBtn.textContent = cfg.mobileBtn;

          newSpinBtn.onclick = function () {
            newSpinBtn.disabled = true;
            if (resultDisplay)
              resultDisplay.textContent = "🌀 ルーレット回転要求中...";

            const rankupMapping = {};
            for (let i = 1; i <= 10; i++) {
              if (i !== 1 && i !== 4) {
                const targetTitle =
                  (player.jobId === "mob" || currentJobName === "モブ")
                    ? i % 2 === 0
                      ? "代表"
                      : "副代表"
                    : rankUpJobName;
                rankupMapping[i] = {
                  name: `🎉 ランクアップ成功！【${targetTitle}】に昇格！`,
                  drinks: 0,
                  isRankUp: true,
                  newJobTitle: targetTitle
                };
              } else {
                rankupMapping[i] = {
                  name: `💦 現状維持...（${currentJobName} のまま）`,
                  drinks: 0,
                  isRankUp: false
                };
              }
            }

            socket.emit("startCustomRouletteEvent", {
              roomCode: targetRoom,
              eventName: "ランクアップ判定",
              mapping: rankupMapping
            });
          };
        }

        // ホイール同期回転リスナー
        if (mod._onSpin) socket.off("spinCustomRoulette", mod._onSpin);
        mod._onSpin = (data) => {
          const resNum = data.result !== undefined ? data.result : 1;
          if (resultDisplay)
            resultDisplay.textContent = "🌀 ルーレット回転中...";

          let pcWheel = document.querySelector(
            "#pc-event-modal .event-roulette-wheel"
          );
          if (pcWheel && typeof pcCurrentRotation !== "undefined") {
            const targetDegrees = [
              342, 306, 270, 234, 198, 162, 126, 90, 54, 18
            ];
            pcCurrentRotation +=
              1800 +
              ((targetDegrees[resNum - 1] - (pcCurrentRotation % 360) + 360) %
                360);
            pcWheel.style.transition =
              "transform 3s cubic-bezier(0.15, 0.9, 0.2, 1)";
            pcWheel.style.transform = `rotate(${pcCurrentRotation}deg)`;
          }

          if (
            typeof currentRotation !== "undefined" &&
            typeof playMobileRouletteAnimation === "function"
          ) {
            const targetDegrees = [
              342, 306, 270, 234, 198, 162, 126, 90, 54, 18
            ];
            currentRotation +=
              1800 +
              ((targetDegrees[resNum - 1] - (currentRotation % 360) + 360) %
                360);
            playMobileRouletteAnimation(resNum, currentRotation, () => {});
          }
        };
        socket.on("spinCustomRoulette", mod._onSpin);

        // 決着通知リスナー
        if (mod._onFinished)
          socket.off("customRouletteFinished", mod._onFinished);
        mod._onFinished = (data) => {
          if (mod._onSpin) socket.off("spinCustomRoulette", mod._onSpin);
          if (mod._onFinished)
            socket.off("customRouletteFinished", mod._onFinished);

          const resNum = data && data.result !== undefined ? data.result : 1;
          if (resNum !== 1 && resNum !== 4) {
            const targetTitle =
              (player.jobId === "mob" || currentJobName === "モブ")
                ? resNum % 2 === 0
                  ? "代表"
                  : "副代表"
                : rankUpJobName;
            player.job = targetTitle;
            player.isRankedUp = true;
            if (typeof updatePhoneStatusDisplay === "function") {
              updatePhoneStatusDisplay();
            }
          }

          if (resultDisplay && data && data.message) {
            resultDisplay.textContent = `🎯 結果: ${data.message}`;
          }
          document.body.classList.remove(cfg.themeClass);

          const resetBtn = document.getElementById("btn-phone-spin");
          if (resetBtn) {
            const cleanedBtn = resetBtn.cloneNode(true);
            resetBtn.parentNode.replaceChild(cleanedBtn, resetBtn);
            cleanedBtn.disabled = true;
            cleanedBtn.textContent = "⚡ ルーレットを回す！";
            if (typeof requestSpin === "function") {
              cleanedBtn.addEventListener("click", requestSpin);
            }
          }
        };
        socket.on("customRouletteFinished", mod._onFinished);
      }
    }
  },

  // 💼 将来用拡張：社会人モード
  salaryman: {
    id: 49,
    type: "branch",
    text: "【強制ストップ】運命の昇進・独立分岐点！",
    drink: 0,
    happiness: 0,
    location: "オフィス",
    routeConfig: {
      title: "🧭 運命の進路選択",
      desc: "進むルートをタップしてください。",
      routeALabel: "Aルート（激シャバルート）",
      routeBLabel: "Bルート（激おもろ一生の思い出ルート）",
      confirmLabel: "進路を確定してルーレットへ"
    },
    shadowTargets: {
      routeA: [
        59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69,
        70, 71, 72, 73, 74, 75, 76, 77, 78, 79
      ],
      routeB: [
        50, 51, 52, 53, 54, 55, 56, 57, 58
      ]
    },
    event: function (p, s) {
      window.SQ_MODULES[49].normal.event(p, s);
    }
  },

  // ⚡ 将来用拡張：ショートモード
  short: {
    id: 49,
    type: "branch",
    text: "【強制ストップ】爆速ルート分岐",
    drink: 0,
    happiness: 10,
    location: "家",
    routeConfig: {
      title: "🧭 運命の進路選択",
      desc: "進むルートをタップしてください。",
      routeALabel: "Aルート（激シャバルート）",
      routeBLabel: "Bルート（激おもろ一生の思い出ルート）",
      confirmLabel: "進路を確定してルーレットへ"
    },
    shadowTargets: {
      routeA: [
        59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69,
        70, 71, 72, 73, 74, 75, 76, 77, 78, 79
      ],
      routeB: [
        50, 51, 52, 53, 54, 55, 56, 57, 58
      ]
    },
    event: function (p, s) {
      window.SQ_MODULES[49].normal.event(p, s);
    }
  }
};
