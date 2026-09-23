const TONE_CLASSES = {
  default: "bg-rose-500",
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-red-500",
} as const;

/**
 * Progress bar reusable (FR-10 per kategori & total,
 * juga dipakai indikator budget FR-16).
 */
export function ProgressBar({
  value,
  label,
  showValue = true,
  tone = "default",
  className = "",
}: {
  /** 0–100 */
  value: number;
  label?: string;
  showValue?: boolean;
  tone?: keyof typeof TONE_CLASSES;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
          {label && <span className="text-neutral-600">{label}</span>}
          {showValue && (
            <span className="font-medium tabular-nums text-neutral-900">
              {clamped}%
            </span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progress"}
        className="h-2 w-full overflow-hidden rounded-full bg-neutral-200"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${TONE_CLASSES[tone]}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
