import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Offline",
};

/**
 * Halaman fallback offline (FR-21) — di-precache service worker,
 * ditampilkan ketika halaman belum pernah dikunjungi dan koneksi mati.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-[100svh] flex-col items-center justify-center gap-4 px-4 text-center">
      <Image
        src="/icons/icon-192.png"
        alt=""
        width={72}
        height={72}
        priority
      />
      <h1 className="text-xl font-semibold text-neutral-900">
        Kamu sedang offline
      </h1>
      <p className="max-w-sm text-sm text-neutral-500">
        Halaman ini belum tersimpan di perangkatmu. Sambungkan internet lalu
        coba lagi — data yang pernah dibuka sebelumnya tetap bisa dibuka.
      </p>
      <Link
        href="/"
        className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-700"
      >
        Coba lagi
      </Link>
    </main>
  );
}
