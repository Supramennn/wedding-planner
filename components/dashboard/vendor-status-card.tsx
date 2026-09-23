"use client";

import { useAuth } from "@/lib/hooks/auth-context";
import { useCollection } from "@/lib/hooks/use-collection";
import { vendorsPath } from "@/lib/collection-paths";
import { vendorStatusCounts } from "@/lib/aggregate";
import {
  VENDOR_STATUSES,
  VENDOR_STATUS_LABELS,
  VENDOR_STATUS_TONES,
} from "@/lib/constants";
import type { Vendor } from "@/types";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/skeleton";

/** FR-07: jumlah vendor per status (dihubungi/nego/deal/dp/lunas). */
export function VendorStatusCard() {
  const { wedding } = useAuth();
  const { items, loading, error } = useCollection<Vendor>(
    wedding ? vendorsPath(wedding.id) : null,
    { orderBy: { field: "createdAt" } }
  );

  if (loading) return <CardSkeleton lines={3} />;

  const counts = vendorStatusCounts(items);

  return (
    <Card>
      <CardTitle>Status vendor</CardTitle>

      {error ? (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      ) : items.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            title="Belum ada vendor"
            description="Catat vendor yang sudah kamu hubungi beserta statusnya."
          />
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {VENDOR_STATUSES.map((status) => (
            <li
              key={status}
              className="flex items-center justify-between gap-2 rounded-xl border border-neutral-200 px-3 py-2"
            >
              <Badge tone={VENDOR_STATUS_TONES[status]}>
                {VENDOR_STATUS_LABELS[status]}
              </Badge>
              <span className="text-sm font-semibold tabular-nums text-neutral-900">
                {counts[status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
