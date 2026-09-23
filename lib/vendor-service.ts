import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { vendorsPath } from "@/lib/collection-paths";
import type { Vendor } from "@/types";

/**
 * Service modul Timeline Vendor (FR-17).
 * Skema: users/{uid}/vendors/{vendorId}
 */

export type VendorInput = Omit<Vendor, "id" | "createdAt">;

export async function addVendor(uid: string, input: VendorInput): Promise<void> {
  await addDoc(collection(getDb(), vendorsPath(uid)), {
    ...input,
    createdAt: Date.now(),
  });
}

export async function updateVendor(
  uid: string,
  vendorId: string,
  input: Partial<VendorInput>
): Promise<void> {
  await updateDoc(
    doc(getDb(), vendorsPath(uid), vendorId),
    input as Record<string, unknown>
  );
}

export async function deleteVendor(uid: string, vendorId: string): Promise<void> {
  await deleteDoc(doc(getDb(), vendorsPath(uid), vendorId));
}
