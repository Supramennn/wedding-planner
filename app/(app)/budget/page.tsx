import type { Metadata } from "next";
import { BudgetView } from "@/components/budget/budget-view";

export const metadata: Metadata = {
  title: "Budget",
};

/** Modul Budget Tracker (FR-12 s/d FR-16). */
export default function BudgetPage() {
  return <BudgetView />;
}
