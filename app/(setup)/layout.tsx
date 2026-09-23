import type { Metadata } from "next";
import { AuthGuard } from "@/lib/hooks/auth-guard";

export const metadata: Metadata = {
  title: "Onboarding",
};

/**
 * Route group untuk setup awal: user harus login, tetapi BELUM harus
 * onboarded (berbeda dari (app) yang memakai requireOnboarded).
 */
export default function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <main className="flex min-h-[100svh] flex-col items-center justify-center px-4 py-8">
        <div className="mb-6 text-center">
          <p className="text-3xl font-semibold tracking-tight text-rose-600">
            WedPlan
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Lengkapi data pernikahanmu
          </p>
        </div>
        <div className="w-full max-w-lg">{children}</div>
      </main>
    </AuthGuard>
  );
}
