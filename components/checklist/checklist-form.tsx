"use client";

import { useState, type FormEvent } from "react";
import { CHECKLIST_CATEGORIES } from "@/lib/constants";
import { addChecklistItem, updateChecklistItem } from "@/lib/checklist-service";
import type { ChecklistItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

/**
 * Form tambah/ubah item checklist (FR-09).
 * Disimpan langsung ke Firestore (FR-11: tanpa tombol save terpisah —
 * tombol di sini adalah "kirim ke Firestore", hasilnya realtime).
 * Komponen di-mount ulang tiap modal dibuka (key) sehingga state selalu segar.
 *
 * Dipakai dua tahap: checklist nikah (default) & checklist engagement
 * (props `categories` = kategori lamaran, `phase` = "engagement" saat tambah).
 */
export function ChecklistForm({
  uid,
  mode,
  item,
  onClose,
  categories = CHECKLIST_CATEGORIES,
  phase,
}: {
  uid: string;
  mode: "add" | "edit";
  item: ChecklistItem | null;
  onClose: () => void;
  /** Daftar kategori untuk select (default: kategori persiapan nikah). */
  categories?: readonly string[];
  /** Ditulis saat TAMBAH bila terisi — memisahkan tahap lamaran vs nikah. */
  phase?: "engagement";
}) {
  const [title, setTitle] = useState(() => item?.title ?? "");
  const [category, setCategory] = useState<string>(
    () => item?.category ?? categories[0] ?? CHECKLIST_CATEGORIES[0]
  );
  const [dueDate, setDueDate] = useState(() => item?.dueDate ?? "");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    // FR-09: judul wajib; kategori & due date (opsional) tersedia.
    const error = title.trim() ? null : "Judul tugas wajib diisi.";
    setTitleError(error);
    if (error) return;

    setSaving(true);
    setSaveError(null);
    try {
      const input = {
        title: title.trim(),
        category: category as ChecklistItem["category"],
        dueDate,
      };
      if (mode === "add") {
        await addChecklistItem(uid, { ...input, phase });
      } else if (item) {
        await updateChecklistItem(uid, item.id, input);
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
        label="Judul tugas"
        type="text"
        placeholder="Contoh: Booking souvenir pernikahan"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        error={titleError ?? undefined}
      />

      <Select
        label="Kategori"
        options={categories.map((value) => ({ value, label: value }))}
        value={category}
        onValueChange={setCategory}
      />

      <Input
        label="Due date (opsional)"
        type="date"
        hint="Kosongkan bila tugas ini tanpa tenggat."
        value={dueDate}
        onChange={(event) => setDueDate(event.target.value)}
      />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" size="lg" onClick={onClose}>
          Batal
        </Button>
        <Button type="submit" size="lg" loading={saving}>
          {mode === "add" ? "Tambah tugas" : "Simpan perubahan"}
        </Button>
      </div>
    </form>
  );
}
