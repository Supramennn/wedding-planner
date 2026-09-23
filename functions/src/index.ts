import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";

/**
 * Cloud Functions WedPlan (Fase 2).
 *
 * 1. `joinWedding` (callable) — tambahkan akun kedua ke weddings/{id} via
 *    kode undangan. Menggunakan admin SDK karena security rules klien dengan
 *    sengaja TIDAK mengizinkan user menambah diri ke members orang lain.
 *    Kode undangan dipakai sekali (doc dihapus setelah join).
 *
 * 2. `scheduledDeadlineReminder` (onSchedule, tiap hari 02:00 Asia/Jakarta) —
 *    kirim Web Push/FCM ke semua device kedua anggota saat ada deadline
 *    checklist (dueDate) atau pembayaran vendor (paymentDeadline) yang jatuh
 *    tempo hari ini / H-1 / H-3 / H-7. Dedup tanpa index komposit:
 *    kueri single-field `in`, + dokumen dedup notifications/{key}.
 */

admin.initializeApp();
const db = admin.firestore();

const DEADLINE_OFFSET_DAYS = [0, 1, 3, 7];

// ---------------------------------------------------------------------------
// 1) joinWedding — Callable Function
// ---------------------------------------------------------------------------

interface JoinWeddingData {
  code: string;
  displayName: string;
}

interface JoinWeddingResult {
  weddingId: string;
  alreadyMember: boolean;
  coupleNames: Record<string, string>;
  members: string[];
}

export const joinWedding = onCall<JoinWeddingData, Promise<JoinWeddingResult>>(
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError(
        "unauthenticated",
        "Login diperlukan untuk bergabung."
      );
    }

    const code = String(request.data?.code ?? "").trim().toUpperCase();
    if (!/^[A-Z2-9]{6}$/.test(code)) {
      throw new HttpsError("invalid-argument", "Format kode undangan tidak valid.");
    }
    const displayName =
      typeof request.data?.displayName === "string"
        ? request.data.displayName.trim()
        : "";
    if (!displayName) {
      throw new HttpsError("invalid-argument", "Nama wajib diisi.");
    }

    try {
      return await db.runTransaction(async (tx) => {
        const inviteRef = db.doc(`weddingInvites/${code}`);
        const inviteSnap = await tx.get(inviteRef);
        if (!inviteSnap.exists) {
          throw new HttpsError("not-found", "Kode undangan tidak ditemukan.");
        }
        const weddingId = inviteSnap.get("weddingId") as string;
        if (!weddingId) {
          throw new HttpsError("not-found", "Kode undangan tidak valid.");
        }

        const weddingRef = db.doc(`weddings/${weddingId}`);
        const weddingSnap = await tx.get(weddingRef);
        if (!weddingSnap.exists) {
          throw new HttpsError(
            "not-found",
            "Data pernikahan tidak ditemukan."
          );
        }

        const wedding = weddingSnap.data() ?? {};
        const members = Array.isArray(wedding.members)
          ? (wedding.members as string[])
          : [];

        if (members.includes(uid)) {
          return {
            weddingId,
            alreadyMember: true,
            coupleNames: wedding.coupleNames ?? {},
            members,
          };
        }
        if (members.length >= 2) {
          throw new HttpsError(
            "failed-precondition",
            "Data pernikahan sudah penuh (maksimal 2 akun)."
          );
        }

        const coupleNames = {
          ...(wedding.coupleNames ?? {}),
          [uid]: displayName,
        };
        tx.update(weddingRef, {
          members: admin.firestore.FieldValue.arrayUnion(uid),
          coupleNames,
        });
        // Kode undangan sekali pakai.
        tx.delete(inviteRef);

        return {
          weddingId,
          alreadyMember: false,
          coupleNames,
          members: [...members, uid],
        };
      });
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("joinWedding gagal", error);
      throw new HttpsError("internal", "Gagal bergabung, coba lagi.");
    }
  }
);

// ---------------------------------------------------------------------------
// 2) scheduledDeadlineReminder — push deadline
// ---------------------------------------------------------------------------

interface GroupTarget {
  id: string;
  weddingDate: string;
  members: string[];
  legacy: boolean; // true = data masih di users/{uid}/... (belum login pasca-migrasi)
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** Tanggal deadline yang relevan: H-0, H-1, H-3, H-7 dari hari-H. */
function deadlineDates(weddingDate: string): string[] {
  const base = new Date(`${weddingDate}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return [];
  return DEADLINE_OFFSET_DAYS.map((offset) =>
    toIsoDate(addDays(base, -offset))
  );
}

async function collectGroups(): Promise<GroupTarget[]> {
  const groups: GroupTarget[] = [];

  // Data pernikahan bersama (post-migrasi).
  const weddingsSnap = await db
    .collection("weddings")
    .where("weddingDate", "!=", "")
    .get();
  weddingsSnap.forEach((snap) => {
    const data = snap.data();
    const weddingId = snap.id;
    const members = Array.isArray(data.members)
      ? (data.members as string[])
      : [];
    if (members.length === 0) return;
    groups.push({
      id: weddingId,
      weddingDate: data.weddingDate || "",
      members,
      legacy: false,
    });
  });

  // Akun lama yang belum pernah login pasca-migrasi (users/{uid} masih
  // menampung data; weddingId belum ada). Idempoten & aman: setelah mereka
  // login, migrasi memindahkan data ke weddings dan kelompok ini tak lagi
  // cocok karena queries memakai path weddings.
  const usersSnap = await db
    .collection("users")
    .where("weddingDate", "!=", "")
    .get();
  usersSnap.forEach((snap) => {
    const data = snap.data();
    if (data.weddingId) return; // sudah dimigrasi, urus di weddings loop
    groups.push({
      id: snap.id,
      weddingDate: data.weddingDate || "",
      members: [snap.id],
      legacy: true,
    });
  });

  return groups;
}

async function collectTokens(members: string[]): Promise<Map<string, string>> {
  const tokens = new Map<string, string>(); // token -> uid
  await Promise.all(
    members.map(async (uid) => {
      const snap = await db.collection(`users/${uid}/devices`).get();
      snap.forEach((docSnap) => {
        tokens.set(docSnap.id, uid);
      });
    })
  );
  return tokens;
}

interface PendingReminder {
  key: string;
  title: string;
  body: string;
  clickTarget: string;
}

/**
 * Kumpulkan reminder yang belum pernah dikirim (dokumen dedup di create).
 */
async function findReminders(
  group: GroupTarget
): Promise<{ reminders: PendingReminder[]; dates: string[] }> {
  const dates = deadlineDates(group.weddingDate);
  if (dates.length === 0) return { reminders: [], dates };
  const reminders: PendingReminder[] = [];

  const root = group.legacy ? `users/${group.id}` : `weddings/${group.id}`;

  // Checklist (kueri single-field `in` → tanpa index komposit).
  const checklistSnap = await db
    .collection(`${root}/checklist`)
    .where("dueDate", "in", dates)
    .get();
  checklistSnap.forEach((snap) => {
    const item = snap.data();
    if (item.isCompleted) return;
    if (!dates.includes(item.dueDate)) return;
    const offset = dates.indexOf(item.dueDate);
    const when = offset === 0 ? "hari ini" : `H-${offset}`;
    reminders.push({
      key: `${group.id}_${item.dueDate}_checklist_${snap.id}`,
      title: "Pengingat checklist",
      body: `Tugas "${item.title}" jatuh tempo ${when}.`,
      clickTarget: "/checklist",
    });
  });

  // Vendor — deadline pembayaran.
  const vendorSnap = await db
    .collection(`${root}/vendors`)
    .where("paymentDeadline", "in", dates)
    .get();
  vendorSnap.forEach((snap) => {
    const vendor = snap.data();
    if (!dates.includes(vendor.paymentDeadline)) return;
    const offset = dates.indexOf(vendor.paymentDeadline);
    const when = offset === 0 ? "hari ini" : `H-${offset}`;
    reminders.push({
      key: `${group.id}_${vendor.paymentDeadline}_vendor_${snap.id}`,
      title: "Pengingat pembayaran",
      body: `Deadline pembayaran vendor "${vendor.name}" ${when}.`,
      clickTarget: "/vendors",
    });
  });

  return { reminders, dates };
}

async function sendPush(
  group: GroupTarget,
  reminders: PendingReminder[]
): Promise<void> {
  const tokens = await collectTokens(group.members);
  if (tokens.size === 0) return;

  // Kirim satu notifikasi ringkasan (bukan per-item) agar tidak spam.
  const title =
    reminders.length === 1
      ? reminders[0].title
      : `${reminders.length} pengingat deadline`;
  const body =
    reminders.length === 1
      ? reminders[0].body
      : `Kamu punya ${reminders.length} deadline dalam beberapa hari ini.`;
  const clickTarget =
    reminders.length === 1 ? reminders[0].clickTarget : "/dashboard";

  const messages = Array.from(tokens.keys()).map((token) => ({
    token,
    notification: { title, body },
    data: {
      clickTarget,
      weddingId: group.id,
    },
  }));

  const response = await admin.messaging().sendEach(messages);
  let cleaned = 0;
  response.responses.forEach((result, index) => {
    if (result.success) return;
    const token = messages[index]?.token;
    if (!token) return;
    const code = result.error?.code ?? "";
    // Token lama/cabut izin — hapus agar tidak dikirimi lagi.
    if (
      code === "messaging/invalid-registration-token" ||
      code === "messaging/registration-token-not-registered" ||
      code === "messaging/not-registered"
    ) {
      const uid = tokens.get(token);
      if (uid) {
        void db.doc(`users/${uid}/devices/${token}`).delete();
        cleaned += 1;
      }
    }
  });
  if (cleaned > 0) {
    logger.info(`membersihkan ${cleaned} token FCM tidak valid`);
  }
}

export const scheduledDeadlineReminder = onSchedule(
  { schedule: "0 2 * * *", timeZone: "Asia/Jakarta" },
  async () => {
    const groups = await collectGroups();
    let sent = 0;

    for (const group of groups) {
      if (!group.weddingDate) continue;
      const { reminders } = await findReminders(group);
      if (reminders.length === 0) continue;

      // Dedup: hanya kirim yang belum pernah tercatat (create gagal bila ada).
      const fresh: PendingReminder[] = [];
      for (const reminder of reminders) {
        try {
          await db.doc(`notifications/${reminder.key}`).create({
            sentAt: Date.now(),
            weddingId: group.id,
          });
          fresh.push(reminder);
        } catch {
          // Sudah pernah dikirim — lewati.
        }
      }
      if (fresh.length === 0) continue;

      await sendPush(group, fresh);
      sent += fresh.length;
    }

    if (sent > 0) logger.info(`kirim ${sent} reminder deadline`);
  }
);