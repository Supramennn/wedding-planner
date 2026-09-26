"use client";

import { useAuth } from "@/lib/hooks/auth-context";
import { useCollection } from "@/lib/hooks/use-collection";
import { checklistPath } from "@/lib/collection-paths";
import { checklistStats } from "@/lib/aggregate";
import type { ChecklistItem } from "@/types";
import { Card, CardTitle } from "@/components/ui/card";
import { AnimatedValue } from "@/components/ui/animated-value";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { CardSkeleton } from "@/components/ui/skeleton";

/** FR-05: % checklist selesai keseluruhan. */
export function ChecklistProgressCard() {
  const { workspaceUid } = useAuth();
  const { items, loading, error } = useCollection<ChecklistItem>(
    workspaceUid ? checklistPath(workspaceUid) : null,
    { orderBy: { field: "createdAt" } }
  );

  if (loading) return <CardSkeleton lines={3} />;

  // Filter tahap yang sama persis dengan halaman Checklist. Kalau tidak,
  // angka di dasbor bisa berbeda dengan angka di menu: 8 dari 12 di
  // Checklist tapi 14 dari 20 di sini.
  const weddingItems = items.filter((item) => item.phase !== "engagement");
  const stats = checklistStats(weddingItems);

  return (
    <Card>
      <CardTitle>Checklist persiapan</CardTitle>

      {error ? (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      ) : stats.total === 0 ? (
        <div className="mt-3">
          <EmptyState
            title="Belum ada tugas"
            description="Checklist default akan terisi setelah onboarding selesai."
          />
        </div>
      ) : (
        <div className="mt-4">
          <ProgressBar
            value={stats.percent}
            label={`${stats.completed} dari ${stats.total} tugas selesai`}
          />
          <p className="mt-3 text-sm text-neutral-500">
            <AnimatedValue
              value={stats.total - stats.completed}
              format={(value) => `${value} tugas masih harus dikerjakan.`}
            />
          </p>
        </div>
      )}
    </Card>
  );
}
