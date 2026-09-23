/** Validasi form autentikasi (FR-01) — satu tempat untuk login & register. */

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MIN_PASSWORD_LENGTH = 8;

/** null = valid. */
export function validateEmail(value: string): string | null {
  const email = value.trim();
  if (!email) return "Email wajib diisi.";
  if (!EMAIL_REGEX.test(email)) return "Format email tidak valid.";
  return null;
}

/** null = valid. */
export function validatePassword(value: string): string | null {
  if (!value) return "Password wajib diisi.";
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Password minimal ${MIN_PASSWORD_LENGTH} karakter.`;
  }
  return null;
}
