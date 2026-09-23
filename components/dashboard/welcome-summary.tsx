"use client";

import { useAuth } from "@/lib/hooks/auth-context";

/** Sapaan personal di dashboard (data dari users/{uid}, single source of truth). */
export function WelcomeSummary() {
  const { user, profile } = useAuth();
  const name = profile?.displayName || user?.displayName || user?.email || "";

  return (
    <div>
      <h1 className="text-xl font-semibold text-neutral-900">
        {name ? `Halo, ${name.split(" ")[0]} 👋` : "Halo 👋"}
      </h1>
      <p className="text-sm text-neutral-500">
        Ini ringkasan persiapan pernikahanmu.
      </p>
    </div>
  );
}
