"use client";

import { useCallback, useMemo, useRef, useState } from "react";

/**
 * Toggle optimistis untuk item realtime (checklist & item persiapan).
 *
 * Masalah yang diselesaikan: checkbox lama di-disable selama menulis ke
 * Firestore, jadi di jaringan lambat user menekan lalu tidak terjadi apa-apa
 * sampai round-trip selesai. Terasa seperti aplikasi mati.
 *
 * Pendekatan: nilai lokal berubah seketika saat diklik, lalu snapshot
 * Firestore yang menentukan kebenaran. Override hanya berlaku selama
 * snapshot belum menyusul, dan dibatalkan begitu gagal simpan. UI jadi
 * terasa instan tapi tidak pernah berbohong soal kondisi server.
 *
 * Catatan: `liveItems` dipakai menghitung statistik dan progress juga,
 * bukan cuma centang, supaya angka di layar ikut bergerak seketika.
 */

export type ToggleField = "isCompleted" | "isDone";

export function useOptimisticToggle<
  T extends { id: string } & Partial<Record<ToggleField, boolean>>,
>(items: T[], field: ToggleField) {
  /** Override yang masih menunggu snapshot, per id item. */
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  /** Meniru proteksi `disabled` lama: satu write per item sekaligus. */
  const inFlight = useRef<Set<string>>(new Set());

  /**
   * Buang override yang sudah dikejar snapshot, atau yang itemnya hilang.
   *
   * Ini harus terjadi, bukan hanya "diabaikan saat dibaca": kalau override
   * basi dibiarkan, lalu pasangan mengubah item yang sama ke nilai
   * sebaliknya, snapshot disagreed terus dan override kita tetap menang,
   * sehingga perubahan pasangan tidak pernah terlihat.
   *
   * State dihitung ulang saat render (pola "adjust state when props change"
   * milik React) alih-alih useEffect, supaya tidak ada render berantai dan
   * ref tidak perlu dibaca saat render.
   */
  if (Object.keys(overrides).length > 0) {
    const stale = Object.keys(overrides).filter((id) => {
      const item = items.find((candidate) => candidate.id === id);
      return !item || item[field] === overrides[id];
    });
    if (stale.length > 0) {
      const next = { ...overrides };
      for (const id of stale) delete next[id];
      setOverrides(next);
    }
  }

  const liveItems = useMemo(
    () =>
      items.map((item) =>
        overrides[item.id] !== undefined
          ? { ...item, [field]: overrides[item.id] }
          : item
      ),
    [items, overrides, field]
  );

  const toggle = useCallback(
    (
      item: T,
      commit: (id: string, next: boolean) => Promise<void>,
      onError: () => void
    ) => {
      const id = item.id;
      if (inFlight.current.has(id)) return;

      const current = overrides[id] ?? Boolean(item[field]);
      const next = !current;
      inFlight.current.add(id);
      setOverrides((prev) => ({ ...prev, [id]: next }));

      void commit(id, next)
        .catch(() => {
          // Kembalikan ke kondisi server supaya user tidak melihat centang
          // yang sebenarnya gagal tersimpan.
          setOverrides((prev) => {
            const copy = { ...prev };
            delete copy[id];
            return copy;
          });
          onError();
        })
        .finally(() => {
          inFlight.current.delete(id);
        });
    },
    [overrides, field]
  );

  return { liveItems, toggle };
}
