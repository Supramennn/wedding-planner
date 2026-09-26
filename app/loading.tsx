import { Spinner } from "@/components/ui/spinner";

/**
 * Tampil selagi segmen route dimuat, terutama saat pindah menu di jaringan
 * seluler yang jelek. Fallback-nya di-precache, jadi tidak menambah
 * permintaan jaringan baru.
 *
 * Sengaja bukan skeleton halaman: semua route di app ini dirender di klien
 * dan datanya datang dari Firestore, jadi tidak ada layout asli yang bisa
 * ditiru. Skeleton hanya menebak, lalu meleset saat data benar-benar datang.
 * Yang jujur adalah menyebut apa yang sedang menunggu.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[60svh] flex-col items-center justify-center gap-3 px-4"
    >
      <Spinner size="md" />
      <p className="text-sm text-neutral-500">Memuat halaman</p>
    </div>
  );
}
