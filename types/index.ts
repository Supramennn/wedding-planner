import type {
  CHECKLIST_CATEGORIES,
  VENDOR_CATEGORIES,
  VENDOR_STATUSES,
} from "@/lib/constants";

/**
 * Tipe data WedPlan — mengikuti skema Firestore di PRD Section 8 + Fase 2.
 *
 * Skema utama (data pernikahan BERSAMA 2 akun, Fase 2):
 *   weddings/{weddingId}                       ← data pernikahan bersama
 *   weddings/{weddingId}/checklist/{itemId}
 *   weddings/{weddingId}/budget/{categoryId}
 *   weddings/{weddingId}/vendors/{vendorId}
 *   weddingInvites/{code}                      ← lookup join (id + nama, non-sensitif)
 *   users/{userId}                             ← identitas akun + ref weddingId
 *   users/{userId}/devices/{tokenId}           ← token FCM (reminder deadline)
 *
 * Akun lama (sebelum kolaborasi) menyimpan field legacy di users/{userId}
 * (weddingDate/venue/totalBudget + subcollection lama). Saat pertama kali
 * login setelah update, data lama dimigrasi otomatis ke weddings/{id}
 * (lihat lib/wedding-service.ts). Subcollection lama dibiarkan (backup).
 */

/** users/{userId} — identitas akun + penunjuk data pernikahan bersama. */
export interface UserProfile {
  email: string;
  displayName: string;
  /** Nama pasangan (tampilan umum; field legacy sebelum kolaborasi). */
  partnerName: string;
  /** Epoch ms. */
  createdAt: number;
  /**
   * Fase 2 — id dokumen weddings/{weddingId} yang menampung data
   * pernikahan bersama (bisa dua akun). Absen = user belum selesai
   * onboarding / migrasi kolaborasi.
   */
  weddingId?: string;
  /** Field legacy: dipindah ke weddings/{id} saat migrasi. Opsional. */
  weddingDate?: string;
  venue?: string;
  totalBudget?: number;
}

/** weddings/{weddingId} — data pernikahan bersama (source of truth, Fase 2). */
export interface Wedding {
  /** id dokumen Firestore (user pembuat dipakai sebagai id deterministik). */
  id: string;
  /** ISO date "YYYY-MM-DD". */
  weddingDate: string;
  venue: string;
  /** Total budget pernikahan (FR-12). Absen/0 = belum ditetapkan. */
  totalBudget?: number;
  /** Epoch ms. */
  createdAt: number;
  /** uid akun pembuat/migrasi. */
  createdBy: string;
  /** Maksimal 2 uid (kolaborasi 2 akun pasangan). */
  members: string[];
  /** uid -> nama tampilan untuk label "A & B" di dashboard. */
  coupleNames: Record<string, string>;
  /** Kode undangan gabung (lihat weddingInvites/{code}). */
  inviteCode: string;
}

/** weddingInvites/{code} — jembatan join pasangan (non-sensitif). */
export interface WeddingInvite {
  weddingId: string;
  /** Epoch ms. */
  createdAt: number;
}

/** users/{userId}/devices/{tokenId} — registrasi token FCM (reminder). */
export interface DeviceToken {
  /** id dokumen = token FCM. */
  id: string;
  token: string;
  platform: "web";
  /** Epoch ms. */
  createdAt: number;
}

export type ChecklistCategory = (typeof CHECKLIST_CATEGORIES)[number];

/** weddings/{weddingId}/checklist/{itemId} */
export interface ChecklistItem {
  /** id dokumen Firestore */
  id: string;
  title: string;
  category: ChecklistCategory;
  /** ISO date "YYYY-MM-DD"; "" = tanpa due date (opsional, FR-09). */
  dueDate: string;
  isCompleted: boolean;
  createdAt: number;
}

/** Objek di dalam field array `expenses` pada dokumen budget. */
export interface Expense {
  description: string;
  amount: number;
  /** ISO date "YYYY-MM-DD" */
  date: string;
  /** URL struk di Firebase Storage; "" = tidak diunggah (opsional, FR-14). */
  receiptUrl: string;
}

/** weddings/{weddingId}/budget/{categoryId} */
export interface BudgetCategory {
  id: string;
  categoryName: string;
  allocatedAmount: number;
  expenses: Expense[];
}

export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];

/** FR-17: dihubungi -> nego -> deal -> dp -> lunas */
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

/** weddings/{weddingId}/vendors/{vendorId} */
export interface Vendor {
  id: string;
  name: string;
  category: VendorCategory | string;
  contact: string;
  status: VendorStatus;
  dealAmount: number;
  /** ISO date "YYYY-MM-DD"; "" = tanpa deadline pembayaran. */
  paymentDeadline: string;
  notes: string;
  createdAt: number;
}
