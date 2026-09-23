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
  if (snapshot.exists()) return;

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
