import type { Metadata } from "next";
import { EngagementView } from "@/components/engagement/engagement-view";

export const metadata: Metadata = {
  title: "Lamaran",
};

/** Modul Persiapan Lamaran (Engagement) — terpisah dari checklist nikah. */
export default function EngagementPage() {
  return <EngagementView />;
}
