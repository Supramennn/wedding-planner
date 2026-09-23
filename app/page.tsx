"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/auth-context";
import { Spinner } from "@/components/ui/spinner";

/**
 * Halaman depan: arahkan user ke dashboard bila sudah login,
 * ke halaman login bila belum.
 */
export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/dashboard" : "/login");
  }, [loading, user, router]);

  return (
    <main className="flex min-h-[100svh] flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold tracking-tight text-rose-600">
        WedPlan
      </h1>
      <Spinner size="md" label="Mengalihkan…" />
    </main>
  );
}
