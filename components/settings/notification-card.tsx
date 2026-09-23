"use client";

import { useState } from "react";
import { useAuth } from "@/lib/hooks/auth-context";
import { isFCMConfigured } from "@/lib/firebase";
import {
  registerForReminders,
  removeDeviceTokenForUser,
  unregisterForReminders,
} from "@/lib/fcm-service";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";

/**
 * Kartu Pengingat (Fase 2) — kelola izin notifikasi & pendaftaran token FCM
 * untuk pengingat deadline (checklist & vendor) via Cloud Function terjadwal.
 *
 * Catatan: notifikasi dijalankan oleh service worker yang diregistrasi lewat
 * route /sw.js (lihat app/sw.js/route.ts). Tanpa itu, izin tercatat di
 * browser tetapi notifikasi background belum tampil.
 */
export function NotificationCard() {
  const { user, wedding, weddingLoading, isOnboarded } = useAuth();
  const [enabled, setEnabled] = useState(
    () =>
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    if (busy || !user || !wedding) return;
    setBusy(true);
    setError(null);
    try {
      if (enabled) {
        const token = await unregisterForReminders();
        if (token) await removeDeviceTokenForUser(user.uid, token);
        setEnabled(false);
      } else {
        await registerForReminders(user.uid);
        setEnabled(true);
      }
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "Gagal mengubah pengaturan notifikasi. Coba lagi."
      );
    } finally {
      setBusy(false);
    }
  }

  if (weddingLoading || !isOnboarded || !user || !wedding) {
    return <CardSkeleton lines={3} />;
  }

  return (
    <Card className="p-5 sm:p-6">
      <CardTitle>Pengingat deadline</CardTitle>
      <CardDescription>
        Terima notifikasi saat checklist atau pembayaran vendor mendekati
        jadwalnya (H-7, H-3, H-1, dan hari-H dari tanggal yang ditetapkan).
      </CardDescription>

      {!isFCMConfigured && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Fitur ini belum aktif: tambahkan NEXT_PUBLIC_FIREBASE_VAPID_KEY di
          .env.local (baca README bagian FCM) lalu deploy Cloud Functions.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-neutral-600">
          Status:{" "}
          <span className="font-medium text-neutral-900">
            {enabled ? "Aktif di device ini" : "Nonaktif"}
          </span>
        </p>
        <Button
          variant={enabled ? "outline" : "primary"}
          size="lg"
          loading={busy}
          disabled={!isFCMConfigured}
          onClick={handleToggle}
        >
          {enabled ? "Nonaktifkan" : "Aktifkan"}
        </Button>
      </div>
    </Card>
  );
}