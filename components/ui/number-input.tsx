"use client";

import { useId } from "react";

/**
 * Input angka standar (nominal Rp / persentase).
 * Nilai disimpan sebagai digit mentah; format tampilan ditampilkan
 * sebagai hint sehingga posisi kursor tidak melompat saat mengetik.
 */
export function NumberInput({
  label,
  value,
  onValueChange,
  prefix,
  suffix,
  error,
  hint,
  placeholder,
  disabled,
}: {
  label: string;
  /** String digit, contoh: "150000000" */
  value: string;
  onValueChange: (digits: string) => void;
  prefix?: string;
  suffix?: string;
  error?: string;
  hint?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className="w-full">
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium text-neutral-700"
      >
        {label}
      </label>

      <div
        className={`flex min-h-11 items-center rounded-xl border bg-white px-3 focus-within:ring-2 focus-within:ring-rose-500 ${
          error ? "border-red-400" : "border-neutral-300"
        } ${disabled ? "opacity-60" : ""}`}
      >
        {prefix && (
          <span className="mr-2 text-sm text-neutral-400" aria-hidden="true">
            {prefix}
          </span>
        )}
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          value={value}
          placeholder={placeholder}
          onChange={(event) =>
            onValueChange(event.target.value.replace(/\D/g, ""))
          }
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [error ? errorId : null, hint ? hintId : null]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className="w-full bg-transparent text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
        />
        {suffix && (
          <span className="ml-2 text-sm text-neutral-400" aria-hidden="true">
            {suffix}
          </span>
        )}
      </div>

      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-neutral-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
