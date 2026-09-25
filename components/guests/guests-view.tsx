"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/lib/hooks/auth-context";
import { useCollection } from "@/lib/hooks/use-collection";
import { guestsPath } from "@/lib/collection-paths";
import { guestStats } from "@/lib/aggregate";
import {
  GUEST_GROUPS,
  GUEST_STATUSES,
  GUEST_STATUS_LABELS,
  GUEST_STATUS_TONES,
} from "@/lib/constants";
import { deleteGuest } from "@/lib/guest-service";
import type { Guest } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { CardSkeleton } from "@/components/ui/skeleton";
import { GuestForm } from "@/components/guests/guest-form";

type FormTarget = { mode: "add"; guest: null } | { mode: "edit"; guest: Guest };

const ACTION_ERROR =
  "Gagal menyimpan perubahan. Periksa koneksi internet Anda.";

/** Urut: yang perlu ditindaklanjuti dulu (belum dikirim → terkirim → hadir). */
function sortGuests(a: Guest, b: Guest): number {
  const rank = (guest: Guest) => GUEST_STATUSES.indexOf(guest.status);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  return a.name.localeCompare(b.name, "id");
}

/** Kelompokkan per GUEST_GROUPS (urut daftar default, lalu sisanya). */
function groupGuests(items: Guest[]) {
  const map = new Map<string, Guest[]>();
  for (const guest of items) {
    const key = guest.group || "Lainnya";
    const list = map.get(key);
    if (list) list.push(guest);
    else map.set(key, [guest]);
  }

  const defaultKeys = GUEST_GROUPS.filter((key) => map.has(key));
  const extraKeys = Array.from(map.keys())
    .filter((key) => !(GUEST_GROUPS as readonly string[]).includes(key))
    .sort();

  return [...defaultKeys, ...extraKeys].map((group) => ({
    group,
    items: (map.get(group) ?? []).sort(sortGuests),
  }));
}

/** Modul Daftar Tamu Undangan — estimasi jumlah tamu per status & kelompok. */
export function GuestsView() {
  const { workspaceUid } = useAuth();
  const { items, loading, error } = useCollection<Guest>(
    workspaceUid ? guestsPath(workspaceUid) : null,
    { orderBy: { field: "createdAt" } }
  );

  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Guest | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const stats = useMemo(() => guestStats(items), [items]);
  const groups = useMemo(() => groupGuests(items), [items]);

  const perGroup = useMemo(() => {
    return groups.map(({ group, items: guests }) => {
      const sub = guestStats(guests);
      return { group, ...sub };
    });
  }, [groups]);

  async function handleDelete() {
    if (!workspaceUid || !pendingDelete) return;
    setActionError(null);
    setBusyId(pendingDelete.id);
    try {
      await deleteGuest(workspaceUid, pendingDelete.id);
      setPendingDelete(null);
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

  const tiles: { label: string; value: number }[] = [
    { label: "Total daftar tamu", value: stats.total },
    { label: "Estimasi hadir", value: stats.estimated },
    { label: "Menunggu jawaban", value: stats.sent },
    { label: "Belum dikirim", value: stats.draft },
    { label: "Tidak hadir", value: stats.declined },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">
            Daftar Tamu Undangan
          </h1>
          <p className="text-sm text-neutral-500">
            {stats.total} tamu terdaftar — estimasi {stats.estimated} akan hadir
          </p>
        </div>
        <Button size="md" onClick={() => setFormTarget({ mode: "add", guest: null })}>
          + Tambah tamu
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

      {/* Estimasi jumlah — angka utama yang dicari user di menu ini. */}
      <Card>
        <CardTitle>Estimasi jumlah tamu</CardTitle>
        <CardDescription>
          Dihitung otomatis dari daftar. Estimasi hadir = status Hadir + Terkirim
          yang belum menjawab; Belum dikirim &amp; Tidak hadir tidak dihitung.
        </CardDescription>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-xl bg-neutral-50 px-3 py-3">
              <p className="text-2xl font-semibold tabular-nums text-neutral-900">
                {tile.value}
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">{tile.label}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Rincian per kelompok undangan */}
      {perGroup.length > 0 && (
        <Card>
          <CardTitle>Per kelompok undangan</CardTitle>
          <ul className="mt-3 divide-y divide-neutral-100">
            {perGroup.map((row) => (
              <li
                key={row.group}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <span className="text-sm font-medium text-neutral-800">
                  {row.group}
                </span>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <Badge tone="neutral">{row.total} tamu</Badge>
                  {row.attending > 0 && (
                    <Badge tone="emerald">{row.attending} hadir</Badge>
                  )}
                  {row.sent > 0 && (
                    <Badge tone="sky">{row.sent} terkirim</Badge>
                  )}
                  {row.draft > 0 && <Badge>{row.draft} belum dikirim</Badge>}
                  {row.declined > 0 && (
                    <Badge tone="amber">{row.declined} tidak hadir</Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="Belum ada tamu"
          description="Tambahkan tamu undangan satu per satu — jumlah per status & kelompok terhitung otomatis untuk estimasi."
          action={
            <Button onClick={() => setFormTarget({ mode: "add", guest: null })}>
              Tambah tamu pertama
            </Button>
          }
        />
      ) : (
        groups.map((group) => (
          <Card key={group.group}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-base font-semibold text-neutral-900">
                {group.group}
              </h2>
              <span className="text-xs tabular-nums text-neutral-500">
                {group.items.length} tamu
              </span>
            </div>

            <ul className="mt-2 divide-y divide-neutral-100">
              {group.items.map((guest) => (
                <li key={guest.id} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-800">
                      {guest.name}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge tone={GUEST_STATUS_TONES[guest.status]}>
                        {GUEST_STATUS_LABELS[guest.status]}
                      </Badge>
                      {guest.notes && (
                        <span className="truncate text-xs text-neutral-500">
                          {guest.notes}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => setFormTarget({ mode: "edit", guest })}
                    >
                      Ubah
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => setPendingDelete(guest)}
                    >
                      Hapus
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}

      {/* Modal tambah/ubah */}
      <Modal
        open={formTarget !== null}
        onClose={() => setFormTarget(null)}
        title={formTarget?.mode === "edit" ? "Ubah tamu" : "Tambah tamu"}
      >
        {formTarget && workspaceUid && (
          <GuestForm
            key={formTarget.guest?.id ?? "new"}
            uid={workspaceUid}
            mode={formTarget.mode}
            guest={formTarget.guest}
            onClose={() => setFormTarget(null)}
          />
        )}
      </Modal>

      {/* Modal konfirmasi hapus */}
      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Hapus tamu?"
      >
        <p className="text-sm text-neutral-600">
          Tamu{" "}
          <span className="font-medium text-neutral-900">
            {pendingDelete?.name}
          </span>{" "}
          akan dihapus permanen dari daftar.
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" size="lg" onClick={() => setPendingDelete(null)}>
            Batal
          </Button>
          <Button
            variant="danger"
            size="lg"
            loading={busyId === pendingDelete?.id}
            onClick={handleDelete}
          >
            Hapus
          </Button>
        </div>
      </Modal>
    </div>
  );
}
