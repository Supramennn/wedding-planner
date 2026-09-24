"use client";

import { deleteToken, getMessaging, getToken, isSupported } from "firebase/messaging";
import { arrayRemove, arrayUnion, doc, updateDoc } from "firebase/firestore";
import { getDb, getFirebaseApp, isFirebaseConfigured } from "@/lib/firebase";

/**
 * Klien push notification (Phase 2 — Firebase Cloud Messaging).
 *
 * - Token FCM disimpan di users/{uid akun INI}.fcmTokens (arrayUnion/
 *   arrayRemove → aman terhadap update paralel). Cron server mengumpulkan
 *   token workspace + pasangan tertaut; unlink otomatis memutus kiriman ke
 *   mantan pasangan tanpa pembersihan manual.
 * - Pengiriman pesan dilakukan SERVER (app/api/cron/reminders) — klien hanya
 *   meminta izin & mendaftarkan token.
 * - Payload notification ditampilkan browser otomatis; sw.js (notificationclick)
 *   membuka rute yang sesuai saat notifikasi diklik.
 */

export type PushResult =
  | "enabled"
  | "disabled"
  | "denied"
  | "unsupported"
  | "no-config"
  | "error";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

function browserSupportsPush(): boolean {
  return (
    typeof Notification !== "undefined" && "serviceWorker" in navigator
  );
}

/** Daftarkan/ambil token push (hanya setelah permission granted). */
async function fetchToken(): Promise<string | null> {
  if (!isFirebaseConfigured || !VAPID_KEY) return null;
  if (!(await isSupported())) return null;
  const registration = await navigator.serviceWorker.register("/sw.js");
  return getToken(getMessaging(getFirebaseApp()), {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
}

/** Aktifkan push untuk akun ini: izin → token → simpan ke dokumen sendiri. */
export async function enablePushNotifications(
  accountUid: string
): Promise<PushResult> {
  if (!isFirebaseConfigured || !VAPID_KEY) return "no-config";
  if (!browserSupportsPush()) return "unsupported";

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";
    if (!(await isSupported())) return "unsupported";

    const token = await fetchToken();
    if (!token) return "error";

    await updateDoc(doc(getDb(), "users", accountUid), {
      fcmTokens: arrayUnion(token),
    });
    return "enabled";
  } catch {
    return "error";
  }
}

/** Matikan push: cabut token dari dokumen sendiri lalu hapus langganan lokal. */
export async function disablePushNotifications(
  accountUid: string
): Promise<PushResult> {
  if (!isFirebaseConfigured || !VAPID_KEY) return "no-config";
  if (!browserSupportsPush()) return "unsupported";
  if (Notification.permission !== "granted") return "disabled";

  try {
    const token = await fetchToken();
    if (token) {
      await updateDoc(doc(getDb(), "users", accountUid), {
        fcmTokens: arrayRemove(token),
      });
      await deleteToken(getMessaging(getFirebaseApp()));
    }
    return "disabled";
  } catch {
    return "error";
  }
}

/**
 * Ambil token push TANPA memicu prompt permission (hanya bila sudah
 * granted) — dipakai NotificationCard untuk menampilkan status akurat.
 */
export async function getSavedPushToken(): Promise<string | null> {
  if (typeof Notification === "undefined") return null;
  if (Notification.permission !== "granted") return null;
  try {
    return await fetchToken();
  } catch {
    return null;
  }
}
