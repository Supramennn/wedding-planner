import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { checklistPath } from "@/lib/collection-paths";
import type { ChecklistCategory, ChecklistItem } from "@/types";

/**
 * Tulis-baca modul checklist (FR-09, FR-11).
 * Skema Fase 2: weddings/{weddingId}/checklist — diakses bersama 2 akun.
 * Semua perubahan langsung ke Firestore — UI tersinkron realtime lewat
 * onSnapshot (tanpa tombol "save" terpisah).
 */

export interface ChecklistInput {
  title: string;
  category: ChecklistCategory;
  /** "" = tanpa due date (opsional) */
  dueDate: string;
}

export async function addChecklistItem(
  weddingId: string,
  input: ChecklistInput
): Promise<void> {
  await addDoc(collection(getDb(), checklistPath(weddingId)), {
    title: input.title,
    category: input.category,
    dueDate: input.dueDate,
    isCompleted: false,
    createdAt: Date.now(),
  });
}

export async function updateChecklistItem(
  weddingId: string,
  itemId: string,
  input: Partial<ChecklistInput> & { isCompleted?: boolean }
): Promise<void> {
  await updateDoc(
    doc(getDb(), checklistPath(weddingId), itemId),
    input as Record<string, unknown>
  );
}

export async function toggleChecklistItem(
  weddingId: string,
  item: ChecklistItem
): Promise<void> {
  await updateDoc(doc(getDb(), checklistPath(weddingId), item.id), {
    isCompleted: !item.isCompleted,
  });
}

export async function deleteChecklistItem(
  weddingId: string,
  itemId: string
): Promise<void> {
  await deleteDoc(doc(getDb(), checklistPath(weddingId), itemId));
}
