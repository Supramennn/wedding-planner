"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { getDb, getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { WEDDING_MIGRATION_ERROR, ensureWedding } from "@/lib/wedding-service";
import type { UserProfile, Wedding } from "@/types";

/**
 * AuthProvider — single source of truth untuk status autentikasi, profil
 * akun, DAN data pernikahan bersama (Fase 2) di seluruh aplikasi.
 *
 * Dua lapis baca realtime (onSnapshot):
 * 1. users/{uid}  -> identitas (displayName/email) + penunjuk weddingId,
 * 2. weddings/{weddingId} -> data pernikahan bersama (member 2 akun).
 *
 * Akun legacy (punya weddingDate tapi belum weddingId) dimigrasi otomatis
 * sekali ke weddings/{id} (idempotent) sebelum wedding ikut disubscribe.
 */

interface AuthContextValue {
  user: User | null;
  /** Profil akun users/{uid} (identitas + weddingId). */
  profile: UserProfile | null;
  /** Data pernikahan bersama; null sampai onboarding/migrasi selesai. */
  wedding: Wedding | null;
  /** true selama menunggu snapshot profil pertama (user sudah login). */
  profileLoading: boolean;
  /** true selama wedding belum siap (migrasi/subscribe berjalan). */
  weddingLoading: boolean;
  /** Error migrasi kolaborasi; null = tidak ada. Retry via retryWedding. */
  weddingError: string | null;
  /** Ulangi migrasi otomatis setelah gagal (mis. offline). */
  retryWedding: () => void;
  /** true selama menunggu status auth pertama. */
  loading: boolean;
  /** true bila data pernikahan siap (legacy: weddingDate terisi). */
  isOnboarded: boolean;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  /** uid yang profilnya sudah ter-load (null = belum ada snapshot). */
  const [profileKey, setProfileKey] = useState<string | null>(null);
  const [wedding, setWedding] = useState<Wedding | null>(null);
  /** weddingId yang snapshotnya sudah ter-load (null = belum). */
  const [weddingKey, setWeddingKey] = useState<string | null>(null);
  const [weddingError, setWeddingError] = useState<string | null>(null);
  const [migrationAttempt, setMigrationAttempt] = useState(0);
  const migrationRunningRef = useRef(false);
  // Loading awal mengikuti ketersediaan konfigurasi (.env.local) — bukan
  // diset di dalam effect, agar tidak ada cascade render.
  const [loading, setLoading] = useState(() => isFirebaseConfigured);

  const weddingId = profile?.weddingId ?? null;
  const needsMigration = Boolean(
    user && profile?.weddingDate && !profile.weddingId
  );

  // Status autentikasi (persistensi sesi Firebase).
  useEffect(() => {
    if (!isFirebaseConfigured) return;

    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setProfile(null);
      setProfileKey(null);
      setWedding(null);
      setWeddingKey(null);
      setWeddingError(null);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Profil akun realtime (onSnapshot) selama user login.
  useEffect(() => {
    if (!user || !isFirebaseConfigured) return;

    const unsubscribe = onSnapshot(
      doc(getDb(), "users", user.uid),
      (snapshot) => {
        setProfile(snapshot.exists() ? (snapshot.data() as UserProfile) : null);
        setProfileKey(user.uid);
      },
      () => {
        // Error jaringan/rules: hentikan loading, modul menampilkan empty state.
        setProfile(null);
        setProfileKey(user.uid);
      }
    );

    return unsubscribe;
  }, [user]);

  // Migrasi lazy akun legacy -> weddings/{id} (sekali jalan, idempotent).
  useEffect(() => {
    if (!needsMigration || migrationRunningRef.current) return;
    let active = true;

    // Promise.resolve() agar tidak ada setState sinkron di dalam effect body.
    void (async () => {
      await Promise.resolve();
      if (!active || migrationRunningRef.current || !user) return;
      migrationRunningRef.current = true;
      setWeddingError(null);
      try {
        await ensureWedding(user);
      } catch {
        if (active) setWeddingError(WEDDING_MIGRATION_ERROR);
      } finally {
        migrationRunningRef.current = false;
      }
    })();

    return () => {
      active = false;
    };
  }, [needsMigration, user, migrationAttempt]);

  // Data pernikahan bersama realtime (onSnapshot) selama weddingId terisi.
  useEffect(() => {
    if (!user || !weddingId || !isFirebaseConfigured) return;

    const unsubscribe = onSnapshot(
      doc(getDb(), "weddings", weddingId),
      (snapshot) => {
        setWedding(
          snapshot.exists()
            ? ({ id: snapshot.id, ...snapshot.data() } as Wedding)
            : null
        );
        setWeddingKey(weddingId);
      },
      () => {
        // Error jaringan/rules: hentikan loading, modul menampilkan empty state.
        setWedding(null);
        setWeddingKey(weddingId);
      }
    );

    return unsubscribe;
  }, [user, weddingId]);

  const retryWedding = useCallback(() => {
    setWeddingError(null);
    if (user && needsMigration) setMigrationAttempt((attempt) => attempt + 1);
  }, [user, needsMigration]);

  const value = useMemo<AuthContextValue>(() => {
    const profileLoading = Boolean(
      isFirebaseConfigured && user && profileKey !== user.uid
    );
    // Wedding siap saat weddingId ada dan snapshotnya sudah tiba;
    // weddingLoading = legacy masih dimigrasi ATAU subscribe belum masuk.
    const weddingReady = Boolean(
      user &&
        profile?.weddingDate &&
      (!profile.weddingId || weddingKey === profile.weddingId)
    );
    const activeWedding = weddingId && wedding?.id === weddingId ? wedding : null;

    return {
      user,
      profile,
      wedding: activeWedding,
      loading,
      profileLoading,
      weddingLoading: Boolean(
        isFirebaseConfigured &&
          user &&
          profile?.weddingDate &&
          !weddingReady
      ),
      weddingError,
      retryWedding,
      isOnboarded: Boolean(profile?.weddingDate || activeWedding?.weddingDate),
      signOutUser: async () => {
        if (!isFirebaseConfigured) return;
        await signOut(getFirebaseAuth());
      },
    };
  }, [
    user,
    profile,
    profileKey,
    weddingId,
    wedding,
    weddingKey,
    loading,
    weddingError,
    retryWedding,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth harus dipakai di dalam <AuthProvider>.");
  }
  return context;
}
