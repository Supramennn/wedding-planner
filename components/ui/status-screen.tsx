"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buttonStyles } from "@/components/ui/button-styles";

/**
 * Layar status untuk kondisi di mana konten utama tidak bisa ditampilkan:
 * error, 404, offline.
 *
 * Keputusan desain (lihat Delivery Gate R-31):
 * - Tanpa ilustrasi, ikon, atau emoji. Tidak ada gambar yang jujur untuk
 *   "aplikasi weddings gagal", dan ilustrasi generik apa pun akan selalu
 *   terasa tempelan. Yang bicara adalah kalimatnya (R-22, R-04).
 * - Judul adalah satu-satunya titik fokus; sisanya mengalah (Part 3).
 * - Aksen rose-600 dipakai sekali saja, di aksi pemulih. Layar error yang
 *   seluruhnya merah hanya berteriak; aksennya milik perbaikannya (R-13).
 * - Tanpa gerak, termasuk spinner. Ini layar yang harus tenang, dan
 *   MotionConfig di root sudah menjatuhkan animasi Framer di sini.
 * - Tanpa landmark. Sengaja <div>: error.tsx dirender DI DALAM <main> milik
 *   app-shell, dan <main> di dalam <main> itu HTML yang invalid.
 */

/**
 * Aksi utama. `reload` ada sebagai jenis tersendiri, bukan onClick, karena
 * "muat ulang" tidak butuh closure: dipakai bersama oleh layar offline dan
 * global-error, dan membingkainya sebagai reload membuat pemanggil bisa
 * tetap Server Component, sebab function tidak boleh menyeberang batas ke
 * Client Component.
 */
export type StatusAction =
  | { label: string; href: string }
  | { label: string; reload: true }
  | { label: string; onClick: () => void };

export function StatusScreen({
  title,
  description,
  action,
  footnote,
  code,
  compact = false,
  className = "",
}: {
  title: string;
  description?: string;
  /** Aksi utama: satu jalan keluar yang jelas, bukan pilihan menumpuk. */
  action?: StatusAction;
  /** Baris kecil di bawah aksi, untuk jalan keluar kedua. */
  footnote?: ReactNode;
  /** Kode hash dari Next (error.digest), ditampilkan apa adanya. */
  code?: string;
  /** true saat pemanggil sudah menaruh blok lain di atas (mis. ikon). */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-4 text-center ${
        compact ? "min-h-0 py-6" : "min-h-[60svh] py-10"
      } ${className}`}
    >
      <div className="w-full max-w-sm">
        <h1 className="text-lg font-semibold text-neutral-900">{title}</h1>

        {description && (
          <p className="mt-2 text-sm text-neutral-500">{description}</p>
        )}

        {action && (
          <div className="mt-6">
            {"href" in action ? (
              <Link
                href={action.href}
                className={buttonStyles({ className: "w-full sm:w-auto" })}
              >
                {action.label}
              </Link>
            ) : (
              <Button
                onClick={
                  "reload" in action
                    ? () => window.location.reload()
                    : action.onClick
                }
                className="w-full sm:w-auto"
              >
                {action.label}
              </Button>
            )}
          </div>
        )}

        {footnote && (
          <div className="mt-4 text-sm text-neutral-500">{footnote}</div>
        )}

        {code && (
          <details className="mt-6 text-left">
            <summary className="inline-block cursor-pointer rounded text-xs text-neutral-500 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
              Kode kesalahan
            </summary>
            <p className="mt-2 break-all font-mono text-xs text-neutral-500">
              {code}
            </p>
          </details>
        )}
      </div>
    </div>
  );
}
