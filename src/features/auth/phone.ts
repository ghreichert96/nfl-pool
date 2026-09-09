import { z } from "zod";

export function normalizePhone(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (trimmed.startsWith("+") && digits.length >= 8 && digits.length <= 15)
    return `+${digits}`;
  return "";
}

export const phoneSchema = z
  .string()
  .transform(normalizePhone)
  .pipe(z.string().regex(/^\+[1-9][0-9]{7,14}$/));

export function sanitizePhoneInput(value: string) {
  const trimmed = value.trimStart();
  const digits = trimmed.replace(/\D/g, "").slice(0, 15);
  if (!digits) return "";
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.length <= 10) return `+1${digits}`;
  return `+${digits}`;
}
