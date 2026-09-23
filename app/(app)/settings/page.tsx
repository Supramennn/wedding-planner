import type { Metadata } from "next";
import { ProfileForm } from "@/components/settings/profile-form";
import { AccountInfo } from "@/components/settings/account-info";

export const metadata: Metadata = {
  title: "Pengaturan",
};

/** Halaman profil/pengaturan — edit data onboarding (FR-03). */
export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <ProfileForm />
      <AccountInfo />
    </div>
  );
}
