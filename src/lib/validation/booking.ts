/**
 * Validasi booking publik — dipakai halaman /p/[slug] & server action.
 * Pure & tanpa DB: aman diuji vitest.
 *
 * Booking publik = alat "Get Customers". Input dari orang luar → jadi Lead.
 * Karena input tak tepercaya, kita batasi panjang field (anti-spam) dan
 * normalisasi nomor telepon ke format WA (digits, prefix 62).
 */
import { z } from "zod";

/** ServiceType sesuai enum Prisma (schema.prisma). */
export const SERVICE_TYPES = [
  "CLEANING",
  "REFILL_FREON",
  "REPAIR",
  "INSTALL",
  "DISMANTLE",
  "INSPECTION",
  "OTHER",
] as const;

export type BookingServiceType = (typeof SERVICE_TYPES)[number];

// Batas panjang (anti-spam)
export const MAX_NAME_LEN = 80;
export const MAX_NOTE_LEN = 500;
export const MAX_PHONE_LEN = 20; // sebelum normalisasi
export const MIN_PHONE_DIGITS = 8;

/** Normalisasi nomor ke format WA (digits only, prefix 62). Lokal, tak bergantung file lain. */
export function normalizeBookingPhone(raw: string): string {
  let p = (raw ?? "").replace(/[^0-9]/g, "");
  if (p.startsWith("0")) p = "62" + p.slice(1);
  if (p.startsWith("620")) p = "62" + p.slice(3);
  return p;
}

/** Opsional string: "" / whitespace → undefined, lainnya di-trim. */
const optionalTrimmed = (max: number) =>
  z
    .string()
    .max(max, `Maksimal ${max} karakter`)
    .optional()
    .transform((v) => {
      const t = (v ?? "").trim();
      return t.length ? t : undefined;
    });

export const publicBookingSchema = z.object({
  name: z
    .string()
    .max(MAX_NAME_LEN, `Nama maksimal ${MAX_NAME_LEN} karakter`)
    .transform((v) => v.trim())
    .refine((v) => v.length >= 1, { message: "Nama wajib diisi" }),

  phone: z
    .string()
    .max(MAX_PHONE_LEN, `Nomor maksimal ${MAX_PHONE_LEN} karakter`)
    .transform((v) => normalizeBookingPhone(v))
    .refine((v) => v.length >= MIN_PHONE_DIGITS, {
      message: "Nomor WhatsApp tidak valid",
    }),

  serviceType: z.enum(SERVICE_TYPES).optional(),

  note: optionalTrimmed(MAX_NOTE_LEN),

  preferredDate: optionalTrimmed(40),
});

export type PublicBookingInput = z.infer<typeof publicBookingSchema>;

/**
 * Nama field honeypot tersembunyi. Manusia tak pernah mengisinya;
 * bot yang mengisi semua input akan tertangkap.
 */
export const HONEYPOT_FIELD = "company_website" as const;

const URL_RE = /(https?:\/\/|www\.)/gi;
const MAX_URLS = 1;

/**
 * Heuristik anti-spam murni (tanpa DB). true = tolak.
 * - honeypot terisi → bot
 * - URL berlebih di gabungan teks (name+note) → spam
 */
export function looksLikeSpam(input: Record<string, unknown>): boolean {
  const hp = input[HONEYPOT_FIELD];
  if (typeof hp === "string" && hp.trim().length > 0) return true;

  // Nama tak pernah berisi URL → sinyal spam kuat.
  if (typeof input.name === "string" && URL_RE.test(input.name)) {
    URL_RE.lastIndex = 0;
    return true;
  }
  URL_RE.lastIndex = 0;

  const text = [input.name, input.note]
    .filter((v): v is string => typeof v === "string")
    .join(" ");
  const urls = text.match(URL_RE);
  if (urls && urls.length > MAX_URLS) return true;

  return false;
}
