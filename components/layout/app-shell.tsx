"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/auth-context";
import { Button } from "@/components/ui/button";

/**
 * Shell aplikasi untuk rute terproteksi: header + konten.
 * Daftar menu diperpanjang saat modul Checklist/Budget/Vendor tersedia
 * (tidak ada link ke rute yang belum ada).
 */
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dasbor" },
  { href: "/checklist", label: "Checklist" },
  { href: "/budget", label: "Budget" },
  { href: "/settings", label: "Pengaturan" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOutUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  async function handleSignOut() {
    await signOutUser();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-[100svh] flex-col">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-lg font-semibold tracking-tight text-rose-600"
            >
              WedPlan
            </Link>
            <nav aria-label="Menu utama" className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-lg px-2 py-1.5 text-sm transition-colors ${
                      active
                        ? "bg-rose-50 font-medium text-rose-700"
                        : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

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
