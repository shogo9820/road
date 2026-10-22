// public/squares/sq_41.js
window.SQ_MODULES = window.SQ_MODULES || {};

window.SQ_MODULES = {
  // 🌸 横展開・再利用可能な汎用データ構造
  normal: {
    id: 41,
    type: "force_stop",
    text: "【強制ストップ】カップル成立！？", // マップ基本テキスト
    location: "家",

    // 🎯 【再利用のための固有設定カタログ】
    // 別のゲームに流用するときは、ここを書き換えるだけでPC大画面もスマホも全部自動で変わります
    config: {
      themeClass: "theme-couple",           // 適用するCSSテーマクラス
      pcFirstTitle: "💕 カップル成立チャンス！？ 💕",
      pcFirstDesc: "運命 of 1回目スピンを回して【偶数】を狙え！",
      pcSecondTitle: "カップル告白",        // 2回目のイベント名（動的反映用）
      pcSecondDesc: "スマホから最終決着スピンを回して、意中の相手を射止めろ！",
      
      // スマホ通常画面のテキスト設定
      mobileFirstDisplay: "🎯 偶数（告白チャンス）を狙ってね！",
      mobileFirstBtn: "🎲 運命の1回目スピンを回す！",
      mobileSecondBtn: "💘 決着の2回目（告白）スピン！"
    },
    
    // 🚀 メイン進行ロジック（PC・スマホ両用で完全カプセル化）
    event: function(player, square) {
      const cfg = this.config;

      // 💻 ① 【PC大画面側だった場合の直接処理】
      const pcModal = document.getElementById("pc-event-modal");
      if (pcModal) {
        if (typeof isPCEventMode !== "undefined") isPCEventMode = true;

        const btnNext = document.getElementById("btn-next-turn");
        if (btnNext) { btnNext.disabled = true; btnNext.style.display = "none"; }

        // カタログ(config)から文字を取得してPCモーダルに流し込む
        pcModal.className = "event-modal-overlay active " + cfg.themeClass;
        document.getElementById("modal-event-title").textContent = cfg.pcFirstTitle;
        document.getElementById("modal-event-desc").textContent = `${player.name} さんがマスに到着！ ${cfg.pcFirstDesc}`;

        const resultBox = document.getElementById("modal-event-result-box");
        if (resultBox) { resultBox.style.display = "none"; resultBox.className = "event-result-box"; resultBox.textContent = ""; }

        // 1〜10の1回目判定条件表をダイレクト生成（偶数・奇数の基本ルール）
        let tableHTML = `
          <div class="event-table-title" style="font-size:1.3rem; color:#d81b60; margin-bottom:8px; font-weight:bold; border-bottom:2px solid #ff69b4; padding-bottom:4px;">🎯 1回目スピン：運命 of 判定条件表</div>
          <ul class="event-table-list">`;
        for (let i = 1; i <= 10; i++) {
          const isEven = i % 2 === 0;
          const badgeBg = isEven ? "#ff4081" : "#78909c";
          const condText = isEven ? '<span style="color:#d81b60; font-weight:bold;">💕 偶数：チャンス突入！</span>' : '<span style="color:#546e7a;">💦 奇数：ここで終了...</span>';
          tableHTML += `<li class="event-table-item"><div class="event-table-num-badge" style="background:${badgeBg};">${i}</div><div>${condText}</div></li>`;
        }
        tableHTML += `</ul>`;
        document.getElementById("pc-event-table-dynamic-zone").innerHTML = tableHTML;
        document.getElementById("modal-roulette-result-display").textContent = "🎯 スマホから運命のスピンを回してね！";
        return;
      }

      // 📱 ② 【スマホ手元側だった場合の直接処理（通常画面の着せ替えと乗っ取り）】
      if (typeof socket !== "undefined") {
        console.log(`📱 [スマホ側] マスID: ${this.id} の進行制御を通常画面にバインドします。`);

        const spinBtn = document.getElementById("btn-phone-spin");
        const resultDisplay = document.getElementById("roulette-result-display");

        // カタログで指定したCSSテーマを付与して通常ルーレットを着せ替え
        document.body.classList.add(cfg.themeClass);

        if (spinBtn) {
          spinBtn.disabled = false;
          spinBtn.textContent = cfg.mobileFirstBtn;
        }
        if (resultDisplay) {
          resultDisplay.textContent = cfg.mobileFirstDisplay;
        }

        // ──────────────────────────────────────────────────────────
        // 🔥 【1回目スピン発火】ボタンをクローン化して古いイベントを完全消去し、乗っ取る
        // ──────────────────────────────────────────────────────────
        if (spinBtn) {
          const newSpinBtn = spinBtn.cloneNode(true);
          spinBtn.parentNode.replaceChild(newSpinBtn, spinBtn);

          newSpinBtn.onclick = function() {
            newSpinBtn.disabled = true;
            if (resultDisplay) resultDisplay.textContent = "🌀 1回目ルーレット回転中...";

            const result = Math.floor(Math.random() * 10) + 1;
            
            // スマホの通常ホイールを物理的に回す
            if (typeof currentRotation !== "undefined" && typeof playMobileRouletteAnimation === "function") {
              const targetDegrees = [342, 306, 270, 234, 198, 162, 126, 90, 54, 18];
              currentRotation += 1800 + ((targetDegrees[result - 1] - (currentRotation % 360) + 360) % 360);
              
              playMobileRouletteAnimation(result, currentRotation, (finalSteps) => {
                socket.emit("coupleRouletteResult", { result: finalSteps });
              });
            } else {
              socket.emit("coupleRouletteResult", { result: result });
            }
          };
        }

        // ──────────────────────────────────────────────────────────
        // 🌟 【1回目の結果受信】偶数なら2回目ボタンへ進化、奇数なら即終了
        // ──────────────────────────────────────────────────────────
        socket.off("coupleRouletteResult");
        socket.on("coupleRouletteResult", (data) => {
          const result = data.result;

          if (result % 2 === 0) {
            // 自分以外のプレイヤーを割り当てるマップを生成
            const otherPlayers = players.filter((p) => String(p.id) !== String(player.id));
            const degreeTable = [342, 306, 270, 234, 198, 162, 126, 90, 54, 18];
            const rollSlots = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            for (let i = rollSlots.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [rollSlots[i], rollSlots[j]] = [rollSlots[j], rollSlots[i]];
            }

            const mapping = {};
            for (let i = 1; i <= 10; i++) mapping[i] = null;
            otherPlayers.forEach((p, idx) => {
              if (idx < rollSlots.length) {
                const assignedRoll = rollSlots[idx];
                mapping[assignedRoll] = { id: p.id, name: p.name, degree: degreeTable[assignedRoll - 1] };
              }
            });

            // 🌟 サーバー経由でPC大画面へ2回目のタイトル・割り当てマップをブロードキャスト！
            socket.emit("playerAction", {
              roomCode: currentRoomCode || "",
              action: "customEventFirstSpinResult",
              playerId: player.id,
              result: result,
              mapping: mapping,
              nextStepEventName: cfg.pcSecondTitle,
              pcSecondDesc: cfg.pcSecondDesc
            });

            // ボタンの状態を更新して2回目用にクローン化して乗っ取る
            const finalSpinBtn = document.getElementById("btn-phone-spin");
            if (finalSpinBtn) {
              finalSpinBtn.disabled = false;
              finalSpinBtn.textContent = cfg.mobileSecondBtn;
              if (resultDisplay) {
                resultDisplay.textContent = `🎯 1回目 [出目:${result}] で成功！最終決着へ！`;
              }

              const newFinalBtn = finalSpinBtn.cloneNode(true);
              finalSpinBtn.parentNode.replaceChild(newFinalBtn, finalSpinBtn);

              newFinalBtn.onclick = function() {
                newFinalBtn.disabled = true;
                if (resultDisplay) resultDisplay.textContent = "🌀 運命の最終判定中...";

                const secondResult = Math.floor(Math.random() * 10) + 1;

                if (typeof currentRotation !== "undefined" && typeof playMobileRouletteAnimation === "function") {
                  const targetDegrees = [342, 306, 270, 234, 198, 162, 126, 90, 54, 18];
                  currentRotation += 1800 + ((targetDegrees[secondResult - 1] - (currentRotation % 360) + 360) % 360);
                  
                  playMobileRouletteAnimation(secondResult, currentRotation, (finalSteps) => {
                    socket.emit("coupleSecondRouletteResult", { result: finalSteps });
                  });
                } else {
                  socket.emit("coupleSecondRouletteResult", { result: secondResult });
                }
              };
            }

          } else {
            // 奇数失敗：安全に終了処理
            alert(`出目 ${result}：残念！チャレンジ失敗です…💦`);
            document.body.classList.remove(cfg.themeClass);
            socket.emit("playerAction", { roomCode: currentRoomCode || "", action: "squareEventFinished", updatedPlayer: player });
          }
        });

        // ──────────────────────────────────────────────────────────
        // 🌟 【2回目の結果受信】最終判定（成否）
        // ──────────────────────────────────────────────────────────
        socket.off("coupleSecondRouletteResult");
        socket.on("coupleSecondRouletteResult", (data) => {
          const result = data.result;
          const currentMapping = window.SQ_MODULES.normal.lastMapping;
          const hitTarget = currentMapping ? currentMapping[result] : null;

          if (hitTarget) {
            // 成功時のステータス更新
            player.isLover = true;
            if (!player.lovers) player.lovers = [];
            if (!player.lovers.includes(hitTarget.name)) player.lovers.push(hitTarget.name);
            player.drinkCount = (player.drinkCount || 0) + 1;

            socket.emit("playerAction", {
              roomCode: currentRoomCode || "",
              action: "customEventSecondSpinResult",
              playerId: player.id,
              result: result,
              successMessage: `💕 イベント大成功！ ${player.name} と ${hitTarget.name} が結ばれました！ 🍺`
            });
          } else {
            socket.emit("playerAction", {
              roomCode: currentRoomCode || "",
              action: "customEventSecondSpinResult",
              playerId: player.id,
              result: result,
              failureMessage: "チャレンジ失敗...！💦"
            });
          }

          // 3.5秒後に通常状態へ戻してサーバーへ完了報告、次のターンへバトンタッチ
          setTimeout(() => {
            document.body.classList.remove(cfg.themeClass);
            socket.emit("playerAction", { roomCode: currentRoomCode || "", action: "squareEventFinished", updatedPlayer: player });
          }, 3500);
        });

        socket.on("startCustomEventSecondSpin", (data) => {
          window.SQ_MODULES.normal.lastMapping = data.mapping;
        });
      }
    }
  },
salaryman: { id: 41, type: "force_stop", text: "【強制ストップ】社内恋愛勃発！？", location: "オフィス", event: function(player, square) { window.SQ_MODULES.normal.event(player, square); } },
short: { id: 41, type: "force_stop", text: "【強制ストップ】スピード婚活チャンス！", location: "家", event: function(player, square) { window.SQ_MODULES.normal.event(player, square); } }
};