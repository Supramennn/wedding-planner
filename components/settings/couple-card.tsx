"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/hooks/auth-context";
import {
  cancelInvite,
  findInviteForEmail,
  unlinkCouple,
} from "@/lib/couple-service";
import { saveUserProfile } from "@/lib/user-service";
import { validateEmail } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CardSkeleton } from "@/components/ui/skeleton";

/**
 * Kartu Kolaborasi Pasangan (Phase 2): undang via email → pasangan
 * daftar/masuk dengan email itu → tautan otomatis (auto-claim di auth-context).
 * Setelah tertaut KEDUA akun membaca/menulis SATU workspace realtime.
 */
export function CoupleCard() {
  const { user, profile, ownProfile, workspaceUid, loading, profileLoading } =
    useAuth();

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Undangan atas email sendiri dari workspace LAIN (kasus kedua-duanya sudah data). */
  const [foreignInvite, setForeignInvite] = useState<string | null>(null);

  const ready = !loading && !profileLoading && user && workspaceUid;
  const isPartner = Boolean(ownProfile?.linkedTo);
  const linked = isPartner || Boolean(ownProfile?.partnerUid);
  const invitePending =
    !linked && profile?.coupleStatus === "invited" && Boolean(profile?.partnerEmail);
  /** Email lawan main saat sudah tertaut. */
  const counterpartEmail = isPartner
    ? profile?.email ?? ""
    : profile?.partnerEmail ?? "";

  // Cek apakah email kita diundang ke workspace lain (hanya bila sendiri
  // sudah onboarding — kalau belum, auto-claim di auth-context yang bekerja).
  useEffect(() => {
    if (!ready || linked || invitePending || !user?.email) return;
    let cancelled = false;
    findInviteForEmail(user.email)
      .then((invite) => {
        if (cancelled || !invite || invite.uid === user.uid) return;
        if (invite.data.weddingDate) {
          setForeignInvite(invite.data.email || invite.data.displayName || "");
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ready, linked, invitePending, user]);

  if (!ready) return <CardSkeleton lines={4} />;

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !user || !workspaceUid) return;

    const emailError = validateEmail(email.trim());
    setEmailError(emailError);
    if (emailError) return;
    if (email.trim().toLowerCase() === user.email?.toLowerCase()) {
      setEmailError("Tidak bisa mengundang email sendiri.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await saveUserProfile(workspaceUid, {
        partnerEmail: email.trim(),
        coupleStatus: "invited",
      });
      setNotice(`Undangan dikirim ke ${email.trim()}.`);
      setEmail("");
    } catch {
      setError("Gagal menyimpan undangan. Periksa koneksi lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelInvite() {
    if (busy || !workspaceUid) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await cancelInvite(workspaceUid);
      setNotice("Undangan dibatalkan.");
    } catch {
      setError("Gagal membatalkan undangan. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlink() {
    if (busy || !user || !ownProfile) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await unlinkCouple({
        myUid: user.uid,
        linkedTo: ownProfile.linkedTo ?? null,
        partnerUid: ownProfile.partnerUid ?? null,
      });
      setNotice("Tautan pasangan dilepas.");
    } catch {
      setError("Gagal melepas tautan. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle>Kolaborasi pasangan</CardTitle>
      <CardDescription>
        Satu data pernikahan untuk dua akun — perubahan saling tersinkron
        realtime (checklist, budget, vendor, dan pengaturan).
      </CardDescription>

      {error && (
        <div
          role="alert"
          className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      )}
      {notice && (
        <p
          className="mt-3 text-sm font-medium text-emerald-600"
          aria-live="polite"
        >
          {notice}
        </p>
      )}

      {linked ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-emerald-800">
              Tertaut dengan {counterpartEmail || "pasangan"}
            </p>
            <p className="mt-0.5 text-xs text-emerald-700">
              {isPartner
                ? "Kamu memakai data pernikahan milik pasanganmu."
                : "Pasanganmu bisa melihat dan mengubah semua data."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            loading={busy}
            onClick={handleUnlink}
          >
            Lepas tautan
          </Button>
        </div>
      ) : invitePending ? (
        <div className="mt-4 space-y-3 rounded-xl bg-rose-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-rose-800">
              Undangan menunggu: {profile?.partnerEmail}
            </p>
            <p className="mt-0.5 text-xs text-rose-700">
              Minta pasangan daftar/masuk memakai email itu — tautan terjadi
              otomatis dan seluruh data langsung shared.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            loading={busy}
            onClick={handleCancelInvite}
          >
            Batalkan undangan
          </Button>
        </div>
      ) : (
        <form onSubmit={handleInvite} noValidate className="mt-4 space-y-3">
          <Input
            label="Email pasangan"
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="nama@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={emailError ?? undefined}
            hint="Pasangan cukup daftar/masuk dengan email ini — tautan otomatis."
          />
          <Button type="submit" size="md" loading={busy} className="w-full sm:w-auto">
            Kirim undangan
          </Button>
        </form>
      )}

      {foreignInvite && (
        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Email kamu juga diundang ke data pernikahan lain
          {foreignInvite ? ` (${foreignInvite})` : ""}, tetapi akun ini sudah
          punya data sendiri. Penggabungan dua data butuh fitur merge — belum
          tersedia.
        </div>
      )}
    </Card>
  );
}
