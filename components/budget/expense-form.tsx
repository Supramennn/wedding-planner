"use client";

import { useState, type FormEvent } from "react";
import { CHECKLIST_CATEGORIES } from "@/lib/constants";
import {
  MAX_RECEIPT_SIZE,
  addExpense,
  updateExpense,
  uploadReceipt,
} from "@/lib/budget-service";
import { formatIDR, parseAmount, toISODate } from "@/lib/format";
import type { Expense } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";

/**
 * Peringatan bila upload struk gagal karena infrastruktur (Cloud Storage
 * belum aktif — kebijakan Google Sep 2024: butuh paket Blaze — atau rules/
 * jaringan bermasalah). Pengeluaran TETAP disimpan; struk dilewati.
 */
const RECEIPT_UNAVAILABLE_WARNING =
  "Pengeluaran berhasil disimpan, tetapi foto struk tidak bisa diunggah — " +
  "Cloud Storage belum aktif untuk proyek ini (kebijakan Google: fitur Storage " +
  "butuh paket Blaze). Setelah Storage diaktifkan, unggah struk langsung " +
  "berfungsi tanpa perubahan apa pun.";

/**
 * Form catat/edit pengeluaran (FR-14):
 * deskripsi, nominal, tanggal, kategori, foto struk (opsional → Storage).
 */
export function ExpenseForm({
  uid,
  mode,
  expense,
  initialCategoryName,
  categoryLocked,
  index,
  onClose,
}: {
  uid: string;
  mode: "add" | "edit";
  expense: Expense | null;
  initialCategoryName: string;
  /** true saat edit — kategori tidak berubah (hindari salah pindah array). */
  categoryLocked: boolean;
  index?: number;
  onClose: () => void;
}) {
  const [description, setDescription] = useState(() => expense?.description ?? "");
  const [amount, setAmount] = useState(() =>
    expense ? String(expense.amount) : ""
  );
  const [date, setDate] = useState(
    () => expense?.date ?? toISODate(new Date())
  );
  const [category, setCategory] = useState(initialCategoryName);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const [errors, setErrors] = useState<{
    description?: string | null;
    amount?: string | null;
  }>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Setelah peringatan struk, form hanya bisa ditutup (hindari duplikat).
    if (saving || saveWarning) return;

    // FR-14: deskripsi, nominal, tanggal wajib; struk opsional.
    const descriptionError = description.trim()
      ? null
      : "Deskripsi wajib diisi.";
    const parsedAmount = parseAmount(amount);
    const amountError = parsedAmount > 0 ? null : "Nominal harus lebih dari 0.";
    setErrors({ description: descriptionError, amount: amountError });
    if (descriptionError || amountError) return;

    setSaving(true);
    setSaveError(null);
    let receiptWarning: string | null = null;
    try {
      let receiptUrl = expense?.receiptUrl ?? "";
      if (receiptFile) {
        setUploading(true);
        try {
          receiptUrl = await uploadReceipt(uid, receiptFile);
        } catch (uploadError) {
          // Ukuran/konfigurasi = bisa diperbaiki user → tetap blokir form.
          if (
            uploadError instanceof Error &&
            (uploadError.message.includes("maksimal") ||
              uploadError.message.includes("konfigurasi"))
          ) {
            throw uploadError;
          }
          // Gagal infrastruktur (Storage mati/jaringan) → lanjut tanpa struk,
          // pengeluaran tidak boleh hilang karena struk yang gagal.
          receiptWarning = RECEIPT_UNAVAILABLE_WARNING;
        } finally {
          setUploading(false);
        }
      }

      const data: Expense = {
        description: description.trim(),
        amount: parsedAmount,
        date,
        receiptUrl,
      };

      if (mode === "add") {
        await addExpense(uid, category, data);
      } else {
        await updateExpense(uid, initialCategoryName, index ?? -1, data);
      }

      if (receiptWarning) {
        // Modal tetap terbuka agar peringatan terbaca; footer jadi "Selesai".
        setSaveWarning(receiptWarning);
      } else {
        onClose();
      }
    } catch (error) {
      setUploading(false);
      setSaveError(
        error instanceof Error &&
          (error.message.includes("maksimal") || error.message.includes("konfigurasi"))
          ? error.message
          : "Gagal menyimpan. Periksa koneksi internet Anda."
      );
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

      {saveWarning && (
        <div
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          {saveWarning}
        </div>
      )}

      <Input
        label="Deskripsi"
        type="text"
        placeholder="Contoh: DP katering"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        error={errors.description ?? undefined}
      />

      <NumberInput
        label="Nominal"
        prefix="Rp"
        value={amount}
        onValueChange={(digits) => {
          setAmount(digits);
          setErrors((prev) => ({ ...prev, amount: null }));
        }}
        placeholder="5000000"
        error={errors.amount ?? undefined}
        hint={parseAmount(amount) > 0 ? `= ${formatIDR(parseAmount(amount))}` : undefined}
      />

      <Input
        label="Tanggal"
        type="date"
        value={date}
        onChange={(event) => setDate(event.target.value)}
      />

      <Select
        label="Kategori"
        options={CHECKLIST_CATEGORIES.map((value) => ({ value, label: value }))}
        value={category}
        disabled={categoryLocked}
        onValueChange={setCategory}
        hint={categoryLocked ? "Kategori tidak bisa diubah saat edit." : undefined}
      />

      {/* Struk (opsional) */}
      <div>
        <label
          htmlFor="receipt-input"
          className="mb-1 block text-sm font-medium text-neutral-700"
        >
          Foto struk (opsional)
        </label>
        <input
          id="receipt-input"
          type="file"
          accept="image/*"
          onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)}
          className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-rose-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-rose-700 hover:file:bg-rose-100"
        />
        <p className="mt-1 text-xs text-neutral-500">
          Maksimal {Math.round(MAX_RECEIPT_SIZE / (1024 * 1024))} MB.
          {expense?.receiptUrl && !receiptFile && (
            <>
              {" "}
              Struk tersimpan:{" "}
              <a
                href={expense.receiptUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-rose-600 hover:underline"
              >
                lihat struk
              </a>
              .
            </>
          )}
        </p>
      </div>

      {saveWarning ? (
        /* Pengeluaran sudah tersimpan tanpa struk — tutup saja formnya. */
        <div className="flex justify-end">
          <Button size="lg" onClick={onClose}>
            Selesai
          </Button>
        </div>
      ) : (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" size="lg" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" size="lg" loading={saving}>
            {uploading
              ? "Mengunggah struk…"
              : mode === "add"
                ? "Catat pengeluaran"
                : "Simpan perubahan"}
          </Button>
        </div>
      )}
    </form>
  );
}
