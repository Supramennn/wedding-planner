"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/hooks/auth-context";
import { saveUserProfile } from "@/lib/user-service";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CardSkeleton } from "@/components/ui/skeleton";
import type { UserProfile } from "@/types";

/**
 * Form pengaturan profil (FR-03: data onboarding bisa diedit ulang).
 * Field diinisialisasi saat data sudah siap (komponen di-mount setelah
 * snapshot profil tiba — tanpa setState di dalam effect).
 */
export function ProfileForm() {
  const { workspaceUid, profile, loading, profileLoading } = useAuth();

  if (loading || profileLoading || !workspaceUid) {
    return <CardSkeleton lines={5} />;
  }

  return (
    <ProfileFormInner key={workspaceUid} uid={workspaceUid} defaults={profile} />
  );
}

function ProfileFormInner({
  uid,
  defaults,
}: {
  uid: string;
  defaults: UserProfile | null;
}) {
  const [displayName, setDisplayName] = useState(
    () => defaults?.displayName ?? ""
  );
  const [partnerName, setPartnerName] = useState(
    () => defaults?.partnerName ?? ""
  );
  const [weddingDate, setWeddingDate] = useState(
    () => defaults?.weddingDate ?? ""
  );
  const [venue, setVenue] = useState(() => defaults?.venue ?? "");

  const [errors, setErrors] = useState<{
    displayName?: string | null;
    partnerName?: string | null;
    weddingDate?: string | null;
  }>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const nextErrors = {
      displayName: displayName.trim() ? null : "Nama wajib diisi.",
      partnerName: partnerName.trim() ? null : "Nama pasangan wajib diisi.",
      weddingDate: weddingDate ? null : "Tanggal pernikahan wajib diisi.",
    };
    setErrors(nextErrors);
    if (nextErrors.displayName || nextErrors.partnerName || nextErrors.weddingDate) {
      return;
    }

    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      await saveUserProfile(uid, {
        displayName: displayName.trim(),
        partnerName: partnerName.trim(),
        weddingDate,
        venue: venue.trim(),
      });
      setSaved(true);
    } catch {
      setSaveError(
        "Gagal menyimpan. Periksa koneksi internet Anda lalu coba lagi."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <CardTitle>Data pernikahan</CardTitle>
      <CardDescription>
        Data ini menjadi sumber tunggal untuk dashboard, checklist, dan
        countdown.
      </CardDescription>

      {saveError && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {saveError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
        <Input
          label="Nama Anda"
          type="text"
          autoComplete="name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          error={errors.displayName ?? undefined}
        />
        <Input
          label="Nama pasangan"
          type="text"
          value={partnerName}
          onChange={(event) => setPartnerName(event.target.value)}
          error={errors.partnerName ?? undefined}
        />
        <Input
          label="Tanggal pernikahan"
          type="date"
          value={weddingDate}
          onChange={(event) => setWeddingDate(event.target.value)}
          error={errors.weddingDate ?? undefined}
        />
        <Input
          label="Lokasi acara (opsional)"
          type="text"
          value={venue}
          onChange={(event) => setVenue(event.target.value)}
        />

        <div className="flex items-center justify-between gap-3 pt-1">
          <p
            className={`text-sm font-medium ${
              saved ? "text-emerald-600" : "text-neutral-400"
            }`}
            aria-live="polite"
          >
            {saved ? "Tersimpan ✓" : ""}
          </p>
          <Button type="submit" size="lg" loading={saving}>
            Simpan perubahan
          </Button>
        </div>
      </form>
    </Card>
  );
}
