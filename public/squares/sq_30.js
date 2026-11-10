// public/squares/sq_30.js
window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES[30] = {
  normal: {
    id: 30,
    type: "insurance_shop",
    text: "【強制ストップ】生命保険購入（0〜3枚選択可能）",
    location: "家",

    config: {
      themeClass: "theme-insurance",
      maxInsurance: 3, // 💡 将来5枚上限に変更する場合はここを 5 に変えるだけで自動反映されます
      pcTitle: "🛡️ 生命保険 取扱所 🛡️",
      pcDesc: "今後の飲酒を完全無効化できる生命保険に加入できます（1枚購入につき1杯飲酒）。スマホで枚数を選択してください。",
      mobilePrompt: "🛡️ 今後の飲酒を完全無効化できる生命保険を購入できます（1枚購入につき1杯飲酒）。"
    },

    event: function (player, square) {
      const cfg = this.config;
      const maxIns = cfg.maxInsurance || 3;
      const currentIns = player.insurance || 0;
      const purchasableMax = Math.max(0, maxIns - currentIns);
      const targetRoom =
        typeof currentRoomCode !== "undefined"
          ? currentRoomCode
          : typeof roomCode !== "undefined"
            ? roomCode
            : "";
      console.log(`🛡️ [sq_30.js] 30番マス: ${player.name} の生命保険購入イベント開始`);

      // 💻 ① 【PC大画面側の処理：案内モーダルを表示して自動進行を阻止】
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
        document.getElementById("modal-event-desc").textContent = `${player.name} さんが保険屋に立ち寄り中！ ${cfg.pcDesc}`;

        const resultBox = document.getElementById("modal-event-result-box");
        if (resultBox) {
          resultBox.style.display = "none";
          resultBox.textContent = "";
        }

        const dynamicTableZone = document.getElementById("pc-event-table-dynamic-zone");
        if (dynamicTableZone) {
          dynamicTableZone.innerHTML = `
            <div class="event-title" style="font-size:1.3rem; color:#8e24aa; margin-bottom:8px; font-weight:bold; border-bottom:2px solid #ab47bc; padding-bottom:4px;">📜 保険プラン内容</div>
            <ul class="event-table-list">
              <li class="event-table-item"><div class="event-table-num-badge" style="background:#d32f2f;">代償</div><div><span style="color:#c62828; font-weight:bold;">🍺 1枚購入するごとに、その場で1杯飲まないといけない！</span></div></li>
              <li class="event-table-item"><div class="event-table-num-badge" style="background:#ab47bc;">効果</div><div><span style="color:#4a148c; font-weight:bold;">1枚消費につき、アルコール1杯を完全無効化！</span></div></li>
              <li class="event-table-item"><div class="event-table-num-badge" style="background:#ab47bc;">制限</div><div><span style="color:#4a148c; font-weight:bold;">1人あたり最大${maxIns}枚まで所持可能（現在: ${currentIns}枚）</span></div></li>
            </ul>
          `;
        }
        document.getElementById("modal-roulette-result-display").textContent =
          "📱 スマホコントローラーから購入枚数を選択中...";
        return;
      }

      // 📱 ② 【スマホ手元側の処理：インラインショップボタンを展開】
      if (typeof socket !== "undefined") {
        const resultDisplay = document.getElementById("roulette-result-display");
        const spinBtn = document.getElementById("btn-phone-spin");
        const playScreen = document.getElementById("phone-screen-play") || document.body;

        document.body.classList.add(cfg.themeClass);
        if (spinBtn) spinBtn.style.display = "none";
        if (resultDisplay) resultDisplay.textContent = cfg.mobilePrompt;

        // 既存の残骸があれば削除
        document.getElementById("insurance-inline-zone")?.remove();

        let buttonsHtml = `<button class="btn-shop-select btn-blue" data-count="0" style="background-color:#78909c !important;">0枚（購入しない / 0杯）</button>`;
        for (let i = 1; i <= purchasableMax; i++) {
          const maxLabel = i === purchasableMax ? "最大 / " : "";
          buttonsHtml += `<button class="btn-shop-select btn-orange" data-count="${i}">${i}枚購入（${maxLabel}🍺 ${i}杯飲む）</button>`;
        }

        const inlineShopHtml = `
          <div id="insurance-inline-zone" style="width:100%; display:flex; flex-direction:column; gap:8px; margin:10px auto; align-items:center;">
            <div style="font-weight:bold; font-size:1.1rem; color:#9c27b0; margin-bottom:4px; text-align:center;">
              🛡️ 何枚購入しますか？ (現在: ${currentIns} / ${maxIns}枚所持)<br>
              <span style="font-size:0.9rem; color:#d32f2f;">※1枚購入するのに1杯飲まないといけません</span>
            </div>
            ${buttonsHtml}
          </div>
        `;

        if (spinBtn) {
          spinBtn.insertAdjacentHTML("beforebegin", inlineShopHtml);
        } else {
          playScreen.insertAdjacentHTML("beforeend", inlineShopHtml);
        }

        // 各ボタンのタップ処理
        const selectButtons = document.querySelectorAll("#insurance-inline-zone .btn-shop-select");
        selectButtons.forEach((btn) => {
          btn.onclick = (e) => {
            e.preventDefault();
            const buyCount = parseInt(e.currentTarget.getAttribute("data-count"), 10);

            if (!player.insurance) player.insurance = 0;
            player.insurance = Math.min(maxIns, player.insurance + buyCount);

            // 購入した枚数分だけ杯数（drinkCount）をプラス＆体力（currentHp）を計算
            if (buyCount > 0) {
              player.drinkCount = (player.drinkCount || 0) + buyCount;

              const jobMaster =
                typeof JOBS !== "undefined" && Array.isArray(JOBS)
                  ? JOBS.find(
                      (j) =>
                        j.id === player.jobId ||
                        j.label === player.job ||
                        j.title === player.job
                    )
                  : null;
              const baseCap = jobMaster ? jobMaster.cap : player.baseCap || 80;
              const maxHp = baseCap + (player.bonusCap || 0);
              if (player.currentHp === undefined) player.currentHp = maxHp;

              player.currentHp = Math.max(0, player.currentHp - buyCount * 10);
              if (player.currentHp <= 0) {
                if (player.happiness === undefined) player.happiness = 100;
                player.happiness = Math.max(0, player.happiness - 30);
                player.skipTurn = true;
                player.currentHp = maxHp;
              }
            }

            if (typeof updatePhoneStatusDisplay === "function") {
              updatePhoneStatusDisplay();
            }

            console.log(
              `[sq_30.js] 保険購入確定: ${buyCount}枚（合計保険: ${player.insurance}枚 / 合計飲酒: ${player.drinkCount || 0}杯）`
            );

            // インラインUI削除 & 通常スピンボタンを非活性で復活
            document.getElementById("insurance-inline-zone")?.remove();
            document.body.classList.remove(cfg.themeClass);

            if (spinBtn) {
              spinBtn.style.display = "block";
              const cleanedSpinBtn = spinBtn.cloneNode(true);
              spinBtn.parentNode.replaceChild(cleanedSpinBtn, spinBtn);
              cleanedSpinBtn.disabled = true;
              cleanedSpinBtn.textContent = "⚡ ルーレットを回す！";
              if (typeof requestSpin === "function") {
                cleanedSpinBtn.addEventListener("click", requestSpin);
              }
            }

            if (resultDisplay) {
              resultDisplay.textContent =
                buyCount > 0
                  ? `🛡️ 保険を ${buyCount} 枚購入し、${buyCount} 杯飲みました！「次のプレイヤーへ」を押してね！`
                  : `🛡️ 保険を購入しませんでした。「次のプレイヤーへ」を押してね！`;
            }

            // PC大画面のモーダルを閉じる
            const targetPcModal = document.getElementById("pc-event-modal");
            if (targetPcModal) {
              targetPcModal.className = "event-modal-overlay";
              targetPcModal.style.display = "none";
            }

            // サーバーへ完了報告（サーバー側でフェーズが WAIT_NEXT に移り、全端末のstateが同期され次へボタンが点灯）
            socket.emit("playerAction", {
              roomCode: targetRoom,
              action: "squareEventFinished",
              updatedPlayer: player
            });
          };
        });
      }
    }
  },
  salaryman: {
    id: 30,
    type: "insurance_shop",
    text: "【強制ストップ】生命保険・ライフプラン設計",
    location: "オフィス",
    event: function (p, s) {
      window.SQ_MODULES[30].normal.event(p, s);
    }
  },
  short: {
    id: 30,
    type: "insurance_shop",
    text: "【強制ストップ】命の盾を闇取引！",
    location: "家",
    event: function (p, s) {
      window.SQ_MODULES[30].normal.event(p, s);
    }
  }
};
