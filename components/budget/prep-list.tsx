"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/lib/hooks/auth-context";
import { useCollection } from "@/lib/hooks/use-collection";
import { prepPath } from "@/lib/collection-paths";
import { prepStats } from "@/lib/aggregate";
import { formatIDR, parseAmount } from "@/lib/format";
import {
  addPrepItem,
  deletePrepItem,
  togglePrepItem,
  updatePrepItem,
} from "@/lib/prep-service";
import type { PrepItem } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { NumberInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";
import { CardSkeleton } from "@/components/ui/skeleton";

type FormTarget =
  | { mode: "add"; item: null }
  | { mode: "edit"; item: PrepItem };

const ACTION_ERROR =
  "Gagal menyimpan perubahan. Periksa koneksi internet Anda.";

/** Item yang sudah disiapkan menyusul, agar yang belum mendapat prioritas. */
function sortPrepItems(a: PrepItem, b: PrepItem): number {
  if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
  return a.name.localeCompare(b.name, "id");
}

/**
 * Form tambah/ubah item "yang perlu disiapkan" (nama, kategori budget,
 * estimasi biaya). Realtime ke users/{uid}/prepItems.
 */
function PrepForm({
  uid,
  mode,
  item,
  categoryNames,
  onClose,
}: {
  uid: string;
  mode: "add" | "edit";
  item: PrepItem | null;
  categoryNames: string[];
  onClose: () => void;
}) {
  const [name, setName] = useState(() => item?.name ?? "");
  const [category, setCategory] = useState<string>(
    () => item?.categoryName ?? categoryNames[0] ?? "Lain-lain"
  );
  const [amount, setAmount] = useState<string>(() =>
    item && item.plannedAmount ? String(item.plannedAmount) : ""
  );
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const error = name.trim() ? null : "Nama item wajib diisi.";
    setNameError(error);
    if (error) return;

    setSaving(true);
    setSaveError(null);
    try {
      const input = {
        name: name.trim(),
        categoryName: category,
        plannedAmount: parseAmount(amount),
      };
      if (mode === "add") {
        await addPrepItem(uid, { ...input, isDone: false });
      } else if (item) {
        await updatePrepItem(uid, item.id, input);
      }
      onClose();
    } catch {
      setSaveError("Gagal menyimpan. Periksa koneksi internet Anda.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {saveError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {saveError}
        </div>
      )}

      <Input
        label="Item yang perlu disiapkan"
        type="text"
        placeholder="Contoh: Souvenir untuk tamu (200 pcs)"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={nameError ?? undefined}
      />

      <Select
        label="Kategori budget"
        options={categoryNames.map((value) => ({ value, label: value }))}
        value={category}
        onValueChange={setCategory}
      />

      <NumberInput
        label="Estimasi biaya"
        prefix="Rp"
        placeholder="0"
        hint="Perkiraan biaya item ini — total rencana dibandingkan dengan alokasi budget. Kosongkan bila belum tahu."
        value={amount}
        onValueChange={setAmount}
      />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" size="lg" onClick={onClose}>
          Batal
        </Button>
        <Button type="submit" size="lg" loading={saving}>
          {mode === "add" ? "Tambah item" : "Simpan perubahan"}
        </Button>
      </div>
    </form>
  );
}

/**
 * Kartu "Item yang perlu disiapkan" di modul Budget — daftar belanja/
 * persiapan dengan estimasi biaya; centang saat sudah disiapkan.
 * Mandiri (sendiri mengambil data realtime) agar BudgetView tetap ringkas.
 */
export function PrepList({
  categoryNames,
}: {
  /** Nama kategori budget yang tersedia (sama dengan daftar alokasi). */
  categoryNames: string[];
}) {
  const { workspaceUid } = useAuth();
  const { items, loading } = useCollection<PrepItem>(
    workspaceUid ? prepPath(workspaceUid) : null,
    { orderBy: { field: "createdAt" } }
  );

  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PrepItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const stats = useMemo(() => prepStats(items), [items]);
  const sorted = useMemo(
    () => [...items].sort(sortPrepItems),
    [items]
  );

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
    return <CardSkeleton lines={4} />;
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <CardTitle>Item yang perlu disiapkan</CardTitle>
          <CardDescription>
            Daftar barang/jasa yang harus disiapkan beserta estimasi biayanya —
            centang saat sudah disiapkan.
          </CardDescription>
        </div>
        <Button size="md" onClick={() => setFormTarget({ mode: "add", item: null })}>
          + Tambah item
        </Button>
      </div>

      {actionError && (
        <div
          role="alert"
          className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {actionError}
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-neutral-50 px-3 py-3">
            <p className="text-lg font-semibold tabular-nums text-neutral-900">
              {formatIDR(stats.plannedTotal)}
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Total rencana ({stats.total} item)
            </p>
          </div>
          <div className="rounded-xl bg-amber-50 px-3 py-3">
            <p className="text-lg font-semibold tabular-nums text-amber-800">
              {formatIDR(stats.pendingAmount)}
            </p>
            <p className="mt-0.5 text-xs text-amber-700">
              Belum disiapkan ({stats.total - stats.done} item)
            </p>
          </div>
          <div className="rounded-xl bg-emerald-50 px-3 py-3">
            <p className="text-lg font-semibold tabular-nums text-emerald-800">
              {formatIDR(stats.doneAmount)}
            </p>
            <p className="mt-0.5 text-xs text-emerald-700">
              Sudah disiapkan ({stats.done} item)
            </p>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          className="mt-4"
          title="Belum ada item persiapan"
          description="Tambahkan barang/jasa yang perlu disiapkan beserta estimasi biayanya, misal: souvenir, seserahan, perlengkapan akad."
          action={
            <Button onClick={() => setFormTarget({ mode: "add", item: null })}>
              Tambah item pertama
            </Button>
          }
        />
      ) : (
        <ul className="mt-4 divide-y divide-neutral-100">
          {sorted.map((item) => (
            <li key={item.id} className="flex items-start gap-3 py-3">
              <input
                type="checkbox"
                checked={item.isDone}
                disabled={busyId === item.id}
                onChange={() =>
                  workspaceUid &&
                  runAction(item.id, () => togglePrepItem(workspaceUid, item))
                }
                aria-label={`Tandai sudah disiapkan: ${item.name}`}
                className="mt-0.5 size-5 shrink-0 rounded accent-rose-600 disabled:opacity-50"
              />

              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm ${
                    item.isDone
                      ? "text-neutral-400 line-through"
                      : "text-neutral-800"
                  }`}
                >
                  {item.name}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{item.categoryName}</Badge>
                  <span className="text-xs tabular-nums text-neutral-500">
                    {formatIDR(Number(item.plannedAmount) || 0)}
                  </span>
                  {item.isDone && <Badge tone="emerald">Sudah disiapkan</Badge>}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setFormTarget({ mode: "edit", item })}
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
            </li>
          ))}
        </ul>
      )}

      {/* Modal tambah/ubah */}
      <Modal
        open={formTarget !== null}
        onClose={() => setFormTarget(null)}
        title={
          formTarget?.mode === "edit" ? "Ubah item" : "Tambah item persiapan"
        }
      >
        {formTarget && workspaceUid && (
          <PrepForm
            key={formTarget.item?.id ?? "new"}
            uid={workspaceUid}
            mode={formTarget.mode}
            item={formTarget.item}
            categoryNames={categoryNames}
            onClose={() => setFormTarget(null)}
          />
        )}
      </Modal>

      {/* Modal konfirmasi hapus */}
      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Hapus item?"
      >
        <p className="text-sm text-neutral-600">
          Item{" "}
          <span className="font-medium text-neutral-900">
            {pendingDelete?.name}
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
                await deletePrepItem(workspaceUid, pendingDelete.id);
                setPendingDelete(null);
              })
            }
          >
            Hapus
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
