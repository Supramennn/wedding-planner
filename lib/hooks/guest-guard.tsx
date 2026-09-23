"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/auth-context";
import { Spinner } from "@/components/ui/spinner";

/**
 * GuestGuard — untuk halaman auth (login/register).
 * Jika sudah login, alihkan ke dashboard supaya user tidak
 * melihat form login dua kali.
 */
export function GuestGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-[60svh] items-center justify-center">
        <Spinner size="lg" label="Memuat…" />
      </div>
    );
  }

  if (user) return null;

  return <>{children}</>;
}
