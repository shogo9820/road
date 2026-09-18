// =========================================================================
// board.js : Excelマップレイアウト完全再現版（100%図面通り配置）
// =========================================================================

window.boardManager = {
  canvas: null,
  ctx: null,
  gridSize: 38, // テレビ大画面に全体が綺麗に収まるマスサイズ
  
  squareColors: {
    start: "#8bc34a",            /* スタート: 明るい緑 */
    goal: "#f44336",             /* ゴール: 赤 */
    force_stop: "#f5a623",       /* 強制ストップ: ゴールド */
    force_stop_rankup: "#f5a623",/* ランクアップ: ゴールド */
    jobChallenge: "#7b1fa2",     /* 役職・就職マス: 紫 */
    location: "#ffffff",         /* 場所マス: 白 */
    normal: "#ffffff",           /* 通常マス: 白 */
    heal: "#ffffff",             /* 回復マス: 白 */
    repeat: "#0d47a1"            /* 留年ルート: 濃い青 */
  },

  playerColors: [
    "#f44336", "#2196f3", "#4caf50", "#ff9800", "#9c27b0", "#00bcd4", "#e91e63", "#795548"
  ],

  // 🎯 修正：Excelのセル位置を1マスずつ完全にトレースした［列, 行］の正しい座標データ
  gridMap: {
    0: { x: 23, y: 18 },  1: { x: 23, y: 16 },  2: { x: 23, y: 14 },  3: { x: 25, y: 14 },
    4: { x: 25, y: 12 },  5: { x: 25, y: 10 },  6: { x: 25, y: 8 },   7: { x: 25, y: 6 },
    8: { x: 21, y: 18 },  9: { x: 19, y: 18 }, 10: { x: 19, y: 16 }, 11: { x: 19, y: 14 },
    12: { x: 19, y: 12 }, 13: { x: 19, y: 10 }, 14: { x: 19, y: 8 },  15: { x: 19, y: 6 },
    16: { x: 21, y: 5 },  17: { x: 23, y: 6 },  18: { x: 23, y: 4 },  19: { x: 23, y: 2 },
    20: { x: 23, y: 0 },  21: { x: 21, y: 0 },  22: { x: 19, y: 0 },  23: { x: 19, y: 2 },
    24: { x: 17, y: 2 },  25: { x: 17, y: 0 },  26: { x: 15, y: 0 },  27: { x: 15, y: 2 },
    28: { x: 15, y: 4 },  29: { x: 15, y: 6 },  30: { x: 15, y: 8 },  31: { x: 15, y: 10 },
    32: { x: 15, y: 12 }, 33: { x: 15, y: 14 }, 34: { x: 15, y: 16 }, 35: { x: 15, y: 18 },
    36: { x: 13, y: 18 }, 37: { x: 11, y: 18 }, 38: { x: 9, y: 18 },  39: { x: 7, y: 18 },
    40: { x: 5, y: 18 },  41: { x: 3, y: 18 },  42: { x: 1, y: 18 },  43: { x: 1, y: 16 },
    44: { x: 1, y: 14 },  45: { x: 1, y: 12 },  46: { x: 1, y: 10 },  47: { x: 1, y: 8 },
    48: { x: 1, y: 6 },   49: { x: 1, y: 4 },   50: { x: 1, y: 2 },   51: { x: 3, y: 2 },
    52: { x: 5, y: 2 },   53: { x: 5, y: 4 },   54: { x: 5, y: 6 },   55: { x: 5, y: 8 },
    56: { x: 5, y: 10 },  57: { x: 3, y: 10 },  58: { x: 3, y: 12 },  59: { x: 3, y: 14 },
    60: { x: 7, y: 2 },   61: { x: 9, y: 2 },   62: { x: 11, y: 2 },  63: { x: 11, y: 4 },
    64: { x: 9, y: 4 },   65: { x: 7, y: 4 },   66: { x: 7, y: 6 },   67: { x: 9, y: 6 },
    68: { x: 9, y: 8 },   69: { x: 9, y: 10 },  70: { x: 9, y: 12 },  71: { x: 9, y: 14 },
    72: { x: 7, y: 14 },  73: { x: 7, y: 12 },  74: { x: 7, y: 10 },  75: { x: 7, y: 8 },
    76: { x: 5, y: 14 },  77: { x: 5, y: 12 },  78: { x: 5, y: 16 },  79: { x: 7, y: 16 },
    80: { x: 9, y: 16 },  81: { x: 11, y: 16 },  82: { x: 11, y: 14 }, 83: { x: 11, y: 12 },
    84: { x: 11, y: 10 }, 85: { x: 11, y: 8 },  86: { x: 11, y: 6 },  87: { x: 2, y: 10 },
    88: { x: 2, y: 8 },   89: { x: 2, y: 6 },   90: { x: 5, y: 6 },   91: { x: 5, y: 8 },
    92: { x: 7, y: 8 },   93: { x: 9, y: 8 },   94: { x: 9, y: 6 },   95: { x: 9, y: 4 },
    96: { x: 7, y: 4 },   97: { x: 5, y: 4 },   98: { x: 3, y: 4 },   99: { x: 2, y: 2 }
  },

  init(gridSize) {
    this.canvas = document.getElementById("board-canvas");
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");
    this.gridSize = gridSize || 38;
    this.canvas.width = 27 * this.gridSize;
    this.canvas.height = 20 * this.gridSize;
  },

  getCoordinates(index) {
    const pt = this.gridMap[index] || { x: 0, y: 0 };
    return {
      x: pt.x * this.gridSize + this.gridSize / 2,
      y: pt.y * this.gridSize + this.gridSize / 2
    };
  },

  draw(playersList, activeIdx) {
    if (!this.ctx || !this.canvas) this.init(38);
    if (!this.ctx) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (typeof MAP_SQUARES === "undefined" || !Array.isArray(MAP_SQUARES)) return;

    // 1. ルート線の描画
    this.ctx.strokeStyle = "rgba(100, 110, 120, 0.45)";
    this.ctx.lineWidth = 4;
    MAP_SQUARES.forEach((sq, idx) => {
      const fromPos = this.getCoordinates(idx);
      if (sq.nextId && Array.isArray(sq.nextId)) {
        sq.nextId.forEach(nextIdx => {
          if (this.gridMap[nextIdx]) {
            const toPos = this.getCoordinates(nextIdx);
            this.ctx.beginPath();
            this.ctx.moveTo(fromPos.x, fromPos.y);
            this.ctx.lineTo(toPos.x, toPos.y);
            this.ctx.stroke();
          }
        });
      }
    });

    // 2. マス目の描画
    MAP_SQUARES.forEach((sq, idx) => {
      const pos = this.getCoordinates(idx);
      const isCustomSize = (sq.type === "start" || sq.type === "goal" || sq.id === 18 || sq.id === 30 || sq.id === 41 || sq.id === 49 || sq.id === 80 || sq.id === 89);
      const size = isCustomSize ? this.gridSize * 1.3 : this.gridSize * 0.85;

      let fillColor = this.squareColors[sq.type] || this.squareColors.normal;
      if (sq.text && sq.text.includes("【役職マス】")) fillColor = this.squareColors.jobChallenge;

      this.ctx.fillStyle = fillColor;
      this.ctx.strokeStyle = (fillColor === "#ffffff") ? "#333333" : "#ffffff";
      this.ctx.lineWidth = 2;

      this.ctx.fillRect(pos.x - size / 2, pos.y - size / 2, size, size);
      this.ctx.strokeRect(pos.x - size / 2, pos.y - size / 2, size, size);

      this.ctx.fillStyle = (fillColor === "#ffffff") ? "#333333" : "#ffffff";
      this.ctx.font = "bold 11px sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";

      if (sq.type === "start") {
        this.ctx.fillText("ST", pos.x, pos.y);
      } else if (sq.type === "goal") {
        this.ctx.fillText("GOAL", pos.x, pos.y);
      } else {
        this.ctx.fillText(sq.id.toString(), pos.x, pos.y);
      }
    });

    // 3. プレイヤーのピン描画
    if (playersList && Array.isArray(playersList)) {
      const positionCounts = {};
      playersList.forEach((p, idx) => {
        const currentPos = p.position !== undefined ? p.position : 0;
        const coords = this.getCoordinates(currentPos);

        if (positionCounts[currentPos] === undefined) positionCounts[currentPos] = 0;
        const offsetIdx = positionCounts[currentPos];
        positionCounts[currentPos]++;

        let offsetX = 0; let offsetY = 0;
        if (offsetIdx > 0) {
          const angle = (offsetIdx * Math.PI * 2) / 4;
          offsetX = Math.cos(angle) * 11;
          offsetY = Math.sin(angle) * 11;
        }

        const pinX = coords.x + offsetX;
        const pinY = coords.y + offsetY;
        const pinColor = p.color || this.playerColors[idx % this.playerColors.length];

        this.ctx.beginPath();
        this.ctx.arc(pinX, pinY, 9, 0, Math.PI * 2);
        this.ctx.fillStyle = "#333333";
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.arc(pinX, pinY, 7, 0, Math.PI * 2);
        this.ctx.fillStyle = pinColor;
        this.ctx.fill();

        if (idx === activeIdx) {
          this.ctx.lineWidth = 2;
          this.ctx.strokeStyle = "#ffffff";
          this.ctx.beginPath();
          this.ctx.arc(pinX, pinY, 10, 0, Math.PI * 2);
          this.ctx.stroke();
        }
      });
    }
  }
};
