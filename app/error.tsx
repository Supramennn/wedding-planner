"use client";

import { useEffect } from "react";
import { StatusScreen } from "@/components/ui/status-screen";
import { useAuth } from "@/lib/hooks/auth-context";

/**
 * Error boundary untuk semua route di bawah root layout.
 *
 * Ditaruh di app/ (bukan app/(app)/) dengan sengaja: error.js tidak
 * membungkus layout.js di segment yang sama, jadi bila hanya ada di
 * (app)/, crash dari AuthGuard atau AppShell tidak punya boundary
 * sampai global-error.
 *
 * `retry` (bukan `reset`): retry fetching lalu render ulang children,
 * sesuai docs Next 16.3. Dipakai juga untuk aksi utama, karena inilah
 * penyebab paling mungkin: koneksi sempat putus.
 */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const { signOutUser } = useAuth();

  useEffect(() => {
    console.error(error);
  }, [error]);

  // Sesi Firebase kadang ikut rusak, dan retry tidak akan menolongnya.
  // Reload di finally supaya user tetap mendarat di login bersih walau
  // signOut-nya sendiri gagal, tanpa meninggalkan promise yang unhandled.
  async function handleSignOut() {
    try {
      await signOutUser();
    } finally {
      window.location.reload();
    }
  }

  return (
    <StatusScreen
      title="Halaman ini gagal dibuka"
      description="Ada yang tidak beres saat halaman ini ditampilkan. Coba muat ulang, data yang sudah kamu simpan tidak ikut hilang."
      action={{ label: "Coba lagi", onClick: retry }}
      footnote={
        <>
          Terus bermasalah?{" "}
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="rounded font-medium text-rose-600 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            Keluar dari akun
          </button>
        </>
      }
      code={error.digest}
    />
  );
}
