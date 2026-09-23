import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  writeBatch,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { checklistPath } from "@/lib/collection-paths";
import type { ChecklistCategory } from "@/types";

/**
 * Checklist default (FR-02 & FR-08) — di-generate otomatis setelah
 * onboarding selesai, mencakup 9 kategori default.
 * Due date dihitung mundur dari tanggal pernikahan.
 */

interface ChecklistTemplate {
  title: string;
  category: ChecklistCategory;
  /** Berapa hari sebelum hari-H. */
  daysBeforeWedding: number;
}

export const DEFAULT_CHECKLIST_TEMPLATES: ChecklistTemplate[] = [
  // Legal/Dokumen
  { title: "Siapkan dokumen pernikahan (KTP, KK, akta lahir)", category: "Legal/Dokumen", daysBeforeWedding: 90 },
  { title: "Daftarkan pernikahan di KUA", category: "Legal/Dokumen", daysBeforeWedding: 60 },
  // Venue
  { title: "Survey dan kunci venue acara", category: "Venue", daysBeforeWedding: 300 },
  { title: "Konfirmasi layout dan kapasitas tamu dengan venue", category: "Venue", daysBeforeWedding: 45 },
  // Catering
  { title: "Pilih katering dan cicipi menu (food tasting)", category: "Catering", daysBeforeWedding: 120 },
  { title: "Finalisasi jumlah porsi tamu", category: "Catering", daysBeforeWedding: 30 },
  // Dekorasi
  { title: "Tentukan konsep dekorasi dan bunga", category: "Dekorasi", daysBeforeWedding: 90 },
  { title: "Finalisasi dekorasi dengan vendor", category: "Dekorasi", daysBeforeWedding: 30 },
  // Busana
  { title: "Pesan gaun dan jas pengantin", category: "Busana", daysBeforeWedding: 120 },
  { title: "Sesi fitting busana pengantin", category: "Busana", daysBeforeWedding: 30 },
  // Dokumentasi
  { title: "Pilih fotografer dan videografer", category: "Dokumentasi", daysBeforeWedding: 150 },
  { title: "Briefing konsep sesi pre-wedding", category: "Dokumentasi", daysBeforeWedding: 60 },
  // Undangan
  { title: "Desain undangan pernikahan", category: "Undangan", daysBeforeWedding: 90 },
  { title: "Cetak dan sebar undangan ke tamu", category: "Undangan", daysBeforeWedding: 30 },
  // Hiburan
  { title: "Pilih entertainmen (band, MC, atau DJ)", category: "Hiburan", daysBeforeWedding: 90 },
  { title: "Susun rundown acara hari-H", category: "Hiburan", daysBeforeWedding: 30 },
  // Lain-lain
  { title: "Susun daftar tamu undangan", category: "Lain-lain", daysBeforeWedding: 120 },
  { title: "Booking souvenir pernikahan", category: "Lain-lain", daysBeforeWedding: 60 },
  { title: "Persiapkan seserahan dan mahar", category: "Lain-lain", daysBeforeWedding: 14 },
];

function dueDateBefore(weddingDate: string, days: number): string {
  const wedding = new Date(`${weddingDate}T00:00:00`);
  if (Number.isNaN(wedding.getTime())) return "";
  wedding.setDate(wedding.getDate() - days);
  const year = wedding.getFullYear();
  const month = String(wedding.getMonth() + 1).padStart(2, "0");
  const day = String(wedding.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Generate checklist default. Aman dipanggil berulang: bila koleksi sudah
 * berisi item, tidak ada apa-apa yang dilakukan (tidak ada duplikasi).
 * Skema Fase 2: weddings/{weddingId}/checklist.
 *
 * @returns jumlah item yang dibuat (0 bila sudah pernah generate).
 */
export async function generateDefaultChecklist(
  weddingId: string,
  weddingDate: string
): Promise<number> {
  const db = getDb();
  const checklistCollection = collection(db, checklistPath(weddingId));

  const existing = await getDocs(query(checklistCollection, limit(1)));
  if (!existing.empty) return 0;

  const batch = writeBatch(db);
  const createdAt = Date.now();

  for (const template of DEFAULT_CHECKLIST_TEMPLATES) {
    const itemRef = doc(checklistCollection);
    batch.set(itemRef, {
      title: template.title,
      category: template.category,
      dueDate: weddingDate
        ? dueDateBefore(weddingDate, template.daysBeforeWedding)
        : "",
      isCompleted: false,
      createdAt,
    });
  }

  await batch.commit();
  return DEFAULT_CHECKLIST_TEMPLATES.length;
}
