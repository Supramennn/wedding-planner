/**
 * Path koleksi Firestore — satu tempat untuk seluruh app (single source).
 * Skema: users/{uid}/checklist, users/{uid}/budget, users/{uid}/vendors
 *
 * Bentuk string (bukan array) agar bisa langsung dipakai oleh
 * collection()/doc() tanpa spread argumen, maupun oleh hook useCollection.
 */

export function userDocPath(uid: string): string {
  return `users/${uid}`;
}

export function checklistPath(uid: string): string {
  return `users/${uid}/checklist`;
}

export function budgetPath(uid: string): string {
  return `users/${uid}/budget`;
}

export function vendorsPath(uid: string): string {
  return `users/${uid}/vendors`;
}

/** Daftar tamu undangan (estimasi jumlah tamu). */
export function guestsPath(uid: string): string {
  return `users/${uid}/guests`;
}

/** Item persiapan/pengeluaran (daftar yang perlu disiapkan — modul budget). */
export function prepPath(uid: string): string {
  return `users/${uid}/prepItems`;
}
