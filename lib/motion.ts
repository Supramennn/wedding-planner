import type { Target, Transition, Variants } from "framer-motion";

/**
 * Gerak WedPlan.
 *
 * Aturan main (R-19): animasi di sini harus menjawab pertanyaan "apa yang
 * baru terjadi?", bukan sekadar mengisi layar. Karena itu hanya ada tiga
 * bentuk gerak, masing-masing dengan satu pekerjaan:
 *
 *   listItem : item yang masuk/keluar dari data realtime. Membikin terlihat
 *              bahwa pasanganmu baru saja mengubah sesuatu.
 *   valueRise: angka yang berubah. Menarik mata ke angka itu supaya user
 *              tidak perlu mencari tahu apa yang baru saja berganti.
 *
 * Durasi sengaja pendek (150-190ms). Animasi yang lebih lambat terasa
 * seperti lag di jaringan seluler, dan aplikasi ini dipakai sambil berdiri
 * di lokasi acara dengan sinyal buruk.
 *
 * reducedMotion: `MotionConfig reducedMotion="user"` di app-providers sudah
 * mematikan semua gerak transform (y/scale) untuk user yang minta reduced
 * motion, dan menyisakan fade opacity saja. Jadi tidak perlu cek manual di
 * setiap komponen.
 */

const EASE = [0.25, 0.1, 0.25, 1] as const;

/** Transisi bersama supaya durasi tidak melenceng antar tempat. */
export const quickTransition: Transition = { duration: 0.16, ease: EASE };
export const valueTransition: Transition = { duration: 0.19, ease: EASE };

/**
 * Item daftar realtime: masuk dan keluar.
 * Dipakai lewat label variant (`initial="initial" animate="animate"`), jadi
 * `initial={false}` di AnimatePresence bisa mematikan animasi untuk item
 * yang sudah ada saat halaman pertama dibuka.
 */
export const listItemVariants: Variants = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0, transition: quickTransition },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

/** Target untuk angka yang nilainya berubah. */
export const valueRiseInitial: Target = { opacity: 0, y: -6 };
export const valueRiseAnimate: Target = { opacity: 1, y: 0 };
