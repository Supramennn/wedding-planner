import type { Metadata } from "next";
import { GuestGuard } from "@/lib/hooks/guest-guard";

export const metadata: Metadata = {
  title: "Masuk",
};

/** Layout untuk halaman auth: kartu terpusat + cegah user yang sudah login. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <GuestGuard>
      <main className="flex min-h-[100svh] flex-col items-center justify-center px-4 py-8">
        <div className="mb-6 text-center">
          <p className="text-3xl font-semibold tracking-tight text-rose-600">
            WedPlan
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Persiapan pernikahanmu dalam satu tempat
          </p>
        </div>
        <div className="w-full max-w-md">{children}</div>
      </main>
    </GuestGuard>
  );
}
