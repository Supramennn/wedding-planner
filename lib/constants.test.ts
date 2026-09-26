import { test } from "node:test";
import assert from "node:assert/strict";

import {
  BUDGET_LEVEL_MESSAGES,
  BUDGET_THRESHOLDS,
  getBudgetLevel,
  type BudgetLevel,
} from "@/lib/constants";

/**
 * FR-16 menetapkan angka persis: hijau di bawah 70%, kuning 70-99%, merah
 * 100% ke atas. Angka ini menentukan warna di seluruh modul budget, jadi
 * ambangnya diuji langsung, bukan hanya implementasi-colored.
 */
test("getBudgetLevel: di bawah 70% = hijau", () => {
  assert.equal(getBudgetLevel(0), "green");
  assert.equal(getBudgetLevel(0.5), "green");
  assert.equal(getBudgetLevel(0.69), "green");
});

test("getBudgetLevel: tepat 70% = kuning", () => {
  assert.equal(getBudgetLevel(0.7), "yellow");
  assert.equal(BUDGET_THRESHOLDS.green, 0.7);
});

test("getBudgetLevel: 70-99% = kuning", () => {
  assert.equal(getBudgetLevel(0.85), "yellow");
  assert.equal(getBudgetLevel(0.99), "yellow");
});

test("getBudgetLevel: tepat 100% dan lebih = merah", () => {
  assert.equal(getBudgetLevel(1), "red");
  assert.equal(getBudgetLevel(1.5), "red");
  assert.equal(BUDGET_THRESHOLDS.yellow, 1);
});

test("setiap level punya pesan (tidak ada level tanpa teks)", () => {
  const levels: BudgetLevel[] = ["green", "yellow", "red"];
  for (const level of levels) {
    assert.ok(
      BUDGET_LEVEL_MESSAGES[level] && BUDGET_LEVEL_MESSAGES[level].length > 0,
      `pesan untuk ${level}`
    );
  }
});
