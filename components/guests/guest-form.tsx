"use client";

import { useState, type FormEvent } from "react";
import {
  GUEST_GROUPS,
  GUEST_STATUSES,
  GUEST_STATUS_LABELS,
} from "@/lib/constants";
import { addGuest, updateGuest } from "@/lib/guest-service";
import type { Guest } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

/**
 * Form tambah/ubah tamu undangan (nama wajib; kelompok, status, catatan).
 * Disimpan realtime ke users/{uid}/guests — tanpa tombol "save" terpisah
 * di luar modal ini (konsisten dengan modul lain).
 */
export function GuestForm({
  uid,
  mode,
  guest,
  onClose,
}: {
  uid: string;
  mode: "add" | "edit";
  guest: Guest | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(() => guest?.name ?? "");
  const [group, setGroup] = useState<string>(
    () => guest?.group ?? GUEST_GROUPS[0]
  );
  const [status, setStatus] = useState<string>(
    () => guest?.status ?? GUEST_STATUSES[0]
  );
  const [notes, setNotes] = useState(() => guest?.notes ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const error = name.trim() ? null : "Nama tamu wajib diisi.";
    setNameError(error);
    if (error) return;

    setSaving(true);
    setSaveError(null);
    try {
      const input = {
        name: name.trim(),
        group: group as Guest["group"],
        status: status as Guest["status"],
        notes: notes.trim(),
      };
      if (mode === "add") {
        await addGuest(uid, input);
      } else if (guest) {
        await updateGuest(uid, guest.id, input);
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
        label="Nama tamu"
        type="text"
        placeholder="Contoh: Budi Santoso (keluarga)"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={nameError ?? undefined}
      />

      <Select
        label="Kelompok undangan"
        options={GUEST_GROUPS.map((value) => ({ value, label: value }))}
        value={group}
        onValueChange={setGroup}
      />

      <Select
        label="Status"
        options={GUEST_STATUSES.map((value) => ({
          value,
          label: GUEST_STATUS_LABELS[value],
        }))}
        value={status}
        onValueChange={setStatus}
        hint="Estimasi hadir menghitung status Hadir + Terkirim (belum menjawab)."
      />

      <Input
        label="Catatan (opsional)"
        type="text"
        placeholder="Contoh: 0812xxxx, +1 pasangan, meja keluarga A"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" size="lg" onClick={onClose}>
          Batal
        </Button>
        <Button type="submit" size="lg" loading={saving}>
          {mode === "add" ? "Tambah tamu" : "Simpan perubahan"}
        </Button>
      </div>
    </form>
  );
}
