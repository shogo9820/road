// ==========================================
// board.js : 盤面（すごろくマップ）描画システム
// ==========================================

window.boardManager = {
  canvas: null,
  ctx: null,
  gridSize: 100, // マス目の描画サイズ
  cols: 10,      // 横のマス数

  // 🎯 マスのタイプ（特性）に応じた正しいカラーパレットの定義
  // 前のデザインと1ミリも変えずに完全に色分けを復元します
  squareColors: {
    start: "#4caf50",            /* スタート: 緑 */
    goal: "#f44336",             /* ゴール: 赤 */
    force_stop: "#ff9800",       /* 強制ストップ: オレンジ */
    force_stop_rankup: "#f5a623",/* ランクアップ強制ストップ: ゴールド */
    jobChallenge: "#9c27b0",     /* 役職・就職マス: 紫 */
    location: "#00bcd4",         /* 場所・イベントマス: シアン */
    normal: "#2196f3",           /* 通常マス: 青 */
    heal: "#8bc34a"              /* 回復マス: 明るい緑 */
  },

  // プレイヤーの駒（ピン）のカラーパレット（最大8人分、プレイヤーカードのグラデーションと同期）
  playerColors: [
    "#f44336", // 1: 赤
    "#2196f3", // 2: 青
    "#4caf50", // 3: 緑
    "#ff9800", // 4: オレンジ
    "#9c27b0", // 5: 紫
    "#00bcd4", // 6: シアン
    "#e91e6 pink", // 7: ピンク
    "#795548"  // 8: 茶色
  ],

  // 盤面の初期化処理
  init(gridSize) {
    this.canvas = document.getElementById("board-canvas");
    if (!this.canvas) {
      console.error("⚠️ エラー: HTML内に 'board-canvas' が見つかりません。");
      return;
    }
    this.ctx = this.canvas.getContext("2d");
    this.gridSize = gridSize || 100;

    // 100マスのマップに合わせたCanvasサイズを動的に設定 (10列 × 10行)
    this.canvas.width = this.cols * this.gridSize;
    this.canvas.height = Math.ceil(100 / this.cols) * this.gridSize;
  },

  // 100マスのグリッド座標を蛇行（ジグザグ）型に計算するヘルパー
  getCoordinates(index) {
    const row = Math.floor(index / this.cols);
    let col = index % this.cols;
    
    // 偶数行（0, 2, 4...）は左から右へ、奇数行（1, 3, 5...）は右から左へ蛇行させる
    if (row % 2 === 1) {
      col = this.cols - 1 - col;
    }

    // 各マスの中心位置のX, Y座標を返す
    return {
      x: col * this.gridSize + this.gridSize / 2,
      y: row * this.gridSize + this.gridSize / 2
    };
  },

  // 盤面全体のレンダリング（データ同期が走るたびにPC側から呼び出される）
  draw(playersList, activeIdx) {
    if (!this.ctx || !this.canvas) this.init(100);
    if (!this.ctx) return;

    // 1. 一度Canvas全体をきれいにクリアする
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 2. 外部から読み込まれている MAP_SQUARES（マスターデータ）をループしてマスを描画
    if (typeof MAP_SQUARES === "undefined" || !Array.isArray(MAP_SQUARES)) {
      console.error("⚠️ エラー: MAP_SQUARES のマスターデータが読み込まれていません。");
      return;
    }
    // 3. マス目同士を繋ぐルート線の描画
    this.ctx.beginPath();
    this.ctx.strokeStyle = "#b0bec5";
    this.ctx.lineWidth = 6;
    this.ctx.setLineDash([5, 5]); // 点線にする
    
    for (let i = 0; i < MAP_SQUARES.length; i++) {
      const pos = this.getCoordinates(i);
      if (i === 0) {
        this.ctx.moveTo(pos.x, pos.y);
      } else {
        this.ctx.lineTo(pos.x, pos.y);
      }
    }
    this.ctx.stroke();
    this.ctx.setLineDash([]); // 点線を戻す

    // 4. マス目本体の描画（特性に応じた色分けを適用）
    MAP_SQUARES.forEach((sq, idx) => {
      const pos = this.getCoordinates(idx);
      const radius = this.gridSize * 0.35; // マスの半径

      // 🎯 マスのタイプ（特性）に合わせて、上で定義した正しいカラーを適用する
      let fillColor = this.squareColors[sq.type] || this.squareColors.normal;
      
      // 特殊なテキスト（【役職マス】など）が含まれている場合のフォールバック補正
      if (sq.text && sq.text.includes("【役職マス】")) fillColor = this.squareColors.jobChallenge;
      if (sq.text && sq.text.includes("【強制ストップ】")) fillColor = this.squareColors.force_stop;

      // 円形のマスを描画
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      this.ctx.fillStyle = fillColor;
      this.ctx.shadowColor = "rgba(0, 0, 0, 0.15)";
      this.ctx.shadowBlur = 6;
      this.ctx.shadowOffsetY = 3;
      this.ctx.fill();
      this.ctx.shadowBlur = 0; // シャドウをリセット
      this.ctx.shadowOffsetY = 0;

      // 白い内枠を引いてポップなデザインにする
      this.ctx.lineWidth = 3;
      this.ctx.strokeStyle = "#ffffff";
      this.ctx.stroke();

      // マス目の番号（数字）を中央に描画
      this.ctx.fillStyle = "#ffffff";
      this.ctx.font = "bold 20px 'M PLUS Rounded 1c', sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      
      // スタートとゴールは文字、それ以外は数字
      if (sq.type === "start") {
        this.ctx.font = "bold 14px 'M PLUS Rounded 1c', sans-serif";
        this.ctx.fillText("ST", pos.x, pos.y);
      } else if (sq.type === "goal") {
        this.ctx.font = "bold 14px 'M PLUS Rounded 1c', sans-serif";
        this.ctx.fillText("GOAL", pos.x, pos.y);
      } else {
        this.ctx.fillText(sq.id.toString(), pos.x, pos.y);
      }
    });

    // 5. プレイヤーの駒（ピン）の描画
    if (playersList && Array.isArray(playersList)) {
      // 同じマスに複数のプレイヤーがいる場合に位置をずらすためのカウンタ
      const positionCounts = {};

      playersList.forEach((p, idx) => {
        const currentPos = p.position !== undefined ? p.position : 0;
        const coords = this.getCoordinates(currentPos);

        // 重なり防止のオフセット（ずらし）計算
        if (positionCounts[currentPos] === undefined) {
          positionCounts[currentPos] = 0;
        }
        const offsetIdx = positionCounts[currentPos];
        positionCounts[currentPos]++;

        // 複数人いる時は円状に少しずらす
        let offsetX = 0;
        let offsetY = 0;
        if (offsetIdx > 0) {
          const angle = (offsetIdx * Math.PI * 2) / 4; // 最大4方向を想定
          offsetX = Math.cos(angle) * 18;
          offsetY = Math.sin(angle) * 18;
        }

        const pinX = coords.x + offsetX;
        const pinY = coords.y + offsetY;
        const pinColor = p.color || this.playerColors[idx % this.playerColors.length];

        // 外側の黒い縁取り円
        this.ctx.beginPath();
        this.ctx.arc(pinX, pinY, 14, 0, Math.PI * 2);
        this.ctx.fillStyle = "#333333";
        this.ctx.fill();

        // プレイヤー固有のカラーピン
        this.ctx.beginPath();
        this.ctx.arc(pinX, pinY, 11, 0, Math.PI * 2);
        this.ctx.fillStyle = pinColor;
        this.ctx.fill();

        // 現在のターンプレイヤーのピンに、白い光（アクセント）を入れる
        if (idx === activeIdx) {
          this.ctx.beginPath();
          this.ctx.arc(pinX - 3, pinY - 3, 3, 0, Math.PI * 2);
          this.ctx.fillStyle = "#ffffff";
          this.ctx.fill();

          // ターンプレイヤーのピンの周りにアニメーション風の太い白枠を引く
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
