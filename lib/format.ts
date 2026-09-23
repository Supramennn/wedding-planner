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

/** 23 Sep 2026, atau "23 Oktober 2026" bila style = "long". */
export function formatDateID(
  isoDate: string,
  style: "short" | "long" = "short"
): string {
  if (!isoDate) return "-";
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: style === "long" ? "long" : "short",
    year: "numeric",
  }).format(date);
}

/** Date -> "YYYY-MM-DD" (untuk input date & penyimpanan Firestore). */
export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
