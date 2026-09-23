import { WelcomeSummary } from "@/components/dashboard/welcome-summary";
import { CountdownCard } from "@/components/dashboard/countdown-card";
import { ChecklistProgressCard } from "@/components/dashboard/checklist-progress-card";
import { BudgetSummaryCard } from "@/components/dashboard/budget-summary-card";
import { VendorStatusCard } from "@/components/dashboard/vendor-status-card";

/**
 * Dashboard ringkasan (FR-04 s/d FR-07):
 * - FR-04 countdown hari-H
 * - FR-05 % checklist selesai
 * - FR-06 budget terpakai vs alokasi (indikator warna FR-16)
 * - FR-07 jumlah vendor per status
 */
export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <WelcomeSummary />

      <div className="grid gap-4 sm:grid-cols-2">
        <CountdownCard />
        <ChecklistProgressCard />
        <BudgetSummaryCard />
        <VendorStatusCard />
      </div>
    </div>
  );
}
