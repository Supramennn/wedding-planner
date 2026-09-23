const SIZE_CLASSES = {
  sm: "size-4",
  md: "size-6",
  lg: "size-10",
} as const;

/** Indikator loading standar. */
export function Spinner({
  size = "md",
  label,
  className = "",
}: {
  size?: keyof typeof SIZE_CLASSES;
  /** Label untuk screen reader (a11y). */
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-live={label ? "polite" : undefined}
    >
      <svg
        className={`animate-spin text-current ${SIZE_CLASSES[size]}`}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-90"
          fill="currentColor"
          d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
        />
      </svg>
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}

/** Layar loading penuh (guard rute, first load). */
export function FullScreenSpinner({ label = "Memuat…" }: { label?: string }) {
  return (
    <div className="flex min-h-[60svh] items-center justify-center text-neutral-400">
      <Spinner size="lg" label={label} />
    </div>
  );
}
