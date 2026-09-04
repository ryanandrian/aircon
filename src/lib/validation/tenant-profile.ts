/**
 * Validasi profil usaha tenant (Fase 1): branding (logo), pajak (PKP), rekening, QRIS.
 * Semua opsional — tenant kecil non-PKP tak wajib isi apa pun.
 */
import { z } from "zod";

export const tenantProfileSchema = z.object({
  name: z.string().trim().min(2, "Nama usaha minimal 2 karakter").max(120).optional(),
  phone: z.string().trim().min(6, "Nomor telepon tidak valid").max(30).optional(),
  address: z.string().trim().max(300).optional(),
  tagline: z.string().trim().max(160).optional(),
  logoUrl: z.string().trim().max(500).optional(),
  isPkp: z.boolean().optional(),
  npwp: z.string().trim().max(40).optional(),
  taxPercent: z.number().min(0).max(100).optional(),
  bankName: z.string().trim().max(80).optional(),
  bankAccountNo: z.string().trim().max(60).optional(),
  bankAccountName: z.string().trim().max(120).optional(),
  qrisImageUrl: z.string().trim().max(500).optional(),
  teamIncentiveMode: z.enum(["BAGI_RATA", "PENUH"]).optional(),
  incentiveBasis: z.enum(["LUNAS", "TERBIT"]).optional(),
  incentiveEnabled: z.boolean().optional(),
});

export type TenantProfileInput = z.infer<typeof tenantProfileSchema>;
