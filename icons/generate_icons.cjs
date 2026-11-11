// PWAアイコン生成スクリプト（依存ライブラリ不要）: node icons/generate_icons.cjs
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function crc32(buf) {
  let c, crc = 0xffffffff;
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
function encodePNG(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x / size, y / size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const lerp = (a, b, t) => Math.round(a + (b - a) * t);

// ビールジョッキ柄: 紫→青グラデ背景 + 白いジョッキ + 金色の泡
function makePixel(maskable) {
  const scale = maskable ? 0.8 : 1; // maskableは中央80%のセーフゾーンに収める
  return (u, v) => {
    // 背景グラデーション
    const t = (u + v) / 2;
    let col = [lerp(106, 37, t), lerp(17, 117, t), lerp(203, 252, t), 255];
    // セーフゾーン変換
    const x = (u - 0.5) / scale + 0.5;
    const y = (v - 0.5) / scale + 0.5;
    // ジョッキ本体
    if (x > 0.27 && x < 0.65 && y > 0.36 && y < 0.78) col = [255, 255, 255, 255];
    // ビール（金色）
    if (x > 0.31 && x < 0.61 && y > 0.42 && y < 0.74) col = [255, 193, 7, 255];
    // 泡
    const bubbles = [[0.33, 0.36, 0.07], [0.43, 0.32, 0.09], [0.53, 0.35, 0.08], [0.6, 0.38, 0.06]];
    for (const [cx, cy, r] of bubbles) {
      if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) col = [255, 255, 255, 255];
    }
    // 持ち手（リング）
    const hx = x - 0.7, hy = y - 0.56;
    const d = Math.sqrt(hx * hx + hy * hy);
    if (d < 0.14 && d > 0.07 && x > 0.64) col = [255, 255, 255, 255];
    return col;
  };
}

const outDir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "icon-192.png"), encodePNG(192, makePixel(false)));
fs.writeFileSync(path.join(outDir, "icon-512.png"), encodePNG(512, makePixel(false)));
fs.writeFileSync(path.join(outDir, "icon-maskable-512.png"), encodePNG(512, makePixel(true)));
fs.writeFileSync(path.join(outDir, "apple-touch-icon.png"), encodePNG(180, makePixel(false)));
console.log("icons generated:", outDir);

