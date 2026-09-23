"use client";

import { useAuth } from "@/lib/hooks/auth-context";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

/** Info akun (baca-saja) + jalan pintas keluar. */
export function AccountInfo() {
  const { user, signOutUser } = useAuth();

  return (
    <Card>
      <CardTitle>Akun</CardTitle>
      <CardDescription>Email yang terdaftar di WedPlan.</CardDescription>
      <p className="mt-3 break-all text-sm text-neutral-700">
        {user?.email ?? "-"}
      </p>
      <button
        type="button"
        onClick={() => signOutUser()}
        className="mt-4 text-sm font-medium text-red-600 hover:underline"
      >
        Keluar dari akun
      </button>
    </Card>
  );
}
