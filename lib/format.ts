/** Helper formatisasi (tanggal & mata uang) untuk seluruh app. */

const idrFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

/** Rp 150.000.000 */
export function formatIDR(amount: number): string {
  return idrFormatter.format(Number.isFinite(amount) ? amount : 0);
}

/** 23 Sep 2026 */
export function formatDateID(isoDate: string): string {
  if (!isoDate) return "-";
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Sisa hari menuju tanggal target (hari-H).
 * Negatif = tanggal sudah lewat. 0 = hari-H.
 */
export function daysUntil(isoDate: string): number | null {
  if (!isoDate) return null;
  const target = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** 75 (persen terpakai, dibulatkan) */
export function toPercent(used: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((used / total) * 100)));
}
