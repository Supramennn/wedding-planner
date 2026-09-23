import type { ReactNode } from "react";

/** Empty state standar (checklist kosong, budget belum diisi, vendor belum ada). */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white/60 px-6 py-10 text-center ${className}`}
    >
      {icon && <div className="mb-3 text-neutral-300">{icon}</div>}
      <p className="text-sm font-semibold text-neutral-800">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-neutral-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
