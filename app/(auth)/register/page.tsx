"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import {
  FIREBASE_NOT_CONFIGURED_MESSAGE,
  getFirebaseAuth,
  isFirebaseConfigured,
} from "@/lib/firebase";
import { mapAuthError } from "@/lib/auth-errors";
import { sendVerificationTo } from "@/lib/auth-verify";
import { validateEmail, validatePassword } from "@/lib/validation";
import { ensureUserProfile } from "@/lib/user-service";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { GoogleButton } from "@/components/auth/google-button";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string | null;
    email?: string | null;
    password?: string | null;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // FR-01: validasi format email & password minimal 8 karakter.
    const nameError = name.trim() ? null : "Nama wajib diisi.";
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    setFieldErrors({ name: nameError, email: emailError, password: passwordError });
    if (nameError || emailError || passwordError) return;

    setLoading(true);
    setFormError(null);
    try {
      const credential = await createUserWithEmailAndPassword(
        getFirebaseAuth(),
        email.trim(),
        password
      );
      await ensureUserProfile(credential.user, {
        displayName: name.trim(),
      });
      // Kirim email verifikasi di background. Kegagalan di sini TIDAK
      // membatalkan pendaftaran: verifikasi hanya dibutuhkan untuk klaim
      // undangan pasangan, bukan untuk memakai aplikasi. User tetap bisa
      // mengirim ulang kapan saja dari Pengaturan.
      sendVerificationTo(credential.user).catch(() => {});
      // Destinasi (onboarding utk user baru) ditentukan GuestGuard (FR-02).
    } catch (error) {
      setFormError(mapAuthError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignUp() {
    setGoogleLoading(true);
    setFormError(null);
    try {
      const result = await signInWithPopup(
        getFirebaseAuth(),
        new GoogleAuthProvider()
      );
      await ensureUserProfile(result.user);
    } catch (error) {
      setFormError(mapAuthError(error));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <h1 className="text-xl font-semibold text-neutral-900">Daftar akun</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Mulai rencanakan pernikahanmu bersama WedPlan.
      </p>

      {!isFirebaseConfigured && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {FIREBASE_NOT_CONFIGURED_MESSAGE}
        </div>
      )}

      {formError && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
        <Input
          label="Nama Anda"
          type="text"
          autoComplete="name"
          placeholder="Contoh: Andi"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={fieldErrors.name ?? undefined}
        />
        <Input
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="nama@email.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email ?? undefined}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="Minimal 8 karakter"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password ?? undefined}
        />
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Buat akun
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-neutral-400">
        <span className="h-px flex-1 bg-neutral-200" />
        atau
        <span className="h-px flex-1 bg-neutral-200" />
      </div>

      <GoogleButton
        onClick={handleGoogleSignUp}
        loading={googleLoading}
        label="Daftar dengan Google"
      />

      <p className="mt-6 text-center text-sm text-neutral-600">
        Sudah punya akun?{" "}
        <Link
          href="/login"
          className="font-medium text-rose-600 hover:underline"
        >
          Masuk
        </Link>
      </p>
    </Card>
  );
}
