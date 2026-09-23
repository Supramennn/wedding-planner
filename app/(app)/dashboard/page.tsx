import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { WelcomeSummary } from "@/components/dashboard/welcome-summary";

/**
 * Dashboard ringkasan (FR-04 s/d FR-07) — konten penuh dibangun di Fase 2.
 * Fase 1: halaman terproteksi sudah bisa diakses setelah login.
 */
export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <WelcomeSummary />

      <Card>
        <CardTitle>Ringkasan persiapan</CardTitle>
        <CardDescription>
          Countdown, progress checklist, budget, dan status vendor akan
          tampil di sini.
        </CardDescription>
        <div className="mt-4">
          <EmptyState
            title="Belum ada data persiapan"
            description="Lengkapi data pernikahanmu untuk melihat ringkasan persiapan."
          />
        </div>
      </Card>
    </div>
  );
}
