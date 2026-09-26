import type { Metadata } from "next";
import Image from "next/image";
import { StatusScreen } from "@/components/ui/status-screen";

export const metadata: Metadata = {
  title: "Offline",
};

/**
 * Halaman fallback offline (FR-21). Di-precache service worker, dan
 * ditampilkan ketika halaman belum pernah dikunjungi lalu koneksi mati.
 *
 * Ikon 72px dipertahankan karena layar ini muncul justru saat jaringan
 * jelek, jadi pengguna perlu tahu aplikasi mana yang sedang gagal
 * sebelum sempat membaca teksnya.
 *
 * Sisanya memakai StatusScreen yang sama dengan error dan 404, supaya
 * keempat layar kegagalan tidak melenceng satu sama lain.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-[100svh] flex-col items-center justify-center px-4 pb-[env(safe-area-inset-bottom)]">
      <Image
        src="/icons/icon-192.png"
        alt=""
        width={72}
        height={72}
        priority
      />
      <StatusScreen
        compact
        title="Kamu sedang offline"
        description="Halaman ini belum tersimpan di perangkatmu. Sambungkan internet lalu coba lagi. Data yang pernah dibuka sebelumnya tetap bisa dibuka."
        action={{
          label: "Coba lagi",
          // Muat ulang, bukan navigasi ke "/": selama koneksi masih putus,
          // rute itu akan memunculkan halaman offline yang sama kembali.
          reload: true,
        }}
      />
    </main>
  );
}
