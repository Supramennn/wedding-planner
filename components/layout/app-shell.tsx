"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/auth-context";
import { Button } from "@/components/ui/button";

/**
 * Shell aplikasi untuk rute terproteksi: header + konten.
 * Navigasi modul (Dashboard/Checklist/Budget/Vendor) ditambahkan saat
 * modulnya tersedia agar tidak ada link mati.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOutUser } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOutUser();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-[100svh] flex-col">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
          <Link
            href="/dashboard"
            className="text-lg font-semibold tracking-tight text-rose-600"
          >
            WedPlan
          </Link>
          <div className="flex items-center gap-2">
            {user?.email && (
              <span
                className="hidden max-w-56 truncate text-xs text-neutral-500 sm:inline"
                title={user.email}
              >
                {user.email}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Keluar
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>

      <footer className="border-t border-neutral-200 py-4 text-center text-xs text-neutral-400">
        WedPlan — Wedding Planner by Nexus Diji
      </footer>
    </div>
  );
}
