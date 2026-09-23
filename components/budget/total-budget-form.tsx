"use client";

import { useState, type FormEvent } from "react";
import { setTotalBudget } from "@/lib/budget-service";
import { formatIDR, parseAmount } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";

/** Form set/edit total budget pernikahan (FR-12). */
export function TotalBudgetForm({
  uid,
  current,
  onClose,
}: {
  uid: string;
  current: number;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(() =>
    current > 0 ? String(current) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const parsed = parseAmount(amount);
    if (!amount || parsed <= 0) {
      setError("Masukkan nominal total budget (lebih dari 0).");
      return;
    }

    setSaving(true);
    try {
      await setTotalBudget(uid, parsed);
      onClose();
    } catch {
      setError("Gagal menyimpan. Periksa koneksi internet Anda.");
    } finally {
      setSaving(false);
    }
  }

  const preview = parseAmount(amount);

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <NumberInput
        label="Total budget pernikahan"
        prefix="Rp"
        value={amount}
        onValueChange={(digits) => {
          setAmount(digits);
          setError(null);
        }}
        placeholder="150000000"
        error={error ?? undefined}
        hint={preview > 0 ? `= ${formatIDR(preview)}` : "Masukkan nominal dalam Rupiah."}
      />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" size="lg" onClick={onClose}>
          Batal
        </Button>
        <Button type="submit" size="lg" loading={saving}>
          Simpan total
        </Button>
      </div>
    </form>
  );
}
