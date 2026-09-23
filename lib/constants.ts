/**
 * Konstanta bersama WedPlan — single source of truth untuk kategori & status.
 * Kategori dipakai bersama oleh Checklist (FR-08) dan Budget/Vendor,
 * supaya tidak ada duplikasi daftar kategori di banyak tempat.
 */

/** FR-08: kategori default checklist. */
export const CHECKLIST_CATEGORIES = [
  "Legal/Dokumen",
  "Venue",
  "Catering",
  "Dekorasi",
  "Busana",
  "Dokumentasi",
  "Undangan",
  "Hiburan",
  "Lain-lain",
] as const;

/** Kategori vendor memakai daftar kategori yang sama (satu sumber data). */
export const VENDOR_CATEGORIES = CHECKLIST_CATEGORIES;

/** FR-17: alur status vendor. */
export const VENDOR_STATUSES = [
  "dihubungi",
  "nego",
  "deal",
  "dp",
  "lunas",
] as const;

export const VENDOR_STATUS_LABELS: Record<
  (typeof VENDOR_STATUSES)[number],
  string
> = {
  dihubungi: "Dihubungi",
  nego: "Nego",
  deal: "Deal",
  dp: "DP",
  lunas: "Lunas",
};

/** FR-16: indikator warna budget berdasarkan rasio terpakai. */
export type BudgetLevel = "green" | "yellow" | "red";

export const BUDGET_THRESHOLDS = {
  /** < 70% terpakai = hijau */
  green: 0.7,
  /** 70–99% terpakai = kuning; >= 100% = merah */
  yellow: 1,
} as const;

/** Hitung level warna budget dari rasio terpakai (spent / allocated). */
export function getBudgetLevel(spentRatio: number): BudgetLevel {
  if (spentRatio >= BUDGET_THRESHOLDS.yellow) return "red";
  if (spentRatio >= BUDGET_THRESHOLDS.green) return "yellow";
  return "green";
}
