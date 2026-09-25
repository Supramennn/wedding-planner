import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { prepPath } from "@/lib/collection-paths";
import type { PrepItem } from "@/types";

/**
 * Service item "yang perlu disiapkan" — daftar belanja/persiapan di
 * modul Budget, realtime di users/{uid}/prepItems.
 * Setiap item membawa estimasi biaya → total rencana bisa dibandingkan
 * dengan alokasi/total budget.
 */

export type PrepItemInput = Omit<PrepItem, "id" | "createdAt">;

export async function addPrepItem(
  uid: string,
  input: PrepItemInput
): Promise<void> {
  await addDoc(collection(getDb(), prepPath(uid)), {
    ...input,
    createdAt: Date.now(),
  });
}

export async function updatePrepItem(
  uid: string,
  itemId: string,
  input: Partial<PrepItemInput>
): Promise<void> {
  await updateDoc(
    doc(getDb(), prepPath(uid), itemId),
    input as Record<string, unknown>
  );
}

/** Centang/batal centang "sudah disiapkan" (toggle optimis dari UI). */
export async function togglePrepItem(
  uid: string,
  item: Pick<PrepItem, "id" | "isDone">
): Promise<void> {
  await updateDoc(doc(getDb(), prepPath(uid), item.id), {
    isDone: !item.isDone,
  });
}

export async function deletePrepItem(
  uid: string,
  itemId: string
): Promise<void> {
  await deleteDoc(doc(getDb(), prepPath(uid), itemId));
}
