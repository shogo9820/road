// PWAアイコン生成スクリプト（依存ライブラリ不要）: node icons/generate_icons.cjs
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function crc32(buf) {
  let c;
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

// 10色ルーレットカラー（common.css と完全連動）
const ROULETTE_COLORS = [
  [244, 67, 54],   // #f44336
  [233, 30, 99],   // #e91e63
  [156, 39, 176],  // #9c27b0
  [103, 58, 183],  // #673ab7
  [63, 81, 181],   // #3f51b5
  [33, 150, 243],  // #2196f3
  [3, 169, 244],   // #03a9f4
  [0, 188, 212],   // #00bcd4
  [0, 150, 136],   // #009688
  [76, 175, 80],   // #4caf50
];

function sdRoundedBox(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.sqrt(ax * ax + ay * ay) + Math.min(Math.max(qx, qy), 0) - r;
}

function sdCircle(px, py, cx, cy, r) {
  const dx = px - cx;
  const dy = py - cy;
  return Math.sqrt(dx * dx + dy * dy) - r;
}

function sdStar4(px, py, cx, cy, size) {
  const dx = Math.abs(px - cx);
  const dy = Math.abs(py - cy);
  if (dx > size || dy > size) return 1;
  const d = (dx + dy) * 0.7071;
  const sharp = Math.sqrt(dx) + Math.sqrt(dy) - Math.sqrt(size);
  return Math.min(d, sharp * size);
}

function blendRGB(dstR, dstG, dstB, srcR, srcG, srcB, alpha) {
  const a = clamp01(alpha);
  const inv = 1 - a;
  return [
    dstR * inv + srcR * a,
    dstG * inv + srcG * a,
    dstB * inv + srcB * a,
  ];
}

function sampleIconPixel(u, v, maskable, aaWidth) {
  // 背景: 紫(#6a11cb) -> 青(#2575fc) グラデーション
  const gradT = clamp01(u * 0.55 + v * 0.45);
  let r = 106 + (37 - 106) * gradT;
  let g = 17 + (117 - 17) * gradT;
  let b = 203 + (252 - 203) * gradT;

  // セーフゾーン変換（maskableは中央76%内に収める）
  const scale = maskable ? 0.76 : 0.96;
  const x = (u - 0.5) / scale;
  const y = (v - 0.5) / scale;
  const aa = aaWidth / scale;
  const distCenter = Math.sqrt(x * x + y * y);

  // 背景中央のやわらかい発光グロー
  const bgGlow = Math.exp(-distCenter * distCenter * 4.2) * 0.28;
  [r, g, b] = blendRGB(r, g, b, 255, 224, 130, bgGlow);

  // 1. 外周ルーレットリング（半径 0.345 〜 0.435）
  const outerRingR = 0.435;
  const innerRingR = 0.345;
  const goldOuterR = 0.452;

  // リング外側のソフトシャドウ
  const shadowMask = 1 - smoothstep(goldOuterR - 0.01, goldOuterR + 0.05, distCenter);
  [r, g, b] = blendRGB(r, g, b, 15, 5, 40, shadowMask * 0.38);

  // 外側ゴールド枠
  const goldOuterAlpha = 1 - smoothstep(goldOuterR - aa, goldOuterR + aa, distCenter);
  if (goldOuterAlpha > 0) {
    const goldShade = 0.85 + 0.15 * Math.cos((x - y) * 3.5);
    [r, g, b] = blendRGB(
      r,
      g,
      b,
      255 * goldShade,
      213 * goldShade,
      79 * goldShade,
      goldOuterAlpha
    );
  }

  // 10色ルーレットセクター
  const rouletteAlpha = 1 - smoothstep(outerRingR - aa, outerRingR + aa, distCenter);
  if (rouletteAlpha > 0) {
    let angle = Math.atan2(x, -y); // 上を0度として時計回り
    if (angle < 0) angle += Math.PI * 2;
    const sectorFloat = (angle / (Math.PI * 2)) * 10;
    const sectorIdx = Math.floor(sectorFloat) % 10;
    const c = ROULETTE_COLORS[sectorIdx];
    // セクター境界の細い白い区切り線
    const edgeDist = Math.min(sectorFloat - Math.floor(sectorFloat), Math.ceil(sectorFloat) - sectorFloat);
    const sepAlpha = 1 - smoothstep(0.015, 0.045, edgeDist);
    let sr = c[0];
    let sg = c[1];
    let sb = c[2];
    if (sepAlpha > 0) {
      [sr, sg, sb] = blendRGB(sr, sg, sb, 255, 255, 255, sepAlpha * 0.65);
    }
    [r, g, b] = blendRGB(r, g, b, sr, sg, sb, rouletteAlpha);
  }

  // 内側ゴールド枠（半径 0.345 〜 0.362）
  const innerGoldR = 0.362;
  const innerGoldAlpha = 1 - smoothstep(innerGoldR - aa, innerGoldR + aa, distCenter);
  if (innerGoldAlpha > 0) {
    [r, g, b] = blendRGB(r, g, b, 255, 215, 64, innerGoldAlpha);
  }

  // 内側メダル盤面（濃いロイヤルパープル〜ネイビーグラデーション）
  const innerDiscAlpha = 1 - smoothstep(innerRingR - aa, innerRingR + aa, distCenter);
  if (innerDiscAlpha > 0) {
    const discT = clamp01((y + innerRingR) / (innerRingR * 2));
    let dr = 52 + (24 - 52) * discT;
    let dg = 18 + (36 - 18) * discT;
    let db = 112 + (122 - 112) * discT;
    // 内側の暖色ラジアルハイライト
    const innerGlow = Math.exp(-distCenter * distCenter * 18) * 0.35;
    [dr, dg, db] = blendRGB(dr, dg, db, 140, 82, 255, innerGlow);
    [r, g, b] = blendRGB(r, g, b, dr, dg, db, innerDiscAlpha);
  }

  // 2. ビールジョッキのドロップシャドウ
  const mugDropD = Math.min(
    sdRoundedBox(x - 0.012, y - 0.018, -0.025, 0.075, 0.145, 0.165, 0.028),
    Math.abs(sdCircle(x - 0.012, y - 0.018, 0.135, 0.07, 0.075)) - 0.024
  );
  const mugShadowAlpha = 1 - smoothstep(-aa, aa * 5, mugDropD);
  if (mugShadowAlpha > 0) {
    [r, g, b] = blendRGB(r, g, b, 10, 5, 30, mugShadowAlpha * 0.45);
  }

  // 3. ジョッキの持ち手（右側）
  const handleOuter = sdRoundedBox(x, y, 0.125, 0.07, 0.095, 0.095, 0.048);
  const handleInner = sdRoundedBox(x, y, 0.125, 0.07, 0.048, 0.052, 0.025);
  const handleD = Math.max(handleOuter, -handleInner);
  if (x > 0.05) {
    const handleAlpha = 1 - smoothstep(-aa, aa, handleD);
    if (handleAlpha > 0) {
      const hHighlight = smoothstep(0.18, 0.12, x) * 0.12;
      const hr = 242 + 13 * (1 - hHighlight);
      const hg = 246 + 9 * (1 - hHighlight);
      const hb = 255;
      [r, g, b] = blendRGB(r, g, b, hr, hg, hb, handleAlpha);
    }
  }

  // 4. ジョッキ本体（ガラス外枠）
  const mugBodyD = sdRoundedBox(x, y, -0.025, 0.075, 0.145, 0.165, 0.026);
  const mugBodyAlpha = 1 - smoothstep(-aa, aa, mugBodyD);
  if (mugBodyAlpha > 0) {
    // ガラスの上品な白〜アイスブルー立体感
    const glassShade = clamp01((x + 0.17) / 0.29);
    const gr = 255 - 14 * glassShade;
    const gg = 255 - 8 * glassShade;
    const gb = 255;
    [r, g, b] = blendRGB(r, g, b, gr, gg, gb, mugBodyAlpha);
  }

  // 5. ビール液体部分（金色〜アンバーグラデーション）
  const beerD = sdRoundedBox(x, y, -0.025, 0.082, 0.114, 0.132, 0.015);
  const beerAlpha = 1 - smoothstep(-aa, aa, beerD);
  if (beerAlpha > 0) {
    const beerV = clamp01((y - (-0.05)) / 0.264);
    let br = 255;
    let bg = 218 + (148 - 218) * beerV;
    let bb = 56 + (0 - 56) * beerV;

    // 縦のガラス溝・光沢ハイライト
    const stripe1 = Math.exp(-((x + 0.095) ** 2) / 0.00025) * 0.45;
    const stripe2 = Math.exp(-((x - 0.045) ** 2) / 0.00018) * 0.25;
    [br, bg, bb] = blendRGB(br, bg, bb, 255, 248, 190, stripe1 + stripe2);

    // 炭酸気泡（小さな明るい泡粒）
    const beerBubbles = [
      [-0.06, 0.12, 0.011],
      [0.01, 0.07, 0.009],
      [-0.02, 0.16, 0.008],
      [0.05, 0.14, 0.01],
    ];
    for (const [bx, by, bradius] of beerBubbles) {
      const bd = sdCircle(x, y, bx, by, bradius);
      const ba = 1 - smoothstep(-aa, aa, bd);
      if (ba > 0) {
        [br, bg, bb] = blendRGB(br, bg, bb, 255, 245, 200, ba * 0.7);
      }
    }
    [r, g, b] = blendRGB(r, g, b, br, bg, bb, beerAlpha);
  }

  // 6. ふわっとした白い泡（複数の円を合成）
  let foamD = Math.min(
    sdCircle(x, y, -0.115, -0.085, 0.062),
    sdCircle(x, y, -0.035, -0.125, 0.082),
    sdCircle(x, y, 0.05, -0.105, 0.068),
    sdCircle(x, y, 0.105, -0.07, 0.046),
    sdRoundedBox(x, y, -0.02, -0.068, 0.132, 0.032, 0.025)
  );
  // 右側に垂れる可愛い泡しずく
  foamD = Math.min(
    foamD,
    sdRoundedBox(x, y, 0.078, -0.015, 0.02, 0.052, 0.02)
  );

  const foamAlpha = 1 - smoothstep(-aa, aa, foamD);
  if (foamAlpha > 0) {
    // 泡の下部に淡い青紫の陰影を入れて立体化
    const foamShade = smoothstep(-0.16, -0.01, y);
    const fr = 255 - 24 * foamShade;
    const fg = 255 - 18 * foamShade;
    const fb = 255;
    [r, g, b] = blendRGB(r, g, b, fr, fg, fb, foamAlpha);
  }

  // 7. 周囲のキラキラ装飾（4点スター）
  const stars = [
    [-0.22, -0.17, 0.042],
    [0.21, -0.15, 0.035],
    [-0.21, 0.16, 0.028],
  ];
  for (const [sx, sy, ssize] of stars) {
    const sd = sdStar4(x, y, sx, sy, ssize);
    const sa = 1 - smoothstep(-aa * 0.8, aa * 0.8, sd);
    if (sa > 0) {
      [r, g, b] = blendRGB(r, g, b, 255, 241, 118, sa * 0.95);
    }
  }

  return [r, g, b, 255];
}

function encodePNG(size, maskable) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const aaWidth = 1.15 / size;
  // 2x2 スーパーサンプリングで滑らかなアンチエイリアスを実現
  const subOffsets = [0.25, 0.75];

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < size; x++) {
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let sumA = 0;
      for (let sy = 0; sy < 2; sy++) {
        for (let sx = 0; sx < 2; sx++) {
          const u = (x + subOffsets[sx]) / size;
          const v = (y + subOffsets[sy]) / size;
          const [pr, pg, pb, pa] = sampleIconPixel(u, v, maskable, aaWidth);
          sumR += pr;
          sumG += pg;
          sumB += pb;
          sumA += pa;
        }
      }
      const o = rowStart + 1 + x * 4;
      raw[o] = Math.round(sumR * 0.25);
      raw[o + 1] = Math.round(sumG * 0.25);
      raw[o + 2] = Math.round(sumB * 0.25);
      raw[o + 3] = Math.round(sumA * 0.25);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  { name: "icon-192.png", size: 192, maskable: false },
  { name: "icon-maskable-192.png", size: 192, maskable: true },
  { name: "icon-512.png", size: 512, maskable: false },
  { name: "icon-maskable-512.png", size: 512, maskable: true },
  { name: "apple-touch-icon.png", size: 180, maskable: false },
  { name: "favicon-32.png", size: 32, maskable: false },
];

for (const t of targets) {
  const buf = encodePNG(t.size, t.maskable);
  fs.writeFileSync(path.join(outDir, t.name), buf);
  console.log(`Generated ${t.name} (${t.size}x${t.size}, maskable=${t.maskable})`);
}
