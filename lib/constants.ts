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

/**
 * Kategori checklist ENGAGEMENT (persiapan lamaran) — terpisah dari
 * persiapan nikah agar kedua rangkaian acara tidak tercampur (menu "Lamaran").
 */
export const ENGAGEMENT_CATEGORIES = [
  "Cincin & Mahar",
  "Keluarga & Adat",
  "Acara & Venue",
  "Dokumentasi",
  "Busana & Penampilan",
  "Lain-lain",
] as const;

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

/** Kelompok tamu undangan — dasar estimasi jumlah per segmen undangan. */
export const GUEST_GROUPS = [
  "Keluarga Pria",
  "Keluarga Wanita",
  "Teman Pria",
  "Teman Wanita",
  "Rekan Kerja",
  "Lainnya",
] as const;

/** Status undangan/kehadiran per tamu (alur: draft → terkirim → hadir/tidak). */
export const GUEST_STATUSES = [
  "draft",
  "terkirim",
  "hadir",
  "tidak_hadir",
] as const;

export const GUEST_STATUS_LABELS: Record<
  (typeof GUEST_STATUSES)[number],
  string
> = {
  draft: "Belum dikirim",
  terkirim: "Terkirim",
  hadir: "Hadir",
  tidak_hadir: "Tidak hadir",
};

/** Warna badge status tamu (daftar tamu & estimasi kehadiran). */
export const GUEST_STATUS_TONES = {
  draft: "neutral",
  terkirim: "sky",
  hadir: "emerald",
  tidak_hadir: "amber",
} as const satisfies Record<(typeof GUEST_STATUSES)[number], string>;

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

/** Warna badge per status vendor (dipakai dashboard & timeline). */
export const VENDOR_STATUS_TONES = {
  dihubungi: "neutral",
  nego: "amber",
  deal: "sky",
  dp: "violet",
  lunas: "emerald",
} as const satisfies Record<(typeof VENDOR_STATUSES)[number], string>;

/** Pesan indikator warna budget (FR-16) — dipakai dashboard & modul budget. */
export const BUDGET_LEVEL_MESSAGES: Record<BudgetLevel, string> = {
  green: "Masih aman — terpakai di bawah 70%.",
  yellow: "Hati-hati — sudah terpakai 70% atau lebih.",
  red: "Over budget — pengeluaran sudah ≥ 100% alokasi.",
};
