import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import type { User } from "firebase/auth";
import { getDb, getFirebaseFunctions } from "@/lib/firebase";
import {
  budgetPath,
  checklistPath,
  legacyBudgetPath,
  legacyChecklistPath,
  legacyVendorsPath,
  vendorsPath,
  weddingDocPath,
  weddingInvitePath,
} from "@/lib/collection-paths";
import type { UserProfile, Wedding } from "@/types";

/**
 * Service data pernikahan BERSAMA (Fase 2 — kolaborasi 2 akun pasangan).
 *
 * Skema: weddings/{weddingId} dengan members: [uidA, uidB] (maks 2).
 * id dokumen = uid pembuat (deterministik) sehingga pembuatan ulang
 * idempotent (tanpa duplikasi) saat migrasi akun lama.
 *
 * Migrasi lazy akun lama (data di users/{uid}):
 * 1. buat/isi weddings/{id} dari field legacy (weddingDate/venue/totalBudget),
 * 2. salin subcollection lama -> weddings/{id}/... bila target masih kosong,
 * 3. set users/{uid}.weddingId (AuthContext lalu realtime subscribe).
 * Struk lama TIDAK dipindah (URL tetap valid; rules member diijinkan baca).
 */

export const WEDDING_MIGRATION_ERROR =
  "Gagal menyiapkan data kolaborasi. Periksa koneksi internet Anda lalu coba lagi.";

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa O/0/I/1

/** Kode undangan 6 karakter (aman dibaca, tanpa karakter mudah tertukar). */
function generateInviteCode(): string {
  let code = "";
  const values = new Uint32Array(6);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(values);
  } else {
    for (let i = 0; i < values.length; i += 1) values[i] = Math.floor(Math.random() * 0xffffffff);
  }
  for (let i = 0; i < 6; i += 1) {
    code += INVITE_ALPHABET[values[i] % INVITE_ALPHABET.length];
  }
  return code;
}

/**
 * Alokasikan kode undangan unik (doc id = kode menjamin keunikan).
 * Bila tabisi (already-exists), regenerasi sampai berhasil.
 */
async function resolveInviteCode(weddingId: string): Promise<string> {
  const db = getDb();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateInviteCode();
    try {
      await setDoc(doc(db, weddingInvitePath(code)), {
        weddingId,
        createdAt: Date.now(),
      });
      return code;
    } catch (error) {
      const code_ = (error as { code?: string } | null)?.code;
      if (code_ === "already-exists") continue;
      throw error;
    }
  }
  throw new Error("Gagal membuat kode undangan. Coba lagi.");
}

/**
 * Salin subcollection legacy -> weddings/{id} bila target masih kosong
 * (aman dipanggil berulang: tidak pernah menggandakan data).
 */
async function copyCollectionIfEmpty(
  sourcePath: string,
  targetPath: string
): Promise<void> {
  const db = getDb();
  const source = await getDocs(collection(db, sourcePath));
  if (source.empty) return;

  const targetRef = collection(db, targetPath);
  const existing = await getDocs(query(targetRef, limit(1)));
  if (!existing.empty) return;

  // Batch dibagi per 400 dokumen (batas aman writeBatch adalah 500).
  const docs = source.docs;
  let batch = writeBatch(db);
  let pending = 0;
  for (const snapshot of docs) {
    batch.set(doc(targetRef, snapshot.id), snapshot.data());
    pending += 1;
    if (pending >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      pending = 0;
    }
  }
  if (pending > 0) await batch.commit();
}

export interface EnsureWeddingInput {
  /** "" = pakai nilai legacy/wedding yang sudah ada. */
  weddingDate?: string;
  venue?: string;
}

/**
 * Buat/isi dokumen weddings/{uid} lalu tandai users/{uid}.weddingId.
 * Dipakai dua alur:
 * - onboarding baru (weddingDate/venue dari wizard),
 * - migrasi akun legacy (field legacy disalin dari users/{uid}).
 * Idempotent: aman dipanggil berulang/tanpa jaringan terputus di tengah.
 */
export async function ensureWedding(
  user: User,
  input: EnsureWeddingInput = {}
): Promise<string> {
  const db = getDb();
  const weddingId = user.uid;
  const weddingRef = doc(db, weddingDocPath(weddingId));

  const profileSnapshot = await getDoc(doc(db, "users", user.uid));
  const profile = (
    profileSnapshot.exists() ? profileSnapshot.data() : {}
  ) as Partial<UserProfile>;

  const existingSnapshot = await getDoc(weddingRef);
  const existing = existingSnapshot.exists()
    ? (existingSnapshot.data() as Partial<Wedding>)
    : null;

  const coupleNames: Record<string, string> = { ...(existing?.coupleNames ?? {}) };
  const ownName = user.displayName || profile.displayName || "";
  if (ownName) coupleNames[user.uid] = ownName;

  const payload: Record<string, unknown> = {
    weddingDate:
      input.weddingDate || existing?.weddingDate || profile.weddingDate || "",
    venue: input.venue ?? existing?.venue ?? profile.venue ?? "",
    coupleNames,
    createdBy: existing?.createdBy ?? user.uid,
    createdAt: existing?.createdAt ?? Date.now(),
  };
  const totalBudget = profile.totalBudget ?? existing?.totalBudget;
  if (typeof totalBudget === "number") payload.totalBudget = totalBudget;
  if (!existing) payload.members = [user.uid];

  // 1) Inisialisasi dokumen wedding DI DAHULU (tanpa inviteCode) — rule
  //    `weddingInvites.create` mensyaratkan wedding sudah tersedia (isMemberOf).
  await setDoc(weddingRef, payload, { merge: true });

  const inviteCode =
    existing?.inviteCode ?? (await resolveInviteCode(weddingId));
  // 2) Kode undangan baru — wedding sudah ada sehingga created-by-member valid.
  await setDoc(weddingRef, { inviteCode }, { merge: true });

  // Salin data legacy (aman: skip bila target sudah terisi).
  await copyCollectionIfEmpty(
    legacyChecklistPath(user.uid),
    checklistPath(weddingId)
  );
  await copyCollectionIfEmpty(legacyBudgetPath(user.uid), budgetPath(weddingId));
  await copyCollectionIfEmpty(legacyVendorsPath(user.uid), vendorsPath(weddingId));

  // Tandai reference terakhir supaya AuthContext baru berlangganan
  // setelah dokumen & data bersama siap.
  await setDoc(doc(db, "users", user.uid), { weddingId }, { merge: true });
  return weddingId;
}

/** Simpan field data pernikahan (settings / onboarding edit). */
export async function saveWedding(
  weddingId: string,
  patch: Partial<Pick<Wedding, "weddingDate" | "venue" | "totalBudget">>
): Promise<void> {
  await setDoc(doc(getDb(), weddingDocPath(weddingId)), patch, { merge: true });
}

/** Baca kode undangan -> weddingId (client memverifikasi sebelum join). */
export async function getWeddingIdByInvite(
  code: string
): Promise<{ weddingId: string } | null> {
  const snapshot = await getDoc(
    doc(getDb(), weddingInvitePath(code.trim().toUpperCase()))
  );
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as { weddingId?: unknown };
  return typeof data.weddingId === "string" && data.weddingId
    ? { weddingId: data.weddingId }
    : null;
}

export interface JoinWeddingResult {
  weddingId: string;
  alreadyMember: boolean;
  coupleNames: Record<string, string>;
  members: string[];
}

/**
 * Join ke data pernikahan pasangan memakai kode undangan.
 * Validasi & penulisan atomik dilakukan Callable Function `joinWedding`
 * (admin SDK) — rules klien tidak boleh mengizinkan member menambah diri.
 */
export async function joinWeddingWithCode(
  code: string,
  displayName: string
): Promise<JoinWeddingResult> {
  const callable = httpsCallable<
    { code: string; displayName: string },
    JoinWeddingResult
  >(getFirebaseFunctions(), "joinWedding");
  const result = await callable({
    code: code.trim().toUpperCase(),
    displayName,
  });
  return result.data;
}

/**
 * Label pasangan untuk dashboard: "A & B".
 * Prioritas: coupleNames (Fase 2) -> profile legacy (displayName & partnerName).
 */
export function coupleLabel(
  wedding: Pick<Wedding, "coupleNames"> | null,
  profile: Pick<UserProfile, "displayName" | "partnerName"> | null
): string {
  const names = Object.values(wedding?.coupleNames ?? {}).filter(Boolean);
  if (names.length >= 2) return names.slice(0, 2).join(" & ");
  if (names.length === 1 && !profile?.partnerName) return names[0];
  if (profile?.displayName && profile?.partnerName) {
    return `${profile.displayName} & ${profile.partnerName}`;
  }
  if (names.length === 1) return names[0];
  return profile?.displayName || "";
}
