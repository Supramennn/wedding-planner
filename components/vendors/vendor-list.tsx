"use client";

import { useMemo, useState } from "react";
import { VENDOR_STATUS_LABELS, VENDOR_STATUS_TONES } from "@/lib/constants";
import { daysUntil, formatIDR } from "@/lib/format";
import type { Vendor } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { DeadlineBadge } from "@/components/vendors/deadline-badge";

type SortKey = "deadline" | "name" | "amount";

const SORT_OPTIONS = [
  { value: "deadline", label: "Deadline terdekat" },
  { value: "name", label: "Nama (A–Z)" },
  { value: "amount", label: "Nominal terbesar" },
];

function sortVendors(vendors: Vendor[], key: SortKey): Vendor[] {
  const list = [...vendors];
  if (key === "name") {
    return list.sort((a, b) => a.name.localeCompare(b.name, "id"));
  }
  if (key === "amount") {
    return list.sort((a, b) => (b.dealAmount || 0) - (a.dealAmount || 0));
  }
  // deadline: tanggal terdekat dulu; tanpa deadline di akhir.
  return list.sort((a, b) => {
    if (!a.paymentDeadline && !b.paymentDeadline) return 0;
    if (!a.paymentDeadline) return 1;
    if (!b.paymentDeadline) return -1;
    return a.paymentDeadline.localeCompare(b.paymentDeadline);
  });
}

/** FR-18: tampilan list (sortable) — urut deadline/nama/nominal. */
export function VendorList({
  vendors,
  onEdit,
  onDelete,
}: {
  vendors: Vendor[];
  onEdit: (vendor: Vendor) => void;
  onDelete: (vendor: Vendor) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("deadline");
  const sorted = useMemo(() => sortVendors(vendors, sortKey), [vendors, sortKey]);

  if (vendors.length === 0) {
    return (
      <EmptyState
        title="Belum ada vendor"
        description="Catat vendor (venue, katering, fotografer, dll) beserta status dan deadline pembayarannya."
      />
    );
  }

  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <p className="text-sm text-neutral-500">{vendors.length} vendor</p>
        <div className="w-56">
          <Select
            label="Urutkan"
            options={SORT_OPTIONS}
            value={sortKey}
            onValueChange={(value) => setSortKey(value as SortKey)}
          />
        </div>
      </div>

      <ul className="mt-3 space-y-3">
        {sorted.map((vendor) => (
          <li
            key={vendor.id}
            className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-neutral-900">
                    {vendor.name}
                  </p>
                  <Badge tone={VENDOR_STATUS_TONES[vendor.status]}>
                    {VENDOR_STATUS_LABELS[vendor.status]}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{vendor.category}</Badge>
                  <DeadlineBadge isoDate={vendor.paymentDeadline} />
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => onEdit(vendor)}
                >
                  Ubah
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => onDelete(vendor)}
                >
                  Hapus
                </Button>
              </div>
            </div>

            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-neutral-400">Kontak</dt>
                <dd className="mt-0.5 break-all text-neutral-700">
                  {vendor.contact || "-"}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-400">Nominal deal</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-neutral-700">
                  {vendor.dealAmount > 0 ? formatIDR(vendor.dealAmount) : "-"}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-400">Sisa waktu</dt>
                <dd className="mt-0.5 text-neutral-700">
                  {vendor.paymentDeadline
                    ? (() => {
                        const days = daysUntil(vendor.paymentDeadline);
                        if (days === null) return "-";
                        if (days < 0) return `Lewat ${Math.abs(days)} hari`;
                        if (days === 0) return "Hari ini";
                        return `${days} hari lagi`;
                      })()
                    : "-"}
                </dd>
              </div>
            </dl>

            {vendor.notes && (
              <p className="mt-2 whitespace-pre-line border-t border-neutral-100 pt-2 text-xs text-neutral-500">
                {vendor.notes}
              </p>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

/** FR-18: tampilan timeline — urut berdasarkan deadline pembayaran. */
export function VendorTimeline({
  vendors,
  onEdit,
}: {
  vendors: Vendor[];
  onEdit: (vendor: Vendor) => void;
}) {
  const { withDeadline, withoutDeadline } = useMemo(() => {
    const sorted = [...vendors].sort((a, b) => {
      if (!a.paymentDeadline && !b.paymentDeadline) return 0;
      if (!a.paymentDeadline) return 1;
      if (!b.paymentDeadline) return -1;
      return a.paymentDeadline.localeCompare(b.paymentDeadline);
    });
    return {
      withDeadline: sorted.filter((vendor) => vendor.paymentDeadline),
      withoutDeadline: sorted.filter((vendor) => !vendor.paymentDeadline),
    };
  }, [vendors]);

  if (vendors.length === 0) {
    return (
      <EmptyState
        title="Belum ada vendor"
        description="Tambahkan vendor dengan deadline pembayaran untuk melihat urutan timeline."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-base font-semibold text-neutral-900">
          Deadline pembayaran
        </h2>
        <p className="text-xs text-neutral-500">
          Diurutkan dari yang paling mendesak. Highlight H-7 / H-3 / H-1
          otomatis.
        </p>

        <ol className="relative mt-4 ml-2 border-l-2 border-neutral-200">
          {withDeadline.map((vendor) => (
            <li key={vendor.id} className="relative pb-5 pl-5 last:pb-0">
              <span
                aria-hidden="true"
                className={`absolute -left-[9px] top-1.5 size-3.5 rounded-full ring-4 ring-white ${
                  vendor.status === "lunas"
                    ? "bg-emerald-500"
                    : daysUntil(vendor.paymentDeadline) !== null &&
                        (daysUntil(vendor.paymentDeadline) as number) <= 7
                      ? "bg-rose-500"
                      : "bg-neutral-300"
                }`}
              />
              <div className="flex flex-wrap items-center gap-2">
                <DeadlineBadge isoDate={vendor.paymentDeadline} />
                <Badge tone={VENDOR_STATUS_TONES[vendor.status]}>
                  {VENDOR_STATUS_LABELS[vendor.status]}
                </Badge>
              </div>
              <button
                type="button"
                onClick={() => onEdit(vendor)}
                className="mt-1 block text-left text-sm font-semibold text-neutral-900 hover:text-rose-600 hover:underline"
              >
                {vendor.name}
              </button>
              <p className="text-xs text-neutral-500">
                {vendor.category}
                {vendor.dealAmount > 0 &&
                  ` · ${formatIDR(vendor.dealAmount)}`}
                {vendor.contact && ` · ${vendor.contact}`}
              </p>
            </li>
          ))}
        </ol>
      </Card>

      {withoutDeadline.length > 0 && (
        <Card>
          <h2 className="text-base font-semibold text-neutral-900">
            Tanpa deadline
          </h2>
          <ul className="mt-3 space-y-2">
            {withoutDeadline.map((vendor) => (
              <li
                key={vendor.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(vendor)}
                    className="text-sm font-medium text-neutral-900 hover:text-rose-600 hover:underline"
                  >
                    {vendor.name}
                  </button>
                  <Badge tone={VENDOR_STATUS_TONES[vendor.status]}>
                    {VENDOR_STATUS_LABELS[vendor.status]}
                  </Badge>
                </div>
                <span className="text-xs text-neutral-400">
                  {vendor.category}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
