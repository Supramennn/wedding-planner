import type { Metadata } from "next";
import { VendorView } from "@/components/vendors/vendor-view";

export const metadata: Metadata = {
  title: "Vendor",
};

/** Modul Timeline Vendor (FR-17 s/d FR-19). */
export default function VendorsPage() {
  return <VendorView />;
}
