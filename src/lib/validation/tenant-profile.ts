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

  // Halaman usaha publik (/p) — semua opsional; default diterapkan saat render.
  publicDescription: z.string().trim().max(600).optional(),
  services: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  operatingHours: z.string().trim().max(120).optional(),
  trustBadges: z.array(z.string().trim().min(1).max(40)).max(3).optional(),
  areaCities: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  areaDistricts: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  instagram: z.string().trim().max(120).optional(),
  mapUrl: z.string().trim().max(500).optional(),
});

export type TenantProfileInput = z.infer<typeof tenantProfileSchema>;

/**
 * Interval servis default per tenant (dipakai saat unit tak punya aturan sendiri).
 * Batas 1–730 hari (≈2 tahun) — cegah input yang membuat jadwal tak masuk akal.
 */
export const tenantMaintenanceSchema = z.object({
  maintenanceIntervalDays: z
    .number()
    .int("Interval servis harus bilangan bulat")
    .positive("Interval servis harus lebih dari 0"),
});

/**
 * Jarak kirim pengingat (reminderLeadDays) per tenant — berapa hari SEBELUM
 * jadwal servis pesan disiapkan/dikirim.
 * 0 = kirim tepat hari H; batas 90 hari (sudah lebih dari cukup untuk servis AC).
 */
export const tenantReminderLeadSchema = z.object({
  reminderLeadDays: z
    .number()
    .int("Jarak kirim pengingat harus bilangan bulat")
    .min(0, "Jarak kirim pengingat tidak boleh negatif")
    .max(90, "Jarak kirim pengingat maksimal 90 hari"),
});
