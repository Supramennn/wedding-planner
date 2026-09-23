import type { ReactNode } from "react";

/** Kartu container standar seluruh modul WedPlan. */
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}
    >
      {children}
    </div>
  );
}

/** Judul di dalam Card. */
export function CardTitle({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2 className={`text-base font-semibold text-neutral-900 ${className}`}>
      {children}
    </h2>
  );
}

/** Deskripsi kecil di dalam Card. */
export function CardDescription({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={`mt-1 text-sm text-neutral-500 ${className}`}>{children}</p>
  );
}
