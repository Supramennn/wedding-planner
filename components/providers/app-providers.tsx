"use client";

import { type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { AuthProvider } from "@/lib/hooks/auth-context";
import { SwRegister } from "@/components/providers/sw-register";

/**
 * Provider global di root layout.
 * MotionConfig reducedMotion="user" WAJIB (NFR Accessibility): semua animasi
 * Framer Motion otomatis menghormati preferensi "reduce motion" sistem user.
 * SwRegister: pendaftaran service worker PWA (FR-21, production only).
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <SwRegister />
        {children}
      </AuthProvider>
    </MotionConfig>
  );
}
