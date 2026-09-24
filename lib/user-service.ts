import { doc, getDoc, setDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { getDb } from "@/lib/firebase";
import type { UserProfile } from "@/types";

/**
 * Service untuk dokumen users/{userId}.
 * Satu-satunya tempat membaca/menulis profil pernikahan (single source of truth).
 */

const EMPTY_PROFILE = {
  partnerName: "",
  weddingDate: "",
  venue: "",
  // Field kolaborasi (Phase 2) selalu ada di dokumen baru agar ekspresi
  // rules tidak pernah error "No such property" pada akses field.
  partnerEmail: null,
  partnerUid: null,
  coupleStatus: null,
  linkedTo: null,
} as const;

function userDocPath(uid: string) {
  return doc(getDb(), "users", uid);
}

/**
 * Buat dokumen profil bila belum ada (dipanggil saat register & first
 * Google Sign-In). `merge: true` supaya login berulang tidak menimpa
 * data onboarding yang sudah ada.
 */
export async function ensureUserProfile(
  user: User,
  overrides: Partial<UserProfile> = {}
): Promise<void> {
  const ref = userDocPath(user.uid);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) {
    // Dokumen sudah ada: isi HANYA field yang belum ada (tanpa menimpa data).
    // Kebutuhan pasca-klaim undangan — dokumen pasangan bisa dibuat lebih
    // dulu oleh couple-service sebelum fungsi ini dipanggil saat login.
    const data = snapshot.data();
    const patch: Partial<UserProfile> = {};
    if (data.email === undefined) patch.email = user.email ?? "";
    if (data.createdAt === undefined) patch.createdAt = Date.now();
    if (Object.keys(patch).length > 0) {
      await setDoc(ref, patch, { merge: true });
    }
    return;
  }

  await setDoc(
    ref,
    {
      email: user.email ?? "",
      displayName: user.displayName ?? "",
      ...EMPTY_PROFILE,
      createdAt: Date.now(),
      ...overrides,
    },
    { merge: true }
  );
}

/** Simpan/update profil (dipakai onboarding wizard & halaman pengaturan / FR-03). */
export async function saveUserProfile(
  uid: string,
  profile: Partial<UserProfile>
): Promise<void> {
  await setDoc(userDocPath(uid), profile, { merge: true });
}
