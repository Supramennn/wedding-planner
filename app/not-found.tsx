import type { Metadata } from "next";
import { StatusScreen } from "@/components/ui/status-screen";

export const metadata: Metadata = {
  title: "Halaman tidak ditemukan",
};

/**
 * 404 untuk URL yang tidak cocok dengan route mana pun, dan untuk
 * notFound() yang dipanggil segment mana pun.
 *
 * Di root layout, jadi tidak ada app-shell dan tidak ada navigasi di
 * halaman ini. Karena itu tombol ke dasbor bukan sugar, itu satu-satunya
 * jalan keluar, dan /dashboard memang ada (AuthGuard yang mengarahkan ke
 * login bila pengunjung belum masuk).
 */
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col">
      <StatusScreen
        title="Halaman tidak ditemukan"
        description="Alamat yang kamu buka tidak ada di WedPlan. Mungkin ada salah ketik di tautannya."
        action={{ label: "Kembali ke dasbor", href: "/dashboard" }}
      />
    </main>
  );
}
