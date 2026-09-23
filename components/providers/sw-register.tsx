"use client";

import { useEffect } from "react";

/**
 * Pendaftaran service worker (FR-21).
 * Hanya di production — di `next dev` SW sengaja tidak aktif agar
 * perubahan kode tidak pernah terkena cache stale saat dikembangkan.
 */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        // PWA tetap terbuka tanpa SW; fitur offline hanya hilang (bukan crash).
      });
  }, []);

  return null;
}
