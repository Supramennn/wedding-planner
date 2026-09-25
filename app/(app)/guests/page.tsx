import type { Metadata } from "next";
import { GuestsView } from "@/components/guests/guests-view";

export const metadata: Metadata = {
  title: "Tamu",
};

/** Modul Daftar Tamu Undangan — estimasi jumlah tamu per status & kelompok. */
export default function GuestsPage() {
  return <GuestsView />;
}
