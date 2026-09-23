"use client";

import Link from "next/link";
import { useAuth } from "@/lib/hooks/auth-context";
import { coupleLabel } from "@/lib/wedding-service";
import { daysUntil, formatDateID } from "@/lib/format";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

/** FR-04: countdown ke hari-H (dalam hari). */
export function CountdownCard() {
  const { profile, wedding, loading, profileLoading, weddingLoading } =
    useAuth();

  if (loading || profileLoading || weddingLoading) {
    return (
      <Card>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-4 h-10 w-24" />
        <Skeleton className="mt-3 h-3 w-40" />
      </Card>
    );
  }

  const weddingDate = wedding?.weddingDate ?? profile?.weddingDate ?? "";
  const venue = wedding?.venue ?? profile?.venue ?? "";
  const days = daysUntil(weddingDate);

  return (
    <Card>
      <CardTitle>Hari menuju hari-H</CardTitle>

      {days === null ? (
        <div className="mt-3">
          <EmptyState
            title="Tanggal belum diatur"
            description="Atur tanggal pernikahanmu untuk melihat countdown."
            action={
              <Link
                href="/settings"
                className="text-sm font-medium text-rose-600 hover:underline"
              >
                Atur di Pengaturan
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-4xl font-semibold tabular-nums text-rose-600">
            {days > 0 ? days : Math.abs(days)}
            <span className="ml-2 text-sm font-medium text-neutral-500">
              {days > 0
                ? "hari lagi"
                : days === 0
                  ? "hari ini hari-H!"
                  : "hari sejak hari-H"}
            </span>
          </p>
          <p className="mt-2 text-sm text-neutral-600">
            {formatDateID(weddingDate, "long")}
          </p>
          <p className="text-sm text-neutral-500">
            {coupleLabel(wedding, profile)}
            {venue ? ` · ${venue}` : ""}
          </p>
        </div>
      )}
    </Card>
  );
}
