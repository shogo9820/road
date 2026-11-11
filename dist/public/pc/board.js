"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// ==========================================================================
// 宅飲み人生ゲーム : 盤面Canvas描画＆同期システム（board.ts）
// ==========================================================================
window.boardManager = {
    canvas: null,
    ctx: null,
    cellSize: 15,
    previewRouteIdx: null,
    // マス種別ごとの基本カラー
    squareColors: {
        start: "#43a047",
        goal: "#e53935",
        force_stop: "#f5a623",
        force_stop_rankup: "#ffa000",
        branch: "#ffa000",
        jobChallenge: "#8e24aa",
        location: "#fffdf5",
        normal: "#fffdf5",
        heal: "#26a69a",
        repeat: "#311b92",
    },
    // 強制ストップマス・分岐マスごとの固有イメージカラー＆ラベル定義
    specialSquareThemes: {
        0: {
            bg: "#2e7d32",
            accent: "#66bb6a",
            border: "#ffffff",
            icon: "🚀",
            label: "START",
        },
        18: {
            bg: "#0288d1",
            accent: "#4fc3f7",
            border: "#ffffff",
            icon: "🌸",
            label: "入学式",
        },
        30: {
            bg: "#7b1fa2",
            accent: "#ba68c8",
            border: "#ffffff",
            icon: "🛡️",
            label: "生命保険",
        },
        41: {
            bg: "#d81b60",
            accent: "#ff80ab",
            border: "#ffffff",
            icon: "💕",
            label: "カップル",
        },
        49: {
            bg: "#ef6c00",
            accent: "#ffb74d",
            border: "#ffffff",
            icon: "🔥",
            label: "ランクUP",
        },
        80: {
            bg: "#c62828",
            accent: "#ff8a65",
            border: "#ffd54f",
            icon: "🎲",
            label: "引退勝負",
        },
        89: {
            bg: "#283593",
            accent: "#7986cb",
            border: "#ffd54f",
            icon: "🎓",
            label: "卒業判定",
        },
        99: {
            bg: "#d32f2f",
            accent: "#ff5252",
            border: "#ffd700",
            icon: "🎉",
            label: "GOAL!",
        },
    },
    playerColors: [
        "#f44336",
        "#2196f3",
        "#4caf50",
        "#ff9800",
        "#9c27b0",
        "#00bcd4",
        "#e91e63",
        "#795548",
    ],
    gridMap: {
        0: { x: 52, y: 48, w: 7, h: 7 },
        1: { x: 54, y: 45, w: 3, h: 3 },
        2: { x: 55, y: 42, w: 3, h: 3 },
        3: { x: 56, y: 39, w: 3, h: 3 },
        4: { x: 56, y: 36, w: 3, h: 3 },
        5: { x: 55, y: 33, w: 3, h: 3 },
        6: { x: 54, y: 30, w: 3, h: 3 },
        7: { x: 53, y: 27, w: 3, h: 3 },
        8: { x: 49, y: 51, w: 3, h: 3 },
        9: { x: 46, y: 49, w: 3, h: 3 },
        10: { x: 45, y: 46, w: 3, h: 3 },
        11: { x: 44, y: 43, w: 3, h: 3 },
        12: { x: 43, y: 40, w: 3, h: 3 },
        13: { x: 43, y: 37, w: 3, h: 3 },
        14: { x: 44, y: 34, w: 3, h: 3 },
        15: { x: 45, y: 31, w: 3, h: 3 },
        16: { x: 46, y: 28, w: 3, h: 3 },
        17: { x: 49, y: 27, w: 3, h: 3 },
        18: { x: 50, y: 22, w: 5, h: 5 },
        19: { x: 51, y: 19, w: 3, h: 3 },
        20: { x: 50, y: 16, w: 3, h: 3 },
        21: { x: 49, y: 13, w: 3, h: 3 },
        22: { x: 46, y: 12, w: 3, h: 3 },
        23: { x: 43, y: 11, w: 3, h: 3 },
        24: { x: 40, y: 12, w: 3, h: 3 },
        25: { x: 37, y: 13, w: 3, h: 3 },
        26: { x: 36, y: 16, w: 3, h: 3 },
        27: { x: 35, y: 19, w: 3, h: 3 },
        28: { x: 36, y: 22, w: 3, h: 3 },
        29: { x: 37, y: 25, w: 3, h: 3 },
        30: { x: 36, y: 28, w: 5, h: 5 },
        31: { x: 37, y: 33, w: 3, h: 3 },
        32: { x: 38, y: 36, w: 3, h: 3 },
        33: { x: 39, y: 39, w: 3, h: 3 },
        34: { x: 39, y: 42, w: 3, h: 3 },
        35: { x: 38, y: 45, w: 3, h: 3 },
        36: { x: 37, y: 48, w: 3, h: 3 },
        37: { x: 34, y: 49, w: 3, h: 3 },
        38: { x: 31, y: 50, w: 3, h: 3 },
        39: { x: 28, y: 51, w: 3, h: 3 },
        40: { x: 25, y: 50, w: 3, h: 3 },
        41: { x: 20, y: 49, w: 5, h: 5 },
        42: { x: 17, y: 50, w: 3, h: 3 },
        43: { x: 14, y: 51, w: 3, h: 3 },
        44: { x: 11, y: 52, w: 3, h: 3 },
        45: { x: 8, y: 51, w: 3, h: 3 },
        46: { x: 5, y: 50, w: 3, h: 3 },
        47: { x: 4, y: 47, w: 3, h: 3 },
        48: { x: 3, y: 44, w: 3, h: 3 },
        49: { x: 2, y: 39, w: 5, h: 5 },
        50: { x: 3, y: 36, w: 3, h: 3 },
        51: { x: 2, y: 33, w: 3, h: 3 },
        52: { x: 1, y: 30, w: 3, h: 3 },
        53: { x: 2, y: 27, w: 3, h: 3 },
        54: { x: 3, y: 24, w: 3, h: 3 },
        55: { x: 6, y: 23, w: 3, h: 3 },
        56: { x: 9, y: 24, w: 3, h: 3 },
        57: { x: 10, y: 27, w: 3, h: 3 },
        58: { x: 11, y: 30, w: 3, h: 3 },
        59: { x: 7, y: 40, w: 3, h: 3 },
        60: { x: 10, y: 41, w: 3, h: 3 },
        61: { x: 13, y: 42, w: 3, h: 3 },
        62: { x: 16, y: 43, w: 3, h: 3 },
        63: { x: 19, y: 44, w: 3, h: 3 },
        64: { x: 22, y: 43, w: 3, h: 3 },
        65: { x: 25, y: 42, w: 3, h: 3 },
        66: { x: 28, y: 41, w: 3, h: 3 },
        67: { x: 29, y: 38, w: 3, h: 3 },
        68: { x: 30, y: 35, w: 3, h: 3 },
        69: { x: 31, y: 32, w: 3, h: 3 },
        70: { x: 30, y: 29, w: 3, h: 3 },
        71: { x: 31, y: 26, w: 3, h: 3 },
        72: { x: 32, y: 23, w: 3, h: 3 },
        73: { x: 31, y: 20, w: 3, h: 3 },
        74: { x: 28, y: 19, w: 3, h: 3 },
        75: { x: 25, y: 20, w: 3, h: 3 },
        76: { x: 24, y: 23, w: 3, h: 3 },
        77: { x: 23, y: 26, w: 3, h: 3 },
        78: { x: 22, y: 29, w: 3, h: 3 },
        79: { x: 19, y: 30, w: 3, h: 3 },
        80: { x: 14, y: 29, w: 5, h: 5 },
        81: { x: 15, y: 26, w: 3, h: 3 },
        82: { x: 14, y: 23, w: 3, h: 3 },
        83: { x: 13, y: 20, w: 3, h: 3 },
        84: { x: 12, y: 17, w: 3, h: 3 },
        85: { x: 9, y: 16, w: 3, h: 3 },
        86: { x: 6, y: 15, w: 3, h: 3 },
        87: { x: 5, y: 12, w: 3, h: 3 },
        88: { x: 6, y: 9, w: 3, h: 3 },
        89: { x: 9, y: 8, w: 5, h: 5 },
        90: { x: 14, y: 9, w: 3, h: 3 },
        91: { x: 15, y: 12, w: 3, h: 3 },
        92: { x: 18, y: 13, w: 3, h: 3 },
        93: { x: 21, y: 12, w: 3, h: 3 },
        94: { x: 22, y: 9, w: 3, h: 3 },
        95: { x: 22, y: 6, w: 3, h: 3 },
        96: { x: 21, y: 3, w: 3, h: 3 },
        97: { x: 18, y: 2, w: 3, h: 3 },
        98: { x: 15, y: 3, w: 3, h: 3 },
        99: { x: 8, y: 1, w: 7, h: 7 },
    },
    init() {
        this.canvas = document.getElementById("board-canvas");
        if (!this.canvas)
            return;
        this.ctx = this.canvas.getContext("2d");
        this.canvas.width = 60 * this.cellSize;
        this.canvas.height = 56 * this.cellSize;
        this.bindSocketListeners();
    },
    getCoordinates(index) {
        const data = this.gridMap[index] || { x: 0, y: 0, w: 3, h: 3 };
        return {
            x: (data.x + data.w / 2) * this.cellSize,
            y: (data.y + data.h / 2) * this.cellSize,
        };
    },
    drawRoundedRect(ctx, x, y, w, h, r) {
        const radius = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    },
    drawBoardBackground(ctx, width, height, isRepeatDark) {
        // 1. ベース背景グラデーション（人生ゲーム風ポップなマップ背景 / 留年時はダーク背景）
        const grad = ctx.createLinearGradient(0, 0, width, height);
        if (isRepeatDark) {
            grad.addColorStop(0, "#1a1025");
            grad.addColorStop(0.5, "#120c1c");
            grad.addColorStop(1, "#241434");
        }
        else {
            grad.addColorStop(0, "#e8f5e9");
            grad.addColorStop(0.35, "#fffde7");
            grad.addColorStop(0.7, "#fff3e0");
            grad.addColorStop(1, "#e1f5fe");
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        // 2. うっすらドットグリッド模様でボードゲーム感を演出
        ctx.fillStyle = isRepeatDark
            ? "rgba(255, 255, 255, 0.04)"
            : "rgba(0, 0, 0, 0.035)";
        const step = this.cellSize * 2;
        for (let gx = step; gx < width; gx += step) {
            for (let gy = step; gy < height; gy += step) {
                ctx.beginPath();
                ctx.arc(gx, gy, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        // 3. マップ上の楽しいエリア看板・ランドマーク装飾（マスと被らない空きスペースに配置）
        const badges = isRepeatDark
            ? [
                {
                    x: 32,
                    y: 6,
                    text: "💀 5回生・留年サバイバル編 💀",
                    bg: "rgba(74, 20, 140, 0.85)",
                    color: "#ff80ab",
                },
                {
                    x: 24,
                    y: 35,
                    text: "🍺 宅飲み人生ゲーム 🍺",
                    bg: "rgba(33, 33, 33, 0.8)",
                    color: "#ce93d8",
                },
            ]
            : [
                {
                    x: 33,
                    y: 5,
                    text: "🍻 宅飲み人生ゲーム 🍺",
                    bg: "rgba(255, 255, 255, 0.88)",
                    color: "#d84315",
                },
                {
                    x: 51,
                    y: 38,
                    text: "🎭 役職決定ゾーン",
                    bg: "rgba(142, 36, 170, 0.14)",
                    color: "#6a1b9a",
                },
                {
                    x: 44,
                    y: 20,
                    text: "🌸 1〜2回生ゾーン",
                    bg: "rgba(2, 136, 209, 0.14)",
                    color: "#01579b",
                },
                {
                    x: 6,
                    y: 20,
                    text: "🍹 A: 激シャバルート",
                    bg: "rgba(0, 150, 136, 0.15)",
                    color: "#00695c",
                },
                {
                    x: 20,
                    y: 36,
                    text: "🔥 B: 激おもろルート",
                    bg: "rgba(255, 152, 0, 0.18)",
                    color: "#e65100",
                },
            ];
        badges.forEach((b) => {
            const bx = b.x * this.cellSize;
            const by = b.y * this.cellSize;
            ctx.save();
            ctx.font = "bold 12px 'M PLUS Rounded 1c', sans-serif";
            const textWidth = ctx.measureText(b.text).width;
            const padX = 10;
            const boxW = textWidth + padX * 2;
            const boxH = 24;
            this.drawRoundedRect(ctx, bx - boxW / 2, by - boxH / 2, boxW, boxH, 12);
            ctx.fillStyle = b.bg;
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = isRepeatDark
                ? "rgba(234, 128, 252, 0.4)"
                : "rgba(0, 0, 0, 0.08)";
            ctx.stroke();
            ctx.fillStyle = b.color;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(b.text, bx, by);
            ctx.restore();
        });
        // 4. 周辺マスのエピソード・季節感にちなんだスタンプ風絵文字の描画
        this.drawSeasonalEmojiStamps(ctx, isRepeatDark);
    },
    drawSeasonalEmojiStamps(ctx, isRepeatDark) {
        const stamps = [
            // 🌸 1回生 春（入学式・新歓: マス18〜20）
            { x: 56.5, y: 19.5, emoji: "🌸", size: 26, rotate: -8 },
            { x: 56.5, y: 23, emoji: "🎒", size: 20, rotate: 6 },
            { x: 54, y: 14.5, emoji: "🍡", size: 20, rotate: 10 },
            // 🌻 1回生 夏（夏合宿・バス飲み: マス21〜24）
            { x: 47, y: 8, emoji: "🌻", size: 26, rotate: 10 },
            { x: 44, y: 7.5, emoji: "🍉", size: 21, rotate: -6 },
            { x: 41, y: 8, emoji: "🚌", size: 22, rotate: -8 },
            // 🍁 1回生 秋（秋キャン・黒潮市場・龍祭: マス25〜27）
            { x: 40, y: 15.5, emoji: "🍁", size: 25, rotate: -12 },
            { x: 39, y: 18.5, emoji: "⛺", size: 21, rotate: 6 },
            { x: 33.5, y: 15, emoji: "🏮", size: 21, rotate: 8 },
            // ❄️ 1〜2回生 冬（忘年会・冬合宿: マス28〜29, 32）
            { x: 42.5, y: 25, emoji: "❄️", size: 26, rotate: 0 },
            { x: 42.5, y: 28.5, emoji: "⛄", size: 21, rotate: -8 },
            { x: 43.5, y: 35.5, emoji: "🎿", size: 22, rotate: 15 },
            // 🌸 2回生 春（新歓キャンプ・お花見ももじ: マス33〜34）
            { x: 44, y: 40, emoji: "🌸", size: 26, rotate: 8 },
            { x: 44, y: 43.5, emoji: "🍡", size: 21, rotate: -10 },
            // 🌻 2回生 夏（花火・沖縄・夏合宿: マス46〜48）
            { x: 2, y: 49, emoji: "🌻", size: 26, rotate: 12 },
            { x: 1.5, y: 52.5, emoji: "🎆", size: 22, rotate: -5 },
            { x: 5, y: 54, emoji: "🍉", size: 20, rotate: 10 },
            // 🍓 3回生 Aルート 春〜初夏（いちご狩り・お菓子: マス53〜55）
            { x: 2.5, y: 21, emoji: "🍓", size: 22, rotate: 12 },
            { x: 5, y: 20, emoji: "🌸", size: 22, rotate: -8 },
            // 🌻 3回生 Bルート 夏（夏合宿・琵琶湖HAMIKIN: マス59〜60）
            { x: 8, y: 44.5, emoji: "🌻", size: 26, rotate: -10 },
            { x: 11, y: 45.5, emoji: "🏊", size: 22, rotate: 5 },
            { x: 14, y: 46, emoji: "🌊", size: 20, rotate: -5 },
            // 🍁 3回生 Bルート 秋（秋キャン・龍祭バケツタピオカ: マス64〜68）
            { x: 26, y: 46, emoji: "🍁", size: 25, rotate: 10 },
            { x: 23, y: 47, emoji: "⛺", size: 21, rotate: -8 },
            { x: 30, y: 42, emoji: "🧋", size: 22, rotate: 8 },
            // ❄️ 3回生 Bルート 冬（忘年会・成人式・冬合宿: マス70〜74）
            { x: 35.5, y: 22, emoji: "❄️", size: 26, rotate: 0 },
            { x: 35.5, y: 25.5, emoji: "👘", size: 22, rotate: -10 },
            { x: 28, y: 16, emoji: "🏂", size: 22, rotate: 12 },
            { x: 31, y: 16.5, emoji: "⛄", size: 20, rotate: -5 },
            // 🌸 4回生直前 春（新歓・川飲み: マス76）
            { x: 26.5, y: 24.5, emoji: "🌸", size: 24, rotate: 8 },
            { x: 25, y: 27.5, emoji: "🏞️", size: 21, rotate: -6 },
            // 🌻 4回生 夏（引退合宿: マス79〜81）
            { x: 18.5, y: 34.5, emoji: "🌻", size: 26, rotate: 12 },
            { x: 21.5, y: 34, emoji: "🍉", size: 21, rotate: -8 },
            // 🍁 4回生 秋（秋キャン・HOT LIMIT・龍祭ガイモン: マス82〜84）
            { x: 17, y: 20, emoji: "🍁", size: 25, rotate: -10 },
            { x: 16.5, y: 23, emoji: "⛺", size: 21, rotate: 8 },
            // ❄️ 4回生 冬（忘年会・ゲレンデカレー: マス85〜86）
            { x: 7, y: 18.5, emoji: "❄️", size: 26, rotate: 0 },
            { x: 9.5, y: 19, emoji: "🍛", size: 22, rotate: 10 },
            { x: 4, y: 17, emoji: "⛄", size: 20, rotate: -8 },
            // 🌸 卒業シーズン 春（追いコン・卒業式: マス87, 89, 99）
            { x: 2.5, y: 10.5, emoji: "🌸", size: 26, rotate: 8 },
            { x: 2.5, y: 7, emoji: "💐", size: 22, rotate: -10 },
            { x: 4, y: 3.5, emoji: "🌸", size: 28, rotate: -15 },
            { x: 5.5, y: 1.5, emoji: "🎊", size: 22, rotate: 12 },
            { x: 16, y: 2, emoji: "🎓", size: 24, rotate: -8 },
        ];
        if (isRepeatDark) {
            stamps.push({ x: 18.5, y: 7.5, emoji: "🎂", size: 22, rotate: 8 }, { x: 24.5, y: 5, emoji: "🍂", size: 22, rotate: -12 }, { x: 24, y: 8, emoji: "💀", size: 24, rotate: 5 });
        }
        stamps.forEach((s) => {
            const sx = s.x * this.cellSize;
            const sy = s.y * this.cellSize;
            ctx.save();
            ctx.translate(sx, sy);
            if (s.rotate) {
                ctx.rotate((s.rotate * Math.PI) / 180);
            }
            ctx.font = `${s.size || 20}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.shadowColor = isRepeatDark ? "rgba(0, 0, 0, 0.7)" : "rgba(0, 0, 0, 0.12)";
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            ctx.fillText(s.emoji, 0, 0);
            ctx.restore();
        });
    },
    drawRoutePaths(ctx, currentPlayer, isRepeatDark) {
        if (typeof MAP_SQUARES === "undefined" || !Array.isArray(MAP_SQUARES))
            return;
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        MAP_SQUARES.forEach((sq, idx) => {
            if (idx >= 90 && idx <= 98) {
                if (!currentPlayer || currentPlayer.isRepeat !== true)
                    return;
            }
            if (!sq.nextId || !Array.isArray(sq.nextId))
                return;
            const fromCoord = this.getCoordinates(idx);
            sq.nextId.forEach((nextIdx) => {
                if (nextIdx >= 90 && nextIdx <= 98) {
                    if (!currentPlayer || currentPlayer.isRepeat !== true)
                        return;
                }
                // 89 -> 99 の直接ワープ線は盤面を横断するため描画しない
                if (idx === 89 && nextIdx === 99)
                    return;
                const toCoord = this.getCoordinates(nextIdx);
                // 外枠の白い縁取りライン
                ctx.beginPath();
                ctx.moveTo(fromCoord.x, fromCoord.y);
                ctx.lineTo(toCoord.x, toCoord.y);
                ctx.lineWidth = 8;
                ctx.strokeStyle = isRepeatDark
                    ? "rgba(123, 31, 162, 0.5)"
                    : "rgba(255, 255, 255, 0.85)";
                ctx.stroke();
                // 内側の道ライン
                ctx.beginPath();
                ctx.moveTo(fromCoord.x, fromCoord.y);
                ctx.lineTo(toCoord.x, toCoord.y);
                ctx.lineWidth = 4;
                ctx.strokeStyle =
                    idx >= 89 && nextIdx >= 90
                        ? "#ab47bc"
                        : isRepeatDark
                            ? "#7e57c2"
                            : "#ffb74d";
                ctx.stroke();
            });
        });
        ctx.restore();
    },
    draw(playersList, activeIdx) {
        if (!this.ctx || !this.canvas)
            this.init();
        if (!this.ctx)
            return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (typeof MAP_SQUARES === "undefined" || !Array.isArray(MAP_SQUARES))
            return;
        const currentPlayer = playersList && playersList[activeIdx] ? playersList[activeIdx] : null;
        const isRepeatDark = Boolean(currentPlayer && currentPlayer.isRepeat);
        // 0. ボード背景＆道ラインの描画
        this.drawBoardBackground(this.ctx, this.canvas.width, this.canvas.height, isRepeatDark);
        this.drawRoutePaths(this.ctx, currentPlayer, isRepeatDark);
        // 1. 各道ブロックの描画ループ
        MAP_SQUARES.forEach((sq, idx) => {
            if (idx >= 90 && idx <= 98) {
                if (!currentPlayer || currentPlayer.isRepeat !== true) {
                    return;
                }
            }
            const data = this.gridMap[idx];
            if (!data)
                return;
            const px = data.x * this.cellSize;
            const py = data.y * this.cellSize;
            const pw = data.w * this.cellSize;
            const ph = data.h * this.cellSize;
            const cx = px + pw / 2;
            const cy = py + ph / 2;
            const specialTheme = this.specialSquareThemes[idx];
            const isBigSquare = data.w >= 5 || Boolean(specialTheme);
            this.ctx.save();
            if (specialTheme) {
                // 🌟 特別マス（0:START, 18:入学式, 30:保険, 41:カップル, 49:ランクUP, 80:引退, 89:卒業判定, 99:GOAL）
                // 立体ドロップシャドウ
                this.drawRoundedRect(this.ctx, px + 2, py + 3, pw, ph, 10);
                this.ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
                this.ctx.fill();
                // グラデーション背景
                const sqGrad = this.ctx.createLinearGradient(px, py, px, py + ph);
                sqGrad.addColorStop(0, specialTheme.accent);
                sqGrad.addColorStop(1, specialTheme.bg);
                this.drawRoundedRect(this.ctx, px, py, pw, ph, 10);
                this.ctx.fillStyle = sqGrad;
                this.ctx.fill();
                // 枠線（2重枠で特別感を演出）
                this.ctx.lineWidth = 2.5;
                this.ctx.strokeStyle = specialTheme.border;
                this.ctx.stroke();
                // アイコン＋番号＋ラベル描画
                this.ctx.fillStyle = "#ffffff";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                if (idx === 0 || idx === 99) {
                    this.ctx.font = "bold 18px sans-serif";
                    this.ctx.fillText(specialTheme.icon, cx, cy - 14);
                    this.ctx.font = "900 14px 'M PLUS Rounded 1c', sans-serif";
                    this.ctx.fillText(specialTheme.label, cx, cy + 8);
                }
                else {
                    this.ctx.font = "bold 14px sans-serif";
                    this.ctx.fillText(`${specialTheme.icon}${idx}`, cx, cy - 9);
                    this.ctx.font = "bold 10px 'M PLUS Rounded 1c', sans-serif";
                    this.ctx.fillText(specialTheme.label, cx, cy + 10);
                }
            }
            else {
                // 🎲 通常マス・役職マス・回復マス・留年マス
                let fillColor = this.squareColors[sq.type] || this.squareColors.normal;
                let strokeColor = "#e0c38c";
                let textColor = "#333333";
                if (sq.type === "jobChallenge" ||
                    (sq.text && sq.text.includes("【役職マス】"))) {
                    fillColor = this.squareColors.jobChallenge;
                    strokeColor = "#ffffff";
                    textColor = "#ffffff";
                }
                else if (sq.type === "heal") {
                    fillColor = this.squareColors.heal;
                    strokeColor = "#ffffff";
                    textColor = "#ffffff";
                }
                else if (sq.type === "rankup_chance") {
                    fillColor = "#ff9800";
                    strokeColor = "#ffffff";
                    textColor = "#ffffff";
                }
                else if (sq.type === "repeat") {
                    fillColor = this.squareColors.repeat;
                    strokeColor = "#ba68c8";
                    textColor = "#ffffff";
                }
                else if (sq.text && sq.text.trim() !== "") {
                    // イベントテキストが入っている通常マスは温かみのあるクリーム色＋オレンジ枠
                    fillColor = "#fff9e6";
                    strokeColor = "#ffb74d";
                    textColor = "#4e342e";
                }
                else {
                    fillColor = "#ffffff";
                    strokeColor = "#cfd8dc";
                    textColor = "#78909c";
                }
                // 立体シャドウ
                this.drawRoundedRect(this.ctx, px + 1, py + 2, pw, ph, 6);
                this.ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
                this.ctx.fill();
                // 本体
                this.drawRoundedRect(this.ctx, px, py, pw, ph, 6);
                this.ctx.fillStyle = fillColor;
                this.ctx.fill();
                this.ctx.lineWidth = 1.5;
                this.ctx.strokeStyle = strokeColor;
                this.ctx.stroke();
                // マス番号
                this.ctx.fillStyle = textColor;
                this.ctx.font = isBigSquare
                    ? "bold 12px sans-serif"
                    : "bold 11px sans-serif";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                this.ctx.fillText(sq.id.toString(), cx, cy);
            }
            // ✨ 現在手番プレイヤーが立っているマスの強調ハイライト枠
            if (currentPlayer && Number(currentPlayer.position) === idx) {
                const radius = specialTheme ? 12 : 8;
                // 外側の発光リング
                this.drawRoundedRect(this.ctx, px - 4, py - 4, pw + 8, ph + 8, radius + 2);
                this.ctx.lineWidth = 5;
                this.ctx.strokeStyle = "rgba(255, 235, 59, 0.75)";
                this.ctx.stroke();
                // 内側のシャープなゴールド枠
                this.drawRoundedRect(this.ctx, px - 2, py - 2, pw + 4, ph + 4, radius);
                this.ctx.lineWidth = 2.5;
                this.ctx.strokeStyle = "#ff6f00";
                this.ctx.stroke();
            }
            this.ctx.restore();
        });
        // 2. 独立影マスクのレイヤー重ね描き（位置限定）
        const p = playersList && playersList[activeIdx] ? playersList[activeIdx] : null;
        const currentRoute = this.previewRouteIdx !== null
            ? this.previewRouteIdx
            : p
                ? p.chosenRouteIdx
                : null;
        if (p && currentRoute !== null && currentRoute !== undefined) {
            let currentMode = "normal";
            if (typeof rooms !== "undefined" &&
                typeof roomCode !== "undefined" &&
                rooms[roomCode]) {
                currentMode = rooms[roomCode].mode || "normal";
            }
            let hasDrawnNewShadow = false;
            if (window.SQ_MODULES &&
                window.SQ_MODULES[p.position] &&
                window.SQ_MODULES[p.position][currentMode]) {
                const compData = window.SQ_MODULES[p.position][currentMode];
                if (compData.type === "branch" && compData.shadowTargets) {
                    let targets = [];
                    if (currentRoute === 0 && compData.shadowTargets.routeA) {
                        targets = compData.shadowTargets.routeA;
                    }
                    else if (currentRoute === 1 && compData.shadowTargets.routeB) {
                        targets = compData.shadowTargets.routeB;
                    }
                    MAP_SQUARES.forEach((sq, idx) => {
                        if (targets.includes(idx)) {
                            const data = this.gridMap[idx];
                            if (!data)
                                return;
                            this.ctx.save();
                            this.drawRoundedRect(this.ctx, data.x * this.cellSize, data.y * this.cellSize, data.w * this.cellSize, data.h * this.cellSize, 6);
                            this.ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
                            this.ctx.fill();
                            this.ctx.restore();
                            hasDrawnNewShadow = true;
                        }
                    });
                }
            }
            if (!hasDrawnNewShadow) {
                MAP_SQUARES.forEach((sq, idx) => {
                    const data = this.gridMap[idx];
                    if (!data)
                        return;
                    if (p.position === 0) {
                        if (currentRoute === 0 && idx >= 8 && idx <= 17) {
                            this.ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
                            this.ctx.fillRect(data.x * this.cellSize, data.y * this.cellSize, data.w * this.cellSize, data.h * this.cellSize);
                        }
                        if (currentRoute === 1 && idx >= 1 && idx <= 7) {
                            this.ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
                            this.ctx.fillRect(data.x * this.cellSize, data.y * this.cellSize, data.w * this.cellSize, data.h * this.cellSize);
                        }
                    }
                    if (p.position === 49) {
                        if (currentRoute === 0 && idx >= 59 && idx <= 79) {
                            this.ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
                            this.ctx.fillRect(data.x * this.cellSize, data.y * this.cellSize, data.w * this.cellSize, data.h * this.cellSize);
                        }
                        if (currentRoute === 1 && idx >= 50 && idx <= 58) {
                            this.ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
                            this.ctx.fillRect(data.x * this.cellSize, data.y * this.cellSize, data.w * this.cellSize, data.h * this.cellSize);
                        }
                    }
                });
            }
        }
        // 3. ピンの描画（プレイヤー番号入りで視認性アップ）
        if (playersList && Array.isArray(playersList)) {
            const positionCounts = {};
            playersList.forEach((pl, idx) => {
                const currentPos = pl.position !== undefined ? pl.position : 0;
                const coords = this.getCoordinates(currentPos);
                if (positionCounts[currentPos] === undefined)
                    positionCounts[currentPos] = 0;
                const offsetIdx = positionCounts[currentPos];
                positionCounts[currentPos]++;
                let offsetX = 0;
                let offsetY = 0;
                if (offsetIdx > 0) {
                    const angle = (offsetIdx * Math.PI * 2) / 4;
                    offsetX = Math.cos(angle) * 11;
                    offsetY = Math.sin(angle) * 11;
                }
                const pinX = coords.x + offsetX;
                const pinY = coords.y + offsetY;
                const pinColor = pl.color || this.playerColors[idx % this.playerColors.length];
                const isCurrent = idx === activeIdx;
                const radius = isCurrent ? 9.5 : 7.5;
                this.ctx.save();
                // 手番プレイヤーの強調グロー
                if (isCurrent) {
                    this.ctx.beginPath();
                    this.ctx.arc(pinX, pinY, radius + 3, 0, Math.PI * 2);
                    this.ctx.fillStyle = "rgba(255, 235, 59, 0.75)";
                    this.ctx.fill();
                }
                // ピンの影と外枠
                this.ctx.beginPath();
                this.ctx.arc(pinX, pinY + 1.5, radius, 0, Math.PI * 2);
                this.ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
                this.ctx.fill();
                this.ctx.beginPath();
                this.ctx.arc(pinX, pinY, radius, 0, Math.PI * 2);
                this.ctx.fillStyle = pinColor;
                this.ctx.fill();
                this.ctx.lineWidth = isCurrent ? 2.5 : 1.5;
                this.ctx.strokeStyle = "#ffffff";
                this.ctx.stroke();
                // ピンの中のプレイヤー番号
                this.ctx.fillStyle = "#ffffff";
                this.ctx.font = "bold 9px sans-serif";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                this.ctx.fillText(String(idx + 1), pinX, pinY + 0.5);
                this.ctx.restore();
            });
        }
    },
    bindSocketListeners() {
        if (typeof socket === "undefined" || this.hasBound)
            return;
        this.hasBound = true;
        socket.on("applyRoutePreview", (data) => {
            this.previewRouteIdx = data.selectedRouteIndex;
            if (typeof players !== "undefined") {
                if (typeof loadAndApplySquareComponent === "function") {
                    const activePlayer = players[activePlayerIndex];
                    const currentPos = activePlayer ? activePlayer.position : 0;
                    loadAndApplySquareComponent(currentPos, () => {
                        this.draw(players, activePlayerIndex);
                    });
                }
                else {
                    this.draw(players, activePlayerIndex);
                }
            }
        });
        socket.on("routeSelectionConfirmed", (data) => {
            this.previewRouteIdx = null;
            if (typeof players !== "undefined")
                this.draw(players, activePlayerIndex);
        });
    },
};
//# sourceMappingURL=board.js.map