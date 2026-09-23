import type { Metadata } from "next";
import { ChecklistView } from "@/components/checklist/checklist-view";

export const metadata: Metadata = {
  title: "Checklist",
};

/** Modul Checklist Persiapan (FR-08 s/d FR-11). */
export default function ChecklistPage() {
  return <ChecklistView />;
}
