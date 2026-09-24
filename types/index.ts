import type {
  CHECKLIST_CATEGORIES,
  VENDOR_CATEGORIES,
  VENDOR_STATUSES,
} from "@/lib/constants";

/**
 * Tipe data WedPlan — mengikuti skema Firestore di PRD Section 8.
 * users/{userId}
 * users/{userId}/checklist/{itemId}
 * users/{userId}/budget/{categoryId}
 * users/{userId}/vendors/{vendorId}
 */

/** users/{userId} — dokumen profil pernikahan (single source of truth). */
export interface UserProfile {
  email: string;
  displayName: string;
  partnerName: string;
  /** ISO date "YYYY-MM-DD". Kosong = onboarding belum selesai. */
  weddingDate: string;
  venue: string;
  /**
   * Total budget pernikahan (FR-12). Field tambahan di atas skema dasar
   * PRD Section 8 — sesuai NFR "siap ditambah field baru tanpa migrasi".
   * Absen/0 = belum ditetapkan.
   */
  totalBudget?: number;
  /** Epoch ms. */
  createdAt: number;

  // —— Kolaborasi pasangan (Phase 2: 2 akun, 1 data pernikahan) ——

  /** Email pasangan yang diundang (diisi pemilik workspace saat membuat undangan). */
  partnerEmail?: string;
  /** uid akun pasangan yang sudah bergabung (diisi saat klaim undangan). */
  partnerUid?: string;
  /** Status tautan: "invited" = undangan dikirim, "linked" = sudah menyatu. */
  coupleStatus?: "invited" | "linked";
  /**
   * Hanya ada di dokumen milik pasangan: uid pemilik workspace yang
   * ditautkan. Semua data pernikahan dibaca dari users/{linkedTo}.
   */
  linkedTo?: string;
  /**
   * Token FCM milik AKUN INI (push reminder, Phase 2). Setiap akun
   * menyimpan token di dokumennya sendiri; cron mengumpulkan token dari
   * workspace + pasangan tertaut, sehingga lepas tautan langsung memutus
   * pengiriman ke mantan pasangan. Ditulis via arrayUnion/arrayRemove.
   */
  fcmTokens?: string[];
}

export type ChecklistCategory = (typeof CHECKLIST_CATEGORIES)[number];

/** users/{userId}/checklist/{itemId} */
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

/** users/{userId}/budget/{categoryId} */
export interface BudgetCategory {
  id: string;
  categoryName: string;
  allocatedAmount: number;
  expenses: Expense[];
}

export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];

/** FR-17: dihubungi -> nego -> deal -> dp -> lunas */
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

/** users/{userId}/vendors/{vendorId} */
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
