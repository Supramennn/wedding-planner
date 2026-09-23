import { Badge, type BadgeTone } from "@/components/ui/badge";
import { daysUntil, formatDateID } from "@/lib/format";

/**
 * Highlight deadline pembayaran (FR-19):
 * badge khusus untuk H-7, H-3, H-1 — dengan eskala warna
 * merah (≤1 hari), kuning (≤3 hari), rose (≤7 hari).
 */
export function deadlineBadge(
  isoDate: string
): { tone: BadgeTone; label: string } | null {
  if (!isoDate) return null;
  const days = daysUntil(isoDate);
  if (days === null) return null;

  if (days < 0) return { tone: "red", label: "Terlambat" };
  if (days === 0) return { tone: "red", label: "Hari ini" };
  if (days <= 1) return { tone: "red", label: "H-1" };
  if (days <= 3) return { tone: "amber", label: `H-${days}` };
  if (days <= 7) return { tone: "rose", label: `H-${days}` };
  return null;
}

/** Badge + tanggal deadline (dipakai list & timeline). */
export function DeadlineBadge({ isoDate }: { isoDate: string }) {
  const badge = deadlineBadge(isoDate);

  if (!isoDate) {
    return <span className="text-xs text-neutral-400">Tanpa deadline</span>;
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
      {formatDateID(isoDate)}
      {badge && <Badge tone={badge.tone}>{badge.label}</Badge>}
    </span>
  );
}
