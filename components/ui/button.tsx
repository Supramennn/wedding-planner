"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Spinner } from "@/components/ui/spinner";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<Variant, string> = {
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

const SIZE_CLASSES: Record<Size, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-5 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

/** Tombol reusable — mobile-first (target sentuh >= 44px). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      className = "",
      children,
      type = "button",
      ...props
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
        {...props}
      >
        {loading && <Spinner size="sm" />}
        {children}
      </button>
    );
  }
);
