"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/auth-context";
import { Spinner } from "@/components/ui/spinner";

/**
 * GuestGuard — untuk halaman auth (login/register).
 * Jika sudah login, alihkan ke dashboard (FR-02: user baru → onboarding).
 */
export function GuestGuard({ children }: { children: ReactNode }) {
  const { user, loading, profileLoading, isOnboarded } = useAuth();
  const router = useRouter();

  const ready = !loading && (!user || !profileLoading);

  useEffect(() => {
    if (!ready || !user) return;
    router.replace(isOnboarded ? "/dashboard" : "/onboarding");
  }, [ready, user, isOnboarded, router]);

  if (!ready) {
    return (
      <div className="flex min-h-[60svh] items-center justify-center">
        <Spinner size="lg" label="Memuat…" />
      </div>
    );
  }

  if (user) return null;

  return <>{children}</>;
}
