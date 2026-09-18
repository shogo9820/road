// =========================================================================
// board.js : Excel仕様完全再現版（セル密着・道型マッピングシステム）
// =========================================================================

window.boardManager = {
  canvas: null,
  ctx: null,
  cellSize: 15, // 1セルのピクセルサイズ（60×15=900px、56×15=840pxでテレビにジャスト配置）

  squareColors: {
    start: "#8bc34a",
    goal: "#f44336",
    force_stop: "#f5a623",
    force_stop_rankup: "#f5a623",
    jobChallenge: "#7b1fa2",
    location: "#ffffff",
    normal: "#ffffff",
    heal: "#ffffff",
    repeat: "#0d47a1"
  },

  playerColors: [
    "#f44336", "#2196f3", "#4caf50", "#ff9800", "#9c27b0", "#00bcd4", "#e91e63", "#795548"
  ],

  // 🎯 修正：Excelの「横60 × 縦56」のグリッド上における各マスの［左上角のXセル, Yセル, 横幅, 縦幅］
  // すべて半角の「,」と「{ }」で記述し、マス同士がピタッとくっついて太い道になるようにしています。
  gridMap: {
    0: { x: 53, y: 49, w: 7, h: 7 },   1: { x: 50, y: 53, w: 3, h: 3 },   2: { x: 50, y: 50, w: 3, h: 3 },   3: { x: 53, y: 46, w: 3, h: 3 },
    4: { x: 53, y: 43, w: 3, h: 3 },   5: { x: 53, y: 40, w: 3, h: 3 },   6: { x: 53, y: 37, w: 3, h: 3 },   7: { x: 53, y: 34, w: 3, h: 3 },
    8: { x: 47, y: 53, w: 3, h: 3 },   9: { x: 44, y: 53, w: 3, h: 3 },  10: { x: 44, y: 50, w: 3, h: 3 },  11: { x: 44, y: 47, w: 3, h: 3 },
    12: { x: 44, y: 44, w: 3, h: 3 },  13: { x: 44, y: 41, w: 3, h: 3 },  14: { x: 44, y: 38, w: 3, h: 3 },  15: { x: 44, y: 35, w: 3, h: 3 },
    16: { x: 47, y: 34, w: 3, h: 3 },  17: { x: 50, y: 34, w: 3, h: 3 },  18: { x: 50, y: 29, w: 5, h: 5 },  19: { x: 50, y: 26, w: 3, h: 3 },
    20: { x: 50, y: 23, w: 3, h: 3 },  21: { x: 47, y: 23, w: 3, h: 3 },  22: { x: 44, y: 23, w: 3, h: 3 },  23: { x: 44, y: 26, w: 3, h: 3 },
    24: { x: 41, y: 26, w: 3, h: 3 },  25: { x: 41, y: 23, w: 3, h: 3 },  26: { x: 38, y: 23, w: 3, h: 3 },  27: { x: 38, y: 26, w: 3, h: 3 },
    28: { x: 38, y: 29, w: 3, h: 3 },  29: { x: 38, y: 32, w: 3, h: 3 },  30: { x: 38, y: 35, w: 5, h: 5 },  31: { x: 38, y: 40, w: 3, h: 3 },
    32: { x: 38, y: 43, w: 3, h: 3 },  33: { x: 38, y: 46, w: 3, h: 3 },  34: { x: 38, y: 49, w: 3, h: 3 },  35: { x: 38, y: 52, w: 3, h: 3 },
    36: { x: 35, y: 53, w: 3, h: 3 },  37: { x: 32, y: 53, w: 3, h: 3 },  38: { x: 29, y: 53, w: 3, h: 3 },  39: { x: 26, y: 53, w: 3, h: 3 },
    40: { x: 23, y: 53, w: 3, h: 3 },  41: { x: 18, y: 51, w: 5, h: 5 },  42: { x: 15, y: 53, w: 3, h: 3 },  43: { x: 12, y: 53, w: 3, h: 3 },
    44: { x: 9, y: 53, w: 3, h: 3 },   45: { x: 6, y: 53, w: 3, h: 3 },   46: { x: 3, y: 53, w: 3, h: 3 },   47: { x: 3, y: 50, w: 3, h: 3 },
    48: { x: 3, y: 47, w: 3, h: 3 },   49: { x: 1, y: 42, w: 5, h: 5 },   50: { x: 6, y: 44, w: 3, h: 3 },   51: { x: 9, y: 44, w: 3, h: 3 },
    52: { x: 9, y: 41, w: 3, h: 3 },   53: { x: 9, y: 38, w: 3, h: 3 },   54: { x: 9, y: 35, w: 3, h: 3 },   55: { x: 9, y: 32, w: 3, h: 3 },
    56: { x: 6, y: 32, w: 3, h: 3 },   57: { x: 3, y: 32, w: 3, h: 3 },   58: { x: 3, y: 35, w: 3, h: 3 },   59: { x: 1, y: 37, w: 3, h: 3 },
    60: { x: 1, y: 34, w: 3, h: 3 },   61: { x: 1, y: 31, w: 3, h: 3 },   62: { x: 1, y: 28, w: 3, h: 3 },   63: { x: 3, y: 28, w: 3, h: 3 },
    64: { x: 6, y: 28, w: 3, h: 3 },   65: { x: 6, y: 25, w: 3, h: 3 },   66: { x: 3, y: 25, w: 3, h: 3 },   67: { x: 3, y: 22, w: 3, h: 3 },
    68: { x: 3, y: 19, w: 3, h: 3 },   69: { x: 3, y: 16, w: 3, h: 3 },   70: { x: 3, y: 13, w: 3, h: 3 },   71: { x: 6, y: 13, w: 3, h: 3 },
    72: { x: 6, y: 16, w: 3, h: 3 },   73: { x: 6, y: 19, w: 3, h: 3 },   74: { x: 6, y: 22, w: 3, h: 3 },   75: { x: 9, y: 22, w: 3, h: 3 },
    76: { x: 9, y: 25, w: 3, h: 3 },   77: { x: 9, y: 28, w: 3, h: 3 },   78: { x: 9, y: 19, w: 3, h: 3 },   79: { x: 9, y: 16, w: 3, h: 3 },
    80: { x: 11, y: 11, w: 5, h: 5 },  81: { x: 16, y: 13, w: 3, h: 3 },  82: { x: 16, y: 16, w: 3, h: 3 },  83: { x: 16, y: 19, w: 3, h: 3 },
    84: { x: 16, y: 22, w: 3, h: 3 },  85: { x: 16, y: 25, w: 3, h: 3 },  86: { x: 16, y: 28, w: 3, h: 3 },  87: { x: 19, y: 28, w: 3, h: 3 },
    88: { x: 22, y: 28, w: 3, h: 3 },  89: { x: 25, y: 26, w: 5, h: 5 },  90: { x: 30, y: 28, w: 3, h: 3 },  91: { x: 33, y: 28, w: 3, h: 3 },
    92: { x: 33, y: 25, w: 3, h: 3 },  93: { x: 33, y: 22, w: 3, h: 3 },  94: { x: 30, y: 22, w: 3, h: 3 },  95: { x: 27, y: 22, w: 3, h: 3 },
    96: { x: 27, y: 25, w: 3, h: 3 },  97: { x: 27, y: 28, w: 3, h: 3 },  98: { x: 27, y: 31, w: 3, h: 3 },  99: { x: 23, y: 33, w: 7, h: 7 }
  },

  init(gSize) {
    this.canvas = document.getElementById("board-canvas");
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");
    
    // 🎯 60×56グリッドにセルサイズ（15px）を掛けて、Canvasの解像度を完全に決定
    this.canvas.width = 60 * this.cellSize;
    this.canvas.height = 56 * this.cellSize;
  },

  // マスの中心座標（ピンを置く位置）を計算するヘルパー
  getCoordinates(index) {
    const data = this.gridMap[index] || { x: 0, y: 0, w: 3, h: 3 };
    return {
      x: (data.x + data.w / 2) * this.cellSize,
      y: (data.y + data.h / 2) * this.cellSize
    };
  },

  draw(playersList, activeIdx) {
    if (!this.ctx || !this.canvas) this.init();
    if (!this.ctx) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (typeof MAP_SQUARES === "undefined" || !Array.isArray(MAP_SQUARES)) return;

    // 🎯 修正：マスの中心を結ぶ「細い線」の描画を100%完全撤廃しました。

    // 🎯 修正：各マスの指定された w, h セルサイズに基づいて、隙間なくピッタリ敷き詰めて描画
    MAP_SQUARES.forEach((sq, idx) => {
      const data = this.gridMap[idx];
      if (!data) return;

      // セル位置から実際のピクセル座標とサイズを算出
      const px = data.x * this.cellSize;
      const py = data.y * this.cellSize;
      const pw = data.w * this.cellSize;
      const ph = data.h * this.cellSize;

      let fillColor = this.squareColors[sq.type] || this.squareColors.normal;
      if (sq.text && sq.text.includes("【役職マス】")) fillColor = this.squareColors.jobChallenge;

      // 四角い道ブロックを描画
      this.ctx.fillStyle = fillColor;
      this.ctx.fillRect(px, py, pw, ph);

      // マスの外枠線を引いてクッキリさせる（白ベースは黒枠、その他は白枠で図面を再現）
      this.ctx.strokeStyle = (fillColor === "#ffffff") ? "#444444" : "#ffffff";
      this.ctx.lineWidth = 1.5;
      this.ctx.strokeRect(px, py, pw, ph);

      // マス内のテキスト（数字・文字）描画
      this.ctx.fillStyle = (fillColor === "#ffffff") ? "#333333" : "#ffffff";
      this.ctx.font = "bold 11px sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";

      const cx = px + pw / 2;
      const cy = py + ph / 2;

      if (sq.type === "start") {
        this.ctx.fillText("ST", cx, cy);
      } else if (sq.type === "goal") {
        this.ctx.fillText("GOAL", cx, cy);
      } else {
        this.ctx.fillText(sq.id.toString(), cx, cy);
      }
    });

    // 3. プレイヤーのピンを道の真ん中に描画
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
          offsetX = Math.cos(angle) * 10;
          offsetY = Math.sin(angle) * 10;
        }

        const pinX = coords.x + offsetX;
        const pinY = coords.y + offsetY;
        const pinColor = p.color || this.playerColors[idx % this.playerColors.length];

        this.ctx.beginPath();
        this.ctx.arc(pinX, pinY, 8, 0, Math.PI * 2);
        this.ctx.fillStyle = "#333333";
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.arc(pinX, pinY, 6, 0, Math.PI * 2);
        this.ctx.fillStyle = pinColor;
        this.ctx.fill();

        if (idx === activeIdx) {
          this.ctx.lineWidth = 2;
          this.ctx.strokeStyle = "#ffffff";
          this.ctx.beginPath();
          this.ctx.arc(pinX, pinY, 9, 0, Math.PI * 2);
          this.ctx.stroke();
        }
      });
    }
  }
};
