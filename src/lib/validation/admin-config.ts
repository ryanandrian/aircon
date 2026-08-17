/**
 * Validasi Zod untuk admin config (paket, kebijakan, produk IoT).
 * Dipakai server action admin sebelum menulis ke DB.
 */
import { z } from "zod";

/** Kuota: bilangan bulat >= 0, atau null (= tanpa batas). */
const quota = z.number().int().min(0).nullable();

export const planConfigSchema = z.object({
  displayName: z.string().trim().min(2).max(60),
  priceMonthly: z.number().int().min(0),
  taxable: z.boolean(),
  active: z.boolean(),
  sortOrder: z.number().int().min(0),
  tagline: z.string().trim().max(120).optional().or(z.literal("")),
  maxAdmins: quota,
  maxTechnicians: quota,
  maxCustomers: quota,
  maxAcUnits: quota,
});
export type PlanConfigInput = z.infer<typeof planConfigSchema>;

export const billingPolicySchema = z
  .object({
    taxPercent: z.number().min(0).max(100),
    trialDays: z.number().int().min(0),
    graceDaysBeforeSuspend: z.number().int().min(0),
    daysBeforeDelete: z.number().int().min(1),
    dunningReminderDays: z
      .string()
      .trim()
      .regex(/^(\d+)(\s*,\s*\d+)*$/, "Format harus angka dipisah koma, mis. 0,1,3"),
    deleteWarningDay: z.number().int().min(0),
  })
  .refine((d) => d.daysBeforeDelete > d.graceDaysBeforeSuspend, {
    message: "Hari hapus harus lebih besar dari hari suspend",
    path: ["daysBeforeDelete"],
  })
  .refine((d) => d.deleteWarningDay < d.daysBeforeDelete, {
    message: "Hari peringatan hapus harus sebelum hari hapus",
    path: ["deleteWarningDay"],
  });
export type BillingPolicyInput = z.infer<typeof billingPolicySchema>;

export const iotProductSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  priceUnit: z.number().int().min(0),
  warrantyDays: z.number().int().min(0),
  active: z.boolean(),
});
export type IotProductInput = z.infer<typeof iotProductSchema>;

export const companyProfileSchema = z.object({
  legalName: z.string().trim().max(120),
  brandName: z.string().trim().min(1).max(60),
  logoUrl: z.string().trim().max(300),
  isPkp: z.boolean(),
  npwp: z.string().trim().max(40),
  taxLabel: z.string().trim().max(20),
  email: z.string().trim().max(120).refine((v) => v === "" || /.+@.+\..+/.test(v), "Email tidak valid"),
  phone: z.string().trim().max(30),
  addressLine: z.string().trim().max(200),
  city: z.string().trim().max(60),
  province: z.string().trim().max(60),
  postalCode: z.string().trim().max(10),
  countryCode: z.string().trim().min(2).max(3),
  checkoutExpiryHours: z.number().int().min(1).max(720),
  finishUrl: z.string().trim().max(300).refine((v) => v === "" || /^https?:\/\//.test(v), "URL harus diawali http(s)://"),
});
export type CompanyProfileInput = z.infer<typeof companyProfileSchema>;
