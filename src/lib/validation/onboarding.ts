/**
 * Validasi wizard setup usaha (onboarding owner baru).
 * Pure & tanpa DB: aman diuji vitest.
 *
 * Owner baru mengisi 3 hal: Nama Usaha, Kota/Area layanan, Nomor WhatsApp usaha.
 * Nomor dinormalisasi ke format WA (digits, prefix 62) agar konsisten dengan
 * data usaha lain (lihat src/lib/validation/booking.ts).
 */
import { z } from "zod";
import { DEFAULT_TENANT_TZ } from "@/lib/domain/tenant-timezone";

// Batas panjang field
export const MIN_BUSINESS_NAME_LEN = 2;
export const MAX_BUSINESS_NAME_LEN = 60;
export const MIN_CITY_LEN = 2;
export const MAX_CITY_LEN = 60;
export const MAX_PHONE_LEN = 20; // sebelum normalisasi
export const MIN_PHONE_DIGITS = 8;

/**
 * Zona waktu tenant (keputusan K7, 2026-10-17) — ditetapkan saat onboarding;
 * UI menyediakan pilihan, default-nya WIB. Nilai bawaan diambil dari
 * src/lib/domain/tenant-timezone.ts (SATU sumber kebenaran).
 */
export { DEFAULT_TENANT_TZ };
export const TENANT_TIMEZONE_OPTIONS = [
  { value: "Asia/Jakarta", label: "WIB — Jakarta (bawaan)" },
  { value: "Asia/Makassar", label: "WITA — Makassar" },
  { value: "Asia/Jayapura", label: "WIT — Jayapura" },
] as const;
const TENANT_TZ_VALUES = TENANT_TIMEZONE_OPTIONS.map((o) => o.value);

/** Normalisasi nomor ke format WA (digits only, prefix 62). Lokal, tak bergantung file lain. */
export function normalizeWhatsappPhone(raw: string): string {
  let p = (raw ?? "").replace(/[^0-9]/g, "");
  if (p.startsWith("0")) p = "62" + p.slice(1);
  if (p.startsWith("620")) p = "62" + p.slice(3);
  return p;
}

export const onboardingSchema = z.object({
  businessName: z
    .string()
    .max(MAX_BUSINESS_NAME_LEN, `Nama usaha maksimal ${MAX_BUSINESS_NAME_LEN} karakter`)
    .transform((v) => v.trim())
    .refine((v) => v.length >= MIN_BUSINESS_NAME_LEN, {
      message: `Nama usaha minimal ${MIN_BUSINESS_NAME_LEN} karakter`,
    }),

  city: z
    .string()
    .max(MAX_CITY_LEN, `Kota/area maksimal ${MAX_CITY_LEN} karakter`)
    .transform((v) => v.trim())
    .refine((v) => v.length >= MIN_CITY_LEN, {
      message: `Kota/area minimal ${MIN_CITY_LEN} karakter`,
    }),

  whatsappPhone: z
    .string()
    .max(MAX_PHONE_LEN, `Nomor maksimal ${MAX_PHONE_LEN} karakter`)
    .transform((v) => normalizeWhatsappPhone(v))
    .refine((v) => v.length >= MIN_PHONE_DIGITS, {
      message: "Nomor WhatsApp tidak valid",
    }),

  /**
   * Zona waktu tenant (K7). Opsional supaya form lama tanpa field ini tetap lolos —
   * bila kosong, pelaksana memakai DEFAULT_TENANT_TZ (WIB). Nilai yang diterima
   * hanya daftar di TENANT_TIMEZONE_OPTIONS (dicek manual agar pesannya ramah).
   */
  timezone: z
    .string()
    .optional()
    .refine((v) => v === undefined || v === "" || (TENANT_TZ_VALUES as readonly string[]).includes(v), {
      message: "Zona waktu tidak dikenal",
    }),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
