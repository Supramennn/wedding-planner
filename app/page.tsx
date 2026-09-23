"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/auth-context";
import { Spinner } from "@/components/ui/spinner";

/**
 * Halaman depan: arahkan user ke dashboard bila sudah login
 * (atau ke onboarding bila belum), ke halaman login bila belum login.
 */
export default function HomePage() {
  const { user, loading, profileLoading, isOnboarded } = useAuth();
  const router = useRouter();

  const ready = !loading && (!user || !profileLoading);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    router.replace(isOnboarded ? "/dashboard" : "/onboarding");
  }, [ready, user, isOnboarded, router]);

  return (
    <main className="flex min-h-[100svh] flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold tracking-tight text-rose-600">
        WedPlan
      </h1>
      <Spinner size="md" label="Mengalihkan…" />
    </main>
  );
}
