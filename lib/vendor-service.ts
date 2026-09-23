import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { vendorsPath } from "@/lib/collection-paths";
import type { Vendor } from "@/types";

/**
 * Service modul Timeline Vendor (FR-17).
 * Skema Fase 2: weddings/{weddingId}/vendors — diakses bersama 2 akun.
 */

export type VendorInput = Omit<Vendor, "id" | "createdAt">;

export async function addVendor(
  weddingId: string,
  input: VendorInput
): Promise<void> {
  await addDoc(collection(getDb(), vendorsPath(weddingId)), {
    ...input,
    createdAt: Date.now(),
  });
}

export async function updateVendor(
  weddingId: string,
  vendorId: string,
  input: Partial<VendorInput>
): Promise<void> {
  await updateDoc(
    doc(getDb(), vendorsPath(weddingId), vendorId),
    input as Record<string, unknown>
  );
}

export async function deleteVendor(
  weddingId: string,
  vendorId: string
): Promise<void> {
  await deleteDoc(doc(getDb(), vendorsPath(weddingId), vendorId));
}
