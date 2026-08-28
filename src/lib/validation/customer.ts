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

const customerCategoryEnum = z.enum([
  "RUMAH",
  "SEKOLAH_KAMPUS",
  "MASJID_MUSHOLA",
  "TOKO_OUTLET",
  "RUKO_RUKAN",
  "KANTOR_PERUSAHAAN",
  "LAINNYA",
]);

const customerTypeEnum = z.enum(["PERORANGAN", "BADAN"]);

const topTypeEnum = z.enum([
  "CASH",
  "TEMPO_7",
  "TEMPO_14",
  "TEMPO_30",
  "TEMPO_45",
  "TEMPO_60",
  "TEMPO_90",
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
  // Modul invoicing/AR (Fase 1) — semua opsional, backward-compatible.
  category: customerCategoryEnum.optional(),
  customerType: customerTypeEnum.optional(),
  topType: topTypeEnum.optional(),
  npwp: z.string().trim().optional(),
  isPphWithholder: z.boolean().optional(),
  billingCustomerId: z.string().optional(),
  picWorkName: z.string().trim().optional(),
  picWorkPhone: z.string().trim().optional(),
  picWorkRole: z.string().trim().optional(),
  picFinanceName: z.string().trim().optional(),
  picFinancePhone: z.string().trim().optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
