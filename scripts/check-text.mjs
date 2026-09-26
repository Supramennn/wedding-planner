// Pemeriksaan cepat untuk mendeteksi karakter yang rusak (mojibake) di file
// sumber. Jalankan: node scripts/check-text.mjs [folder]
// Node saja, tanpa dependensi, supaya bisa dipakai di CI nanti.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.argv[2] ?? ".";
const SKIP = new Set(["node_modules", ".next", ".git", ".tools", "dist"]);

// Karakter yang tidak pernah muncul di teks Indonesia atau TypeScript ini,
// dan merupakan tanda mojibake.
const SUSPECT = [
  [0x20ac, "euro"],       // €
  [0x00e2, "circumflex"], // â, penanda mojibake latin1
  [0x00e3, "tilde"],      // ã
  [0x00ef, "e-acute"],    // ï
  [0x00f1, "n-tilde"],    // ñ
  [0x00fc, "u-diaeresis"],// ü
  [0x00c0, "A-grave"],    // À
  [0x0101, "a-macron"],   // ā, évite
  [0x00fe, "thorn"],      // þ
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.(ts|tsx|css|md|json|mjs|js)$/.test(entry)) files.push(full);
  }
  return files;
}

const problems = [];
for (const file of walk(ROOT)) {
  // Tabel SUSPECT di file ini sengaja memuat karakter yang diawasi.
  if (file.endsWith("check-text.mjs")) continue;
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const ch of line) {
      const code = ch.codePointAt(0);
      const hit = SUSPECT.find(([c]) => c === code);
      if (hit) {
        problems.push(
          `${relative(ROOT, file)}:${i + 1}  U+${code.toString(16).toUpperCase().padStart(4, "0")} (${hit[1]})  ${line.trim().slice(0, 90)}`
        );
        return;
      }
    }
  });
}

if (problems.length === 0) {
  console.log("OK  tidak ada karakter rusak terdeteksi.");
} else {
  console.log(`${problems.length} baris bermasalah:\n`);
  for (const p of problems) console.log("  " + p);
  process.exitCode = 1;
}
