"use client";

import { useState } from "react";
import { useAuth } from "@/lib/hooks/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import type { Wedding } from "@/types";

/**
 * Kartu Kolaborasi (Fase 2) — menampilkan anggota data pernikahan bersama
 * (< 2 = ada slot terbuka) + kode undangan yang bisa dibagikan ke pasangan.
 */
export function PartnershipCard() {
  const { user, wedding, weddingLoading, isOnboarded } = useAuth();

  if (weddingLoading || !isOnboarded || !wedding) {
    return <CardSkeleton lines={4} />;
  }

  return (
    <Card className="p-5 sm:p-6">
      <CardTitle>Kolaborasi</CardTitle>
      <CardDescription>
        Data pernikahan ini dibagikan ke akun pasanganmu. Maksimal 2 akun.
      </CardDescription>

      <ul className="mt-4 space-y-2">
        {wedding.members.map((uid) => {
          const isSelf = uid === user?.uid;
          return (
            <li
              key={uid}
              className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2"
            >
              <span className="text-sm font-medium text-neutral-800">
                {wedding.coupleNames?.[uid] || "Anggota"}
              </span>
              <span className="text-xs text-neutral-500">
                {isSelf ? "Kamu" : "Pasangan"}
              </span>
            </li>
          );
        })}
      </ul>

      {wedding.members.length < 2 ? (
        <InviteCodeBlock wedding={wedding} />
      ) : (
        <p className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Kolaborasi aktif — pasanganmu sudah bergabung.
        </p>
      )}
    </Card>
  );
}

function InviteCodeBlock({ wedding }: { wedding: Wedding }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(wedding.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard tidak tersedia (non-HTTPS); biarkan user menyalin manual.
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <p className="text-sm text-neutral-600">
        Bagikan kode ini ke pasanganmu untuk bergabung:
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-lg font-semibold tracking-[0.3em] text-neutral-900">
          {wedding.inviteCode}
        </code>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          loading={false}
        >
          {copied ? "Tersalin" : "Salin"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        Sisa {2 - wedding.members.length} slot. Kode hanya berlaku sekali pakai.
      </p>
    </div>
  );
}