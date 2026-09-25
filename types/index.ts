import type {
  CHECKLIST_CATEGORIES,
  ENGAGEMENT_CATEGORIES,
  GUEST_GROUPS,
  GUEST_STATUSES,
  VENDOR_CATEGORIES,
  VENDOR_STATUSES,
} from "@/lib/constants";

/**
 * Tipe data WedPlan — mengikuti skema Firestore di PRD Section 8.
 * users/{userId}
 * users/{userId}/checklist/{itemId}
 * users/{userId}/budget/{categoryId}
 * users/{userId}/vendors/{vendorId}
 * users/{userId}/guests/{guestId}       (daftar tamu — fitur tamu)
 * users/{userId}/prepItems/{itemId}     (item persiapan — modul budget)
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

  // —— Merge data (dua akun sudah punya data sendiri) ——

  /**
   * uid pasangan yang datanya pernah di-MERGE ke workspace ini.
   * Penanda idempoten: retry klaim/merge tidak menggandakan salinan.
   * Ditulis TERAKHIR setelah seluruh langkah penyalinan sukses.
   */
  mergedFromUid?: string | null;
  /** Epoch ms kapan merge dijalankan. */
  mergedAt?: number | null;
}

export type ChecklistCategory = (typeof CHECKLIST_CATEGORIES)[number];
export type EngagementCategory = (typeof ENGAGEMENT_CATEGORIES)[number];

/**
 * Kategori item checklist: kategori nikah ATAU kategori lamaran.
 * Pemisahan tahap ditentukan field `phase` (absen = persiapan nikah).
 */
export type ChecklistItemCategory = ChecklistCategory | EngagementCategory;

/** users/{userId}/checklist/{itemId} */
export interface ChecklistItem {
  /** id dokumen Firestore */
  id: string;
  title: string;
  category: ChecklistItemCategory;
  /** ISO date "YYYY-MM-DD"; "" = tanpa due date (opsional, FR-09). */
  dueDate: string;
  isCompleted: boolean;
  createdAt: number;
  /**
   * Tahap persiapan: absen/undefined = nikah (data lama & default),
   * "engagement" = persiapan lamaran (menu "Lamaran", terpisah dari nikah).
   */
  phase?: "engagement";
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

/**
 * users/{userId}/guests/{guestId} — daftar tamu undangan.
 * Dipakai untuk mengestimasi jumlah tamu per status & kelompok.
 */
export interface Guest {
  id: string;
  /** Nama tamu (wajib). */
  name: string;
  /** Kelompok undangan (GUEST_GROUPS). */
  group: (typeof GUEST_GROUPS)[number];
  /** Status undangan/kehadiran (GUEST_STATUSES). */
  status: (typeof GUEST_STATUSES)[number];
  /** Catatan opsional (nomor WA, hubungan, dll). */
  notes: string;
  /** Epoch ms. */
  createdAt: number;
}

/**
 * users/{userId}/prepItems/{itemId} — item yang perlu disiapkan
 * (daftar belanja/persiapan di modul Budget, dihitung vs alokasi).
 */
export interface PrepItem {
  id: string;
  /** Nama item yang perlu disiapkan (wajib). */
  name: string;
  /** Kategori budget terkait (untuk pengelompokan & pembanding alokasi). */
  categoryName: string;
  /** Estimasi biaya (Rp); 0 = belum diperkirakan. */
  plannedAmount: number;
  /** Sudah disiapkan/dibeli? */
  isDone: boolean;
  /** Epoch ms. */
  createdAt: number;
}
