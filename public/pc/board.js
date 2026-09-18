// ==========================================
// board.js : 盤面（新ルート・格子整列テスト版）
// ==========================================

window.boardManager = {
  canvas: null,
  ctx: null,
  gridSize: 100, // マス目の描画サイズ
  cols: 10,      // 横のマス数

  squareColors: {
    start: "#4caf50",            /* スタート: 緑 */
    goal: "#f44336",             /* ゴール: 赤 */
    force_stop: "#ff9800",       /* 強制ストップ: オレンジ */
    force_stop_rankup: "#f5a623",/* ランクアップ: ゴールド */
    jobChallenge: "#9c27b0",     /* 役職・就職マス: 紫 */
    location: "#00bcd4",         /* 場所・イベントマス: シアン */
    normal: "#2196f3",           /* 通常マス: 青 */
    heal: "#8bc34a"              /* 回復マス: 明るい緑 */
  },

  playerColors: [
    "#f44336", "#2196f3", "#4caf50", "#ff9800", "#9c27b0", "#00bcd4", "#e91e63", "#795548"
  ],

  init(gridSize) {
    this.canvas = document.getElementById("board-canvas");
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");
    this.gridSize = gridSize || 100;

    // 新マップ（全100マス）を10列×10行の格子状に整列させるためのサイズ設定
    this.canvas.width = this.cols * this.gridSize;
    this.canvas.height = 10 * this.gridSize;
  },

  // 🎯 修正：ジグザグ蛇行を一時廃止し、配列インデックス順に上から左詰めで綺麗に配置
  getCoordinates(index) {
    const row = Math.floor(index / this.cols);
    const col = index % this.cols;
    return {
      x: col * this.gridSize + this.gridSize / 2,
      y: row * this.gridSize + this.gridSize / 2
    };
  },

  draw(playersList, activeIdx) {
    if (!this.ctx || !this.canvas) this.init(100);
    if (!this.ctx) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (typeof MAP_SQUARES === "undefined" || !Array.isArray(MAP_SQUARES)) return;

    // 🎯 修正：データ内の「nextId」に登録されたルート矢印の通りに線を引く（分岐・合流を線で視覚化）
    this.ctx.strokeStyle = "rgba(176, 190, 197, 0.75)";
    this.ctx.lineWidth = 4;
    MAP_SQUARES.forEach((sq, idx) => {
      const fromPos = this.getCoordinates(idx);
      if (sq.nextId && Array.isArray(sq.nextId)) {
        sq.nextId.forEach(nextIdx => {
          if (MAP_SQUARES[nextIdx]) {
            const toPos = this.getCoordinates(nextIdx);
            this.ctx.beginPath();
            this.ctx.moveTo(fromPos.x, fromPos.y);
            this.ctx.lineTo(toPos.x, toPos.y);
            this.ctx.stroke();
          }
        });
      }
    });

    // マス本体の描画
    MAP_SQUARES.forEach((sq, idx) => {
      const pos = this.getCoordinates(idx);
      const radius = this.gridSize * 0.35;

      let fillColor = this.squareColors[sq.type] || this.squareColors.normal;
      if (sq.text && sq.text.includes("【役職マス】")) fillColor = this.squareColors.jobChallenge;
      if (sq.text && sq.text.includes("【強制ストップ】")) fillColor = this.squareColors.force_stop;

      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      this.ctx.fillStyle = fillColor;
      this.ctx.fill();

      this.ctx.lineWidth = 3;
      this.ctx.strokeStyle = "#ffffff";
      this.ctx.stroke();

      this.ctx.fillStyle = "#ffffff";
      this.ctx.font = "bold 20px sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      
      if (sq.type === "start") {
        this.ctx.font = "bold 14px sans-serif";
        this.ctx.fillText("ST", pos.x, pos.y);
      } else if (sq.type === "goal") {
        this.ctx.font = "bold 14px sans-serif";
        this.ctx.fillText("GOAL", pos.x, pos.y);
      } else {
        this.ctx.fillText(sq.id.toString(), pos.x, pos.y);
      }
    });

    // プレイヤーのピン（駒）描画（位置が同じ場合はずらす）
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
          offsetX = Math.cos(angle) * 18;
          offsetY = Math.sin(angle) * 18;
        }

        const pinX = coords.x + offsetX;
        const pinY = coords.y + offsetY;
        const pinColor = p.color || this.playerColors[idx % this.playerColors.length];

        this.ctx.beginPath();
        this.ctx.arc(pinX, pinY, 14, 0, Math.PI * 2);
        this.ctx.fillStyle = "#333333";
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.arc(pinX, pinY, 11, 0, Math.PI * 2);
        this.ctx.fillStyle = pinColor;
        this.ctx.fill();

        if (idx === activeIdx) {
          this.ctx.beginPath();
          this.ctx.arc(pinX - 3, pinY - 3, 3, 0, Math.PI * 2);
          this.ctx.fillStyle = "#ffffff";
          this.ctx.fill();

          this.ctx.lineWidth = 3;
          this.ctx.strokeStyle = "#ffffff";
          this.ctx.beginPath();
          this.ctx.arc(pinX, pinY, 15, 0, Math.PI * 2);
          this.ctx.stroke();
        }
      });
    }
  }
};
