import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { getDb } from "@/lib/firebase";
import type { UserProfile } from "@/types";

/**
 * Service kolaborasi pasangan (Phase 2).
 *
 * Alur undangan (invite-by-email):
 * 1. Pemilik workspace mengisi `partnerEmail` di profilnya (status "invited").
 * 2. Pasangan daftar/masuk MEMAKAI email tersebut → auth-context otomatis
 *    memanggil `tryAutoClaimInvite` saat profil sendiri belum onboarding.
 * 3. Klaim menulis `partnerUid` di dokumen pemilik (diizinkan rules karena
 *    `partnerEmail` cocok dengan token email) + `linkedTo` di dokumen sendiri.
 * 4. Sejak itu `workspaceUid = linkedTo` → seluruh modul (checklist, budget,
 *    vendor, dashboard, struk) membaca/menulis ke SATU workspace; snapshot
 *    onSnapshot di kedua perangkat sinkron realtime.
 */

export interface InviteDoc {
  /** uid pemilik workspace (dokumen yang memuat partnerEmail). */
  uid: string;
  data: UserProfile;
}

/**
 * Cari workspace yang mengundang `email` ini.
 * Query divalidasi rules: client WAJIB men-filter dengan email sendiri
 * (request.auth.token.email), jadi tidak ada data orang lain yang bocor.
 */
export async function findInviteForEmail(
  email: string
): Promise<InviteDoc | null> {
  const snapshot = await getDocs(
    query(
      collection(getDb(), "users"),
      where("partnerEmail", "==", email),
      limit(1)
    )
  );
  const first = snapshot.docs[0];
  if (!first) return null;
  return { uid: first.id, data: first.data() as UserProfile };
}

/**
 * Klaim undangan: tautkan akun `user` ke workspace `ownerUid`.
 * Aman dipanggil ulang (idempoten) — dipakai auto-claim di auth-context.
 */
export async function claimInvite(ownerUid: string, user: User): Promise<void> {
  // 1) Tandai di dokumen pemilik (rules: partnerEmail == token.email,
  //    hanya boleh menyentuh field partnerUid & coupleStatus).
  await setDoc(
    doc(getDb(), "users", ownerUid),
    { partnerUid: user.uid, coupleStatus: "linked" },
    { merge: true }
  );
  // 2) Tandai di dokumen sendiri (setDoc merge → dibuat bila belum ada).
  await setDoc(
    doc(getDb(), "users", user.uid),
    { linkedTo: ownerUid, coupleStatus: "linked" },
    { merge: true }
  );
}

/**
 * Auto-claim untuk auth-context: hanya bila akun ini BELUM onboarding solo
 * (tidak ada data sendiri yang bisa clash) dan undangan masih berlaku.
 * Mengembalikan true bila klaim dijalankan.
 */
export async function tryAutoClaimInvite(user: User): Promise<boolean> {
  if (!user.email) return false;
  const invite = await findInviteForEmail(user.email);
  if (!invite || invite.uid === user.uid) return false;
  // Klaim hanya legal bila workspace sudah onboarding dan belum tertaut
  // ke akun lain. Dua akun yang sama-sama sudah punya data sendiri butuh
  // merge — di luar cakupan (lihat README Future Enhancement).
  if (!invite.data.weddingDate) return false;
  if (invite.data.partnerUid && invite.data.partnerUid !== user.uid) {
    return false;
  }
  await claimInvite(invite.uid, user);
  return true;
}

/** Batalkan undangan yang belum diterima (dipanggil pemilik workspace). */
export async function cancelInvite(uid: string): Promise<void> {
  await setDoc(
    doc(getDb(), "users", uid),
    { partnerEmail: null, coupleStatus: null },
    { merge: true }
  );
}

/**
 * Lepas tautan pasangan — membersihkan kedua dokumen (pemilik maupun
 * pasangan boleh memulai; rules mengizinkan kedua arah).
 */
export async function unlinkCouple(options: {
  /** uid dokumen milik sendiri. */
  myUid: string;
  /** Non-null bila akun INI adalah pasangan (linkedTo → pemilik workspace). */
  linkedTo: string | null;
  /** Non-null bila akun INI adalah pemilik (partnerUid → pasangan). */
  partnerUid: string | null;
}): Promise<void> {
  const { myUid, linkedTo, partnerUid } = options;

  if (linkedTo) {
    // Saya pasangan: hapus tautan di dokumen sendiri…
    await setDoc(
      doc(getDb(), "users", myUid),
      { linkedTo: null, coupleStatus: null },
      { merge: true }
    );
    // …lalu cabut akses di dokumen pemilik.
    await setDoc(
      doc(getDb(), "users", linkedTo),
      { partnerUid: null, partnerEmail: null, coupleStatus: null },
      { merge: true }
    );
    return;
  }

  if (partnerUid) {
    // Saya pemilik: hapus undangan/tautan di dokumen sendiri…
    await setDoc(
      doc(getDb(), "users", myUid),
      { partnerUid: null, partnerEmail: null, coupleStatus: null },
      { merge: true }
    );
    // …lalu cabut tautan di dokumen pasangan (rules: linkedTo == saya).
    await setDoc(
      doc(getDb(), "users", partnerUid),
      { linkedTo: null, coupleStatus: null },
      { merge: true }
    );
  }
}
