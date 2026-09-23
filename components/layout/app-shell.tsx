"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/auth-context";
import { Button } from "@/components/ui/button";

/**
 * Shell aplikasi untuk rute terproteksi.
 * Responsif dua mode:
 * - Mobile (< sm): nav pindah ke **bottom tab bar** (alur jempol Android/iOS),
 *   dengan safe-area untuk notch/home-indicator (viewport-fit=cover).
 * - sm ke atas: nav tetap di header seperti semula.
 */
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dasbor" },
  { href: "/checklist", label: "Checklist" },
  { href: "/budget", label: "Budget" },
  { href: "/vendors", label: "Vendor" },
  { href: "/settings", label: "Pengaturan" },
] as const;

/** Ikon stroke ringkas (24px) per tujuan — sengaja inline, tanpa dependensi ikon. */
const NAV_ICONS: Record<string, ReactNode> = {
  "/dashboard": (
    <>
      <path d="M3 10.8 12 3.6l9 7.2" />
      <path d="M5.5 9.6V20.4h13V9.6" />
      <path d="M10 20.4v-5h4v5" />
    </>
  ),
  "/checklist": (
    <>
      <path d="M9.5 6h11M9.5 12h11M9.5 18h11" />
      <path d="m3.2 5.4 1.4 1.4 2.6-3" />
      <path d="m3.2 11.4 1.4 1.4 2.6-3" />
      <path d="m3.2 17.4 1.4 1.4 2.6-3" />
    </>
  ),
  "/budget": (
    <>
      <rect x="3" y="6.5" width="18" height="12.5" rx="2.5" />
      <path d="M3 10.5h18" />
      <circle cx="16.5" cy="15" r="1.1" />
    </>
  ),
  "/vendors": (
    <>
      <path d="M4.5 9.5h15V20h-15z" />
      <path d="M5 9.5 6.5 4h11l1.5 5.5" />
      <path d="M9.5 20v-5h5v5" />
    </>
  ),
  "/settings": (
    <>
      <path d="M4 7.5h8M17.5 7.5H20M4 16.5h3.5M13 16.5h7" />
      <circle cx="14.5" cy="7.5" r="2.4" />
      <circle cx="10" cy="16.5" r="2.4" />
    </>
  ),
};

function TabIcon({ href }: { href: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-5"
    >
      {NAV_ICONS[href]}
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOutUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  async function handleSignOut() {
    await signOutUser();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-[100svh] flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              href="/dashboard"
              className="shrink-0 text-lg font-semibold tracking-tight text-rose-600"
            >
              WedPlan
            </Link>
            {/* Nav horizontal hanya sm+; di mobile pakai bottom tab bar. */}
            <nav aria-label="Menu utama" className="hidden items-center gap-1 sm:flex">
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

          <div className="flex shrink-0 items-center gap-2">
            {user?.email && (
              <span
                className="hidden max-w-56 truncate text-xs text-neutral-500 md:inline"
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

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 sm:px-6 sm:py-6">
        {children}
      </main>

      <footer className="border-t border-neutral-200 py-4 text-center text-xs text-neutral-400">
        WedPlan — Wedding Planner by Nexus Diji
      </footer>

      {/* Bottom tab bar (mobile) — target sentuh >= 56px + safe-area iOS. */}
      <nav
        aria-label="Menu utama"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.05)] backdrop-blur sm:hidden"
      >
        <ul className="mx-auto flex w-full max-w-lg">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <li key={item.href} className="min-w-0 flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-1 px-0.5 pt-1.5 text-[11px] font-medium leading-none transition-colors ${
                    active
                      ? "text-rose-600"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  <TabIcon href={item.href} />
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
