/**
 * board.js - すごろく盤面とプレイヤー（人型アイコン）の描画管理
 */
class BoardManager {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");
    this.tiles = [];
    this.totalTiles = 100; // 100マスに対応

    // ★追加: キャンバスの内部解像度を100マスが収まるサイズに明示的に設定する
    this.canvas.width = 600;
    this.canvas.height = 600;
  }

  /**
   * 盤面の初期化とマス座標の計算
   */
  init(totalTiles = 100) {
    if (!this.canvas) return;

    // 念のため幅・高さが0の場合の保険
    if (this.canvas.width === 0) this.canvas.width = 600;
    if (this.canvas.height === 0) this.canvas.height = 600;

    this.totalTiles = totalTiles;
    this.generateTileCoordinates();
    this.draw();
  }

  /**
   * 下から上へ向かうS字（ジグザグ）マスの座標を生成
   */
  generateTileCoordinates() {
    this.tiles = [];
    const cols = 10; // 1行あたりのマス数を10に変更（100マスをきれいなグリッドにするため）
    const tileSize = 55;
    const paddingX = 45;
    const paddingY = 40;

    // 全100マス分の座標を計算（行のインデックスを逆転させて「下から上」へ流す）
    const totalRows = Math.ceil(this.totalTiles / cols);

    for (let i = 0; i < this.totalTiles; i++) {
      const logicalRow = Math.floor(i / cols);
      // 下から上へ並べるため、行を反転させる
      const row = (totalRows - 1) - logicalRow;
      let col = i % cols;

      // 偶数/奇数行でジグザグにする（下からスタートする場合のS字調整）
      if (logicalRow % 2 === 1) {
        col = (cols - 1) - col;
      }

      const x = paddingX + col * tileSize;
      const y = paddingY + row * tileSize;

      // MAP_SQUARES から対応するマスの情報を取得（あれば利用）
      let tileType = "normal";
      if (typeof MAP_SQUARES !== 'undefined' && MAP_SQUARES[i]) {
        const sq = MAP_SQUARES[i];
        tileType = sq.type || "normal";
        if (sq.isGoal) tileType = "goal";
      } else {
        if (i === 0) tileType = "start";
        else if (i === this.totalTiles - 1) tileType = "goal";
      }

      this.tiles.push({ index: i, x, y, type: tileType });
    }
  }

  /**
   * 盤面全体とプレイヤーの人型アイコンを描画
   */
  draw(players = [], activePlayerIndex = 0) {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. コース（マス同士の接続線）を描画
    if (this.tiles.length > 1) {
      this.ctx.beginPath();
      this.ctx.strokeStyle = "#cfd8dc";
      this.ctx.lineWidth = 8;
      this.ctx.lineCap = "round";
      this.ctx.lineJoin = "round";

      this.tiles.forEach((tile, index) => {
        if (index === 0) this.ctx.moveTo(tile.x, tile.y);
        else this.ctx.lineTo(tile.x, tile.y);
      });
      this.ctx.stroke();
    }

    // 2. マス（円形）を描画
    this.tiles.forEach((tile) => {
      this.ctx.beginPath();
      this.ctx.arc(tile.x, tile.y, 18, 0, Math.PI * 2);

      // マスの種類に応じた色分け
      if (tile.type === "start") {
        this.ctx.fillStyle = "#4caf50"; // 緑（スタート）
      } else if (tile.type === "goal") {
        this.ctx.fillStyle = "#e91e63"; // ピンク（ゴール）
      } else if (tile.type === "jobChallenge") {
        this.ctx.fillStyle = "#9c27b0"; // 紫（役職）
      } else if (tile.type === "force_stop" || tile.type === "force_stop_rankup") {
        this.ctx.fillStyle = "#f44336"; // 赤（強制ストップ）
      } else if (tile.type === "heal") {
        this.ctx.fillStyle = "#00bcd4"; // 水色（回復）
      } else {
        this.ctx.fillStyle = "#2196f3"; // 青（通常・その他）
      }

      this.ctx.fill();
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = "#ffffff";
      this.ctx.stroke();

      // マス番号
      this.ctx.fillStyle = "#ffffff";
      this.ctx.font = "bold 10px sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(tile.index === 0 ? "ST" : (tile.index === this.totalTiles - 1 ? "GOAL" : tile.index), tile.x, tile.y);
    });

    // 3. プレイヤーの人型アイコン（👤）を色違いで描画
    const playerColors = [
      "#f44336", // 赤
      "#2196f3", // 青
      "#4caf50", // 緑
      "#ff9800", // オレンジ
      "#9c27b0", // 紫
      "#00bcd4", // シアン
      "#e91e63", // ピンク
      "#795548"  // 茶色
    ];

    players.forEach((p, idx) => {
      const pos = p.position || 0;
      const tile = this.tiles[pos] || this.tiles[0];
      if (!tile) return;

      // 複数人が同じマスにいる場合に重ならないようズラす
      const offsetX = (idx % 3) * 12 - 6;
      const offsetY = Math.floor(idx / 3) * 12 - 12;

      const color = playerColors[idx % playerColors.length];

      // 人型アイコンの背景サークル（見やすさのため）
      this.ctx.beginPath();
      this.ctx.arc(tile.x + offsetX, tile.y + offsetY - 20, 10, 0, Math.PI * 2);
      this.ctx.fillStyle = color;
      this.ctx.fill();
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = "#ffffff";
      this.ctx.stroke();

      // 人型アイコン（文字）
      this.ctx.font = "12px sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText("👤", tile.x + offsetX, tile.y + offsetY - 20);
    });
  }
}

// グローバルインスタンスを作成
window.boardManager = new BoardManager("board-canvas");