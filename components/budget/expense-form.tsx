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
 * Form catat/edit pengeluaran (FR-14):
 * deskripsi, nominal, tanggal, kategori, foto struk (opsional → Storage).
 */
export function ExpenseForm({
  weddingId,
  mode,
  expense,
  initialCategoryName,
  categoryLocked,
  index,
  onClose,
}: {
  weddingId: string;
  mode: "add" | "edit";
  expense: Expense | null;
  initialCategoryName: string;
  categoryLocked?: boolean;
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

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
    try {
      let receiptUrl = expense?.receiptUrl ?? "";
      if (receiptFile) {
        setUploading(true);
        receiptUrl = await uploadReceipt(weddingId, receiptFile);
        setUploading(false);
      }

      const data: Expense = {
        description: description.trim(),
        amount: parsedAmount,
        date,
        receiptUrl,
      };

      if (mode === "add") {
        await addExpense(weddingId, category, data);
      } else {
        await updateExpense(weddingId, initialCategoryName, index ?? -1, data);
      }
      onClose();
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
    </form>
  );
}
