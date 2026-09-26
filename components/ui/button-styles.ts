/**
 * Kelas visual tombol. Sengaja modul terpisah tanpa "use client" supaya
 * bisa dipakai juga dari Server Component (mis. halaman not-found), yang
 * tidak boleh memanggil fungsi yang ditandai client.
 *
 * Satu sumber kebenaran untuk <Button> dan untuk elemen lain yang perlu
 * terlihat seperti tombol (mis. <Link> di StatusScreen), supaya keduanya
 * tidak bisa melenceng.
 */

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger";

export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500",
  secondary:
    "bg-neutral-900 text-white hover:bg-neutral-800 focus-visible:ring-neutral-600",
  outline:
    "border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 focus-visible:ring-neutral-400",
  ghost:
    "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-neutral-300",
  danger:
    "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  // min-h-11 = 44px untuk semua ukuran. Versi lama memakai min-h-10 (40px)
  // untuk size sm padahal komentarnya menjanjikan target sentuh 44px.
  sm: "min-h-11 px-3 text-sm",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-5 text-base",
};

const BASE_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

export function buttonStyles({
  variant = "primary",
  size = "md",
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return `${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`;
}
