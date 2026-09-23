"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { getDb, getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import type { UserProfile } from "@/types";

/**
 * AuthProvider — single source of truth untuk status autentikasi & profil
 * pernikahan di seluruh aplikasi. Semua halaman membaca dari sini,
 * tidak ada duplikasi state user.
 */

interface AuthContextValue {
  user: User | null;
  /** Profil users/{uid}; null sampai onboarding terisi. */
  profile: UserProfile | null;
  /** true selama menunggu status auth pertama. */
  loading: boolean;
  /** true bila seluruh field profil (termasuk weddingDate) sudah terisi. */
  isOnboarded: boolean;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  // Loading awal mengikuti ketersediaan konfigurasi (.env.local) — bukan
  // diset di dalam effect, agar tidak ada cascade render.
  const [loading, setLoading] = useState(() => isFirebaseConfigured);

  // Status autentikasi (persistensi sesi Firebase).
  useEffect(() => {
    if (!isFirebaseConfigured) return;

    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (!nextUser) setProfile(null);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Profil pernikahan realtime (onSnapshot) selama user login.
  useEffect(() => {
    if (!user || !isFirebaseConfigured) return;

    const unsubscribe = onSnapshot(
      doc(getDb(), "users", user.uid),
      (snapshot) => {
        setProfile(snapshot.exists() ? (snapshot.data() as UserProfile) : null);
      },
      () => {
        // Error jaringan/rules: biarkan profile null, modul menampilkan empty state.
        setProfile(null);
      }
    );

    return unsubscribe;
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      isOnboarded: Boolean(profile?.weddingDate),
      signOutUser: async () => {
        if (!isFirebaseConfigured) return;
        await signOut(getFirebaseAuth());
      },
    }),
    [user, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth harus dipakai di dalam <AuthProvider>.");
  }
  return context;
}
