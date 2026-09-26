import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { checklistPath } from "@/lib/collection-paths";
import type { ChecklistItem } from "@/types";

/**
 * Tulis-baca modul checklist (FR-09, FR-11).
 * Semua perubahan langsung ke Firestore — UI tersinkron realtime lewat
 * onSnapshot (tanpa tombol "save" terpisah).
 */

export interface ChecklistInput {
  title: string;
  category: ChecklistItem["category"];
  /** "" = tanpa due date (opsional) */
  dueDate: string;
  /**
   * Tahap: absen = persiapan nikah (default), "engagement" = persiapan
   * lamaran. Ditulis hanya bila terisi (data lama tetap tanpa field ini).
   */
  phase?: "engagement";
}

export async function addChecklistItem(
  uid: string,
  input: ChecklistInput
): Promise<void> {
  await addDoc(collection(getDb(), checklistPath(uid)), {
    title: input.title,
    category: input.category,
    dueDate: input.dueDate,
    isCompleted: false,
    createdAt: Date.now(),
    ...(input.phase ? { phase: input.phase } : {}),
  });
}

export async function updateChecklistItem(
  uid: string,
  itemId: string,
  input: Partial<ChecklistInput> & { isCompleted?: boolean }
): Promise<void> {
  await updateDoc(
    doc(getDb(), checklistPath(uid), itemId),
    input as Record<string, unknown>
  );
}

/**
 * Tulis status selesai dengan nilai target eksplisit.
 *
 * Nilai target diterima sebagai argumen, bukan diturunkan dari `item`,
 * supaya aman dipanggil berulang: dengan cara lama (`!item.isCompleted`),
 * tap kedua sebelum snapshot tiba akan menulis nilai yang sama.
 */
export async function toggleChecklistItem(
  uid: string,
  itemId: string,
  isCompleted: boolean
): Promise<void> {
  await updateDoc(doc(getDb(), checklistPath(uid), itemId), { isCompleted });
}

export async function deleteChecklistItem(
  uid: string,
  itemId: string
): Promise<void> {
  await deleteDoc(doc(getDb(), checklistPath(uid), itemId));
}
