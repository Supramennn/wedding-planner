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
  /** true selama menunggu snapshot profil pertama (user sudah login). */
  profileLoading: boolean;
  /** true bila seluruh field profil (termasuk weddingDate) sudah terisi. */
  isOnboarded: boolean;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  /** uid yang profilnya sudah ter-load (null = belum ada snapshot). */
  const [profileKey, setProfileKey] = useState<string | null>(null);
  // Loading awal mengikuti ketersediaan konfigurasi (.env.local) — bukan
  // diset di dalam effect, agar tidak ada cascade render.
  const [loading, setLoading] = useState(() => isFirebaseConfigured);

  // Status autentikasi (persistensi sesi Firebase).
  useEffect(() => {
    if (!isFirebaseConfigured) return;

    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setProfile(null);
      setProfileKey(null);
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

  const value = useMemo<AuthContextValue>(() => {
    const profileLoading = Boolean(
      isFirebaseConfigured && user && profileKey !== user.uid
    );

    return {
      user,
      profile,
      loading,
      profileLoading,
      isOnboarded: Boolean(profile?.weddingDate),
      signOutUser: async () => {
        if (!isFirebaseConfigured) return;
        await signOut(getFirebaseAuth());
      },
    };
  }, [user, profile, profileKey, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth harus dipakai di dalam <AuthProvider>.");
  }
  return context;
}
