"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/auth-context";
import {
  disablePushNotifications,
  enablePushNotifications,
  getSavedPushToken,
} from "@/lib/push/client";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";

type PermissionState = "granted" | "denied" | "default" | "unsupported";

const PERMISSION_LABEL: Record<PermissionState, string> = {
  granted: "Diizinkan",
  denied: "Diblokir browser",
  default: "Belum aktif",
  unsupported: "Tidak didukung",
};

/**
 * Kartu pengingat notifikasi push (Phase 2 — FCM).
 * Token FCM disimpan di profil workspace (fcmTokens[]) sehingga pengingat
 * diterima kedua akun pasangan. Pengiriman dilakukan cron di server.
 */
export function NotificationCard() {
  const { user, ownProfile, loading, profileLoading } = useAuth();

  const [permission, setPermission] = useState<PermissionState>("default");
  const [active, setActive] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);

  const ready = !loading && !profileLoading && Boolean(user);

  // Status awal: permission browser + apakah token sudah tersimpan di
  // dokumen AKUN INI (fcmTokens) — getToken TANPA memaksa prompt.
  useEffect(() => {
    if (!ready || !user) return;
    let cancelled = false;

    (async () => {
      const state: PermissionState =
        typeof Notification === "undefined"
          ? "unsupported"
          : (Notification.permission as PermissionState);
      if (cancelled) return;
      setPermission(state);

      if (state !== "granted") {
        setActive(false);
        setChecking(false);
        return;
      }
      const token = await getSavedPushToken();
      if (cancelled) return;
      setActive(
        Boolean(token && (ownProfile?.fcmTokens ?? []).includes(token))
      );
      setChecking(false);
    })();

    return () => {
      cancelled = true;
    };
    // profileLoading/fcmTokens berubah → status token bisa berubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user, profileLoading]);

  async function handleEnable() {
    if (busy || !user) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await enablePushNotifications(user.uid);
      switch (result) {
        case "enabled":
          setPermission("granted");
          setActive(true);
          setMessage({ tone: "ok", text: "Pengingat aktif ✓" });
          break;
        case "denied":
          setPermission("denied");
          setActive(false);
          setMessage({
            tone: "error",
            text: "Izin notifikasi ditolak. Izinkan lewat ikon gembok/pengaturan situs di browser.",
          });
          break;
        case "unsupported":
          setPermission("unsupported");
          setMessage({
            tone: "error",
            text: "Browser ini belum mendukung push. Di iOS, buka WedPlan dari Add to Home Screen (iOS 16.4+).",
          });
          break;
        case "no-config":
          setMessage({
            tone: "error",
            text: "VAPID key belum dikonfigurasi di environment (NEXT_PUBLIC_FIREBASE_VAPID_KEY).",
          });
          break;
        default:
          setMessage({
            tone: "error",
            text: "Gagal mengaktifkan. Coba lagi, atau pasang ulang PWA-nya.",
          });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    if (busy || !user) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await disablePushNotifications(user.uid);
      if (result === "disabled") {
        setActive(false);
        setMessage({ tone: "ok", text: "Pengingat dimatikan." });
      } else {
        setMessage({ tone: "error", text: "Gagal mematikan. Coba lagi." });
      }
    } finally {
      setBusy(false);
    }
  }

  if (!ready || checking) return <CardSkeleton lines={3} />;
  return (
    <Card>
      <CardTitle>Pengingat notifikasi</CardTitle>
      <CardDescription>
        Push H-7, H-3, H-1, dan H-0 (07.00–21.00 WIB) untuk jatuh tempo
        pembayaran vendor dan tenggat tugas checklist — diterima di HP meski
        PWA tertutup.
      </CardDescription>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-neutral-50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-neutral-800">
            Status: {PERMISSION_LABEL[permission]}
            {permission === "granted" && active && " · terkirim ke perangkat ini"}
          </p>
          {permission === "denied" && (
            <p className="mt-0.5 text-xs text-red-600">
              Buka pengaturan situs di browser → Notifikasi → Izinkan, lalu
              muat ulang halaman.
            </p>
          )}
          {permission === "unsupported" && (
            <p className="mt-0.5 text-xs text-amber-700">
              Chrome/Edge (Android &amp; desktop) atau Safari 16.4+ (iOS,
              dari Add to Home Screen).
            </p>
          )}
        </div>

        {permission === "granted" ? (
          active ? (
            <Button
              variant="outline"
              size="sm"
              loading={busy}
              onClick={handleDisable}
            >
              Matikan pengingat
            </Button>
          ) : (
            <Button size="sm" loading={busy} onClick={handleEnable}>
              Aktifkan pengingat
            </Button>
          )
        ) : permission === "default" ? (
          <Button size="sm" loading={busy} onClick={handleEnable}>
            Aktifkan pengingat
          </Button>
        ) : null}
      </div>

      {message && (
        <p
          className={`mt-3 text-sm font-medium ${
            message.tone === "ok" ? "text-emerald-600" : "text-red-600"
          }`}
          aria-live="polite"
        >
          {message.text}
        </p>
      )}
    </Card>
  );
}
