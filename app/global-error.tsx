"use client";

import { useEffect } from "react";
// Wajib: global-error merender dokumen sendiri, sehingga stylesheet root
// layout tidak ikut. Tanpa import ini halamannya tanpa styling sama sekali.
import "./globals.css";
import { StatusScreen } from "@/components/ui/status-screen";

/**
 * Penangkap error terakhir: root layout sendiri yang gagal, sehingga tidak
 * ada layout, provider, maupun auth context yang bisa diandalkan.
 *
 * Aksi utamanya location.reload(), bukan retry(). Retry hanya merender ulang
 * boundary yang sama, jadi layout yang baru saja crash akan crash lagi.
 * Reload mengambil dokumen segar, sehingga satu-satunya jalan keluar yang
 * benar-benar berbeda dari kondisi sebelumnya.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="id" className="h-full">
      <body className="flex min-h-full flex-col">
        <main className="flex flex-1 flex-col">
          <StatusScreen
            title="WedPlan gagal dibuka"
            description="Terjadi kesalahan mendasar sebelum aplikasi selesai dimuat. Muat ulang halaman untuk mencoba lagi."
            action={{
              label: "Muat ulang",
              onClick: () => window.location.reload(),
            }}
            code={error.digest}
          />
        </main>
      </body>
    </html>
  );
}
