"use client";

import { useState, type FormEvent } from "react";
import { setCategoryAllocation } from "@/lib/budget-service";
import { formatIDR, parseAmount } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";

type Mode = "amount" | "percent";

/**
 * Form alokasi per kategori (FR-13): nominal langsung ATAU
 * persentase dari total budget.
 */
export function AllocationForm({
  weddingId,
  totalBudget,
  categoryName,
  current,
  onClose,
}: {
  weddingId: string;
  totalBudget: number;
  categoryName: string;
  current: number;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>("amount");
  const [value, setValue] = useState(() =>
    current > 0 ? String(current) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setError(null);
    // Konversi nilai saat berpindah mode agar input tetap masuk akal.
    if (next === "percent") {
      const parsed = parseAmount(value);
      setValue(
        totalBudget > 0 && parsed > 0
          ? String(Math.round((parsed / totalBudget) * 100))
          : ""
      );
    } else {
      const percent = Number(value);
      setValue(
        value && totalBudget > 0 && !Number.isNaN(percent)
          ? String(Math.round((totalBudget * percent) / 100))
          : ""
      );
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    let amount = 0;
    if (mode === "amount") {
      if (!value) {
        setError("Masukkan nominal alokasi.");
        return;
      }
      amount = parseAmount(value);
    } else {
      const percent = Number(value);
      if (!value || Number.isNaN(percent) || percent < 0 || percent > 100) {
        setError("Persentase harus antara 0 dan 100.");
        return;
      }
      if (totalBudget <= 0) {
        setError("Tetapkan total budget dulu sebelum memakai persentase.");
        return;
      }
      amount = Math.round((totalBudget * percent) / 100);
    }

    setSaving(true);
    try {
      await setCategoryAllocation(weddingId, categoryName, amount);
      onClose();
    } catch {
      setError("Gagal menyimpan. Periksa koneksi internet Anda.");
    } finally {
      setSaving(false);
    }
  }

  const percent =
    mode === "percent" ? Number(value || 0) : totalBudget > 0 ? Math.round((parseAmount(value) / totalBudget) * 100) : 0;
  const equivalent =
    mode === "percent" ? Math.round((totalBudget * Number(value || 0)) / 100) : parseAmount(value);

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Pilihan mode FR-13 */}
      <div
        className="grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1"
        role="group"
        aria-label="Mode alokasi"
      >
        {(
          [
            { id: "amount", label: "Nominal (Rp)" },
            { id: "percent", label: "Persentase (%)" },
          ] as const
        ).map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={mode === option.id}
            onClick={() => switchMode(option.id)}
            className={`min-h-9 rounded-lg px-3 text-sm font-medium transition-colors ${
              mode === option.id
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <NumberInput
        label={`Alokasi untuk ${categoryName}`}
        prefix={mode === "amount" ? "Rp" : undefined}
        suffix={mode === "percent" ? "%" : undefined}
        value={value}
        onValueChange={(digits) => {
          setValue(digits);
          setError(null);
        }}
        placeholder={mode === "amount" ? "50000000" : "30"}
        error={error ?? undefined}
        hint={
          mode === "percent"
            ? totalBudget > 0
              ? `= ${formatIDR(equivalent)} dari total ${formatIDR(totalBudget)}`
              : "Tetapkan total budget dulu untuk memakai persentase."
            : totalBudget > 0
              ? `≈ ${percent}% dari total ${formatIDR(totalBudget)}`
              : "Masukkan nominal dalam Rupiah."
        }
      />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" size="lg" onClick={onClose}>
          Batal
        </Button>
        <Button type="submit" size="lg" loading={saving}>
          Simpan alokasi
        </Button>
      </div>
    </form>
  );
}
