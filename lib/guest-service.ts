import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { guestsPath } from "@/lib/collection-paths";
import type { Guest } from "@/types";

/**
 * Service Daftar Tamu Undangan — CRUD realtime di users/{uid}/guests.
 * Data dipakai halaman Tamu untuk mengestimasi jumlah undangan
 * per status (belum dikirim/terkirim/hadir/tidak hadir) & kelompok.
 */

export type GuestInput = Omit<Guest, "id" | "createdAt">;

export async function addGuest(uid: string, input: GuestInput): Promise<void> {
  await addDoc(collection(getDb(), guestsPath(uid)), {
    ...input,
    createdAt: Date.now(),
  });
}

export async function updateGuest(
  uid: string,
  guestId: string,
  input: Partial<GuestInput>
): Promise<void> {
  await updateDoc(
    doc(getDb(), guestsPath(uid), guestId),
    input as Record<string, unknown>
  );
}

export async function deleteGuest(uid: string, guestId: string): Promise<void> {
  await deleteDoc(doc(getDb(), guestsPath(uid), guestId));
}
