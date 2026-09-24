import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { getBytes, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import type { User } from "firebase/auth";
import {
  getDb,
  getFirebaseStorage,
  isFirebaseConfigured,
} from "@/lib/firebase";
import { MAX_RECEIPT_SIZE } from "@/lib/budget-service";
import type { Expense, UserProfile } from "@/types";

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
 * 5. Bila kedua akun SUDAH punya data sendiri, auto-claim sengaja diam —
 *    pasangan memilih lewat tombol di kartu Pengaturan: `mergeAndClaim`
 *    (tautan + salinan data dengan dedup) atau klaim tanpa penyalinan.
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
 *
 * Dua akun yang sama-sama sudah punya data TIDAK diklaim otomatis (butuh
 * persetujuan & penyalinan eksplisit) → lihat `mergeAndClaim`, ditampilkan
 * sebagai tombol di kartu Kolaborasi pasangan (Pengaturan).
 */
export async function tryAutoClaimInvite(user: User): Promise<boolean> {
  if (!user.email) return false;
  const invite = await findInviteForEmail(user.email);
  if (!invite || invite.uid === user.uid) return false;
  // Klaim hanya legal bila workspace sudah onboarding dan belum tertaut
  // ke akun lain.
  if (!invite.data.weddingDate) return false;
  if (invite.data.partnerUid && invite.data.partnerUid !== user.uid) {
    return false;
  }
  await claimInvite(invite.uid, user);
  return true;
}

// —— Merge: kedua akun sudah punya data sendiri ——————————————————————————

/** Kunci dedup checklist: judul (case-insensitive) + kategori. */
function checklistKey(data: Record<string, unknown>): string {
  return `${String(data.title ?? "").trim().toLowerCase()}|${data.category ?? ""}`;
}

/** Kunci dedup vendor: nama (case-insensitive) + kategori. */
function vendorKey(data: Record<string, unknown>): string {
  return `${String(data.name ?? "").trim().toLowerCase()}|${data.category ?? ""}`;
}

/** Kunci dedup pengeluaran: deskripsi + nominal + tanggal. */
function expenseKey(expense: Expense): string {
  return `${expense.description}|${expense.amount}|${expense.date}`;
}

function guessMimeType(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "heic") return "image/heic";
  if (ext === "pdf") return "application/pdf";
  return "image/jpeg";
}

/**
 * Salin file struk milik akun sendiri ke folder workspace (best-effort):
 * supaya struk yang ikut tersalin tetap terbaca pemilik workspace bahkan
 * setelah lepas tautan. Bila gagal → pertahankan URL lama (masih terbaca
 * pasangan selama tertaut via storage rules couple dua arah).
 */
async function copyReceiptToWorkspace(
  expense: Expense,
  ownerUid: string
): Promise<Expense> {
  const url = expense.receiptUrl;
  if (!url || !isFirebaseConfigured) return expense;
  try {
    let blob: Blob;
    let sourceName = "receipt";
    if (/^https?:\/\//i.test(url)) {
      const response = await fetch(url);
      if (!response.ok) return expense;
      blob = await response.blob();
      sourceName = url.split("/").pop()?.split("?")[0] ?? sourceName;
    } else {
      // Bentuk lama: path relatif bucket.
      const bytes = await getBytes(ref(getFirebaseStorage(), url));
      blob = new Blob([bytes]);
      sourceName = url.split("/").pop() ?? sourceName;
    }
    if (blob.size === 0 || blob.size >= MAX_RECEIPT_SIZE) return expense;
    const safeName =
      decodeURIComponent(sourceName).replace(/[^\w.-]+/g, "_").slice(-60) ||
      "receipt";
    const destination = ref(
      getFirebaseStorage(),
      `users/${ownerUid}/receipts/${Date.now()}-${safeName}`
    );
    await uploadBytes(destination, blob, {
      contentType: blob.type || guessMimeType(safeName),
    });
    return { ...expense, receiptUrl: await getDownloadURL(destination) };
  } catch {
    return expense; // best-effort: URL lama tetap terbaca selama tertaut
  }
}

/**
 * Tautkan akun `user` ke workspace `ownerUid` — untuk kasus kedua akun
 * SUDAH punya data sendiri (pemicu manual dari kartu Pengaturan, bukan
 * auto-claim).
 *
 * @param options.mergeData true → salin data sendiri (checklist/vendor/
 *   budget/struk) ke workspace dengan dedup + isi kekosongan profil;
 *   false → hanya tautkan, data sendiri ditinggal utuh di dokumen akun ini.
 *
 * Idempoten: aman dipanggil ulang (penanda `mergedFromUid` ditulis terakhir).
 */
export async function mergeAndClaim(
  ownerUid: string,
  user: User,
  options: { mergeData: boolean }
): Promise<void> {
  const ownerSnap = await getDoc(doc(getDb(), "users", ownerUid));
  const owner = ownerSnap.data();
  if (!owner) throw new Error("Data pernikahan undangan tidak ditemukan.");
  if (!owner.weddingDate) throw new Error("Workspace undangan belum onboarding.");
  if (owner.partnerUid && owner.partnerUid !== user.uid) {
    throw new Error("Undangan sudah diterima akun lain.");
  }

  await claimInvite(ownerUid, user); // dua langkah klaim (idempoten)
  if (options.mergeData) {
    await mergeOwnDataInto(ownerUid, user);
  }
}

/**
 * Salin data akun `user` ke workspace `ownerUid`. Semua langkah berjalan
 * SETELAH klaim → aturan rules yang sama persis dengan kolaborasi biasa
 * (partner via `hasWorkspaceAccess`, dokumen sendiri sebagai owner).
 */
async function mergeOwnDataInto(ownerUid: string, user: User): Promise<void> {
  const db = getDb();
  const ownerRef = doc(db, "users", ownerUid);
  const ownerSnap = await getDoc(ownerRef);
  const ownSnap = await getDoc(doc(db, "users", user.uid));
  const owner = ownerSnap.data();
  const own = ownSnap.data();
  if (!owner || !own) throw new Error("Profil tidak ditemukan saat merge.");
  if (owner.mergedFromUid === user.uid) return; // sudah pernah di-merge

  // 1) Profil: workspace menang; isi KEKOSONGAN dari data sendiri.
  const fill: Partial<UserProfile> = {};
  if (!owner.venue && own.venue) fill.venue = own.venue;
  if (!owner.partnerName && own.partnerName) fill.partnerName = own.partnerName;
  if (!owner.totalBudget && own.totalBudget) fill.totalBudget = own.totalBudget;
  if (Object.keys(fill).length > 0) {
    await setDoc(ownerRef, fill, { merge: true });
  }

  // 2) Checklist: tambahkan item sendiri (dedup judul+kategori).
  const [ownItems, ownerItems] = await Promise.all([
    getDocs(collection(db, "users", user.uid, "checklist")),
    getDocs(collection(db, "users", ownerUid, "checklist")),
  ]);
  const haveTitles = new Set(ownerItems.docs.map((d) => checklistKey(d.data())));
  for (const snap of ownItems.docs) {
    const data = snap.data();
    const key = checklistKey(data);
    if (haveTitles.has(key)) continue;
    haveTitles.add(key);
    await addDoc(collection(db, "users", ownerUid, "checklist"), {
      title: data.title,
      category: data.category,
      dueDate: data.dueDate ?? "",
      isCompleted: Boolean(data.isCompleted),
      createdAt: typeof data.createdAt === "number" ? data.createdAt : Date.now(),
    });
  }

  // 3) Vendor: tambahkan vendor sendiri (dedup nama+kategori).
  const [ownVendors, ownerVendors] = await Promise.all([
    getDocs(collection(db, "users", user.uid, "vendors")),
    getDocs(collection(db, "users", ownerUid, "vendors")),
  ]);
  const haveVendors = new Set(ownerVendors.docs.map((d) => vendorKey(d.data())));
  for (const snap of ownVendors.docs) {
    const data = snap.data();
    const key = vendorKey(data);
    if (haveVendors.has(key)) continue;
    haveVendors.add(key);
    await addDoc(collection(db, "users", ownerUid, "vendors"), {
      name: data.name ?? "",
      category: data.category ?? "",
      contact: data.contact ?? "",
      status: data.status ?? "Dihubungi",
      dealAmount: typeof data.dealAmount === "number" ? data.dealAmount : 0,
      paymentDeadline: data.paymentDeadline ?? "",
      notes: data.notes ?? "",
      createdAt: typeof data.createdAt === "number" ? data.createdAt : Date.now(),
    });
  }

  // 4) Budget: kategori yang belum ada disalin penuh; yang sudah ada →
  //    gabung expenses (dedup) + alokasi workspace dipertahankan (bila 0,
  //    baru diambil dari data sendiri). Struk ikut disalin ke folder workspace.
  const [ownBudget, ownerBudget] = await Promise.all([
    getDocs(collection(db, "users", user.uid, "budget")),
    getDocs(collection(db, "users", ownerUid, "budget")),
  ]);
  const ownerBySlug = new Map(ownerBudget.docs.map((d) => [d.id, d]));
  for (const snap of ownBudget.docs) {
    const data = snap.data();
    const ownExpenses = (Array.isArray(data.expenses)
      ? data.expenses
      : []) as Expense[];
    const allocated =
      typeof data.allocatedAmount === "number" ? data.allocatedAmount : 0;
    const categoryName = String(data.categoryName ?? "");

    const target = ownerBySlug.get(snap.id); // slug determinik di kedua sisi
    if (!target) {
      const copied: Expense[] = [];
      for (const expense of ownExpenses) {
        copied.push(await copyReceiptToWorkspace(expense, ownerUid));
      }
      await setDoc(doc(db, "users", ownerUid, "budget", snap.id), {
        categoryName,
        allocatedAmount: allocated,
        expenses: copied,
      });
      continue;
    }

    const targetData = target.data();
    const expenses = Array.isArray(targetData.expenses)
      ? [...(targetData.expenses as Expense[])]
      : [];
    const haveExpenses = new Set(expenses.map(expenseKey));
    let added = 0;
    for (const expense of ownExpenses) {
      const key = expenseKey(expense);
      if (haveExpenses.has(key)) continue;
      haveExpenses.add(key);
      expenses.push(await copyReceiptToWorkspace(expense, ownerUid));
      added++;
    }
    if (added === 0) continue;
    await setDoc(target.ref, {
      categoryName: targetData.categoryName ?? categoryName,
      allocatedAmount: targetData.allocatedAmount || allocated,
      expenses,
    });
  }

  // 5) Penanda idempoten — TERAKHIR, hanya bila seluruh langkah sukses.
  await setDoc(
    ownerRef,
    { mergedFromUid: user.uid, mergedAt: Date.now() },
    { merge: true }
  );
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
