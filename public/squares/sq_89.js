// public/squares/sq_89.js
window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES[89] = {
  normal: {
    id: 89,
    type: "force_stop",
    text: "【強制ストップ】運命の卒業判定マス！",
    location: "家",

    config: {
      themeClass: "theme-rankup",
      repeatThemeClass: "theme-repeat-dark",
      pcTitle: "🎓 運命の卒業判定 🎓",
      pcDesc: "出目 6以上で卒業！5以下は留年...",
      mobileTitle: "🎓 運命の卒業判定 🎓",
      mobileDesc: "出目 6以上で卒業！<br>5以下は留年...",
      mobileBtn: "⚡ 卒業判定ルーレットを回す！",
      mobileRepeatBtn: "💀 留年ルートへ進む！",
      mobileRepeatDisplay: "💀 5年生編スタート..."
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

      // ─── 【着地時（ターン終了処理）】 ───
      if (!square || !square.isTurnStart) {
        console.log(
          `🎓 [89番マス: 着地] プレイヤー: ${player.name} が到着。強制ストップとして一旦ターンを終了します。`
        );

        // PC大画面側は着地時はモーダルを開かず終了（完了通知はスマホ側から送信）
        const pcModal = document.getElementById("pc-event-modal");
        if (pcModal) return;

        // 🎯 着地時はそのまま完了通知を送り、手元の「次へ」ボタンを点灯させて次の人へ手番を回す
        if (typeof socket !== "undefined") {
          socket.emit("playerAction", {
            roomCode: targetRoom,
            action: "squareEventFinished",
            updatedPlayer: player
          });
        }
        return;
      }

      // ─── 【次ターン開始時（運命の卒業判定ルーレット）】 ───

      // 💻 ① 【PC大画面側の初期描画＆リスナー制御】
      const pcModal = document.getElementById("pc-event-modal");
      if (pcModal) {
        console.log(`💻 [PC 卒業判定展開] プレイヤー: ${player.name}`);
        if (typeof isPCEventMode !== "undefined") isPCEventMode = true;

        pcModal.className = "event-modal-overlay active " + cfg.themeClass;
        pcModal.style.display = "flex";

        const titleEl = document.getElementById("modal-event-title");
        if (titleEl) titleEl.textContent = cfg.pcTitle;

        const descEl = document.getElementById("modal-event-desc");
        if (descEl) descEl.textContent = cfg.pcDesc;

        const modalResultBox = document.getElementById("modal-event-result-box");
        if (modalResultBox) {
          modalResultBox.style.display = "none";
          modalResultBox.className = "event-result-box";
          modalResultBox.textContent = "";
        }

        const modalRouletteDisplay = document.getElementById(
          "modal-roulette-result-display"
        );
        if (modalRouletteDisplay) {
          modalRouletteDisplay.textContent = "🎯 スマホから回してね！";
        }

        const dynamicTableZone = document.getElementById("pc-event-table-dynamic-zone");
        if (dynamicTableZone) {
          dynamicTableZone.innerHTML = `
            <div class="event-title" style="font-size:1.3rem; color:#b78103; margin-bottom:8px; font-weight:bold; border-bottom:2px solid #f5a623; padding-bottom:4px;">📜 卒業判定基準</div>
            <ul class="event-table-list">
              <li class="event-table-item"><div class="event-table-num-badge" style="background:#4caf50;">6〜10</div><div><span style="color:#2e7d32; font-weight:bold;">卒業！</span></div></li>
              <li class="event-table-item"><div class="event-table-num-badge" style="background:#f44336;">1〜5</div><div><span style="color:#c62828; font-weight:bold;">留年...</span></div></li>
            </ul>
          `;
        }

        // 🎓 卒業ルーレット回転リスナー（3秒回転 ➔ 回り終えた時点で出目を表示）
        if (mod._onPcSpin) socket.off("spinGraduateRoulette", mod._onPcSpin);
        mod._onPcSpin = (data) => {
          console.log(`💻 [PC 卒業ルーレット回転] 出目: ${data.result}`);
          if (modalRouletteDisplay) {
            modalRouletteDisplay.textContent = "🌀 回転中...";
          }
          if (typeof executeSyncedRoulette === "function") {
            executeSyncedRoulette(data.result);
          }
          // ルーレットが回り終えた瞬間（3秒後）に出目結果を表示し、その1秒後にサーバーから暗転信号が届く
          setTimeout(() => {
            if (modalRouletteDisplay) {
              modalRouletteDisplay.textContent = `出目: ${data.result}`;
            }
            if (modalResultBox) {
              modalResultBox.style.display = "block";
              modalResultBox.className = data.isPass
                ? "event-result-box success"
                : "event-result-box failure";
              modalResultBox.innerHTML = `
                <div style="font-size:1.8rem; font-weight:bold; margin-bottom:6px;">出目: ${data.result}</div>
                <div style="font-size:1.4rem; font-weight:bold;">${data.isPass ? "卒業！" : "留年..."}</div>
              `;
            }

            // PC手動クローズボタンを表示
            const pcCloseBtn = document.getElementById("pc-event-modal-close-btn");
            if (pcCloseBtn) pcCloseBtn.style.display = "inline-block";
          }, 3000);
        };
        socket.on("spinGraduateRoulette", mod._onPcSpin);

        // 💀 留年：画面ダークモード化（背景を暗転させ、モーダルは手動で閉じるまで維持）
        if (mod._onPcRepeat) socket.off("applyRepeatDarkTheme", mod._onPcRepeat);
        mod._onPcRepeat = (data) => {
          console.log(
            `💻 [PC 暗黒留年演出] ${data.playerName} が留年ルートへ突入しました。`
          );
          // 背景を暗くする
          document.body.classList.add(cfg.repeatThemeClass);

          const tileDescEl =
            document.getElementById("event-text") ||
            document.getElementById("current-tile-desc");
          if (tileDescEl) {
            tileDescEl.innerHTML = `<p style="color: #9c27b0; font-weight: 900; font-size: 1.2rem; animation: pulse 1s infinite;">💀 ${data.playerName} は留年した...！留年ルート（90〜98）が開通！ 💀</p>`;
          }

          if (window.boardManager) {
            window.boardManager.draw(players, activePlayerIndex);
          }
        };
        socket.on("applyRepeatDarkTheme", mod._onPcRepeat);
        return;
      }

      // 📱 ② 【スマホ手元側の制御】
      if (typeof socket !== "undefined") {
        console.log(
          "📱 [89番マス] 運命の卒業判定を検知。独立信号 showGraduateEvent を直撃送信！"
        );
        const mainSpinBtn = document.getElementById("btn-phone-spin");
        if (mainSpinBtn) mainSpinBtn.disabled = true;

        // スマホ側でもルーレット回転アニメーションを同期
        if (mod._onMobileSpin)
          socket.off("spinGraduateRoulette", mod._onMobileSpin);
        mod._onMobileSpin = (data) => {
          const resNum = data && data.result !== undefined ? data.result : 1;
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
        socket.on("spinGraduateRoulette", mod._onMobileSpin);

        // 🌸 合格時：交代ボタンのみ点灯
        if (mod._onPass) socket.off("showGraduateNextButton", mod._onPass);
        mod._onPass = (data) => {
          if (mod._onMobileSpin)
            socket.off("spinGraduateRoulette", mod._onMobileSpin);
          if (mod._onPass) socket.off("showGraduateNextButton", mod._onPass);
          if (mod._onFail) socket.off("graduateFailedRepeat", mod._onFail);

          const modal = document.getElementById("mobile-couple-event-modal");
          if (modal) modal.style.display = "none";

          const resDisplay = document.getElementById("roulette-result-display");
          if (resDisplay) {
            resDisplay.textContent = `🌸 ${data && data.message ? data.message : "卒業おめでとう！"}`;
          }
          const btnNext = document.getElementById("btn-phone-next");
          if (btnNext) btnNext.disabled = false;
        };
        socket.on("showGraduateNextButton", mod._onPass);

        // 💀 留年時：モーダル消去と同時に手元もダークモード化させて通常スピンを復活！
        if (mod._onFail) socket.off("graduateFailedRepeat", mod._onFail);
        mod._onFail = (data) => {
          if (mod._onMobileSpin)
            socket.off("spinGraduateRoulette", mod._onMobileSpin);
          if (mod._onPass) socket.off("showGraduateNextButton", mod._onPass);
          if (mod._onFail) socket.off("graduateFailedRepeat", mod._onFail);

          const modal = document.getElementById("mobile-couple-event-modal");
          if (modal) modal.style.display = "none";

          // 手元画面もPCと同時にダークモード化
          document.body.classList.add(cfg.repeatThemeClass);

          const spinBtn = document.getElementById("btn-phone-spin");
          if (spinBtn) {
            spinBtn.disabled = false;
            spinBtn.textContent = cfg.mobileRepeatBtn;
            spinBtn.style.background =
              "linear-gradient(135deg, #4a148c 0%, #000000 100%)";
            spinBtn.style.color = "#ff80ab";
            spinBtn.style.border = "2px solid #ea80fc";
          }

          const resDisplay = document.getElementById("roulette-result-display");
          if (resDisplay) {
            resDisplay.textContent = cfg.mobileRepeatDisplay;
          }
        };
        socket.on("graduateFailedRepeat", mod._onFail);

        setTimeout(() => {
          socket.emit("showGraduateEvent", {
            roomCode: targetRoom,
            playerName: player.name
          });

          const modal = document.getElementById("mobile-couple-event-modal");
          if (!modal) return;

          const titleEl =
            modal.querySelector("h3") || modal.querySelector(".couple-title");
          if (titleEl) titleEl.innerHTML = cfg.mobileTitle;

          const descEl = modal.querySelector(".couple-desc");
          if (descEl) descEl.innerHTML = cfg.mobileDesc;

          const btnSpin = document.getElementById("btn-couple-spin");
          if (btnSpin) {
            btnSpin.style.display = "block";
            btnSpin.textContent = cfg.mobileBtn;
            btnSpin.disabled = false;

            btnSpin.onclick = () => {
              btnSpin.disabled = true;
              socket.emit("requestGraduateSpin", { roomCode: targetRoom });
            };
          }
          modal.style.display = "flex";
        }, 150);
      }
    }
  },
  salaryman: {
    id: 89,
    type: "force_stop",
    text: "【強制ストップ】運命の卒業判定マス！",
    location: "卒業判定掲示板前",
    event: function (p, s) {
      window.SQ_MODULES[89].normal.event(p, s);
    }
  },
  short: {
    id: 89,
    type: "force_stop",
    text: "【強制ストップ】運命の卒業判定マス！",
    location: "卒業判定掲示板前",
    event: function (p, s) {
      window.SQ_MODULES[89].normal.event(p, s);
    }
  }
};
