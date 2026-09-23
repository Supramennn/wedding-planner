"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type OrderByDirection,
} from "firebase/firestore";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";

/**
 * Hook realtime untuk subcollection di bawah users/{uid}.
 * Perubahan langsung tersinkron (FR-11: tanpa tombol "save").
 *
 * Loading diturunkan (derived) dari key path terakhir yang berhasil dimuat,
 * sehingga tidak ada setState sinkron di dalam effect.
 */
export function useCollection<T extends { id: string }>(
  path: string[] | null,
  options: { orderBy?: { field: string; direction?: OrderByDirection } } = {}
): {
  items: T[];
  loading: boolean;
  error: string | null;
} {
  const pathKey = path ? path.join("/") : null;
  const orderField = options.orderBy?.field ?? null;
  const orderDirection = options.orderBy?.direction ?? "asc";

  const [items, setItems] = useState<T[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pathKey || !isFirebaseConfigured) return;

    // collection() menerima path ber-"/" lengkap, tanpa spread argumen.
    const baseCollection = collection(getDb(), pathKey);
    const q = orderField
      ? query(baseCollection, orderBy(orderField, orderDirection))
      : query(baseCollection);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setItems(
          snapshot.docs.map(
            (docSnapshot) =>
              ({ id: docSnapshot.id, ...docSnapshot.data() }) as T
          )
        );
        setLoadedKey(pathKey);
        setError(null);
      },
      () => {
        // Rules/koneksi bermasalah: hentikan loading & tampilkan pesan jelas.
        setLoadedKey(pathKey);
        setError("Gagal memuat data. Periksa koneksi internet Anda.");
      }
    );

    return unsubscribe;
  }, [pathKey, orderField, orderDirection]);

  const loading =
    isFirebaseConfigured &&
    (pathKey === null || loadedKey !== pathKey);

  return { items, loading, error };
}
