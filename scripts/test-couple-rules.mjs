/**
 * Uji Security Rules kolaborasi pasangan (Phase 2) — pasangan dari
 * test-rules-isolation.mjs. Dua mode (lihat header file itu):
 *
 * (A) EMULATOR — otomatis & aman (butuh Java 21):
 *     npx firebase-tools emulators:exec --only auth,firestore,storage \
 *       --project demo-wedplan "node scripts/test-couple-rules.mjs --emulator"
 *
 * (B) PROYEK ASLI — setelah `firebase deploy --only firestore:rules,storage`:
 *     node scripts/test-couple-rules.mjs
 *     (membuat 3 akun uji couple-test-a/b/c@… — dokumen dibersihkan otomatis,
 *      akun dapat dihapus via Firebase Console → Authentication.)
 *
 * Skenario yang dibuktikan:
 *  1. A membuat undangan (partnerEmail = email B) → baseline A akses sendiri.
 *  2. B menemukan undangan via query `where partnerEmail == email B` (izin rules).
 *  3. SEBELUM klaim: B DITOLAK mengakses subcollection A (checklist).
 *  4. Klaim: B menulis {partnerUid,coupleStatus} di A & {linkedTo} di doc B → OK.
 *  5. SETELAH klaim: B membaca list checklist A (12 dokumen → uji get() pada
 *     list), menambah/mengubah item, & mengubah profil A → OK (kolaborasi).
 *  6. B upload struk ke folder A (storage via firestore.get) → OK.
 *  7. C (pihak ketiga): baca/tulis profil, subcollection, storage milik A,
 *     serta upaya klaim diri → SEMUA DENY.
 *  8. Unlink oleh A: kedua dokumen dibersihkan → akses B gugur → DENY.
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
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  getDoc,
  query,
  setDoc,
  updateDoc,
  where,
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
  ? {
      projectId: "demo-wedplan",
      apiKey: "demo-api-key",
      appId: "demo-app-id",
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

async function expectValue(label, promise, check) {
  try {
    const value = await promise;
    const ok = check(value);
    report(ok, label, ok ? "" : "nilai tak sesuai harapan");
  } catch (error) {
    report(false, label, `error: ${error?.code ?? error}`);
  }
}

console.log(
  `Mode: ${useEmulator ? "EMULATOR (demo-wedplan)" : "PROYEK ASLI"}\n`
);

// --- Akun uji: A (pemilik), B (pasangan), C (pihak ketiga) ---------------
const emailA = `couple-test-a+${stamp}@example.com`;
const emailB = `couple-test-b+${stamp}@example.com`;
const emailC = `couple-test-c+${stamp}@example.com`;
const PASSWORD = "Test-Rules-123";

const credA = await createUserWithEmailAndPassword(auth, emailA, PASSWORD);
const uidA = credA.user.uid;

// --- 1. A: baseline + undangan ke B + 12 item checklist -------------------
await expectAllowed(
  "A menulis profil + undangan (partnerEmail=B)",
  setDoc(doc(db, "users", uidA), {
    email: emailA,
    displayName: "Couple Test A",
    partnerName: "Pasangan A",
    weddingDate: "2030-01-01",
    venue: "Venue Uji",
    partnerEmail: emailB,
    partnerUid: null,
    coupleStatus: null,
    linkedTo: null,
    createdAt: stamp,
  })
);

const checklistRefs = [];
for (let index = 0; index < 12; index++) {
  const refDoc = doc(collection(db, "users", uidA, "checklist"));
  checklistRefs.push(refDoc);
  await setDoc(refDoc, {
    title: `Tugas ${index + 1}`,
    category: "Lain-lain",
    dueDate: "",
    isCompleted: false,
    createdAt: stamp + index,
  });
}
await expectAllowed(
  "A membaca checklist miliknya sendiri (12 item)",
  getDocs(collection(db, "users", uidA, "checklist"))
);

await signOut(auth);

// --- Akun B & C (tulis dokumen sendiri saat akun itu masih aktif login) ---
const credB = await createUserWithEmailAndPassword(auth, emailB, PASSWORD);
const uidB = credB.user.uid;
// Dokumen sendiri dibuat persis seperti app (ensureUserProfile).
await setDoc(doc(db, "users", uidB), {
  email: emailB,
  displayName: "Couple Test B",
  partnerName: "",
  weddingDate: "",
  venue: "",
  partnerEmail: null,
  partnerUid: null,
  coupleStatus: null,
  linkedTo: null,
  createdAt: stamp,
});

const credC = await createUserWithEmailAndPassword(auth, emailC, PASSWORD);
const uidC = credC.user.uid;
await setDoc(doc(db, "users", uidC), {
  email: emailC,
  displayName: "Couple Test C",
  partnerName: "",
  weddingDate: "",
  venue: "",
  partnerEmail: null,
  partnerUid: null,
  coupleStatus: null,
  linkedTo: null,
  createdAt: stamp,
});

// --- 2. B menemukan undangan via query partnerEmail -----------------------
await signInWithEmailAndPassword(auth, emailB, PASSWORD);
await expectValue(
  "B menemukan undangan via query where partnerEmail == email B",
  getDocs(
    query(collection(db, "users"), where("partnerEmail", "==", emailB))
  ),
  (snapshot) => snapshot.docs.some((entry) => entry.id === uidA)
);
await expectValue(
  "B membaca profil A (izin undangan, untuk klaim)",
  getDoc(doc(db, "users", uidA)),
  (snapshot) => snapshot.exists() && snapshot.data().weddingDate === "2030-01-01"
);

// --- 3. SEBELUM klaim: subcollection A tertutup untuk B -------------------
await expectDenied(
  "B membaca checklist A sebelum klaim",
  getDocs(collection(db, "users", uidA, "checklist"))
);
await expectDenied(
  "B menulis checklist A sebelum klaim",
  addDoc(collection(db, "users", uidA, "checklist"), {
    title: "Numpang lewat",
    category: "Lain-lain",
    dueDate: "",
    isCompleted: false,
    createdAt: stamp,
  })
);

// --- 4. Klaim tautan (dua langkah, sama seperti couple-service) -----------
await expectAllowed(
  "B mengklaim: tulis partnerUid+coupleStatus di dokumen A",
  setDoc(
    doc(db, "users", uidA),
    { partnerUid: uidB, coupleStatus: "linked" },
    { merge: true }
  )
);
await expectAllowed(
  "B mengklaim: tulis linkedTo di dokumen sendiri",
  setDoc(
    doc(db, "users", uidB),
    { linkedTo: uidA, coupleStatus: "linked" },
    { merge: true }
  )
);

// --- 5. SETELAH klaim: kolaborasi penuh dua arah --------------------------
await expectValue(
  "B membaca list checklist A (12 item — get() pada list rules)",
  getDocs(collection(db, "users", uidA, "checklist")),
  (snapshot) => snapshot.size === 12
);

const bNewItem = doc(collection(db, "users", uidA, "checklist"));
await expectAllowed(
  "B menambahkan tugas baru ke checklist A",
  setDoc(bNewItem, {
    title: "Dari pasangan",
    category: "Lain-lain",
    dueDate: "",
    isCompleted: false,
    createdAt: stamp + 100,
  })
);
await expectAllowed(
  "B menandai selesai item checklist A",
  updateDoc(checklistRefs[0], { isCompleted: true })
);
await expectAllowed(
  "B mengubah profil A (edit pengaturan bersama)",
  updateDoc(doc(db, "users", uidA), { venue: "Venue Diganti Pasangan" })
);
await expectAllowed(
  "B mengubah totalBudget di dokumen A",
  setDoc(doc(db, "users", uidA), { totalBudget: 250_000_000 }, { merge: true })
);

// --- 6. Storage: B upload struk ke folder A -------------------------------
const bytes = new Uint8Array([1, 2, 3, 4]);
const receiptByB = `users/${uidA}/receipts/couple-test-b.jpg`;
await expectAllowed(
  "B upload struk ke folder A (storage firestore.get)",
  uploadBytes(ref(storage, receiptByB), bytes, { contentType: "image/jpeg" })
);
await expectAllowed(
  "B membaca struk di folder A",
  (async () => {
    const { getDownloadURL } = await import("firebase/storage");
    await getDownloadURL(ref(storage, receiptByB));
  })()
);

// --- 7. C (pihak ketiga) tetap terkunci total -----------------------------
await signOut(auth);
await signInWithEmailAndPassword(auth, emailC, PASSWORD);
await expectDenied(
  "C membaca profil A",
  getDoc(doc(db, "users", uidA))
);
await expectDenied(
  "C query undangan milik orang lain",
  getDocs(
    query(collection(db, "users"), where("partnerEmail", "==", emailB))
  )
);
await expectDenied(
  "C membaca checklist A",
  getDocs(collection(db, "users", uidA, "checklist"))
);
await expectDenied(
  "C mengubah profil A",
  updateDoc(doc(db, "users", uidA), { venue: "Hacked" })
);
await expectDenied(
  "C mengklaim tautan milik B (partnerUid dipaksa ke C)",
  setDoc(
    doc(db, "users", uidA),
    { partnerUid: uidC, coupleStatus: "linked" },
    { merge: true }
  )
);
await expectDenied(
  "C upload struk ke folder A",
  uploadBytes(ref(storage, `users/${uidA}/receipts/couple-test-c.jpg`), bytes, {
    contentType: "image/jpeg",
  })
);
await expectAllowed(
  "C tetap bisa upload ke folder sendiri (baseline)",
  uploadBytes(ref(storage, `users/${uidC}/receipts/couple-test-c.jpg`), bytes, {
    contentType: "image/jpeg",
  })
);

// --- 8. Unlink oleh A → akses B gugur ------------------------------------
await signOut(auth);
await signInWithEmailAndPassword(auth, emailA, PASSWORD);
await expectAllowed(
  "A unlink: bersihkan partnerUid/partnerEmail di dokumennya",
  setDoc(
    doc(db, "users", uidA),
    { partnerUid: null, partnerEmail: null, coupleStatus: null },
    { merge: true }
  )
);
await expectAllowed(
  "A unlink: cabut linkedTo di dokumen B (rules linkedTo == A)",
  setDoc(
    doc(db, "users", uidB),
    { linkedTo: null, coupleStatus: null },
    { merge: true }
  )
);

await signOut(auth);
await signInWithEmailAndPassword(auth, emailB, PASSWORD);
await expectDenied(
  "B (setelah unlink) membaca profil A",
  getDoc(doc(db, "users", uidA))
);
await expectDenied(
  "B (setelah unlink) membaca checklist A",
  getDocs(collection(db, "users", uidA, "checklist"))
);
await expectDenied(
  "B (setelah unlink) menulis checklist A",
  addDoc(collection(db, "users", uidA, "checklist"), {
    title: "Masih nyasar",
    category: "Lain-lain",
    dueDate: "",
    isCompleted: false,
    createdAt: stamp,
  })
);
await expectDenied(
  "B (setelah unlink) upload struk ke folder A",
  uploadBytes(ref(storage, `users/${uidA}/receipts/couple-after.jpg`), bytes, {
    contentType: "image/jpeg",
  })
);

// --- Cleanup (best-effort) ------------------------------------------------
try {
  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailA, PASSWORD);
  const listSnapshot = await getDocs(collection(db, "users", uidA, "checklist"));
  await Promise.all(
    listSnapshot.docs.map((entry) => deleteDoc(entry.ref).catch(() => {}))
  );
  await deleteDoc(bNewItem).catch(() => {});
  await deleteDoc(doc(db, "users", uidA)).catch(() => {});
  await deleteObject(ref(storage, receiptByB)).catch(() => {});
} catch {
  /* dokumen/file mungkin sudah tidak ada */
}
try {
  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailB, PASSWORD);
  await deleteDoc(doc(db, "users", uidB)).catch(() => {});
} catch {
  /* abaikan */
}
try {
  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailC, PASSWORD);
  await deleteDoc(doc(db, "users", uidC)).catch(() => {});
  await deleteObject(ref(storage, `users/${uidC}/receipts/couple-test-c.jpg`)).catch(
    () => {}
  );
} catch {
  /* abaikan */
}
await signOut(auth);

console.log(
  `\nSelesai. PASS semua skenario = rules kolaborasi pasangan terbukti: ` +
    `partner tertaut bekerja penuh, pihak ketiga tetap terkunci.`
);
if (failures > 0) {
  console.error(`${failures} skenario GAGAL — periksa rules lalu jalankan ulang.`);
  process.exit(1);
}
