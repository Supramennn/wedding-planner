"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import {
  FIREBASE_NOT_CONFIGURED_MESSAGE,
  getFirebaseAuth,
  isFirebaseConfigured,
} from "@/lib/firebase";
import { mapAuthError } from "@/lib/auth-errors";
import { validateEmail, validatePassword } from "@/lib/validation";
import { ensureUserProfile } from "@/lib/user-service";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { GoogleButton } from "@/components/auth/google-button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string | null;
    password?: string | null;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // FR-01: validasi format email & password minimal 8 karakter.
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    setFieldErrors({ email: emailError, password: passwordError });
    if (emailError || passwordError) return;

    setLoading(true);
    setFormError(null);
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      router.replace("/dashboard");
    } catch (error) {
      setFormError(mapAuthError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setFormError(null);
    try {
      const result = await signInWithPopup(
        getFirebaseAuth(),
        new GoogleAuthProvider()
      );
      await ensureUserProfile(result.user);
      router.replace("/dashboard");
    } catch (error) {
      setFormError(mapAuthError(error));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <h1 className="text-xl font-semibold text-neutral-900">Masuk</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Gunakan email atau Google untuk melanjutkan.
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
          autoComplete="current-password"
          placeholder="Minimal 8 karakter"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password ?? undefined}
        />
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Masuk
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-neutral-400">
        <span className="h-px flex-1 bg-neutral-200" />
        atau
        <span className="h-px flex-1 bg-neutral-200" />
      </div>

      <GoogleButton onClick={handleGoogleSignIn} loading={googleLoading} />

      <p className="mt-6 text-center text-sm text-neutral-600">
        Belum punya akun?{" "}
        <Link
          href="/register"
          className="font-medium text-rose-600 hover:underline"
        >
          Daftar
        </Link>
      </p>
    </Card>
  );
}
