"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/lib/hooks/auth-context";
import { saveUserProfile } from "@/lib/user-service";
import { generateDefaultChecklist } from "@/lib/default-checklist";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress-bar";

const STEPS = [
  {
    title: "Siapa nama pasangan kamu?",
    description: "Nama ini tampil di dashboard dan pengaturan.",
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

/** Wizard onboarding 3 langkah (FR-02, FR-03). */
export function OnboardingWizard() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [step, setStep] = useState(0);
  const [partnerName, setPartnerName] = useState(
    () => profile?.partnerName ?? ""
  );
  const [weddingDate, setWeddingDate] = useState(
    () => profile?.weddingDate ?? ""
  );
  const [venue, setVenue] = useState(() => profile?.venue ?? "");
  const [errors, setErrors] = useState<{
    partnerName?: string | null;
    weddingDate?: string | null;
  }>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function validateCurrentStep(): boolean {
    if (step === 0) {
      const error = partnerName.trim() ? null : "Nama pasangan wajib diisi.";
      setErrors({ partnerName: error });
      return !error;
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
    setErrors({
      partnerName: partnerName.trim() ? null : "Nama pasangan wajib diisi.",
      weddingDate: weddingDate ? null : "Tanggal pernikahan wajib diisi.",
    });
    if (!partnerName.trim() || !weddingDate) {
      setStep(!partnerName.trim() ? 0 : 1);
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      // FR-03: data onboarding tersimpan di users/{userId}.
      await saveUserProfile(user.uid, {
        partnerName: partnerName.trim(),
        weddingDate,
        venue: venue.trim(),
      });
      // FR-02: auto-generate checklist default 9 kategori (FR-08).
      await generateDefaultChecklist(user.uid, weddingDate);
      router.replace("/dashboard");
    } catch {
      setSaveError(
        "Gagal menyimpan. Periksa koneksi internet Anda lalu coba lagi."
      );
    } finally {
      setSaving(false);
    }
  }

  const current = STEPS[step];

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
                  <Input
                    label="Nama pasangan"
                    type="text"
                    placeholder="Contoh: Sinta"
                    value={partnerName}
                    onChange={(event) => setPartnerName(event.target.value)}
                    error={errors.partnerName ?? undefined}
                  />
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
                            {partnerName || "-"}
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
    </Card>
  );
}
