"use client";

import { useState, type FormEvent } from "react";
import { VENDOR_CATEGORIES, VENDOR_STATUSES, VENDOR_STATUS_LABELS } from "@/lib/constants";
import { addVendor, updateVendor, type VendorInput } from "@/lib/vendor-service";
import { parseAmount, formatIDR } from "@/lib/format";
import type { Vendor, VendorStatus } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";

/** Form tambah/ubah vendor (FR-17: semua field wajib tersedia). */
export function VendorForm({
  uid,
  mode,
  vendor,
  onClose,
}: {
  uid: string;
  mode: "add" | "edit";
  vendor: Vendor | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(() => vendor?.name ?? "");
  const [category, setCategory] = useState(
    () => vendor?.category ?? VENDOR_CATEGORIES[0]
  );
  const [contact, setContact] = useState(() => vendor?.contact ?? "");
  const [status, setStatus] = useState<VendorStatus>(
    () => vendor?.status ?? "dihubungi"
  );
  const [dealAmount, setDealAmount] = useState(() =>
    vendor && vendor.dealAmount > 0 ? String(vendor.dealAmount) : ""
  );
  const [paymentDeadline, setPaymentDeadline] = useState(
    () => vendor?.paymentDeadline ?? ""
  );
  const [notes, setNotes] = useState(() => vendor?.notes ?? "");

  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    // FR-17: nama wajib; field lain opsional tapi tersedia.
    const error = name.trim() ? null : "Nama vendor wajib diisi.";
    setNameError(error);
    if (error) return;

    const input: VendorInput = {
      name: name.trim(),
      category,
      contact: contact.trim(),
      status,
      dealAmount: parseAmount(dealAmount),
      paymentDeadline,
      notes: notes.trim(),
    };

    setSaving(true);
    setSaveError(null);
    try {
      if (mode === "add") {
        await addVendor(uid, input);
      } else if (vendor) {
        await updateVendor(uid, vendor.id, input);
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
        label="Nama vendor"
        type="text"
        placeholder="Contoh: Gedung Kertanegara"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={nameError ?? undefined}
      />

      <Select
        label="Kategori"
        options={VENDOR_CATEGORIES.map((value) => ({ value, label: value }))}
        value={category}
        onValueChange={setCategory}
      />

      <Input
        label="Kontak (telp/WA/email)"
        type="text"
        placeholder="0812xxxxxxx atau nama@email.com"
        value={contact}
        onChange={(event) => setContact(event.target.value)}
        hint="Simpan nomor WA/email vendor agar mudah dihubungi."
      />

      <Select
        label="Status"
        options={VENDOR_STATUSES.map((value) => ({
          value,
          label: VENDOR_STATUS_LABELS[value],
        }))}
        value={status}
        onValueChange={(value) => setStatus(value as VendorStatus)}
        hint="Alur: Dihubungi → Nego → Deal → DP → Lunas."
      />

      <NumberInput
        label="Nominal deal (opsional)"
        prefix="Rp"
        value={dealAmount}
        onValueChange={setDealAmount}
        placeholder="50000000"
        hint={
          parseAmount(dealAmount) > 0
            ? `= ${formatIDR(parseAmount(dealAmount))}`
            : "Kosongkan bila belum ada kesepakatan harga."
        }
      />

      <Input
        label="Deadline pembayaran (opsional)"
        type="date"
        hint="Akan muncul highlight H-7 / H-3 / H-1 di timeline."
        value={paymentDeadline}
        onChange={(event) => setPaymentDeadline(event.target.value)}
      />

      <div>
        <label
          htmlFor="vendor-notes"
          className="mb-1 block text-sm font-medium text-neutral-700"
        >
          Catatan (opsional)
        </label>
        <textarea
          id="vendor-notes"
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Contoh: DP 50% saat kontrak, sisa H-7."
          className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
        />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" size="lg" onClick={onClose}>
          Batal
        </Button>
        <Button type="submit" size="lg" loading={saving}>
          {mode === "add" ? "Tambah vendor" : "Simpan perubahan"}
        </Button>
      </div>
    </form>
  );
}
