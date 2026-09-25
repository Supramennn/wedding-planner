import { getBudgetLevel, VENDOR_STATUSES, type BudgetLevel } from "@/lib/constants";
import { toPercent } from "@/lib/format";
import type {
  BudgetCategory,
  ChecklistItem,
  Guest,
  PrepItem,
  Vendor,
  VendorStatus,
} from "@/types";

/**
 * Agregasi data — dipakai dashboard DAN modul masing-masing,
 * supaya angka yang tampil selalu konsisten (single source of truth).
 */

export interface ChecklistStats {
  total: number;
  completed: number;
  /** FR-05: % keseluruhan */
  percent: number;
}

export function checklistStats(items: ChecklistItem[]): ChecklistStats {
  const total = items.length;
  const completed = items.filter((item) => item.isCompleted).length;
  return { total, completed, percent: toPercent(completed, total) };
}

export interface BudgetStats {
  /** Total alokasi semua kategori (FR-06). */
  allocated: number;
  /** Total pengeluaran aktual. */
  spent: number;
  /** Sisa (bisa negatif = over budget). */
  remaining: number;
  percent: number;
  /** FR-16: null bila belum ada alokasi sama sekali. */
  level: BudgetLevel | null;
}

export function budgetStats(categories: BudgetCategory[]): BudgetStats {
  const safeCategories = Array.isArray(categories) ? categories : [];
  const allocated = safeCategories.reduce(
    (sum, category) => sum + (Number(category.allocatedAmount) || 0),
    0
  );
  const spent = safeCategories.reduce((sum, category) => {
    const expenses = Array.isArray(category.expenses) ? category.expenses : [];
    return sum + expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  }, 0);

  return {
    allocated,
    spent,
    remaining: allocated - spent,
    percent: toPercent(spent, allocated),
    level: allocated > 0 ? getBudgetLevel(spent / allocated) : null,
  };
}

/** FR-07: jumlah vendor per status (dihubungi/nego/deal/dp/lunas). */
export function vendorStatusCounts(
  vendors: Vendor[]
): Record<VendorStatus, number> {
  const counts = Object.fromEntries(
    VENDOR_STATUSES.map((status) => [status, 0])
  ) as Record<VendorStatus, number>;

  for (const vendor of Array.isArray(vendors) ? vendors : []) {
    if (vendor.status in counts) {
      counts[vendor.status as VendorStatus] += 1;
    }
  }

  return counts;
}

/**
 * Estimasi jumlah tamu undangan (halaman Tamu).
 * `estimated` = yang sudah konfirmasi hadir + undangan terkirim yang belum
 * menjawab (diasumsikan masih akan hadir); "belum dikirim" & "tidak hadir"
 * tidak dihitung sebagai estimasi hadir.
 */
export interface GuestStats {
  /** Total entri di daftar tamu. */
  total: number;
  /** Status draft — undangan belum dikirim. */
  draft: number;
  /** Terkirim — menunggu jawaban. */
  sent: number;
  /** Konfirmasi hadir. */
  attending: number;
  /** Tidak hadir. */
  declined: number;
  /** Estimasi jumlah yang akan hadir (attending + sent). */
  estimated: number;
}

export function guestStats(guests: Guest[]): GuestStats {
  const safe = Array.isArray(guests) ? guests : [];
  const count = (status: Guest["status"]) =>
    safe.filter((guest) => guest.status === status).length;

  const attending = count("hadir");
  const sent = count("terkirim");
  return {
    total: safe.length,
    draft: count("draft"),
    sent,
    attending,
    declined: count("tidak_hadir"),
    estimated: attending + sent,
  };
}

/** Estimasi biaya item persiapan (modul Budget). */
export interface PrepStats {
  total: number;
  done: number;
  /** Total estimasi seluruh item. */
  plannedTotal: number;
  /** Estimasi item yang BELUM disiapkan. */
  pendingAmount: number;
  /** Estimasi item yang sudah disiapkan. */
  doneAmount: number;
}

export function prepStats(items: PrepItem[]): PrepStats {
  const safe = Array.isArray(items) ? items : [];
  const amount = (item: PrepItem) => Number(item.plannedAmount) || 0;
  const doneItems = safe.filter((item) => item.isDone);
  const pendingItems = safe.filter((item) => !item.isDone);
  const doneAmount = doneItems.reduce((sum, item) => sum + amount(item), 0);

  return {
    total: safe.length,
    done: doneItems.length,
    plannedTotal: safe.reduce((sum, item) => sum + amount(item), 0),
    pendingAmount: pendingItems.reduce((sum, item) => sum + amount(item), 0),
    doneAmount,
  };
}

/** Urut item checklist: belum selesai dulu, lalu due date, lalu judul. */
export function sortChecklistItems(a: ChecklistItem, b: ChecklistItem): number {
  if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
  if (a.dueDate !== b.dueDate) {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  }
  return a.title.localeCompare(b.title);
}

/**
 * Kelompokkan item checklist per kategori: urut sesuai `categoryOrder`
 * (default nikah / kategori lamaran), kategori di luar daftar menyusul A–Z.
 */
export function groupChecklistByCategory(
  items: ChecklistItem[],
  categoryOrder: readonly string[]
): Array<{ category: string; items: ChecklistItem[] }> {
  const map = new Map<string, ChecklistItem[]>();
  for (const item of items) {
    const key = item.category || "Lain-lain";
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }

  const defaultKeys = categoryOrder.filter((key) => map.has(key));
  const extraKeys = Array.from(map.keys())
    .filter((key) => !categoryOrder.includes(key))
    .sort();

  return [...defaultKeys, ...extraKeys].map((category) => ({
    category,
    items: (map.get(category) ?? []).sort(sortChecklistItems),
  }));
}
