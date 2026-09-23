"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/auth-context";
import { Spinner } from "@/components/ui/spinner";

/**
 * AuthGuard — guard rute terproteksi (layout guard).
 *
 * Catatan: guard dilakukan di layout, bukan proxy/middleware, karena sesi
 * Firebase disimpan di client (IndexedDB) sehingga tidak terbaca dari
 * runtime server/edge. proxy.ts Next 16 tetap tidak bisa memverifikasi
 * token Firebase tanpa integrasi session cookie.
 */
export function AuthGuard({
  children,
  requireOnboarded = false,
}: {
  children: ReactNode;
  /** true → paksa ke /onboarding bila profil belum punya weddingDate (FR-02). */
  requireOnboarded?: boolean;
}) {
  const { user, profile, loading, isOnboarded } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (requireOnboarded && !isOnboarded) {
      router.replace("/onboarding");
    }
  }, [loading, user, isOnboarded, requireOnboarded, pathname, router]);

  if (loading || !user || (requireOnboarded && !isOnboarded)) {
    return (
      <div className="flex min-h-[60svh] items-center justify-center">
        <Spinner size="lg" label="Memuat…" />
      </div>
    );
  }

  // Sembunyikan konten lama sampai redirect ke onboarding selesai.
  if (requireOnboarded && !profile) {
    return (
      <div className="flex min-h-[60svh] items-center justify-center">
        <Spinner size="lg" label="Memuat…" />
      </div>
    );
  }

  return <>{children}</>;
}
