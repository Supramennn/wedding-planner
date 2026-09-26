import {
  sendEmailVerification,
  type User,
} from "firebase/auth";

/**
 * Verifikasi email, untuk collaborating invite yang aman.
 *
 * Kenapa perlu: rules hanya mengizinkan klaim undangan kalau email pemohon
 * sudah terverifikasi, sehingga mengetahui alamat email seseorang tidak
 * cukup untuk mengambil alih data pernikahan mereka. Konsekuensinya, akun
 * yang emailnya belum terverifikasi tidak bisa mengklaim undangan, dan
 * tanpa UI itu akan terasa seperti "undangan tidak masuk".
 *
 * Scope-nya sengaja sempit: verifikasi email hanya syarat untuk operasi
 * lintas akun (klaim undangan, lepas tautan). User tetap bisa memakai
 * seluruh aplikasi dengan email unverified, supaya orang awam tidak
 * terkunci di luar aplikasi.
 *
 * Login Google otomatis terverifikasi karena Google sudah memverifikasi
 * alamatnya, jadi pengguna yang masuk lewat Google tidak melihat prompt ini.
 */

/** Pesan yang ditampilkan ke pengguna, diturunkan dari kode error Firebase. */
function humanizeVerificationError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  if (code === "auth/too-many-requests") {
    return "Terlalu banyak permintaan. Tunggu beberapa menit lalu kirim ulang.";
  }
  if (code === "auth/operation-not-allowed") {
    return "Email verifikasi belum diaktifkan di Firebase Console. Hubungi pengelola aplikasi.";
  }
  return "Gagal mengirim email verifikasi. Periksa koneksi lalu coba lagi.";
}

/**
 * Kirim email verifikasi ke user yang belum terverifikasi.
 * Mengembalikan true bila terkirim, false bila user sudah terverifikasi.
 */
export async function sendVerificationTo(user: User): Promise<boolean> {
  if (user.emailVerified) return false;

  const url =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");

  try {
    await sendEmailVerification(user, { url, handleCodeInApp: true });
    return true;
  } catch (error) {
    throw new Error(humanizeVerificationError(error));
  }
}

/**
 * Segarkan klaim sesi setelah pengguna mengeklik tautan verifikasi.
 *
 * Penting: `onAuthStateChanged` tidak memicu event ketika status verifikasi
 * berubah, jadi klaim undangan yang bergantung pada `email_verified` akan
 * tetap ditolak rules sampai token di-refresh dengan `getIdToken(true)`.
 * Mengembalikan status verifikasi terbaru.
 */
export async function refreshAuthClaims(user: User): Promise<boolean> {
  await user.reload();
  await user.getIdToken(true);
  return user.emailVerified;
}
