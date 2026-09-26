import {
  doc,
  getDoc,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { budgetPath, userDocPath } from "@/lib/collection-paths";
import { deleteReceipt } from "@/lib/receipt-service";
import type { Expense } from "@/types";

/**
 * Service modul Budget (FR-12 s/d FR-16).
 * Skema: users/{uid}/budget/{categoryId} = { categoryName, allocatedAmount, expenses[] }
 * ID kategori = slug determinik agar upsert tidak pernah menggandakan dokumen.
 * Foto struk disimpan terpisah di users/{uid}/receipts (lihat receipt-service).
 */

/**
 * Slug deterministik dari nama kategori, dipakai sebagai document id.
 *
 * PENTING: logika ini tidak boleh diubah ringan. Document id yang sudah
 * tertulis di Firestore tidak ikut berubah, jadi mengubah aturan slug akan
 * membuat dokumen budget lama terlantar dan alokasi kategorinya terpecah.
 *
 * Fallback ada karena nama kategori tanpa alnum (mis. "!!!") akan menjadi
 * string kosong, dan document id kosong ditolak Firestore.
 */
export function categorySlug(categoryName: string): string {
  const slug = categoryName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return slug || "lain-lain";
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
  // expenses SENGAJA tidak ada di payload. merge:true hanya mempertahankan
  // field yang tidak disebut, jadi menyebut expenses (even as []) akan
  // menimpa seluruh transaksi kategori ini. Form alokasi hanya boleh
  // menyentuh categoryName + allocatedAmount.
  await setDoc(refDoc, { categoryName, allocatedAmount }, { merge: true });
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

/** Hapus pengeluaran (termasuk struk di subcollection receipts, best-effort). */
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

  if (removed?.receiptId) {
    try {
      await deleteReceipt(uid, removed.receiptId);
    } catch {
      // Struk gagal dihapus tidak menghalangi UX utama.
    }
  }
}
