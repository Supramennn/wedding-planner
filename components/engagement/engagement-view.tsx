"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/lib/hooks/auth-context";
import { useCollection } from "@/lib/hooks/use-collection";
import { useOptimisticToggle } from "@/lib/hooks/use-optimistic-toggle";
import { checklistPath } from "@/lib/collection-paths";
import { checklistStats, groupChecklistByCategory } from "@/lib/aggregate";
import { ENGAGEMENT_CATEGORIES } from "@/lib/constants";
import { daysUntil, formatDateID } from "@/lib/format";
import { listItemVariants } from "@/lib/motion";
import {
  deleteChecklistItem,
  toggleChecklistItem,
} from "@/lib/checklist-service";
import { generateEngagementChecklist } from "@/lib/default-checklist";
import type { ChecklistItem } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { ProgressBar } from "@/components/ui/progress-bar";
import { CardSkeleton } from "@/components/ui/skeleton";
import { ChecklistForm } from "@/components/checklist/checklist-form";

type FormTarget =
  | { mode: "add"; item: null }
  | { mode: "edit"; item: ChecklistItem };

const ACTION_ERROR =
  "Gagal menyimpan perubahan. Periksa koneksi internet Anda.";

/**
 * Modul Persiapan Lamaran (Engagement) — TERPISAH dari persiapan nikah.
 * Item disimpan di koleksi checklist yang sama dengan `phase: "engagement"`
 * (schema additive, tanpa migrasi), diurutkan dengan kategori lamaran.
 */
export function EngagementView() {
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
  const [seeding, setSeeding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Toggle optimistis, sama persis dengan menu Checklist supaya kedua
  // menu tidak berperilaku berbeda.
  const { liveItems, toggle } = useOptimisticToggle(items, "isCompleted");

  const engagementItems = useMemo(
    () => liveItems.filter((item) => item.phase === "engagement"),
    [liveItems]
  );
  const groups = useMemo(
    () => groupChecklistByCategory(engagementItems, ENGAGEMENT_CATEGORIES),
    [engagementItems]
  );
  const stats = checklistStats(engagementItems);

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

  /** Muat 11 tugas template lamaran (idempoten — tidak menggandakan). */
  async function handleSeed() {
    if (!workspaceUid || seeding) return;
    setActionError(null);
    setSeeding(true);
    try {
      await generateEngagementChecklist(workspaceUid);
    } catch {
      setActionError(ACTION_ERROR);
    } finally {
      setSeeding(false);
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
            Persiapan Lamaran
          </h1>
          <p className="text-sm text-neutral-500">
            Rencana lamaran terpisah dari persiapan nikah — {stats.completed}{" "}
            dari {stats.total} tugas selesai
          </p>
        </div>
        <Button
          size="md"
          onClick={() => setFormTarget({ mode: "add", item: null })}
        >
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

      <Card>
        <ProgressBar value={stats.percent} label="Progress lamaran" />
      </Card>

      {engagementItems.length === 0 ? (
        <EmptyState
          title="Belum ada persiapan lamaran"
          description="Muat template (11 tugas umum: cincin, seserahan, keluarga, acara, dokumentasi) atau tambah tugas sendiri."
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button loading={seeding} onClick={handleSeed}>
                Muat template persiapan
              </Button>
              <Button
                variant="outline"
                onClick={() => setFormTarget({ mode: "add", item: null })}
              >
                Tambah tugas sendiri
              </Button>
            </div>
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

              <ProgressBar
                className="mt-2"
                value={groupStats.percent}
                showValue={false}
              />

              <ul className="mt-3 divide-y divide-neutral-100">
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
                          <Badge tone="violet">{item.category}</Badge>
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
        title={
          formTarget?.mode === "edit" ? "Ubah tugas lamaran" : "Tambah tugas lamaran"
        }
      >
        {formTarget && workspaceUid && (
          <ChecklistForm
            key={formTarget.item?.id ?? "new"}
            uid={workspaceUid}
            mode={formTarget.mode}
            item={formTarget.item}
            categories={ENGAGEMENT_CATEGORIES}
            phase="engagement"
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
          <Button
            variant="outline"
            size="lg"
            onClick={() => setPendingDelete(null)}
          >
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
