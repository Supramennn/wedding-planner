"use client";

import {
  createContext,
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
import { refreshAuthClaims } from "@/lib/auth-verify";
import { tryAutoClaimInvite } from "@/lib/couple-service";
import type { UserProfile } from "@/types";

/**
 * AuthProvider — single source of truth untuk status autentikasi & profil
 * pernikahan di seluruh aplikasi. Semua halaman membaca dari sini,
 * tidak ada duplikasi state user.
 *
 * Kolaborasi pasangan (Phase 2):
 * - Dokumen SENDIRI (users/{user.uid}) selalu di-snapshot → `ownProfile`.
 *   Bila ownProfile.linkedTo terisi, akun ini pasangan dari workspace itu.
 * - `workspaceUid` = linkedTo milik sendiri ?? uid sendiri → SEMUA modul
 *   memakai workspaceUid, sehingga dua akun membaca/menulis satu data.
 * - `profile` = snapshot users/{workspaceUid} (realtime, onSnapshot) —
 *   perubahan pasangan lain langsung tersinkron tanpa refresh.
 * - Auto-claim: bila akun baru (belum onboarding) punya undangan atas
 *   emailnya, tautkan otomatis sekali per sesi login.
 */

interface AuthContextValue {
  user: User | null;
  /** Profil workspace users/{workspaceUid} (untuk pasangan = dokumen pemilik). */
  profile: UserProfile | null;
  /** Dokumen profil milik akun INI (memuat linkedTo/partnerUid bila ada). */
  ownProfile: UserProfile | null;
  /** uid tempat seluruh data pernikahan disimpan (null bila belum login). */
  workspaceUid: string | null;
  /** true selama menunggu status auth pertama. */
  loading: boolean;
  /** true selama menunggu snapshot profil pertama (user sudah login). */
  profileLoading: boolean;
  /** true bila seluruh field profil (termasuk weddingDate) sudah terisi. */
  isOnboarded: boolean;
  /**
   * true bila alamat email sudah diverifikasi.
   *
   * Dipisah dari `user.emailVerified` supaya perubahan status bisa
   * memicu re-render: `onAuthStateChanged` tidak memicu event saat
   * verifikasi berubah, jadi auto-claim undangan butuh nilai ini
   * sebagai dependensi effect.
   */
  emailVerified: boolean;
  /**
   * Segarkan klaim sesi lalu kembalikan status verifikasi terbaru.
   * Dipanggil setelah user mengeklik tautan verifikasi di email.
   */
  refreshEmailVerified: () => Promise<boolean>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ownProfile, setOwnProfile] = useState<UserProfile | null>(null);
  /** uid dokumen sendiri yang sudah ter-snapshot (null = belum ada snapshot). */
  const [ownKey, setOwnKey] = useState<string | null>(null);
  /** Profil workspace (hanya dipakai bila beda dokumen dari ownProfile). */
  const [workspaceProfile, setWorkspaceProfile] = useState<UserProfile | null>(
    null
  );
  const [workspaceKey, setWorkspaceKey] = useState<string | null>(null);
  // Loading awal mengikuti ketersediaan konfigurasi (.env.local) — bukan
  // diset di dalam effect, agar tidak ada cascade render.
  const [loading, setLoading] = useState(() => isFirebaseConfigured);
  /** Anti dobel: auto-claim hanya dicoba sekali per akun per sesi. */
  const claimTriedFor = useRef<string | null>(null);
  /**
   * Status verifikasi sebagai state terpisah, bukan dibaca dari
   * `user.emailVerified`, supaya perubahannya memicu re-render dan
   * effect auto-claim di bawah ikut mengevaluasi ulang.
   */
  const [emailVerified, setEmailVerified] = useState(false);

  // Status autentikasi (persistensi sesi Firebase).
  useEffect(() => {
    if (!isFirebaseConfigured) return;

    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setEmailVerified(nextUser?.emailVerified ?? false);
      setOwnProfile(null);
      setOwnKey(null);
      setWorkspaceProfile(null);
      setWorkspaceKey(null);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Snapshot dokumen profil SENDIRI (realtime) selama user login.
  useEffect(() => {
    if (!user || !isFirebaseConfigured) return;

    const unsubscribe = onSnapshot(
      doc(getDb(), "users", user.uid),
      (snapshot) => {
        setOwnProfile(snapshot.exists() ? (snapshot.data() as UserProfile) : null);
        setOwnKey(user.uid);
      },
      () => {
        // Error jaringan/rules: hentikan loading, modul menampilkan empty state.
        setOwnProfile(null);
        setOwnKey(user.uid);
      }
    );

    return unsubscribe;
  }, [user]);

  // Resolusi workspace: pasangan memakai dokumen pemilik (linkedTo).
  const workspaceUid = user ? (ownProfile?.linkedTo ?? user.uid) : null;
  const isLinkedPartner = Boolean(
    user && ownProfile?.linkedTo && ownProfile.linkedTo !== user.uid
  );

  // Snapshot workspace TERPISAH hanya bila linkedTo menunjuk dokumen lain.
  useEffect(() => {
    if (!isLinkedPartner || !workspaceUid || !isFirebaseConfigured) return;

    const unsubscribe = onSnapshot(
      doc(getDb(), "users", workspaceUid),
      (snapshot) => {
        setWorkspaceProfile(
          snapshot.exists() ? (snapshot.data() as UserProfile) : null
        );
        setWorkspaceKey(workspaceUid);
      },
      () => {
        setWorkspaceProfile(null);
        setWorkspaceKey(workspaceUid);
      }
    );

    return unsubscribe;
  }, [isLinkedPartner, workspaceUid]);

  // Auto-claim undangan pasangan (Phase 2): hanya untuk akun yang belum
  // onboarding solo — saat ownProfile pertama tiba & belum tertaut.
  //
  // Syarat email terverifikasi: rules menolak klaim dari akun yang
  // emailnya belum diverifikasi, jadi mencoba di sini hanya menghasilkan
  // permission-denied yang swallowed. Dengan checking di sini, akun itu
  // akan diberi tahu lewat UI (kartu Kolaborasi di Pengaturan) alih-alih
  // melihat "undangan tidak masuk" tanpa penjelasan.
  useEffect(() => {
    if (!user || !isFirebaseConfigured) return;
    if (ownKey !== user.uid) return; // tunggu snapshot dokumen sendiri dulu
    if (ownProfile?.linkedTo) return; // sudah tertaut
    if (ownProfile?.weddingDate) return; // sudah punya data sendiri (butuh merge)
    if (!emailVerified) return; // perlu verifikasi dulu, jangan dicoba
    if (claimTriedFor.current === user.uid || !user.email) return;
    claimTriedFor.current = user.uid;
    // Best-effort: gagal (offline/rules) dicoba lagi pada login berikutnya.
    tryAutoClaimInvite(user).catch(() => {});
  }, [user, ownProfile, ownKey, emailVerified]);

  const value = useMemo<AuthContextValue>(() => {
    const profile = isLinkedPartner ? workspaceProfile : ownProfile;
    const profileLoading = Boolean(
      isFirebaseConfigured &&
        user &&
        (ownKey !== user.uid ||
          (isLinkedPartner && workspaceKey !== workspaceUid))
    );

    return {
      user,
      profile,
      ownProfile,
      workspaceUid,
      loading,
      profileLoading,
      isOnboarded: Boolean(profile?.weddingDate),
      emailVerified,
      refreshEmailVerified: async () => {
        if (!user) return false;
        const verified = await refreshAuthClaims(user);
        setEmailVerified(verified);
        return verified;
      },
      signOutUser: async () => {
        if (!isFirebaseConfigured) return;
        await signOut(getFirebaseAuth());
      },
    };
  }, [
    user,
    emailVerified,
    ownProfile,
    ownKey,
    workspaceProfile,
    workspaceKey,
    workspaceUid,
    isLinkedPartner,
    loading,
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
