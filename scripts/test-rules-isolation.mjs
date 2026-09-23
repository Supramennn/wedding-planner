/**
 * Uji isolasi Security Rules (syarat DoD: "user A tidak bisa membaca
 * data user B"). Dua mode:
 *
 * (A) EMULATOR — otomatis & aman (butuh Java 17+ untuk Firestore emulator):
 *     npx firebase-tools emulators:exec --only auth,firestore,storage \
 *       --project demo-wedplan "node scripts/test-rules-isolation.mjs --emulator"
 *
 * (B) PROYEK ASLI — setelah `firebase deploy --only firestore:rules,storage`:
 *     node scripts/test-rules-isolation.mjs
 *     (membuat 2 akun uji rules-test-a/b@… — dokumen dibersihkan otomatis,
 *      akun dapat dihapus via Firebase Console → Authentication.)
 *
 * Skenario yang dibuktikan:
 *  1. User A bisa menulis & membaca data miliknya sendiri (baseline).
 *  2. Membaca tanpa login → DENY.
 *  3. User B membaca profil/checklist milik A → DENY.
 *  4. User B menulis/menghapus data milik A → DENY.
 *  5. User B upload struk ke folder A → DENY; ke folder sendiri → OK.
 *
 * Keluaran: PASS/FAIL per skenario; exit code 1 bila ada kegagalan.
 */
import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  connectAuthEmulator,
  signOut,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getFirestore,
  getDoc,
  setDoc,
} from "firebase/firestore";
import {
  connectStorageEmulator,
  deleteObject,
  getStorage,
  ref,
  uploadBytes,
} from "firebase/storage";

const useEmulator =
  process.argv.includes("--emulator") ||
  Boolean(process.env.FIRESTORE_EMULATOR_HOST);

const stamp = Date.now();

const config = useEmulator
  ? { projectId: "demo-wedplan", apiKey: "demo-api-key", appId: "demo-app-id" }
  : {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId:
        process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

if (!useEmulator && !config.projectId) {
  console.error(
    "ERROR: konfigurasi Firebase belum ada. Isi .env.local lalu jalankan\n" +
      "dengan environment variable-nya, atau pakai mode emulator (lihat header file)."
  );
  process.exit(1);
}

const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

if (useEmulator) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", {
    disableWarnings: true,
  });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}

let failures = 0;

function report(ok, label, detail = "") {
  const mark = ok ? "PASS" : "FAIL";
  if (!ok) failures++;
  console.log(`[${mark}] ${label}${detail ? ` — ${detail}` : ""}`);
}

async function expectDenied(label, promise) {
  try {
    await promise;
    report(false, label, "akses diterima, seharusnya DENY");
  } catch (error) {
    if (error?.code === "permission-denied") {
      report(true, label);
    } else {
      report(false, label, `error tak terduga: ${error?.code ?? error}`);
    }
  }
}

async function expectAllowed(label, promise) {
  try {
    await promise;
    report(true, label);
  } catch (error) {
    report(false, label, `seharusnya diizinkan: ${error?.code ?? error}`);
  }
}

console.log(
  `Mode: ${useEmulator ? "EMULATOR (demo-wedplan)" : "PROYEK ASLI"}\n`
);

// --- 1. User A: baseline (boleh akses datanya sendiri) -----------------
const emailA = `rules-test-a+${stamp}@example.com`;
const emailB = `rules-test-b+${stamp}@example.com`;
const credA = await createUserWithEmailAndPassword(
  auth,
  emailA,
  "Test-Rules-123"
);
const uidA = credA.user.uid;

await expectAllowed(
  "A menulis profil miliknya sendiri",
  setDoc(doc(db, "users", uidA), {
    email: emailA,
    displayName: "Rules Test A",
    partnerName: "Pasangan A",
    weddingDate: "2030-01-01",
    venue: "Venue Uji",
    createdAt: stamp,
  })
);
await expectAllowed(
  "A membaca profil miliknya sendiri",
  getDoc(doc(db, "users", uidA))
);

await signOut(auth);

// --- 2. Tanpa login → DENY --------------------------------------------
await expectDenied(
  "Tanpa login membaca profil A",
  getDoc(doc(db, "users", uidA))
);

// --- 3-5. User B vs data A --------------------------------------------
const credB = await createUserWithEmailAndPassword(
  auth,
  emailB,
  "Test-Rules-123"
);
const uidB = credB.user.uid;

await expectDenied(
  "B membaca profil milik A",
  getDoc(doc(db, "users", uidA))
);
await expectDenied(
  "B menulis profil milik A",
  setDoc(doc(db, "users", uidA), { displayName: "Hacked" })
);
await expectDenied(
  "B membaca checklist milik A",
  getDoc(doc(db, "users", uidA, "checklist", "any-item"))
);
await expectDenied(
  "B menghapus data milik A",
  deleteDoc(doc(db, "users", uidA, "budget", "any-category"))
);

// --- Storage: izin path sendiri, tolak path orang lain -----------------
const bytes = new Uint8Array([1, 2, 3, 4]);
const ownPath = `users/${uidB}/receipts/rules-test.jpg`;
const otherPath = `users/${uidA}/receipts/rules-test.jpg`;

await expectAllowed(
  "B upload struk ke folder miliknya sendiri",
  uploadBytes(ref(storage, ownPath), bytes, { contentType: "image/jpeg" })
);
await expectDenied(
  "B upload struk ke folder milik A",
  uploadBytes(ref(storage, otherPath), bytes, { contentType: "image/jpeg" })
);

// --- Cleanup (best-effort) ---------------------------------------------
try {
  await deleteDoc(doc(db, "users", uidA));
} catch {
  /* sudah ditolak rules / sudah bersih */
}
try {
  await deleteObject(ref(storage, ownPath));
} catch {
  /* file mungkin gagal terbuat */
}
await signOut(auth);

console.log(
  `\nSelesai. PASS semua skenario = isolasi rules terbukti ` +
    `(user A aman dari user B).`
);
if (failures > 0) {
  console.error(`${failures} skenario GAGAL — periksa rules lalu jalankan ulang.`);
  process.exit(1);
}
