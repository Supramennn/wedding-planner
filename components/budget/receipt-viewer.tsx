"use client";

import { useEffect, useState } from "react";
import { loadReceiptObjectUrl } from "@/lib/receipt-service";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Modal penampil foto struk dari subcollection `receipts` (Firestore).
 * Memuat bytes → objectURL saat dibuka; URL dicabut saat ditutup.
 */
export function ReceiptViewer({
  uid,
  receiptId,
  onClose,
}: {
  uid: string;
  receiptId: string;
  onClose: () => void;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    loadReceiptObjectUrl(uid, receiptId)
      .then((url) => {
        if (!active) {
          URL.revokeObjectURL(url);
          return;
        }
        createdUrl = url;
        setObjectUrl(url);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [uid, receiptId]);

  return (
    <Modal open onClose={onClose} title="Struk">
      {failed ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Struk tidak bisa dimuat (mungkin sudah dihapus).
        </div>
      ) : objectUrl ? (
        // objectURL dari bytes lokal — alt deskriptif + larang zoom besar.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={objectUrl}
          alt="Foto struk pengeluaran"
          className="mx-auto max-h-[60svh] w-auto rounded-xl border border-neutral-200"
        />
      ) : (
        <Skeleton className="h-64 w-full" />
      )}
      <div className="flex justify-end">
        <Button variant="outline" size="lg" onClick={onClose}>
          Tutup
        </Button>
      </div>
    </Modal>
  );
}
