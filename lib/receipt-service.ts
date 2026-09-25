import {
  addDoc,
  Bytes,
  collection,
  deleteDoc,
  doc,
  getDoc,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { receiptsPath } from "@/lib/collection-paths";

/**
 * Service foto struk — pengganti Firebase Storage.
 *
 * Kebijakan Google sejak Sep 2024: Cloud Storage butuh paket Blaze, sehingga
 * di paket Spark struk disimpan di Firestore: gambar DIKOMPRES dulu di sisi
 * klien (JPEG, sisi terpanjang 1600px) lalu ditulis sebagai field `bytes` di
 * subcollection `users/{uid}/receipts`.
 *
 * Keunggulan vs Storage: $0 di paket Spark, privat via rules
 * `hasWorkspaceAccess` (tidak ada URL publik), dan merge pasangan cukup
 * menyalin dokumen. Dokumen dijaga < 1 MiB (limit Firestore per dokumen).
 */

/** Batas aman bytes terkompres — jauh di bawah limit 1 MiB per dokumen. */
const TARGET_MAX_BYTES = 900_000;

/** Strategi kompresi: turunkan kualitas dulu, baru kecilkan dimensi. */
const COMPRESSION_STEPS: ReadonlyArray<{ maxSide: number; qualities: number[] }> = [
  { maxSide: 1600, qualities: [0.8, 0.65, 0.5] },
  { maxSide: 1100, qualities: [0.65, 0.5, 0.4] },
  { maxSide: 800, qualities: [0.5, 0.4] },
];

/**
 * Error pemrosesan gambar — pesannya layak ditampilkan langsung ke user
 * (bukan error generik "periksa koneksi").
 */
export class ReceiptProcessingError extends Error {}

export interface ProcessedReceipt {
  bytes: Uint8Array;
  contentType: string;
  /** Byte hasil kompresi (untuk ditampilkan/diagnostik). */
  size: number;
}

/** Decode gambar — utamakan createImageBitmap (hormati orientasi EXIF). */
async function decodeImage(
  file: File
): Promise<{ source: CanvasImageSource; width: number; height: number }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height };
  } catch {
    // Fallback untuk browser tanpa createImageBitmap / format aneh.
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("decode-failed"));
      element.src = objectUrl;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
  } catch {
    throw new ReceiptProcessingError(
      "Foto tidak bisa diproses — pastikan file gambar (JPG/PNG) tidak rusak, lalu coba lagi."
    );
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Kompres gambar struk ke JPEG yang muat jauh di bawah limit 1 MiB.
 * Lewat ketiga strategi bila masih kebesaran → ReceiptProcessingError.
 */
export async function compressReceipt(file: File): Promise<ProcessedReceipt> {
  const { source, width, height } = await decodeImage(file);
  if (!width || !height) {
    throw new ReceiptProcessingError("Foto tidak memiliki dimensi yang valid.");
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new ReceiptProcessingError(
      "Browser tidak mendukung pemrosesan gambar."
    );
  }

  for (const step of COMPRESSION_STEPS) {
    const scale = Math.min(1, step.maxSide / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    context.drawImage(source, 0, 0, canvas.width, canvas.height);

    for (const quality of step.qualities) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality)
      );
      if (!blob) {
        throw new ReceiptProcessingError(
          "Foto gagal dikompres — coba gambar lain."
        );
      }
      if (blob.size <= TARGET_MAX_BYTES) {
        return {
          bytes: new Uint8Array(await blob.arrayBuffer()),
          contentType: "image/jpeg",
          size: blob.size,
        };
      }
    }
  }

  throw new ReceiptProcessingError(
    "Foto terlalu berat untuk disimpan — coba foto ulang atau pilih gambar lain."
  );
}

/** Simpan struk terkompres → id dokumen (dipakai field `expense.receiptId`). */
export async function saveReceipt(
  uid: string,
  receipt: ProcessedReceipt
): Promise<string> {
  const saved = await addDoc(collection(getDb(), receiptsPath(uid)), {
    image: imageFieldValue(receipt.bytes),
    contentType: receipt.contentType,
    size: receipt.size,
    createdAt: Date.now(),
  });
  return saved.id;
}

/**
 * Bungkus bytes sebagai nilai field Firestore — SDK web hanya menerima
 * `Bytes` (Uint8Array mentah ditolak: "custom Uint8Array object").
 */
export function imageFieldValue(bytes: Uint8Array): Bytes {
  return Bytes.fromUint8Array(bytes);
}

/**
 * Nilai baca field `image` → Uint8Array. Toleran terhadap `Bytes`
 * (hasil baca sebagian versi SDK) maupun `Uint8Array` langsung.
 */
export function asImageBytes(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value;
  if (value instanceof Bytes) return value.toUint8Array();
  if (
    value &&
    typeof (value as { toUint8Array?: unknown }).toUint8Array === "function"
  ) {
    return (value as Bytes).toUint8Array();
  }
  return null;
}

/**
 * Muat struk → objectURL. Pemanggil WAJIB `URL.revokeObjectURL()`
 * saat selesai (biasanya saat modal/viewer ditutup).
 */
export async function loadReceiptObjectUrl(
  uid: string,
  receiptId: string
): Promise<string> {
  const snapshot = await getDoc(doc(getDb(), receiptsPath(uid), receiptId));
  const data = snapshot.data();
  const bytes = asImageBytes(data?.image);
  if (!data || !bytes || bytes.length === 0) {
    throw new Error("Struk tidak ditemukan.");
  }
  // Salin ke ArrayBuffer murni (type-safe utk Blob; jaga dari SharedArrayBuffer).
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return URL.createObjectURL(
    new Blob([buffer], { type: String(data.contentType || "image/jpeg") })
  );
}

/** Hapus struk (best-effort dari alur edit/hapus pengeluaran). */
export async function deleteReceipt(
  uid: string,
  receiptId: string
): Promise<void> {
  await deleteDoc(doc(getDb(), receiptsPath(uid), receiptId));
}
