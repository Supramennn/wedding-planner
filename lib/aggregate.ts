import { getBudgetLevel, VENDOR_STATUSES, type BudgetLevel } from "@/lib/constants";
import { toPercent } from "@/lib/format";
import type { BudgetCategory, ChecklistItem, Vendor, VendorStatus } from "@/types";

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
