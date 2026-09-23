"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/icons/google-icon";

const subscribeNoop = () => () => {};

function detectIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/** Tombol Google Sign-In (FR-01/US-01). */
export function GoogleButton({
  onClick,
  loading = false,
  label = "Lanjutkan dengan Google",
}: {
  onClick: () => void;
  loading?: boolean;
  label?: string;
}) {
  // useSyncExternalStore: server snapshot false (hindari hydration mismatch),
  // client snapshot hasil deteksi userAgent — tanpa setState di dalam effect.
  const isIOS = useSyncExternalStore(subscribeNoop, detectIOS, () => false);

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="lg"
        className="w-full"
        onClick={onClick}
        loading={loading}
      >
        <GoogleIcon />
        {label}
      </Button>
      {isIOS && (
        <p className="text-center text-xs text-neutral-500">
          Di iOS, pastikan pop-up diizinkan untuk membuka jendela Google.
        </p>
      )}
    </div>
  );
}
