"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  valueRiseAnimate,
  valueRiseInitial,
  valueTransition,
} from "@/lib/motion";

/**
 * Angka yang ikut bergerak ketika nilainya berubah.
 *
 * Gunanya bukan cantik: di dasbor ada beberapa angka besar (sisa hari, total
 * terpakai, tugas tersisa) dan user perlu tahu mana yang baru saja berganti
 * tanpa harus membandingkan secara manual. Maka saat nilainya berubah,
 * angka itu bergerak singkat supaya mata tertuju ke tempat yang baru berubah.
 *
 * Render pertama sengaja tidak dianimasikan: gerak saat halaman pertama
 * dibuka bukan informasi, cuma hiasan.
 *
 * State dihitung ulang saat render (pola "adjust state when props change"
 * dari React), bukan lewat useEffect, supaya tidak ada render berantai dan
 * ref tidak perlu dibaca saat render.
 */
export function AnimatedValue({
  value,
  format,
  className,
}: {
  value: string | number;
  format?: (value: string | number) => string;
  className?: string;
}) {
  const [previous, setPrevious] = useState(value);
  const [hasChanged, setHasChanged] = useState(false);

  if (previous !== value) {
    setPrevious(value);
    setHasChanged(true);
  }

  return (
    <motion.span
      key={String(value)}
      initial={hasChanged ? valueRiseInitial : false}
      animate={valueRiseAnimate}
      transition={valueTransition}
      className={className}
    >
      {format ? format(value) : String(value)}
    </motion.span>
  );
}
