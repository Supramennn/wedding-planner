/**
 * Path koleksi Firestore — satu tempat untuk seluruh app (single source).
 *
 * Fase 2: data pernikahan bersama dipindah dari users/{uid} ke
 * weddings/{weddingId} agar bisa diakses 2 akun pasangan sekaligus.
 *   weddings/{weddingId}/checklist
 *   weddings/{weddingId}/budget
 *   weddings/{weddingId}/vendors
 *   weddings/{weddingId}/receipts (Storage)
 *
 * Path legacy (users/{uid}/...) masih tersedia untuk migrasi satu arah:
 *   1. subcollection lama disalin ke weddings/{id} saat migrasi otomatis,
 *   2. struk lama tetap di users/{uid}/receipts agar URL yang tersimpan
 *      pada expense lama tidak putus (rules-nya mengizinkan member baca).
 *
 * Bentuk string (bukan array) agar bisa langsung dipakai oleh
 * collection()/doc() tanpa spread argumen, maupun oleh hook useCollection.
 */

/** users/{userId} — profil akun (identitas + weddingId). */
export function userDocPath(uid: string): string {
  return `users/${uid}`;
}

/** weddings/{weddingId} — data pernikahan bersama. */
export function weddingDocPath(weddingId: string): string {
  return `weddings/${weddingId}`;
}

export function checklistPath(weddingId: string): string {
  return `weddings/${weddingId}/checklist`;
}

export function budgetPath(weddingId: string): string {
  return `weddings/${weddingId}/budget`;
}

export function vendorsPath(weddingId: string): string {
  return `weddings/${weddingId}/vendors`;
}

/** users/{userId}/devices — token FCM per akun (reminder deadline). */
export function deviceTokensPath(uid: string): string {
  return `users/${uid}/devices`;
}

/** weddingInvites/{code} — lookup join pasangan. */
export function weddingInvitePath(code: string): string {
  return `weddingInvites/${code}`;
}

// --- Path legacy (dipakai migrasi satu arah, jangan dipakai untuk tulis) ---

export function legacyChecklistPath(uid: string): string {
  return `users/${uid}/checklist`;
}

export function legacyBudgetPath(uid: string): string {
  return `users/${uid}/budget`;
}

export function legacyVendorsPath(uid: string): string {
  return `users/${uid}/vendors`;
}

// --- Storage ---

/** Struk baru setelah kolaborasi: weddings/{weddingId}/receipts. */
export function receiptsStoragePath(weddingId: string): string {
  return `weddings/${weddingId}/receipts`;
}

/** Struk lama: users/{uid}/receipts (URL yang sudah tersimpan tidak diubah). */
export function legacyReceiptsStoragePath(uid: string): string {
  return `users/${uid}/receipts`;
}