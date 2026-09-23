"use client";

import { useAuth } from "@/lib/hooks/auth-context";
import { useCollection } from "@/lib/hooks/use-collection";
import { budgetPath } from "@/lib/collection-paths";
import { budgetStats } from "@/lib/aggregate";
import { BUDGET_LEVEL_MESSAGES } from "@/lib/constants";
import { formatIDR } from "@/lib/format";
import type { BudgetCategory } from "@/types";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { CardSkeleton } from "@/components/ui/skeleton";

/** FR-06: total budget terpakai vs alokasi (dengan indikator warna, FR-16). */
export function BudgetSummaryCard() {
  const { user } = useAuth();
  const { items, loading, error } = useCollection<BudgetCategory>(
    user ? budgetPath(user.uid) : null
  );

  if (loading) return <CardSkeleton lines={3} />;

  const stats = budgetStats(items);
  const hasBudget = items.length > 0 && stats.allocated > 0;

  return (
    <Card>
      <CardTitle>Budget</CardTitle>

      {error ? (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      ) : !hasBudget ? (
        <div className="mt-3">
          <EmptyState
            title="Budget belum diisi"
            description="Tentukan total budget lalu alokasikan per kategori."
          />
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-2xl font-semibold tabular-nums text-neutral-900">
            {formatIDR(stats.spent)}
            <span className="text-sm font-normal text-neutral-400">
              {" "}
              / {formatIDR(stats.allocated)}
            </span>
          </p>
          <ProgressBar
            className="mt-3"
            value={stats.percent}
            tone={stats.level ?? "default"}
            label="Terpakai"
          />
          <p
            className={`mt-3 text-sm font-medium ${
              stats.level === "red"
                ? "text-red-600"
                : stats.level === "yellow"
                  ? "text-amber-600"
                  : "text-emerald-600"
            }`}
          >
            {stats.level ? BUDGET_LEVEL_MESSAGES[stats.level] : ""}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Sisa:{" "}
            <span className="font-medium tabular-nums text-neutral-700">
              {formatIDR(stats.remaining)}
            </span>
          </p>
        </div>
      )}
    </Card>
  );
}
