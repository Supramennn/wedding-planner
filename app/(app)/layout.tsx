import type { Metadata } from "next";
import { AuthGuard } from "@/lib/hooks/auth-guard";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * Rute terproteksi. Guard via layout (lihat catatan di auth-guard.tsx).
 * requireOnboarded: user tanpa data pernikahan dipaksa ke wizard (FR-02).
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requireOnboarded>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
