"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/lib/hooks/auth-context";
import { useCollection } from "@/lib/hooks/use-collection";
import { budgetPath } from "@/lib/collection-paths";
import { budgetStats } from "@/lib/aggregate";
import {
  BUDGET_LEVEL_MESSAGES,
  CHECKLIST_CATEGORIES,
  getBudgetLevel,
} from "@/lib/constants";
import { formatDateID, formatIDR, toPercent } from "@/lib/format";
import { deleteExpense } from "@/lib/budget-service";
import type { BudgetCategory, Expense } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { ProgressBar } from "@/components/ui/progress-bar";
import { CardSkeleton } from "@/components/ui/skeleton";
import { AllocationForm } from "@/components/budget/allocation-form";
import { BudgetChart } from "@/components/budget/budget-chart";
import { ExpenseForm } from "@/components/budget/expense-form";
import { TotalBudgetForm } from "@/components/budget/total-budget-form";

type AllocationTarget = { categoryName: string; current: number };
type ExpenseTarget =
  | { mode: "add" }
  | { mode: "edit"; categoryName: string; index: number; expense: Expense };
type DeleteTarget = {
  categoryName: string;
  index: number;
  expense: Expense;
};

const ACTION_ERROR =
  "Gagal menyimpan perubahan. Periksa koneksi internet Anda.";

const LEVEL_BADGE_LABEL = {
  green: "Aman",
  yellow: "Hati-hati",
  red: "Over budget",
} as const;

/** Modul Budget Tracker (FR-12 s/d FR-16). */
export function BudgetView() {
  const { user, profile, loading: authLoading, profileLoading } = useAuth();
  const {
    items: categories,
    loading: budgetLoading,
    error,
  } = useCollection<BudgetCategory>(user ? budgetPath(user.uid) : null);

  const [totalOpen, setTotalOpen] = useState(false);
  const [allocationTarget, setAllocationTarget] =
    useState<AllocationTarget | null>(null);
  const [expenseTarget, setExpenseTarget] = useState<ExpenseTarget | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const totalBudget = profile?.totalBudget ?? 0;
  const stats = useMemo(() => budgetStats(categories), [categories]);

  /** Baris alokasi: 9 kategori default + kategori lain yang sudah ada datanya. */
  const allocationRows = useMemo(() => {
    const byName = new Map(
      categories.map((category) => [category.categoryName, category])
    );
    const names = Array.from(
      new Set([
        ...CHECKLIST_CATEGORIES,
        ...categories.map((category) => category.categoryName),
      ])
    );

    return names.map((name) => {
      const doc = byName.get(name) ?? null;
      const allocated = Number(doc?.allocatedAmount) || 0;
      const spent = doc ? budgetStats([doc]).spent : 0;
      return {
        name,
        allocated,
        spent,
        level: allocated > 0 ? getBudgetLevel(spent / allocated) : null,
      };
    });
  }, [categories]);

  /** Daftar pengeluaran lintas kategori, terbaru di atas. */
  const expenseRows = useMemo(
    () =>
      categories
        .flatMap((category) =>
          (Array.isArray(category.expenses) ? category.expenses : []).map(
            (expense, index) => ({
              expense,
              categoryName: category.categoryName,
              index,
            })
          )
        )
        .sort((a, b) => b.expense.date.localeCompare(a.expense.date)),
    [categories]
  );

  async function runAction(key: string, action: () => Promise<void>) {
    setActionError(null);
    setBusyKey(key);
    try {
      await action();
    } catch {
      setActionError(ACTION_ERROR);
    } finally {
      setBusyKey(null);
    }
  }

  if (authLoading || profileLoading || budgetLoading) {
    return (
      <div className="space-y-4">
        <CardSkeleton lines={3} />
        <CardSkeleton lines={5} />
        <CardSkeleton lines={4} />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      </Card>
    );
  }

  const unallocated = totalBudget > 0 ? totalBudget - stats.allocated : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">
            Budget Tracker
          </h1>
          <p className="text-sm text-neutral-500">
            Alokasi, pengeluaran, dan sisa budget pernikahanmu.
          </p>
        </div>
        <Button
          size="md"
          onClick={() => setExpenseTarget({ mode: "add" })}
          disabled={!user}
        >
          + Catat pengeluaran
        </Button>
      </div>

      {actionError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {actionError}
        </div>
      )}

      {/* FR-12: total budget, bisa diedit kapan saja */}
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Total budget</CardTitle>
            {totalBudget > 0 && (
              <p className="mt-2 text-3xl font-semibold tabular-nums text-neutral-900">
                {formatIDR(totalBudget)}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTotalOpen(true)}
            disabled={!user}
          >
            {totalBudget > 0 ? "Ubah total" : "Atur total"}
          </Button>
        </div>

        {totalBudget > 0 ? (
          <div className="mt-4">
            <ProgressBar
              value={toPercent(stats.allocated, totalBudget)}
              label="Sudah dialokasikan"
            />
            <p className="mt-2 text-sm text-neutral-500">
              Dialokasikan {formatIDR(stats.allocated)} ·{" "}
              {unallocated > 0
                ? `Belum dialokasikan ${formatIDR(unallocated)}`
                : stats.allocated > totalBudget
                  ? `Alokasi melebihi total ${formatIDR(stats.allocated - totalBudget)}`
                  : "Seluruh total sudah dialokasikan"}
            </p>
          </div>
        ) : (
          <div className="mt-3">
            <EmptyState
              title="Total budget belum ditetapkan"
              description="Tetapkan total budget agar bisa mengalokasikan per kategori (nominal atau persen)."
              action={
                <Button onClick={() => setTotalOpen(true)}>
                  Tentukan total budget
                </Button>
              }
            />
          </div>
        )}
      </Card>

      {/* Ringkasan terpakai vs alokasi (FR-06 + indikator warna FR-16) */}
      {stats.allocated > 0 && (
        <Card>
          <CardTitle>Terpakai vs alokasi</CardTitle>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900">
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
            label="Persentase terpakai"
          />
          {stats.level && (
            <p
              className={`mt-3 text-sm font-medium ${
                stats.level === "red"
                  ? "text-red-600"
                  : stats.level === "yellow"
                    ? "text-amber-600"
                    : "text-emerald-600"
              }`}
            >
              {BUDGET_LEVEL_MESSAGES[stats.level]}
            </p>
          )}
          <p className="mt-1 text-sm text-neutral-500">
            Sisa:{" "}
            <span className="font-medium tabular-nums text-neutral-700">
              {formatIDR(stats.remaining)}
            </span>
          </p>
        </Card>
      )}

      {/* FR-15: chart alokasi vs realisasi */}
      <Card>
        <CardTitle>Alokasi vs realisasi</CardTitle>
        <CardDescription>Per kategori, dalam Rupiah.</CardDescription>
        <div className="mt-4">
          {categories.some(
            (category) =>
              (Number(category.allocatedAmount) || 0) > 0 ||
              budgetStats([category]).spent > 0
          ) ? (
            <BudgetChart categories={categories} />
          ) : (
            <EmptyState
              title="Belum ada data chart"
              description="Chart muncul setelah kamu mengalokasikan budget atau mencatat pengeluaran."
            />
          )}
        </div>
      </Card>

      {/* FR-13: alokasi per kategori (nominal atau persentase) */}
      <Card>
        <CardTitle>Alokasi per kategori</CardTitle>
        <CardDescription>
          Isi nominal langsung atau persentase dari total budget.
        </CardDescription>
        <ul className="mt-3 divide-y divide-neutral-100">
          {allocationRows.map((row) => (
            <li key={row.name} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-neutral-800">
                      {row.name}
                    </p>
                    {row.level && (
                      <Badge tone={row.level}>
                        {LEVEL_BADGE_LABEL[row.level]}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Alokasi {formatIDR(row.allocated)}
                    {totalBudget > 0 &&
                      ` (${toPercent(row.allocated, totalBudget)}%)`}{" "}
                    · Terpakai {formatIDR(row.spent)}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {row.allocated === 0
                      ? "Belum dialokasikan"
                      : row.spent > row.allocated
                        ? `Lebih ${formatIDR(row.spent - row.allocated)}`
                        : `Sisa ${formatIDR(row.allocated - row.spent)}`}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!user}
                  onClick={() =>
                    setAllocationTarget({
                      categoryName: row.name,
                      current: row.allocated,
                    })
                  }
                >
                  Atur
                </Button>
              </div>

              {row.allocated > 0 && (
                <ProgressBar
                  className="mt-2"
                  value={toPercent(row.spent, row.allocated)}
                  tone={row.level ?? "default"}
                  showValue={false}
                />
              )}
            </li>
          ))}
        </ul>
      </Card>

      {/* FR-14: daftar pengeluaran */}
      <Card>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Pengeluaran</CardTitle>
          <span className="text-xs text-neutral-500">
            {expenseRows.length} transaksi
          </span>
        </div>

        {expenseRows.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="Belum ada pengeluaran"
              description="Catat pengeluaran pertama beserta struknya (opsional)."
              action={
                <Button
                  onClick={() => setExpenseTarget({ mode: "add" })}
                  disabled={!user}
                >
                  Catat pengeluaran
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-neutral-100">
            {expenseRows.map((row) => {
              const key = `${row.categoryName}-${row.index}`;
              return (
                <li key={key} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-neutral-800">
                      {row.expense.description}
                    </p>
                    <p className="text-sm font-semibold tabular-nums text-neutral-900">
                      {formatIDR(row.expense.amount)}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                      <Badge tone="rose">{row.categoryName}</Badge>
                      <span>{formatDateID(row.expense.date)}</span>
                      {row.expense.receiptUrl && (
                        <a
                          href={row.expense.receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-rose-600 hover:underline"
                        >
                          Lihat struk
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() =>
                        setExpenseTarget({
                          mode: "edit",
                          categoryName: row.categoryName,
                          index: row.index,
                          expense: row.expense,
                        })
                      }
                    >
                      Ubah
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() =>
                        setDeleteTarget({
                          categoryName: row.categoryName,
                          index: row.index,
                          expense: row.expense,
                        })
                      }
                    >
                      Hapus
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Modal total budget (FR-12) */}
      <Modal
        open={totalOpen}
        onClose={() => setTotalOpen(false)}
        title="Total budget pernikahan"
      >
        {totalOpen && user && (
          <TotalBudgetForm
            key={totalBudget}
            uid={user.uid}
            current={totalBudget}
            onClose={() => setTotalOpen(false)}
          />
        )}
      </Modal>

      {/* Modal alokasi kategori (FR-13) */}
      <Modal
        open={allocationTarget !== null}
        onClose={() => setAllocationTarget(null)}
        title="Atur alokasi kategori"
      >
        {allocationTarget && user && (
          <AllocationForm
            key={allocationTarget.categoryName}
            uid={user.uid}
            totalBudget={totalBudget}
            categoryName={allocationTarget.categoryName}
            current={allocationTarget.current}
            onClose={() => setAllocationTarget(null)}
          />
        )}
      </Modal>

      {/* Modal pengeluaran (FR-14) */}
      <Modal
        open={expenseTarget !== null}
        onClose={() => setExpenseTarget(null)}
        title={
          expenseTarget?.mode === "edit"
            ? "Ubah pengeluaran"
            : "Catat pengeluaran"
        }
      >
        {expenseTarget && user && (
          <ExpenseForm
            key={
              expenseTarget.mode === "edit"
                ? `edit-${expenseTarget.categoryName}-${expenseTarget.index}`
                : "add"
            }
            uid={user.uid}
            mode={expenseTarget.mode}
            expense={expenseTarget.mode === "edit" ? expenseTarget.expense : null}
            initialCategoryName={
              expenseTarget.mode === "edit"
                ? expenseTarget.categoryName
                : CHECKLIST_CATEGORIES[0]
            }
            categoryLocked={expenseTarget.mode === "edit"}
            index={
              expenseTarget.mode === "edit" ? expenseTarget.index : undefined
            }
            onClose={() => setExpenseTarget(null)}
          />
        )}
      </Modal>

      {/* Modal konfirmasi hapus pengeluaran */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Hapus pengeluaran?"
      >
        <p className="text-sm text-neutral-600">
          Pengeluaran{" "}
          <span className="font-medium text-neutral-900">
            {deleteTarget?.expense.description}
          </span>{" "}
          ({formatIDR(deleteTarget?.expense.amount ?? 0)}) beserta struknya
          akan dihapus permanen.
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" size="lg" onClick={() => setDeleteTarget(null)}>
            Batal
          </Button>
          <Button
            variant="danger"
            size="lg"
            loading={busyKey === (deleteTarget ? `${deleteTarget.categoryName}-${deleteTarget.index}` : null)}
            onClick={() =>
              user &&
              deleteTarget &&
              runAction(
                `${deleteTarget.categoryName}-${deleteTarget.index}`,
                async () => {
                  await deleteExpense(
                    user.uid,
                    deleteTarget.categoryName,
                    deleteTarget.index
                  );
                  setDeleteTarget(null);
                }
              )
            }
          >
            Hapus
          </Button>
        </div>
      </Modal>
    </div>
  );
}
