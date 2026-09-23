/**
 * Generator ikon PWA (FR-20) — murni Node, tanpa dependensi.
 * Menghasilkan PNG RGBA valid berisi hati putih di latar rose (#e11d48):
 *   - icon-192.png / icon-512.png        (purpose: any)
 *   - icon-maskable-192/512.png          (maskable — hati lebih kecil, safe zone)
 *   - apple-touch-icon.png (180x180)     (iOS A2HS)
 *
 * Jalankan: node scripts/generate-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "icons");

const BACKGROUND = [225, 29, 72]; // #e11d48 (rose-600, sinkron themeColor)
const FOREGROUND = [255, 255, 255];

/* ---------- PNG encoder (IHDR + IDAT + IEND, CRC32 manual) ---------- */

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1
    );
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------- Render ikon hati ---------- */

/**
 * Kurva hati klasik: (x² + y² − 1)³ − x²·y³ ≤ 0 (y ke atas).
 * @param size sisi ikon (px)
 * @param occupy fraksi lebar ikan yang diduduki hati (safe zone maskable lebih kecil)
 */
function renderHeartIcon(size, occupy) {
  const rgba = new Uint8Array(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  // Lebar kurva ±1.2 unit → skala per piksel.
  const unit = (size * occupy) / 2.4;
  const SAMPLES = 2; // 2×2 subsample untuk anti-alias

  const inside = (x, y) => {
    const t = x * x + y * y - 1;
    return t * t * t - x * x * y * y * y <= 0;
  };

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let hits = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = (px + (sx + 0.5) / SAMPLES - cx) / unit;
          const y = (cy - (py + (sy + 0.5) / SAMPLES)) / unit;
          if (inside(x, y)) hits++;
        }
      }
      const coverage = hits / (SAMPLES * SAMPLES);
      const idx = (py * size + px) * 4;
      for (let ch = 0; ch < 3; ch++) {
        rgba[idx + ch] = Math.round(
          BACKGROUND[ch] * (1 - coverage) + FOREGROUND[ch] * coverage
        );
      }
      rgba[idx + 3] = 255;
    }
  }

  return encodePng(size, size, rgba);
}

/* ---------- Output ---------- */

mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  { file: "icon-192.png", size: 192, occupy: 0.72 },
  { file: "icon-512.png", size: 512, occupy: 0.72 },
  { file: "icon-maskable-192.png", size: 192, occupy: 0.5 },
  { file: "icon-maskable-512.png", size: 512, occupy: 0.5 },
  { file: "apple-touch-icon.png", size: 180, occupy: 0.66 },
];

for (const target of targets) {
  const png = renderHeartIcon(target.size, target.occupy);
  writeFileSync(join(OUT_DIR, target.file), png);
  console.log(`✓ ${target.file} (${target.size}x${target.size}, ${png.length} B)`);
}

// Salinan di root /public: iOS Safari kadang meminta /apple-touch-icon.png
// secara konvensi tanpa membaca <link> (fallback A2HS).
const applePng = renderHeartIcon(180, 0.66);
writeFileSync(join(__dirname, "..", "public", "apple-touch-icon.png"), applePng);
console.log("✓ /apple-touch-icon.png (root fallback)");
