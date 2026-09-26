import { test } from "node:test";
import assert from "node:assert/strict";

import { categorySlug } from "@/lib/budget-service";

/**
 * `categorySlug` menentukan dokumen budget mana yang di-update. Kalau slug
 * berubah, dokumen budget yang sudah tertulis di Firestore akan terlantar,
 * jadi perilaku yang ada di sini DIKUNCI lewat test, bukan diperbaiki diam-diam.
 */

test("categorySlug: konsisten & deterministik", () => {
  assert.equal(categorySlug("Katering"), "katering");
  assert.equal(categorySlug("Katering"), categorySlug("Katering"));
});

test("categorySlug: huruf besar & spasi berlebih dirapikan", () => {
  assert.equal(categorySlug("  Katering  "), "katering");
  assert.equal(categorySlug("BUSANA"), "busana");
});

test("categorySlug: dua kata dipisah spasi menjadi dua bagian", () => {
  assert.equal(categorySlug("Legal Dokumen"), "legal-dokumen");
  assert.equal(categorySlug("Dekorasi Busana"), "dekorasi-busana");
});

test("categorySlug: simbol dihapus, sisa spasi jadi satu hyphen", () => {
  // "Legal/Dokumen": slash dihapus tanpa sisa spasi, dua kata menempel.
  assert.equal(categorySlug("Legal/Dokumen"), "legaldokumen");
  // "Dekorasi & Busana": ada spasi di sekeliling "&", tersisa satu spasi
  // setelah "&" dibuang, lalu jadi satu hyphen.
  assert.equal(categorySlug("Dekorasi & Busana"), "dekorasi-busana");
});

test("categorySlug: nama tanpa alnum dapat fallback, bukan id kosong", () => {
  // Document id kosong ditolak Firestore, jadi slug wajib selalu terisi.
  assert.equal(categorySlug("!!!"), "lain-lain");
  assert.equal(categorySlug(""), "lain-lain");
  assert.ok(categorySlug("&*@#").length > 0);
});
