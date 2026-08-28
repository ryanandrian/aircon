/**
 * Validasi profil usaha tenant (Fase 1): branding (logo), pajak (PKP), rekening, QRIS.
 * Semua opsional — tenant kecil non-PKP tak wajib isi apa pun.
 */
import { z } from "zod";

export const tenantProfileSchema = z.object({
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
});

export type TenantProfileInput = z.infer<typeof tenantProfileSchema>;
