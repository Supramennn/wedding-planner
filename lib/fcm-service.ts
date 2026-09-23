import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { deleteToken, getToken, onMessage, type Messaging } from "firebase/messaging";
import {
  FIREBASE_VAPID_KEY,
  getDb,
  getFirebaseMessaging,
  isFCMConfigured,
} from "@/lib/firebase";
import { deviceTokensPath } from "@/lib/collection-paths";
import type { DeviceToken } from "@/types";

/**
 * Web Push / FCM (Fase 2 — pengingat deadline) sisi klien:
 * - minta izin notifikasi browser,
 * - ambil token FCM (perlu VAPID key, NEXT_PUBLIC_FIREBASE_VAPID_KEY),
 * - simpan token di users/{uid}/devices/{token},
 * - listener pesan saat app sedang dibuka (foreground).
 *
 * Pengiriman notifikasi dilakukan Cloud Function terjadwal
 * (functions/ — lihat README bagian deploy), memakai token ini.
 */

export const NOTIFICATION_DENIED_MESSAGE =
  "Izin notifikasi ditolak oleh browser. Aktifkan lewat pengaturan situs (ikon gembok di address bar).";
export const NOTIFICATION_UNAVAILABLE_MESSAGE =
  "Notifikasi tidak mendukung di browser ini, atau layanan VAPID belum dikonfigurasi.";

function getMessagingOrThrow(): Messaging {
  if (!isFCMConfigured) {
    throw new Error(NOTIFICATION_UNAVAILABLE_MESSAGE);
  }
  return getFirebaseMessaging();
}

/** Minta izin notifikasi browser. Sukarela — bisa dinyalakan ulang kapan saja. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

/** Daftarkan browser ini untuk reminder — simpan token per akun. */
export async function registerForReminders(uid: string): Promise<string> {
  const allowed = await ensureNotificationPermission();
  if (!allowed) {
    throw new Error(NOTIFICATION_DENIED_MESSAGE);
  }
  const messaging = getMessagingOrThrow();
  const token = await getToken(messaging, {
    vapidKey: FIREBASE_VAPID_KEY,
  });
  if (!token) {
    throw new Error("Gagal mengambil token notifikasi. Coba lagi.");
  }
  await saveDeviceTokenForUser(uid, token);
  return token;
}

/** Simpan token FCM di users/{uid}/devices/{token} (id = token). */
export async function saveDeviceTokenForUser(
  uid: string,
  token: string
): Promise<void> {
  const ref = doc(getDb(), deviceTokensPath(uid), token);
  await setDoc(
    ref,
    {
      token,
      platform: "web" as const,
      createdAt: Date.now(),
    } satisfies Omit<DeviceToken, "id">,
    { merge: true }
  );
}

/** Cabut registrasi FCM device ini. @returns token yang dicabut (bila ada). */
export async function unregisterForReminders(): Promise<string | null> {
  const messaging = getMessagingOrThrow();
  const current = await getToken(messaging, { vapidKey: FIREBASE_VAPID_KEY });
  if (current) {
    try {
      await deleteToken(messaging);
    } catch {
      // Token lama mungkin sudah tidak valid; lanjut menghapus rekaman.
    }
    return current;
  }
  return null;
}

export async function removeDeviceTokenForUser(
  uid: string,
  token: string
): Promise<void> {
  await deleteDoc(doc(getDb(), deviceTokensPath(uid), token));
}

/**
 * Listener pesan saat app terbuka (foreground) — FCM default tidak
 * menampilkan notifikasi ketika tab aktif. Hasilnya dipakai card/snackbar.
 */
export function subscribeToForegroundMessages(
  handler: (payload: { title: string; body: string }) => void
): () => void {
  if (!isFCMConfigured) return () => undefined;
  const messaging = getMessagingOrThrow();
  const payloadHandler = (payload: unknown) => {
    const data = payload as { data?: Record<string, string>; notification?: { title?: string; body?: string } };
    const title = data.data?.title || data.notification?.title || "";
    const body = data.data?.body || data.notification?.body || "";
    if (title || body) handler({ title, body });
  };
  const unsubscribe = onMessage(messaging, payloadHandler as never);
  return unsubscribe;
}