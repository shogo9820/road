window.boardManager = {
  canvas: null,
  ctx: null,
  cellSize: 15,
  previewRouteIdx: null, // スマホのリアルタイム仮選択状態（0:A, 1:B）

  squareColors: {
    start: "#8bc34a", goal: "#f44336", force_stop: "#f5a623", force_stop_rankup: "#f5a623",
    jobChallenge: "#7b1fa2", location: "#ffffff", normal: "#ffffff", heal: "#ffffff", repeat: "#0d47a1"
  },

  playerColors: [
    "#f44336", "#2196f3", "#4caf50", "#ff9800", "#9c27b0", "#00bcd4", "#e91e63", "#795548"
  ],

  // 🎯 Excelセルマッピングテーブル
  gridMap: {
    0: { x: 52, y: 48, w: 7, h: 7 },   1: { x: 54, y: 45, w: 3, h: 3 },   2: { x: 55, y: 42, w: 3, h: 3 },   3: { x: 56, y: 39, w: 3, h: 3 },
    4: { x: 56, y: 36, w: 3, h: 3 },   5: { x: 55, y: 33, w: 3, h: 3 },   6: { x: 54, y: 30, w: 3, h: 3 },   7: { x: 53, y: 27, w: 3, h: 3 },
    8: { x: 49, y: 51, w: 3, h: 3 },   9: { x: 46, y: 49, w: 3, h: 3 },  10: { x: 45, y: 46, w: 3, h: 3 },  11: { x: 44, y: 43, w: 3, h: 3 },
    12: { x: 43, y: 40, w: 3, h: 3 },  13: { x: 43, y: 37, w: 3, h: 3 },  14: { x: 44, y: 34, w: 3, h: 3 },  15: { x: 45, y: 31, w: 3, h: 3 },
    16: { x: 46, y: 28, w: 3, h: 3 },  17: { x: 49, y: 27, w: 3, h: 3 },  18: { x: 50, y: 22, w: 5, h: 5 },  19: { x: 51, y: 19, w: 3, h: 3 },
    20: { x: 50, y: 16, w: 3, h: 3 },  21: { x: 49, y: 13, w: 3, h: 3 },  22: { x: 46, y: 12, w: 3, h: 3 },  23: { x: 43, y: 11, w: 3, h: 3 },
    24: { x: 40, y: 12, w: 3, h: 3 },  25: { x: 37, y: 13, w: 3, h: 3 },  26: { x: 36, y: 16, w: 3, h: 3 },  27: { x: 35, y: 19, w: 3, h: 3 },
    28: { x: 36, y: 22, w: 3, h: 3 },  29: { x: 37, y: 25, w: 3, h: 3 },  30: { x: 36, y: 28, w: 5, h: 5 },  31: { x: 37, y: 33, w: 3, h: 3 },
    32: { x: 38, y: 36, w: 3, h: 3 },  33: { x: 39, y: 39, w: 3, h: 3 },  34: { x: 39, y: 42, w: 3, h: 3 },  35: { x: 38, y: 45, w: 3, h: 3 },
    36: { x: 37, y: 48, w: 3, h: 3 },  37: { x: 34, y: 49, w: 3, h: 3 },  38: { x: 31, y: 50, w: 3, h: 3 },  39: { x: 28, y: 51, w: 3, h: 3 },
    40: { x: 25, y: 50, w: 3, h: 3 },  41: { x: 20, y: 49, w: 5, h: 5 },  42: { x: 17, y: 50, w: 3, h: 3 },  43: { x: 14, y: 51, w: 3, h: 3 },
    44: { x: 11, y: 52, w: 3, h: 3 },  45: { x: 8, y: 51, w: 3, h: 3 },   46: { x: 5, y: 50, w: 3, h: 3 },   47: { x: 4, y: 47, w: 3, h: 3 },
    48: { x: 3, y: 44, w: 3, h: 3 },   49: { x: 2, y: 39, w: 5, h: 5 },   50: { x: 3, y: 36, w: 3, h: 3 },   51: { x: 2, y: 33, w: 3, h: 3 },
    52: { x: 1, y: 30, w: 3, h: 3 },   53: { x: 2, y: 27, w: 3, h: 3 },   54: { x: 3, y: 24, w: 3, h: 3 },   55: { x: 6, y: 23, w: 3, h: 3 },
    56: { x: 9, y: 24, w: 3, h: 3 },   57: { x: 10, y: 27, w: 3, h: 3 },  58: { x: 11, y: 30, w: 3, h: 3 },  59: { x: 7, y: 40, w: 3, h: 3 },
    60: { x: 10, y: 41, w: 3, h: 3 },  61: { x: 13, y: 42, w: 3, h: 3 },  62: { x: 16, y: 43, w: 3, h: 3 },  63: { x: 19, y: 44, w: 3, h: 3 },
    64: { x: 22, y: 43, w: 3, h: 3 },  65: { x: 25, y: 42, w: 3, h: 3 },  66: { x: 28, y: 41, w: 3, h: 3 },  67: { x: 29, y: 38, w: 3, h: 3 },
    68: { x: 30, y: 35, w: 3, h: 3 },  69: { x: 31, y: 32, w: 3, h: 3 },  70: { x: 30, y: 29, w: 3, h: 3 },  71: { x: 31, y: 26, w: 3, h: 3 },
    72: { x: 32, y: 23, w: 3, h: 3 },  73: { x: 31, y: 20, w: 3, h: 3 },  74: { x: 28, y: 19, w: 3, h: 3 },  75: { x: 25, y: 20, w: 3, h: 3 },
    76: { x: 24, y: 23, w: 3, h: 3 },  77: { x: 23, y: 26, w: 3, h: 3 },  78: { x: 22, y: 29, w: 3, h: 3 },  79: { x: 19, y: 30, w: 3, h: 3 },
    80: { x: 14, y: 29, w: 5, h: 5 },  81: { x: 15, y: 26, w: 3, h: 3 },  82: { x: 14, y: 23, w: 3, h: 3 },  83: { x: 13, y: 20, w: 3, h: 3 },
    84: { x: 12, y: 17, w: 3, h: 3 },  85: { x: 9, y: 16, w: 3, h: 3 },   86: { x: 6, y: 15, w: 3, h: 3 },   87: { x: 5, y: 12, w: 3, h: 3 },
    88: { x: 6, y: 9, w: 3, h: 3 },    89: { x: 9, y: 8, w: 5, h: 5 },    90: { x: 14, y: 9, w: 3, h: 3 },   91: { x: 15, y: 12, w: 3, h: 3 },
    92: { x: 18, y: 13, w: 3, h: 3 },  93: { x: 21, y: 12, w: 3, h: 3 },  94: { x: 22, y: 9, w: 3, h: 3 },   95: { x: 22, y: 6, w: 3, h: 3 },
    96: { x: 21, y: 3, w: 3, h: 3 },   97: { x: 18, y: 2, w: 3, h: 3 },   98: { x: 15, y: 3, w: 3, h: 3 },   99: { x: 8, y: 1, w: 7, h: 7 }
  },

  init() {
    this.canvas = document.getElementById("board-canvas");
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");
    this.canvas.width = 60 * this.cellSize;
    this.canvas.height = 56 * this.cellSize;
    this.bindSocketListeners(); // 🎯 通信リスナーを確実に初期化
  },

  getCoordinates(index) {
    const data = this.gridMap[index] || { x: 0, y: 0, w: 3, h: 3 };
    return { x: (data.x + data.w / 2) * this.cellSize, y: (data.y + data.h / 2) * this.cellSize };
  },

  draw(playersList, activeIdx) {
    if (!this.ctx || !this.canvas) this.init();
    if (!this.ctx) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (typeof MAP_SQUARES === "undefined" || !Array.isArray(MAP_SQUARES)) return;

    // 1. 各道ブロックの通常描画
    MAP_SQUARES.forEach((sq, idx) => {
      const data = this.gridMap[idx];
      if (!data) return;

      const px = data.x * this.cellSize; const py = data.y * this.cellSize;
      const pw = data.w * this.cellSize; const ph = data.h * this.cellSize;

      let fillColor = this.squareColors[sq.type] || this.squareColors.normal;
      if (sq.text && sq.text.includes("【役職マス】")) fillColor = this.squareColors.jobChallenge;

      this.ctx.fillStyle = fillColor;
      this.ctx.fillRect(px, py, pw, ph);
      this.ctx.strokeStyle = (fillColor === "#ffffff") ? "#444444" : "#ffffff";
      this.ctx.lineWidth = 1.5;
      this.ctx.strokeRect(px, py, pw, ph);

      this.ctx.fillStyle = (fillColor === "#ffffff") ? "#333333" : "#ffffff";
      this.ctx.font = "bold 11px sans-serif"; this.ctx.textAlign = "center"; this.ctx.textBaseline = "middle";
      const cx = px + pw / 2; const cy = py + ph / 2;

      if (sq.type === "start") this.ctx.fillText("ST", cx, cy);
      else if (sq.type === "goal") this.ctx.fillText("GOAL", cx, cy);
      else this.ctx.fillText(sq.id.toString(), cx, cy);
    });

    // 2. 🎯【大修正】現在地に完全に連動した「独立レイヤー影マスク」の重ね描き処理
    const p = (playersList && playersList[activeIdx]) ? playersList[activeIdx] : null;
    const currentRoute = (this.previewRouteIdx !== null) ? this.previewRouteIdx : (p ? p.chosenRouteIdx : null);

    if (p && currentRoute !== null && currentRoute !== undefined) {
      MAP_SQUARES.forEach((sq, idx) => {
        const data = this.gridMap[idx];
        if (!data) return;

        // 💡 プレイヤーが0番マスにいる時だけ、1本目の分岐ルート（1〜7 / 8〜17）の影を動かす
        if (p.position === 0) {
          if (currentRoute === 0 && idx >= 8 && idx <= 17) { // A選択時はB(8〜17)を暗く
            this.ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
            this.ctx.fillRect(data.x * this.cellSize, data.y * this.cellSize, data.w * this.cellSize, data.h * this.cellSize);
          }
          if (currentRoute === 1 && idx >= 1 && idx <= 7) { // B選択時はA(1〜7)を暗く
            this.ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
            this.ctx.fillRect(data.x * this.cellSize, data.y * this.cellSize, data.w * this.cellSize, data.h * this.cellSize);
          }
        }

        // 💡 プレイヤーが49番マスにいる時だけ、2本目の分岐ルート（50〜58 / 59〜79）の影を動かす
        if (p.position === 49) {
          if (currentRoute === 0 && idx >= 59 && idx <= 79) { // A選択時はB(59〜79)を暗く
            this.ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
            this.ctx.fillRect(data.x * this.cellSize, data.y * this.cellSize, data.w * this.cellSize, data.h * this.cellSize);
          }
          if (currentRoute === 1 && idx >= 50 && idx <= 58) { // B選択時はA(50〜58)を暗く
            this.ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
            this.ctx.fillRect(data.x * this.cellSize, data.y * this.cellSize, data.w * this.cellSize, data.h * this.cellSize);
          }
        }
      });
    }

    // 3. プレイヤーのピンを描画
    if (playersList && Array.isArray(playersList)) {
      const positionCounts = {};
      playersList.forEach((pl, idx) => {
        const currentPos = pl.position !== undefined ? pl.position : 0;
        const coords = this.getCoordinates(currentPos);
        if (positionCounts[currentPos] === undefined) positionCounts[currentPos] = 0;
        const offsetIdx = positionCounts[currentPos]; positionCounts[currentPos]++;

        let offsetX = 0; let offsetY = 0;
        if (offsetIdx > 0) {
          const angle = (offsetIdx * Math.PI * 2) / 4;
          offsetX = Math.cos(angle) * 10; offsetY = Math.sin(angle) * 10;
        }
        const pinX = coords.x + offsetX; const pinY = coords.y + offsetY;
        const pinColor = pl.color || this.playerColors[idx % this.playerColors.length];

        this.ctx.beginPath(); this.ctx.arc(pinX, pinY, 8, 0, Math.PI * 2); this.ctx.fillStyle = "#333333"; this.ctx.fill();
        this.ctx.beginPath(); this.ctx.arc(pinX, pinY, 6, 0, Math.PI * 2); this.ctx.fillStyle = pinColor; this.ctx.fill();

        if (idx === activeIdx) {
          this.ctx.lineWidth = 2; this.ctx.strokeStyle = "#ffffff";
          this.ctx.beginPath(); this.ctx.arc(pinX, pinY, 9, 0, Math.PI * 2); this.ctx.stroke();
        }
      });
    }
  },

  // 🎯【変数エラー解消】スコープの不整合を完全に吸収し、大画面側(pc.js)の「players」を確実に引き込んで再描画する
  bindSocketListeners() {
    if (typeof socket === "undefined" || this.hasBound) return;
    this.hasBound = true;

    socket.on("applyRoutePreview", (data) => {
      this.previewRouteIdx = data.selectedRouteIndex;
      // グローバル変数の players, activePlayerIndex を安全に引き渡す
      if (typeof players !== "undefined") {
        this.draw(players, activePlayerIndex);
      }
    });

    socket.on("routeSelectionConfirmed", (data) => {
      this.previewRouteIdx = null; // プレビュー影をリセット
      if (typeof players !== "undefined") {
        this.draw(players, activePlayerIndex);
      }
    });
  }
};
