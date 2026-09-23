import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import {
  doc,
  getDoc,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import {
  getDb,
  getFirebaseStorage,
  isFirebaseConfigured,
} from "@/lib/firebase";
import { budgetPath, userDocPath } from "@/lib/collection-paths";
import type { Expense } from "@/types";

/**
 * Service modul Budget (FR-12 s/d FR-16).
 * Skema: users/{uid}/budget/{categoryId} = { categoryName, allocatedAmount, expenses[] }
 * ID kategori = slug determinik agar upsert tidak pernah menggandakan dokumen.
 */

export const MAX_RECEIPT_SIZE = 5 * 1024 * 1024; // 5 MB (sinkron dgn storage.rules)

export function categorySlug(categoryName: string): string {
  return categoryName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** FR-12: set/edit total budget pernikahan (tersimpan di users/{uid}). */
export async function setTotalBudget(
  uid: string,
  totalBudget: number
): Promise<void> {
  await setDoc(
    doc(getDb(), userDocPath(uid)),
    { totalBudget },
    { merge: true }
  );
}

/** FR-13: alokasi nominal per kategori (upsert by slug). */
export async function setCategoryAllocation(
  uid: string,
  categoryName: string,
  allocatedAmount: number
): Promise<void> {
  const refDoc = doc(getDb(), budgetPath(uid), categorySlug(categoryName));
  // merge:true → field expenses yang sudah ada tidak tertimpa.
  await setDoc(
    refDoc,
    { categoryName, allocatedAmount, expenses: [] },
    { merge: true }
  );
}

async function readBudgetDoc(
  uid: string,
  slug: string,
  fallbackCategoryName: string
): Promise<{ refDoc: ReturnType<typeof doc>; data: DocumentData }> {
  const refDoc = doc(getDb(), budgetPath(uid), slug);
  const snapshot = await getDoc(refDoc);
  const data = snapshot.exists()
    ? snapshot.data()
    : { categoryName: fallbackCategoryName, allocatedAmount: 0, expenses: [] };
  if (!Array.isArray(data.expenses)) data.expenses = [];
  return { refDoc, data };
}

function readExpenses(data: DocumentData): Expense[] {
  return Array.isArray(data.expenses) ? (data.expenses as Expense[]) : [];
}

/** FR-14: tambah pengeluaran ke kategori terpilih. */
export async function addExpense(
  uid: string,
  categoryName: string,
  expense: Expense
): Promise<void> {
  const slug = categorySlug(categoryName);
  const { refDoc, data } = await readBudgetDoc(uid, slug, categoryName);
  await setDoc(refDoc, {
    ...data,
    expenses: [...readExpenses(data), expense],
  });
}

/** Edit pengeluaran (index di dalam array expenses dokumen kategori). */
export async function updateExpense(
  uid: string,
  categoryName: string,
  index: number,
  expense: Expense
): Promise<void> {
  const slug = categorySlug(categoryName);
  const { refDoc, data } = await readBudgetDoc(uid, slug, categoryName);
  const expenses = readExpenses(data);
  if (index < 0 || index >= expenses.length) return;
  expenses[index] = expense;
  await setDoc(refDoc, { ...data, expenses });
}

/** Hapus pengeluaran (termasuk struk di Storage, best-effort). */
export async function deleteExpense(
  uid: string,
  categoryName: string,
  index: number
): Promise<void> {
  const slug = categorySlug(categoryName);
  const { refDoc, data } = await readBudgetDoc(uid, slug, categoryName);
  const expenses = readExpenses(data);
  if (index < 0 || index >= expenses.length) return;
  const [removed] = expenses.splice(index, 1);
  await setDoc(refDoc, { ...data, expenses });

  if (removed?.receiptUrl) {
    try {
      // ref() menerima URL unduhan lengkap milik bucket ini (best-effort).
      await deleteObject(ref(getFirebaseStorage(), removed.receiptUrl));
    } catch {
      // Struk gagal dihapus tidak menghalangi UX utama.
    }
  }
}

/** Upload struk ke Firebase Storage → URL publik (opsional, FR-14). */
export async function uploadReceipt(uid: string, file: File): Promise<string> {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase belum dikonfigurasi.");
  }
  if (file.size > MAX_RECEIPT_SIZE) {
    throw new Error("Ukuran struk maksimal 5 MB.");
  }

  const safeName = file.name.replace(/[^\w.-]+/g, "_");
  const objectRef = ref(
    getFirebaseStorage(),
    `users/${uid}/receipts/${Date.now()}-${safeName}`
  );
  const snapshot = await uploadBytes(objectRef, file, {
    contentType: file.type,
  });
  return await getDownloadURL(snapshot.ref);
}
