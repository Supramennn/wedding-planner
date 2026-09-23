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
 *  6. KOLABORASI (Fase 2): A membuat weddings/{A} (members [A,B]) → B member
 *     boleh baca/tulis; user C (non-member) DENY (Firestore & Storage);
 *     create wedding dengan id bukan milik sendiri DENY.
 *  7. Invite: member boleh buat weddingInvites; non-member DENY; update
 *     weddings/{id} TIDAK boleh mengubah members.
 *  8. Storage legacy: partner B boleh baca users/{A}/receipts (member
 *     weddings/{A}) tapi tidak boleh TULIS ke folder legacy A.
 *
 * Keluaran: PASS/FAIL per skenario; exit code 1 bila ada kegagalan.
 */
import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
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
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
} from "firebase/storage";

const useEmulator =
  process.argv.includes("--emulator") ||
  Boolean(process.env.FIRESTORE_EMULATOR_HOST);

const stamp = Date.now();

const config = useEmulator
  ? {
      projectId: "demo-wedplan",
      apiKey: "demo-api-key",
      appId: "demo-app-id",
      // Storage SDK tetap butuh nama bucket meski lewat emulator.
      storageBucket: "demo-wedplan.appspot.com",
    }
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

/** Kode error yang berarti "rules menolak" (Firestore & Storage beda kode). */
const DENY_CODES = new Set(["permission-denied", "storage/unauthorized"]);

async function expectDenied(label, promise) {
  try {
    await promise;
    report(false, label, "akses diterima, seharusnya DENY");
  } catch (error) {
    if (DENY_CODES.has(error?.code)) {
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

// --- 6-8. Kolaborasi (Fase 2): weddings/{id} + member vs non-member -------

// Aktifkan A kembali untuk membuat data pernikahan bersama.
await signOut(auth);
await signInWithEmailAndPassword(auth, emailA, "Test-Rules-123");

await expectAllowed(
  "A membuat weddings/{uidA} (members [A,B])",
  setDoc(doc(db, "weddings", uidA), {
    weddingDate: "2030-06-15",
    venue: "Gedung Uji",
    fullName_couple: ["A", "B"], // field non-kritis, dipakai verifikasi copy
    members: [uidA, uidB],
    coupleNames: { [uidA]: "Rules A", [uidB]: "Rules B" },
    createdBy: uidA,
    createdAt: stamp,
    inviteCode: "ABC123",
    totalBudget: 100_000_000,
  })
);
await expectDenied(
  "A membuat weddings/{idBukanMilik} (id != uid) → DENY",
  setDoc(doc(db, "weddings", "outsider-123"), {
    members: [uidA],
    createdBy: uidA,
  })
);
await expectAllowed(
  "A membuat weddingInvites untuk wedding miliknya",
  setDoc(doc(db, "weddingInvites", "ABC123"), {
    weddingId: uidA,
    createdAt: stamp,
  })
);
await expectDenied(
  "A membuat weddingInvites untuk wedding yang tidak ada → DENY",
  setDoc(doc(db, "weddingInvites", "XXX999"), {
    weddingId: "tidak-ada",
    createdAt: stamp,
  })
);

// Ganti ke B (member) — seharusnya boleh akses data wedding bersama.
await signOut(auth);
await signInWithEmailAndPassword(auth, emailB, "Test-Rules-123");

await expectAllowed(
  "B (member) membaca weddings/{uidA}",
  getDoc(doc(db, "weddings", uidA))
);
await expectAllowed(
  "B (member) menulis subcollection wedding milik bersama",
  setDoc(doc(db, "weddings", uidA, "checklist", "item-uji"), {
    title: "Item B",
    category: "Umum",
    dueDate: "",
    isCompleted: false,
    createdAt: stamp,
  })
);
await expectAllowed(
  "B (member) update totalBudget wedding (members tetap)",
  setDoc(doc(db, "weddings", uidA), { totalBudget: 250_000_000 })
);
await expectDenied(
  "B (member) TIDAK boleh mengubah members wedding saat update",
  setDoc(doc(db, "weddings", uidA), {
    members: [uidA, uidB, "uid-penyusup"],
  })
);
await expectAllowed(
  "B upload struk ke weddings/{uidA}/receipts (member)",
  uploadBytes(
    ref(storage, `weddings/${uidA}/receipts/rules-test.jpg`),
    bytes,
    { contentType: "image/jpeg" }
  )
);

// Struk legacy milik A: B boleh BACA (partner), tidak boleh menulis ke sana.
const legacyReadPath = `users/${uidA}/receipts/legacy.jpg`;
await expectAllowed(
  "A membuat struk legacy di users/{uidA}/receipts (owner)",
  uploadBytes(ref(storage, legacyReadPath), bytes, {
    contentType: "image/jpeg",
  })
);
await expectAllowed(
  "B (partner member) membaca struk legacy milik A",
  getDownloadURL(ref(storage, legacyReadPath))
);
await expectDenied(
  "B (partner) TIDAK boleh menulis ke folder legacy milik A",
  uploadBytes(ref(storage, `users/${uidA}/receipts/write.jpg`), bytes, {
    contentType: "image/jpeg",
  })
);

// User C — non-member: semua akses ke wedding bersama harus DENY.
await signOut(auth);
const emailC = `rules-test-c+${stamp}@example.com`;
await createUserWithEmailAndPassword(auth, emailC, "Test-Rules-123");

await expectDenied(
  "C (non-member) membaca weddings/{uidA}",
  getDoc(doc(db, "weddings", uidA))
);
await expectDenied(
  "C (non-member) menulis vendor wedding milik bersama",
  setDoc(doc(db, "weddings", uidA, "vendors", "v-uji"), {
    name: "Vendor C",
    status: "dihubungi",
  })
);
await expectDenied(
  "C (non-member) membuat weddingInvites milik wedding A",
  setDoc(doc(db, "weddingInvites", "ZZZ999"), {
    weddingId: uidA,
    createdAt: stamp,
  })
);
await expectDenied(
  "C upload struk ke weddings/{uidA}/receipts (non-member)",
  uploadBytes(
    ref(storage, `weddings/${uidA}/receipts/dll.jpg`),
    bytes,
    { contentType: "image/jpeg" }
  )
);
await expectDenied(
  "C (non-member) membaca struktur legacy users/{uidA}/receipts",
  getDownloadURL(ref(storage, legacyReadPath))
);

// --- Cleanup (best-effort) ---------------------------------------------
// Hapus data uji sebagai A (owner) — saat ini user aktif masih B,
// sehingga menghapus data A akan ditolak rules (justru bukti isolasi).
try {
  await signInWithEmailAndPassword(auth, emailA, "Test-Rules-123");
  await deleteDoc(doc(db, "users", uidA));
  await deleteDoc(doc(db, "weddings", uidA, "checklist", "item-uji"));
  await deleteDoc(doc(db, "weddings", uidA));
} catch {
  /* dokumen mungkin sudah tidak ada / gagal signIn uji */
}
for (const path of [
  ownPath,
  legacyReadPath,
  `weddings/${uidA}/receipts/rules-test.jpg`,
]) {
  try {
    await deleteObject(ref(storage, path));
  } catch {
    /* file mungkin tidak tercipta */
  }
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
