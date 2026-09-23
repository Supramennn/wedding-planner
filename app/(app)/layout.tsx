import type { Metadata } from "next";
import { AuthGuard } from "@/lib/hooks/auth-guard";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * Rute terproteksi. Guard via layout (lihat catatan di auth-guard.tsx).
 * Fase 2: aktifkan requireOnboarded setelah halaman /onboarding ada.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
