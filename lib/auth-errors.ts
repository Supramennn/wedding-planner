import { FIREBASE_NOT_CONFIGURED_MESSAGE } from "@/lib/firebase";

/**
 * Mapping pesan error Firebase Auth ke bahasa Indonesia
 * agar UI konsisten untuk persona awam teknologi (PRD Section 2).
 */
export function mapAuthError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  switch (code) {
    case "auth/invalid-email":
      return "Format email tidak valid.";
    case "auth/missing-password":
      return "Password wajib diisi.";
    case "auth/weak-password":
      return "Password minimal 8 karakter.";
    case "auth/email-already-in-use":
      return "Email sudah terdaftar. Silakan gunakan login.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email atau password salah.";
    case "auth/too-many-requests":
      return "Terlalu banyak percobaan. Coba lagi beberapa saat lagi.";
    case "auth/popup-closed-by-user":
      return "Jendela Google ditutup sebelum selesai. Coba lagi.";
    case "auth/popup-blocked":
      return "Browser memblokir pop-up. Izinkan pop-up lalu coba lagi.";
    case "auth/network-request-failed":
      return "Gagal terhubung. Periksa koneksi internet Anda.";
    case "auth/operation-not-allowed":
      return "Metode login belum diaktifkan di Firebase Console.";
    case "auth/unauthorized-domain":
      return (
        "Domain aplikasi ini belum diizinkan untuk login Google. " +
        "Tambahkan domainnya di Firebase Console → Authentication → " +
        "Settings → Authorized domains."
      );
    default:
      break;
  }

  if (error instanceof Error && error.message === FIREBASE_NOT_CONFIGURED_MESSAGE) {
    return FIREBASE_NOT_CONFIGURED_MESSAGE;
  }

  return "Terjadi kesalahan. Silakan coba lagi.";
}
