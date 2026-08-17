/**
 * Validasi Customer — Zod schema untuk create & update.
 * Pesan error user-facing dalam Bahasa Indonesia.
 * Phone dinormalisasi ke digit (lihat normalizePhone di wa/gateway).
 */
import { z } from "zod";
import { normalizePhone } from "../wa/gateway";

const customerSourceEnum = z.enum([
  "REFERRAL",
  "WHATSAPP",
  "WALK_IN",
  "MARKETING",
  "WEBSITE",
  "IOT_ALERT",
  "REPEAT",
  "OTHER",
]);

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi"),
  phone: z
    .string()
    .trim()
    .min(1, "Nomor telepon wajib diisi")
    .transform((v) => normalizePhone(v))
    .refine((v) => v.length > 0, "Nomor telepon tidak valid"),
  address: z.string().trim().optional(),
  geoLat: z.number().optional(),
  geoLng: z.number().optional(),
  source: customerSourceEnum.optional(),
  referredById: z.string().optional(),
  notes: z.string().trim().optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
