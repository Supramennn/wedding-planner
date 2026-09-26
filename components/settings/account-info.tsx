"use client";

import { useState } from "react";
import { useAuth } from "@/lib/hooks/auth-context";
import { sendVerificationTo } from "@/lib/auth-verify";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

/**
 * Info akun (baca-saja) + verifikasi email + jalan pintas keluar.
 *
 * Prompt verifikasi sengaja dibuat GENERIK: teksnya tidak pernah
 * menyatakan apakah email ini memang diundang atau tidak. Kalau kartu ini
 * mengonfirmasi ada undangan, isinya bisa dipakai siapa pun untuk menebak
 * alamat email yang terdaftar di WedPlan.
 */
export function AccountInfo() {
  const { user, signOutUser, emailVerified, refreshEmailVerified } = useAuth();
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSendVerification() {
    if (!user || sending) return;
    setSending(true);
    setNotice(null);
    setError(null);
    try {
      await sendVerificationTo(user);
      setNotice("Email verifikasi dikirim. Buka inbox email kamu untuk mengikuti tautannya.");
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Gagal mengirim email verifikasi."
      );
    } finally {
      setSending(false);
    }
  }

  async function handleCheckVerification() {
    if (!user || checking) return;
    setChecking(true);
    setNotice(null);
    setError(null);
    try {
      const verified = await refreshEmailVerified();
      setNotice(
        verified
          ? "Email terverifikasi. Semua fitur siap dipakai."
          : "Belum terverifikasi. Coba buka tautan di email verifikasi dulu."
      );
    } catch {
      setError("Gagal memeriksa status verifikasi. Periksa koneksi lalu coba lagi.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <Card>
      <CardTitle>Akun</CardTitle>
      <CardDescription>Email yang terdaftar di WedPlan.</CardDescription>
      <p className="mt-3 break-all text-sm text-neutral-700">
        {user?.email ?? "-"}
      </p>

      {!emailVerified && user?.email && (
        <div className="mt-4 space-y-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-amber-800">
              Email belum diverifikasi
            </p>
            <p className="mt-0.5 text-xs text-amber-700">
              Kamu tetap bisa memakai semua fitur. Verifikasi hanya dibutuhkan
              untuk menerima undangan dari pasangan, supaya data pernikahanmu
              tidak bisa diambil alih oleh orang lain yang kebetulan tahu
              alamat email ini.
            </p>
          </div>

          {notice && (
            <p className="text-xs text-amber-800" aria-live="polite">
              {notice}
            </p>
          )}
          {error && (
            <p role="alert" className="text-xs font-medium text-red-700">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              size="sm"
              loading={sending}
              onClick={handleSendVerification}
            >
              {sending ? "Mengirim" : "Kirim email verifikasi"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              loading={checking}
              onClick={handleCheckVerification}
            >
              Sudah verifikasi, cek sekarang
            </Button>
          </div>
        </div>
      )}

      {emailVerified && (
        <p className="mt-3 text-xs font-medium text-emerald-600">
          Email terverifikasi.
        </p>
      )}

      <button
        type="button"
        onClick={() => signOutUser()}
        className="mt-4 min-h-11 text-sm font-medium text-red-600 hover:underline"
      >
        Keluar dari akun
      </button>
    </Card>
  );
}
