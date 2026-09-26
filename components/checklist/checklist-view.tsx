"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/lib/hooks/auth-context";
import { useCollection } from "@/lib/hooks/use-collection";
import { useOptimisticToggle } from "@/lib/hooks/use-optimistic-toggle";
import { checklistPath } from "@/lib/collection-paths";
import {
  checklistStats,
  groupChecklistByCategory,
} from "@/lib/aggregate";
import { CHECKLIST_CATEGORIES } from "@/lib/constants";
import { daysUntil, formatDateID } from "@/lib/format";
import { listItemVariants } from "@/lib/motion";
import {
  deleteChecklistItem,
  toggleChecklistItem,
} from "@/lib/checklist-service";
import type { ChecklistItem } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { ProgressBar } from "@/components/ui/progress-bar";
import { CardSkeleton } from "@/components/ui/skeleton";
import { ChecklistForm } from "@/components/checklist/checklist-form";

type FormTarget = { mode: "add"; item: null } | { mode: "edit"; item: ChecklistItem };

const ACTION_ERROR =
  "Gagal menyimpan perubahan. Periksa koneksi internet Anda.";

/** Modul Checklist Persiapan nikah (FR-08 s/d FR-11). */
export function ChecklistView() {
  const { workspaceUid } = useAuth();
  const { items, loading, error } = useCollection<ChecklistItem>(
    workspaceUid ? checklistPath(workspaceUid) : null,
    { orderBy: { field: "createdAt" } }
  );

  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ChecklistItem | null>(
    null
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Toggle.optimis: centang berubah seketika, lalu dilepas begitu snapshot
  // Firestore menyusul (atau dibatalkan kalau gagal simpan). Dashboard
  // angka dan progress memakai liveItems, jadi ikut berubah seketika.
  const { liveItems, toggle } = useOptimisticToggle(items, "isCompleted");

  // Pisahkan tahap: item engagement tampil di menu "Lamaran", bukan di sini.
  const weddingItems = useMemo(
    () => liveItems.filter((item) => item.phase !== "engagement"),
    [liveItems]
  );
  const groups = useMemo(
    () => groupChecklistByCategory(weddingItems, CHECKLIST_CATEGORIES),
    [weddingItems]
  );
  const stats = checklistStats(weddingItems);

  async function runAction(id: string | null, action: () => Promise<void>) {
    setActionError(null);
    setBusyId(id);
    try {
      await action();
    } catch {
      setActionError(ACTION_ERROR);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <CardSkeleton lines={2} />
        <CardSkeleton lines={6} />
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">
            Checklist Persiapan
          </h1>
          <p className="text-sm text-neutral-500">
            {stats.completed} dari {stats.total} tugas selesai
          </p>
        </div>
        <Button size="md" onClick={() => setFormTarget({ mode: "add", item: null })}>
          + Tambah tugas
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

      {/* FR-10: progress total keseluruhan */}
      <Card>
        <ProgressBar
          value={stats.percent}
          label="Progress keseluruhan"
        />
      </Card>

      {weddingItems.length === 0 ? (
        <EmptyState
          title="Checklist masih kosong"
          description="Onboarding akan mengisi checklist default. Kamu juga bisa menambah tugas sendiri."
          action={
            <Button onClick={() => setFormTarget({ mode: "add", item: null })}>
              Tambah tugas pertama
            </Button>
          }
        />
      ) : (
        groups.map((group) => {
          const groupStats = checklistStats(group.items);
          return (
            <Card key={group.category}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-base font-semibold text-neutral-900">
                  {group.category}
                </h2>
                <span className="text-xs tabular-nums text-neutral-500">
                  {groupStats.completed}/{groupStats.total} selesai
                </span>
              </div>

              {/* FR-10: progress per kategori */}
              <ProgressBar
                className="mt-2"
                value={groupStats.percent}
                showValue={false}
              />

              <ul className="mt-3 divide-y divide-neutral-100">
                {/* initial={false}: item yang sudah ada saat halaman dibuka
                    tidak dianimasikan. Hanya item yang datang SESUDAH itu
                    (mis. pasanganmu yang baru mencentang) yang bergerak. */}
                <AnimatePresence initial={false}>
                  {group.items.map((item) => {
                    const overdue =
                      !item.isCompleted &&
                      daysUntil(item.dueDate) !== null &&
                      (daysUntil(item.dueDate) as number) < 0;

                    return (
                      <motion.li
                        key={item.id}
                        variants={listItemVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="flex items-start gap-3 py-3"
                      >
                        <input
                          type="checkbox"
                          checked={item.isCompleted}
                          onChange={() =>
                            workspaceUid &&
                            toggle(
                              item,
                              (id, next) =>
                                toggleChecklistItem(workspaceUid, id, next),
                              () => setActionError(ACTION_ERROR)
                            )
                          }
                          aria-label={
                            item.isCompleted
                              ? `Batalkan selesai: ${item.title}`
                              : `Tandai selesai: ${item.title}`
                          }
                          className="mt-0.5 size-5 shrink-0 cursor-pointer rounded accent-rose-600"
                        />

                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm ${
                              item.isCompleted
                                ? "text-neutral-400 line-through"
                                : "text-neutral-800"
                            }`}
                          >
                            {item.title}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            <Badge tone="rose">{item.category}</Badge>
                            {item.dueDate && (
                              <span
                                className={
                                  overdue
                                    ? "font-medium text-red-600"
                                    : "text-neutral-500"
                                }
                              >
                                {formatDateID(item.dueDate)}
                                {overdue ? " · terlambat" : ""}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() =>
                              setFormTarget({ mode: "edit", item })
                            }
                          >
                            Ubah
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => setPendingDelete(item)}
                          >
                            Hapus
                          </Button>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            </Card>
          );
        })
      )}

      {/* Modal tambah/ubah */}
      <Modal
        open={formTarget !== null}
        onClose={() => setFormTarget(null)}
        title={formTarget?.mode === "edit" ? "Ubah tugas" : "Tambah tugas"}
      >
        {formTarget && workspaceUid && (
          <ChecklistForm
            key={formTarget.item?.id ?? "new"}
            uid={workspaceUid}
            mode={formTarget.mode}
            item={formTarget.item}
            onClose={() => setFormTarget(null)}
          />
        )}
      </Modal>

      {/* Modal konfirmasi hapus */}
      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Hapus tugas?"
      >
        <p className="text-sm text-neutral-600">
          Tugas{" "}
          <span className="font-medium text-neutral-900">
            {pendingDelete?.title}
          </span>{" "}
          akan dihapus permanen.
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" size="lg" onClick={() => setPendingDelete(null)}>
            Batal
          </Button>
          <Button
            variant="danger"
            size="lg"
            loading={busyId === pendingDelete?.id}
            onClick={() =>
              workspaceUid &&
              pendingDelete &&
              runAction(pendingDelete.id, async () => {
                await deleteChecklistItem(workspaceUid, pendingDelete.id);
                setPendingDelete(null);
              })
            }
          >
            Hapus
          </Button>
        </div>
      </Modal>
    </div>
  );
}
