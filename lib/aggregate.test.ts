import { test } from "node:test";
import assert from "node:assert/strict";

import {
  budgetStats,
  checklistStats,
  groupChecklistByCategory,
  guestStats,
  prepStats,
  sortChecklistItems,
  vendorStatusCounts,
} from "@/lib/aggregate";
import type {
  BudgetCategory,
  ChecklistItem,
  Expense,
  Guest,
  PrepItem,
  Vendor,
} from "@/types";

/**
 * Agregasi = satu sumber kebenaran angka untuk dashboard DAN modul. Kalau
 * di sini salah, user melihat angka yang berbeda antar halaman.
 */

function expense(partial: Partial<Expense> & { amount: number }): Expense {
  return {
    description: "",
    date: "2026-01-01",
    receiptUrl: "",
    ...partial,
  };
}

function item(
  partial: Partial<ChecklistItem> & { id: string }
): ChecklistItem {
  return {
    title: "",
    category: "Lain-lain",
    dueDate: "",
    isCompleted: false,
    createdAt: 0,
    ...partial,
  };
}

function category(
  partial: Partial<BudgetCategory> & { categoryName: string }
): BudgetCategory {
  return {
    id: partial.categoryName,
    allocatedAmount: 0,
    expenses: [],
    ...partial,
  };
}

test("checklistStats: hitung total, selesai, persen", () => {
  const stats = checklistStats([
    item({ id: "1", isCompleted: true }),
    item({ id: "2", isCompleted: true }),
    item({ id: "3", isCompleted: false }),
    item({ id: "4", isCompleted: false }),
  ]);
  assert.equal(stats.total, 4);
  assert.equal(stats.completed, 2);
  assert.equal(stats.percent, 50);
});

test("checklistStats: daftar kosong = 0 persen (anti NaN)", () => {
  const stats = checklistStats([]);
  assert.equal(stats.percent, 0);
  assert.equal(stats.total, 0);
});

test("budgetStats: alokasi & pengeluaran dijumlahkan, sisa = selisih", () => {
  const stats = budgetStats([
    category({
      categoryName: "Katering",
      allocatedAmount: 10_000_000,
      expenses: [expense({ description: "DP", amount: 2_000_000 })],
    }),
    category({
      categoryName: "Dekorasi",
      allocatedAmount: 5_000_000,
      expenses: [expense({ description: "X", amount: 1_000_000 })],
    }),
  ]);
  assert.equal(stats.allocated, 15_000_000);
  assert.equal(stats.spent, 3_000_000);
  assert.equal(stats.remaining, 12_000_000);
  assert.equal(stats.percent, 20);
  assert.equal(stats.level, "green");
});

test("budgetStats: over budget -> sisa negatif & level merah", () => {
  const stats = budgetStats([
    category({
      categoryName: "Katering",
      allocatedAmount: 1_000_000,
      expenses: [expense({ description: "Boros", amount: 1_500_000 })],
    }),
  ]);
  assert.equal(stats.remaining, -500_000);
  assert.equal(stats.level, "red");
  assert.equal(stats.percent, 100, "persen di-clamp 100 walau over");
});

test("budgetStats: alokasi 0 -> level null (FR-16 belum ada alokasi)", () => {
  const stats = budgetStats([
    category({
      categoryName: "Katering",
      allocatedAmount: 0,
      expenses: [expense({ amount: 500_000 })],
    }),
  ]);
  assert.equal(stats.level, null);
});

test("budgetStats: expenses rusak tidak bikin crash", () => {
  const broken = category({ categoryName: "X", allocatedAmount: 1_000_000 });
  broken.expenses = undefined as unknown as Expense[];
  const stats = budgetStats([broken]);
  assert.equal(stats.spent, 0);
});

function guest(
  partial: Partial<Guest> & { id: string; status: Guest["status"] }
): Guest {
  return {
    name: "",
    group: "Keluarga Pria",
    notes: "",
    createdAt: 0,
    ...partial,
  };
}

test("guestStats: estimasi = hadir + terkirim (menunggu jawaban)", () => {
  const stats = guestStats([
    guest({ id: "1", status: "hadir" }),
    guest({ id: "2", status: "hadir" }),
    guest({ id: "3", status: "terkirim" }),
    guest({ id: "4", status: "draft" }),
    guest({ id: "5", status: "tidak_hadir" }),
  ]);
  assert.equal(stats.total, 5);
  assert.equal(stats.attending, 2);
  assert.equal(stats.sent, 1);
  assert.equal(stats.draft, 1);
  assert.equal(stats.declined, 1);
  assert.equal(stats.estimated, 3, "2 hadir + 1 terkirim");
});

test("guestStats: draft & tidak hadir tidak masuk estimasi", () => {
  const stats = guestStats([
    guest({ id: "1", status: "draft" }),
    guest({ id: "2", status: "tidak_hadir" }),
  ]);
  assert.equal(stats.estimated, 0);
});

test("prepStats: pisahkan belum & sudah disiapkan", () => {
  const items: PrepItem[] = [
    {
      id: "1",
      name: "Souvenir",
      categoryName: "Souvenir",
      plannedAmount: 2_000_000,
      isDone: true,
      createdAt: 0,
    },
    {
      id: "2",
      name: "Seserahan",
      categoryName: "Souvenir",
      plannedAmount: 1_000_000,
      isDone: false,
      createdAt: 0,
    },
  ];
  const stats = prepStats(items);
  assert.equal(stats.total, 2);
  assert.equal(stats.done, 1);
  assert.equal(stats.plannedTotal, 3_000_000);
  assert.equal(stats.doneAmount, 2_000_000);
  assert.equal(stats.pendingAmount, 1_000_000);
});

test("sortChecklistItems: belum selesai di depan yang selesai", () => {
  const belum = item({ id: "a", title: "Z", dueDate: "2026-01-01" });
  const selesai = item({ id: "b", title: "A", isCompleted: true });
  assert.ok(sortChecklistItems(belum, selesai) < 0);
  assert.ok(sortChecklistItems(selesai, belum) > 0);
});

test("sortChecklistItems: tanpa due date di belakang, lalu judul alfabetis", () => {
  const tanpaTanggal = item({ id: "a", title: "B", dueDate: "" });
  const adaTanggal = item({ id: "b", title: "A", dueDate: "2026-01-01" });
  assert.ok(sortChecklistItems(tanpaTanggal, adaTanggal) > 0);

  const zulu = item({ id: "c", title: "Zulu", dueDate: "2026-01-01" });
  const alfa = item({ id: "d", title: "Alfa", dueDate: "2026-01-01" });
  assert.ok(sortChecklistItems(zulu, alfa) > 0);
});

test("groupChecklistByCategory: ikut urutan kategori, sisanya A-Z", () => {
  const groups = groupChecklistByCategory(
    [
      item({ id: "1", category: "Busana" }),
      item({ id: "2", category: "Legal/Dokumen" }),
      item({ id: "3", category: "Undangan" }),
    ],
    ["Legal/Dokumen", "Busana"]
  );
  assert.deepEqual(
    groups.map((group) => group.category),
    ["Legal/Dokumen", "Busana", "Undangan"]
  );
});

function vendor(
  partial: Partial<Vendor> & { id: string; status: Vendor["status"] }
): Vendor {
  return {
    name: "",
    category: "",
    contact: "",
    dealAmount: 0,
    paymentDeadline: "",
    notes: "",
    createdAt: 0,
    ...partial,
  };
}

test("vendorStatusCounts: semua status mulai dari 0", () => {
  const counts = vendorStatusCounts([]);
  assert.equal(counts.dihubungi, 0);
  assert.equal(counts.lunas, 0);
  assert.equal(counts.dp, 0);
});

test("vendorStatusCounts: menghitung per status, status ngawur diabaikan", () => {
  const counts = vendorStatusCounts([
    vendor({ id: "1", status: "lunas" }),
    vendor({ id: "2", status: "nego" }),
    vendor({ id: "3", status: "nego" }),
    vendor({ id: "4", status: "tidak-ada" as Vendor["status"] }),
  ]);
  assert.equal(counts.lunas, 1);
  assert.equal(counts.nego, 2);
  assert.equal(counts.deal, 0);
});
