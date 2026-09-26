import { test } from "node:test";
import assert from "node:assert/strict";

import {
  formatDateID,
  formatIDR,
  formatIDRCompact,
  parseAmount,
  toISODate,
  toPercent,
  daysUntil,
} from "@/lib/format";

/**
 * Test logika format. Fokus: input yang rusak dari user (string, "", null,
 * angka aneh) tidak boleh menghasilkan NaN/undefined yang bocor ke UI.
 */

/**
 * `Intl` untuk id-ID menyisipkan non-breaking space (U+00A0) di antara
 * "Rp" dan angka. Bandingkan setelah dinormalisasi supaya assertion tidak
 * rapuh terhadap detail ICU.
 */
function normalizeSpaces(value: string): string {
  return value.replace(/[\u00a0\u202f]/g, " ");
}

test("formatIDR: format Rupiah dengan pemisah ribuan", () => {
  assert.equal(normalizeSpaces(formatIDR(150000000)), "Rp 150.000.000");
  assert.equal(normalizeSpaces(formatIDR(0)), "Rp 0");
});

test("formatIDR: input tidak valid menjadi 0, bukan NaN", () => {
  assert.equal(normalizeSpaces(formatIDR(Number.NaN)), "Rp 0");
  assert.equal(normalizeSpaces(formatIDR(Number.POSITIVE_INFINITY)), "Rp 0");
  assert.equal(formatIDR(Number.NaN).includes("NaN"), false);
});

test("formatIDRCompact: ringkas untuk sumbu chart", () => {
  const out = formatIDRCompact(1500000);
  // id-ID memakai "J" untuk juta atau "M" untuk miliar, tergantung ICU.
  assert.match(normalizeSpaces(out), /1[.,]5\s*[JM]/i);
});

test("formatDateID: string kosong & tanggal rusak -> \"-\"", () => {
  assert.equal(formatDateID(""), "-");
  assert.equal(formatDateID("bukan-tanggal"), "-");
});

test("formatDateID: tanggal valid diformat Indonesia", () => {
  assert.equal(formatDateID("2026-09-23"), "23 Sep 2026");
  const long = formatDateID("2026-09-23", "long");
  assert.match(long, /2026/);
  assert.match(long, /September/);
});

test("toISODate: format YYYY-MM-DD dengan padding", () => {
  // constructing local date to avoid TZ shift
  assert.equal(toISODate(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(toISODate(new Date(2026, 11, 31)), "2026-12-31");
});

test("toPercent: 0 total -> 0 (anti divide-by-zero)", () => {
  assert.equal(toPercent(5, 0), 0);
  assert.equal(toPercent(0, 0), 0);
});

test("toPercent: persentase dibulatkan & di-clamp 0..100", () => {
  assert.equal(toPercent(1, 3), 33);
  assert.equal(toPercent(2, 3), 67);
  assert.equal(toPercent(1, 2), 50);
  assert.equal(toPercent(999, 100), 100, "clamp atas 100");
  assert.equal(toPercent(-5, 100), 0, "clamp bawah 0");
});

test("parseAmount: bersihkan semua non-digit", () => {
  assert.equal(parseAmount("1500000"), 1500000);
  assert.equal(parseAmount("1.500.000"), 1500000);
  assert.equal(parseAmount("Rp 2.500.000"), 2500000);
  assert.equal(parseAmount("abc"), 0);
  assert.equal(parseAmount(""), 0);
});

test("daysUntil: string kosong & rusak -> null", () => {
  assert.equal(daysUntil(""), null);
  assert.equal(daysUntil("bukan-tanggal"), null);
});

test("daysUntil: hari-H = 0, besok = 1, kemarin = -1", () => {
  const now = new Date();
  const today = toISODate(now);
  const tomorrow = toISODate(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  );
  const yesterday = toISODate(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  );

  assert.equal(daysUntil(today), 0);
  assert.equal(daysUntil(tomorrow), 1);
  assert.equal(daysUntil(yesterday), -1);
});
