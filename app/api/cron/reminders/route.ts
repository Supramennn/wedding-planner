import { NextResponse } from "next/server";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import {
  FieldValue,
  getFirestore,
  type DocumentReference,
} from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

/**
 * Cron pengirim push notification reminder (Phase 2 — FCM).
 *
 * Dijadwalkan Vercel (vercel.json → hourly). Alur:
 * 1. Otorisasi: header `Authorization: Bearer ${CRON_SECRET}` (Vercel cron
 *    mengirimkannya otomatis bila env CRON_SECRET di-set). Tanpa secret → 401.
 * 2. Jendela kirim 07.00–21.00 WIB (di luar jendela → skip, tidak ada
 *    notifikasi tengah malam).
 * 3. Untuk setiap workspace (dokumen users dengan weddingDate + token):
 *    - vendor `paymentDeadline` H-7/H-3/H-1/H-0 (hari-H = "hari ini")
 *    - checklist `dueDate` H-1/H-0 yang belum selesai
 * 4. Dedupe per (item, tanggal, offset) lewat `users/{uid}/reminderLog/{id}`
 *    → satu pengingat hanya dikirim sekali per hari-H.
 * 5. Token dikumpulkan dari dokumen pemilik + pasangan tertaut (partnerUid);
 *    unlink otomatis memutus kiriman ke mantan pasangan. Token mati
 *    (registration-token-not-registered/not-valid) di-prune dari asalnya.
 *
 * Environment (Vercel Production + .env.local):
 * - CRON_SECRET             : string acak rahasia.
 * - FIREBASE_SERVICE_ACCOUNT: JSON service account utuh (string).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const SEND_WINDOW = { startHour: 7, endHour: 21 };
const VENDOR_OFFSETS = [7, 3, 1, 0];
const CHECKLIST_OFFSETS = [1, 0];
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/registration-token-not-valid",
]);
const MONTHS_ID = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

/** Tanggal hari ini menurut WIB (UTC+7) — format "YYYY-MM-DD". */
function todayWib(): string {
  return new Date(Date.now() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

function hourWib(): number {
  return new Date(Date.now() + WIB_OFFSET_MS).getUTCHours();
}

/** Selisih hari dari `from` ke `to` (keduanya "YYYY-MM-DD"). */
function daysBetween(from: string, to: string): number {
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) return Number.NaN;
  return Math.round((toMs - fromMs) / 86_400_000);
}

function formatShort(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${day} ${MONTHS_ID[month - 1]} ${year}`;
}

function formatIDR(value: unknown): string {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function hLabel(offset: number): string {
  return offset === 0 ? "hari ini" : `H-${offset}`;
}

interface PendingMessage {
  logId: string;
  title: string;
  body: string;
  url: string;
}

export async function GET(request: Request): Promise<Response> {
  // 1) Otorisasi — gagal-tertutup: tanpa CRON_SECRET terkonfigurasi → tolak.
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization") ?? "";
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // 2) Jendela kirim WIB.
  const hour = hourWib();
  if (hour < SEND_WINDOW.startHour || hour >= SEND_WINDOW.endHour) {
    return NextResponse.json({
      ok: true,
      skipped: "outside-send-window",
      hour,
    });
  }

  // 3) Kredensial Admin SDK.
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccount) {
    return NextResponse.json(
      { ok: false, error: "FIREBASE_SERVICE_ACCOUNT belum di-set" },
      { status: 503 }
    );
  }

  let app;
  try {
    app =
      getApps()[0] ??
      initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
  } catch {
    return NextResponse.json(
      { ok: false, error: "FIREBASE_SERVICE_ACCOUNT tidak valid" },
      { status: 503 }
    );
  }

  const db = getFirestore(app);
  const messaging = getMessaging(app);
  const today = todayWib();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const iconUrl = appUrl ? `${appUrl}/icons/icon-192.png` : undefined;

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let pruned = 0;

  try {
    const usersSnapshot = await db.collection("users").get();

    for (const userDoc of usersSnapshot.docs) {
      const uid = userDoc.id;
      const profile = userDoc.data();
      // Hanya workspace yang sudah onboarding (weddingDate terisi).
      if (!profile.weddingDate) continue;

      // Kumpulkan token: pemilik + pasangan tertaut (unik per token),
      // beserta dokumen asalnya untuk pruning bila token mati.
      const tokenSources = new Map<string, DocumentReference>();
      const collectTokens = (snapshot: FirebaseFirestore.DocumentSnapshot) => {
        const tokens: unknown = snapshot.data()?.fcmTokens;
        if (Array.isArray(tokens)) {
          for (const token of tokens) {
            if (typeof token === "string" && token) {
              tokenSources.set(token, snapshot.ref);
            }
          }
        }
      };
      collectTokens(userDoc);
      if (profile.partnerUid) {
        const partnerSnapshot = await db
          .doc(`users/${profile.partnerUid}`)
          .get();
        if (partnerSnapshot.exists) collectTokens(partnerSnapshot);
      }
      const tokens = Array.from(tokenSources.keys());
      if (tokens.length === 0) continue;

      const pending: PendingMessage[] = [];

      // Vendor: jatuh tempo pembayaran H-7/H-3/H-1/H-0.
      const vendors = await db.collection(`users/${uid}/vendors`).get();
      for (const vendorSnapshot of vendors.docs) {
        const vendor = vendorSnapshot.data();
        const deadline: string = vendor.paymentDeadline ?? "";
        if (!deadline) continue;
        const offset = daysBetween(today, deadline);
        if (!VENDOR_OFFSETS.includes(offset)) continue;
        pending.push({
          logId: `vendor-${vendorSnapshot.id}-${deadline}-H${offset}`,
          title: "Pengingat pembayaran vendor",
          body: `${vendor.name ?? "Vendor"} · ${formatIDR(vendor.dealAmount)} · jatuh tempo ${formatShort(deadline)} (${hLabel(offset)})`,
          url: "/vendors",
        });
      }

      // Checklist: tenggat H-1/H-0 yang belum selesai.
      const checklist = await db.collection(`users/${uid}/checklist`).get();
      for (const itemSnapshot of checklist.docs) {
        const item = itemSnapshot.data();
        if (item.isCompleted || !item.dueDate) continue;
        const offset = daysBetween(today, item.dueDate);
        if (!CHECKLIST_OFFSETS.includes(offset)) continue;
        pending.push({
          logId: `checklist-${itemSnapshot.id}-${item.dueDate}-H${offset}`,
          title: "Pengingat tugas checklist",
          body: `${item.title} · tenggat ${formatShort(item.dueDate)} (${hLabel(offset)})`,
          url: "/checklist",
        });
      }

      for (const message of pending) {
        const logRef = db.doc(`users/${uid}/reminderLog/${message.logId}`);
        try {
          // Dedupe: kirim sekali per (item, tanggal, offset).
          if ((await logRef.get()).exists) {
            skipped += 1;
            continue;
          }

          const multicast = await messaging.sendEachForMulticast({
            tokens,
            notification: {
              title: message.title,
              body: message.body,
              ...(iconUrl ? { icon: iconUrl } : {}),
            },
            data: { url: message.url },
            ...(appUrl
              ? { webpush: { fcmOptions: { link: `${appUrl}${message.url}` } } }
              : {}),
          });

          // Buang token mati dari dokumen asalnya.
          const deadByDoc = new Map<DocumentReference, string[]>();
          multicast.responses.forEach((response, index) => {
            const code = response.error?.code;
            if (response.error && code && DEAD_TOKEN_CODES.has(code)) {
              const token = tokens[index];
              const sourceRef = tokenSources.get(token);
              if (!sourceRef) return;
              const list = deadByDoc.get(sourceRef) ?? [];
              list.push(token);
              deadByDoc.set(sourceRef, list);
            }
          });
          for (const [sourceRef, deadTokens] of deadByDoc) {
            await sourceRef.update({
              fcmTokens: FieldValue.arrayRemove(...deadTokens),
            });
            pruned += deadTokens.length;
          }

          if (multicast.successCount > 0) {
            await logRef.set({
              createdAt: Date.now(),
              successCount: multicast.successCount,
              title: message.title,
            });
            sent += multicast.successCount;
          } else {
            failed += 1;
          }
        } catch (error) {
          failed += 1;
          console.error("reminder gagal", uid, message.logId, error);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      today,
      sent,
      skipped,
      failed,
      pruned,
    });
  } catch (error) {
    console.error("cron reminders error", error);
    return NextResponse.json(
      { ok: false, error: "internal", sent, skipped, failed },
      { status: 500 }
    );
  }
}
