"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/lib/hooks/auth-context";
import { useCollection } from "@/lib/hooks/use-collection";
import { vendorsPath } from "@/lib/collection-paths";
import { VENDOR_STATUSES, VENDOR_STATUS_LABELS, VENDOR_STATUS_TONES } from "@/lib/constants";
import { formatIDR } from "@/lib/format";
import { deleteVendor } from "@/lib/vendor-service";
import type { Vendor } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { CardSkeleton } from "@/components/ui/skeleton";
import { VendorForm } from "@/components/vendors/vendor-form";
import { VendorList, VendorTimeline } from "@/components/vendors/vendor-list";

type ViewMode = "list" | "timeline";

const ACTION_ERROR =
  "Gagal menyimpan perubahan. Periksa koneksi internet Anda.";

/** Modul Timeline Vendor (FR-17 s/d FR-19). */
export function VendorView() {
  const { workspaceUid } = useAuth();
  const { items: vendors, loading, error } = useCollection<Vendor>(
    workspaceUid ? vendorsPath(workspaceUid) : null,
    { orderBy: { field: "createdAt" } }
  );

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [formTarget, setFormTarget] = useState<
    { mode: "add" } | { mode: "edit"; vendor: Vendor } | null
  >(null);
  const [pendingDelete, setPendingDelete] = useState<Vendor | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(
      VENDOR_STATUSES.map((status) => [status, 0])
    ) as Record<(typeof VENDOR_STATUSES)[number], number>;
    for (const vendor of vendors) {
      if (vendor.status in counts) counts[vendor.status] += 1;
    }
    return counts;
  }, [vendors]);

  const totalDeal = useMemo(
    () =>
      vendors
        .filter(
          (vendor) =>
            vendor.status === "deal" ||
            vendor.status === "dp" ||
            vendor.status === "lunas"
        )
        .reduce((sum, vendor) => sum + (vendor.dealAmount || 0), 0),
    [vendors]
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">
            Timeline Vendor
          </h1>
          <p className="text-sm text-neutral-500">
            {vendors.length} vendor
            {totalDeal > 0 && ` · total deal ${formatIDR(totalDeal)}`}
          </p>
        </div>
        <Button
          size="md"
          onClick={() => setFormTarget({ mode: "add" })}
          disabled={!workspaceUid}
        >
          + Tambah vendor
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

      {/* Ringkasan status (FR-07 + FR-17 alur status) */}
      {vendors.length > 0 && (
        <Card>
          <div className="flex flex-wrap gap-2">
            {VENDOR_STATUSES.map((status) => (
              <span
                key={status}
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-2.5 py-1 text-xs text-neutral-600"
              >
                <Badge tone={VENDOR_STATUS_TONES[status]}>
                  {VENDOR_STATUS_LABELS[status]}
                </Badge>
                <span className="font-semibold tabular-nums">
                  {statusCounts[status]}
                </span>
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Toggle dua mode tampilan (FR-18) */}
      <div
        className="grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1"
        role="group"
        aria-label="Mode tampilan"
      >
        {(
          [
            { id: "list", label: "Daftar" },
            { id: "timeline", label: "Timeline" },
          ] as const
        ).map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={viewMode === option.id}
            onClick={() => setViewMode(option.id)}
            className={`min-h-10 rounded-lg px-3 text-sm font-medium transition-colors ${
              viewMode === option.id
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {viewMode === "list" ? (
        <VendorList
          vendors={vendors}
          onEdit={(vendor) => setFormTarget({ mode: "edit", vendor })}
          onDelete={(vendor) => setPendingDelete(vendor)}
        />
      ) : (
        <VendorTimeline
          vendors={vendors}
          onEdit={(vendor) => setFormTarget({ mode: "edit", vendor })}
        />
      )}

      {/* Modal tambah/ubah vendor (FR-17) */}
      <Modal
        open={formTarget !== null}
        onClose={() => setFormTarget(null)}
        title={formTarget?.mode === "edit" ? "Ubah vendor" : "Tambah vendor"}
      >
        {formTarget && workspaceUid && (
          <VendorForm
            key={formTarget.mode === "edit" ? formTarget.vendor.id : "new"}
            uid={workspaceUid}
            mode={formTarget.mode}
            vendor={formTarget.mode === "edit" ? formTarget.vendor : null}
            onClose={() => setFormTarget(null)}
          />
        )}
      </Modal>

      {/* Modal konfirmasi hapus */}
      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Hapus vendor?"
      >
        <p className="text-sm text-neutral-600">
          Vendor{" "}
          <span className="font-medium text-neutral-900">
            {pendingDelete?.name}
          </span>{" "}
          beserta datanya akan dihapus permanen.
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setPendingDelete(null)}
          >
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
                await deleteVendor(workspaceUid, pendingDelete.id);
                setPendingDelete(null);
              })
            }
          >
            Hapus
          </Button>
        </div>
      </Modal>
    </div>
  );
}
