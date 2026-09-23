"use client";

import { type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { AuthProvider } from "@/lib/hooks/auth-context";

/**
 * Provider global di root layout.
 * MotionConfig reducedMotion="user" WAJIB (NFR Accessibility): semua animasi
 * Framer Motion otomatis menghormati preferensi "reduce motion" sistem user.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <AuthProvider>{children}</AuthProvider>
    </MotionConfig>
  );
}
