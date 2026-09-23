"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/lib/hooks/auth-context";
import { saveUserProfile } from "@/lib/user-service";
import { generateDefaultChecklist } from "@/lib/default-checklist";
import { ensureWedding, joinWeddingWithCode } from "@/lib/wedding-service";
import type { JoinWeddingResult } from "@/lib/wedding-service";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress-bar";

const STEPS = [
  {
    title: "Siapa kamu dan pasanganmu?",
    description: "Nama kalian tampil di dashboard dan pengaturan.",
  },
  {
    title: "Kapan hari-H mu?",
    description: "Tanggal ini dipakai untuk countdown dan jadwal checklist.",
  },
  {
    title: "Di mana lokasi acaranya?",
    description: "Opsional — kamu bisa mengubahnya kapan saja.",
  },
] as const;

const JOIN_ERROR =
  "Gagal bergabung. Pastikan kode valid dan layanan Cloud Functions sudah di-deploy (lihat README bagian deploy), lalu coba lagi.";

/**
 * Wizard onboarding 3 langkah (FR-02, FR-03) + jalur "gabung via kode
 * undangan" (Fase 2 — kolaborasi dengan pasangan).
 *
 * Data disimpan sebagai data PERNIKAHAN BERSAMA (weddings/{uid}):
 * urutan wajib: ensureWedding → generate checklist (ke path wedding) →
 * saveUserProfile identitas — karena subcollection weddings/{id} hanya bisa
 * ditulis setelah dokumen wedding tercipta (security rules member).
 */
export function OnboardingWizard() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [step, setStep] = useState(0);
  const [ownName, setOwnName] = useState(
    () => profile?.displayName ?? user?.displayName ?? ""
  );
  const [partnerName, setPartnerName] = useState(
    () => profile?.partnerName ?? ""
  );
  const [weddingDate, setWeddingDate] = useState(
    () => profile?.weddingDate ?? ""
  );
  const [venue, setVenue] = useState(() => profile?.venue ?? "");
  const [errors, setErrors] = useState<{
    ownName?: string | null;
    partnerName?: string | null;
    weddingDate?: string | null;
  }>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [inviteCode, setInviteCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joined, setJoined] = useState<JoinWeddingResult | null>(null);

  function validateCurrentStep(): boolean {
    if (step === 0) {
      const next = {
        ownName: ownName.trim() ? null : "Nama kamu wajib diisi.",
        partnerName: partnerName.trim() ? null : "Nama pasangan wajib diisi.",
      };
      setErrors(next);
      return !next.ownName && !next.partnerName;
    }
    if (step === 1) {
      const error = weddingDate ? null : "Tanggal pernikahan wajib diisi.";
      setErrors({ weddingDate: error });
      return !error;
    }
    return true;
  }

  function handleNext() {
    if (validateCurrentStep()) setStep((current) => Math.min(current + 1, 2));
  }

  function handleBack() {
    setStep((current) => Math.max(current - 1, 0));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !user) return;

    // Validasi semua langkah sebelum menyimpan.
    const validation = {
      ownName: ownName.trim() ? null : "Nama kamu wajib diisi.",
      partnerName: partnerName.trim() ? null : "Nama pasangan wajib diisi.",
      weddingDate: weddingDate ? null : "Tanggal pernikahan wajib diisi.",
    };
    setErrors(validation);
    if (!ownName.trim() || !partnerName.trim() || !weddingDate) {
      setStep(!ownName.trim() || !partnerName.trim() ? 0 : 1);
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      // Urutan penting: 1) buat weddings/{uid} dulu (ensureWedding —
      // create + inviteCode + penunjuk weddingId), 2) generate checklist
      // default KE PATH WEDDING (butuh wedding doc & membership ada),
      // 3) simpan identitas di users/{uid}.
      await ensureWedding(user, { weddingDate, venue: venue.trim() });
      await generateDefaultChecklist(user.uid, weddingDate);
      await saveUserProfile(user.uid, {
        displayName: ownName.trim(),
        partnerName: partnerName.trim(),
        weddingDate,
        venue: venue.trim(),
      });
      router.replace("/dashboard");
    } catch {
      setSaveError(
        "Gagal menyimpan. Periksa koneksi internet Anda lalu coba lagi."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (joining || !user || joined) return;
    setJoining(true);
    setJoinError(null);
    try {
      const result = await joinWeddingWithCode(inviteCode, ownName.trim());
      if (result) {
        setJoined(result);
        setTimeout(() => router.replace("/dashboard"), 1200);
      }
    } catch {
      setJoinError(JOIN_ERROR);
    } finally {
      setJoining(false);
    }
  }

  const current = STEPS[step];

  if (joined) {
    return (
      <Card className="p-5 sm:p-6">
        <h1 className="text-lg font-semibold text-neutral-900">
          Kamu berhasil bergabung!
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Mulai sekarang kamu dan pasanganmu berkolaborasi dalam satu data
          pernikahan bersama. Mengalihkan ke dashboard…
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-6">
      {/* Indikator langkah */}
      <div className="mb-5">
        <p className="mb-2 text-xs font-medium text-neutral-500">
          Langkah {step + 1} dari {STEPS.length}
        </p>
        <ProgressBar
          value={((step + 1) / STEPS.length) * 100}
          showValue={false}
        />
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="min-h-56">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <h1 className="text-lg font-semibold text-neutral-900">
                {current.title}
              </h1>
              <p className="mt-1 text-sm text-neutral-500">
                {current.description}
              </p>

              <div className="mt-5 space-y-4">
                {step === 0 && (
                  <>
                    <Input
                      label="Nama kamu"
                      type="text"
                      placeholder="Contoh: Andi"
                      value={ownName}
                      onChange={(event) => setOwnName(event.target.value)}
                      error={errors.ownName ?? undefined}
                    />
                    <Input
                      label="Nama pasangan"
                      type="text"
                      placeholder="Contoh: Sinta"
                      value={partnerName}
                      onChange={(event) => setPartnerName(event.target.value)}
                      error={errors.partnerName ?? undefined}
                    />
                  </>
                )}

                {step === 1 && (
                  <Input
                    label="Tanggal pernikahan"
                    type="date"
                    value={weddingDate}
                    onChange={(event) => setWeddingDate(event.target.value)}
                    error={errors.weddingDate ?? undefined}
                  />
                )}

                {step === 2 && (
                  <>
                    <Input
                      label="Lokasi acara (opsional)"
                      type="text"
                      placeholder="Contoh: Gedung Serbaguna Menteng, Jakarta"
                      value={venue}
                      onChange={(event) => setVenue(event.target.value)}
                    />

                    <div className="rounded-xl bg-neutral-50 p-4 text-sm">
                      <p className="mb-2 font-medium text-neutral-700">
                        Ringkasan
                      </p>
                      <dl className="space-y-1 text-neutral-600">
                        <div className="flex justify-between gap-3">
                          <dt>Pasangan</dt>
                          <dd className="font-medium text-neutral-900">
                            {ownName}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt>Tanggal</dt>
                          <dd className="font-medium text-neutral-900">
                            {weddingDate || "-"}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt>Lokasi</dt>
                          <dd className="font-medium text-neutral-900">
                            {venue || "-"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {saveError && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {saveError}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {step > 0 ? (
            <Button variant="outline" size="lg" onClick={handleBack}>
              Kembali
            </Button>
          ) : (
            <span />
          )}

          {step < STEPS.length - 1 ? (
            <Button size="lg" onClick={handleNext}>
              Lanjut
            </Button>
          ) : (
            <Button type="submit" size="lg" loading={saving}>
              Simpan & mulai
            </Button>
          )}
        </div>
      </form>

      {/* Fase 2: jalur gabung data pernikahan pasangan (kode undangan) */}
      <div className="mt-6 rounded-xl border border-dashed border-neutral-300 p-4">
        <p className="text-sm font-medium text-neutral-700">
          Sudah punya data pernikahan bersama?
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Dapatkan kode undangan dari pasanganmu (menu Pengaturan → Kolaborasi).
        </p>
        <form onSubmit={handleJoin} className="mt-3 flex gap-2">
          <Input
            aria-label="Kode undangan"
            type="text"
            placeholder="Kode undangan (contoh: A7K2M9)"
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
            className="uppercase"
          />
          <Button type="submit" variant="outline" loading={joining}>
            Gabung
          </Button>
        </form>
        {joinError && (
          <p role="alert" className="mt-2 text-xs text-red-600">
            {joinError}
          </p>
        )}
      </div>
    </Card>
  );
}