import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

/**
 * Inisialisasi Firebase (client-side) dari environment variables.
 * Konfigurasi dibaca lazily lewat getter agar halaman tetap bisa
 * di-build/di-render walau .env.local belum diisi (PWA/dev smoke test).
 */

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** true bila semua variabel NEXT_PUBLIC_FIREBASE_* sudah terisi. */
export const isFirebaseConfigured = Object.values(firebaseConfig).every(
  (value) => typeof value === "string" && value.length > 0
);

export const FIREBASE_NOT_CONFIGURED_MESSAGE =
  "Konfigurasi Firebase belum lengkap. Salin .env.local.example ke .env.local lalu isi nilai dari Firebase Console.";

function getConfiguredApp(): FirebaseApp {
  if (!isFirebaseConfigured) {
    throw new Error(FIREBASE_NOT_CONFIGURED_MESSAGE);
  }
  const existing = getApps();
  if (existing.length > 0) return existing[0];
  return initializeApp(firebaseConfig);
}

export function getFirebaseAuth(): Auth {
  return getAuth(getConfiguredApp());
}

export function getDb(): Firestore {
  return getFirestore(getConfiguredApp());
}

export function getFirebaseStorage(): FirebaseStorage {
  return getStorage(getConfiguredApp());
}
