import type { Metadata } from "next";
import { ProfileForm } from "@/components/settings/profile-form";
import { CoupleCard } from "@/components/settings/couple-card";
import { NotificationCard } from "@/components/settings/notification-card";
import { AccountInfo } from "@/components/settings/account-info";

export const metadata: Metadata = {
  title: "Pengaturan",
};

/** Halaman profil/pengaturan — edit data onboarding (FR-03) + kolaborasi & push (Phase 2). */
export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <ProfileForm />
      <CoupleCard />
      <NotificationCard />
      <AccountInfo />
    </div>
  );
}
