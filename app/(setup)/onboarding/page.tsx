"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/auth-context";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

/**
 * Halaman onboarding (FR-02, FR-03).
 * Jika user sudah onboarded, langsung kembali ke dashboard.
 */
export default function OnboardingPage() {
  const { isOnboarded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isOnboarded) router.replace("/dashboard");
  }, [isOnboarded, router]);

  if (isOnboarded) return null;

  return <OnboardingWizard />;
}
