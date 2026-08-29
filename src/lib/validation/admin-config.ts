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
    dunningReminderTemplate: z.string().trim().min(10).max(1000),
    dunningWarningTemplate: z.string().trim().min(10).max(1000),
    inactivitySweepEnabled: z.boolean(),
    inactivityDryRun: z.boolean(),
    inactivityReminder1Days: z.number().int().min(1),
    inactivityReminder2Days: z.number().int().min(1),
    inactivityDeleteDays: z.number().int().min(1),
    inactivityMinCustomers: z.number().int().min(0),
    inactivityMinJobs: z.number().int().min(0),
    inactivityExemptPaid: z.boolean(),
    inactivityReminder1Template: z.string().trim().min(10).max(1000),
    inactivityReminder2Template: z.string().trim().min(10).max(1000),
  })
  .refine((d) => d.daysBeforeDelete > d.graceDaysBeforeSuspend, {
    message: "Hari hapus harus lebih besar dari hari suspend",
    path: ["daysBeforeDelete"],
  })
  .refine((d) => d.deleteWarningDay < d.daysBeforeDelete, {
    message: "Hari peringatan hapus harus sebelum hari hapus",
    path: ["deleteWarningDay"],
  })
  .refine((d) => d.inactivityReminder2Days > d.inactivityReminder1Days, {
    message: "Reminder #2 harus setelah reminder #1",
    path: ["inactivityReminder2Days"],
  })
  .refine((d) => d.inactivityDeleteDays >= d.inactivityReminder2Days, {
    message: "Hari hapus harus >= reminder #2",
    path: ["inactivityDeleteDays"],
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

/** Konfigurasi infra WhatsApp Gateway + MQTT (editable admin). */
export const infraConfigSchema = z.object({
  waGatewayUrl: z.string().trim().max(300).refine((v) => v === "" || /^https?:\/\//.test(v), "URL harus http(s)://"),
  waGatewayKey: z.string().trim().max(200).optional().or(z.literal("")),
  waCallbackSecret: z.string().trim().max(200).optional().or(z.literal("")),
  waMinGapMs: z.number().int().min(0).max(600000),
  waMaxGapMs: z.number().int().min(0).max(600000),
  waMaxPerMin: z.number().int().min(1).max(120),
  waMaxPerDay: z.number().int().min(1).max(100000),
  waWarmupEnabled: z.boolean(),
  waWarmupDays: z.number().int().min(0).max(60),
  waWarmupDay1Cap: z.number().int().min(1).max(10000),
  waQuietStartHour: z.number().int().min(0).max(23),
  waQuietEndHour: z.number().int().min(0).max(23),
  waTzOffset: z.number().int().min(-12).max(14),
  waMaxLiveSessions: z.number().int().min(1).max(1000),
  waIdleEvictMs: z.number().int().min(60000).max(86400000),
  mqttBrokerHost: z.string().trim().max(200),
  mqttBrokerPort: z.number().int().min(1).max(65535),
  mqttTlsEnabled: z.boolean(),
  mqttTopicPrefix: z.string().trim().min(1).max(40).regex(/^[a-zA-Z0-9_-]+$/, "Hanya huruf/angka/_/-"),
  iotOvercurrentA: z.number().min(0).max(1000),
  iotNoCoolTempC: z.number().min(0).max(100),
  iotOfflineMinutes: z.number().int().min(1).max(1440),
}).refine((v) => v.waMaxGapMs >= v.waMinGapMs, { message: "Jeda maks harus >= jeda min", path: ["waMaxGapMs"] });
export type InfraConfigFormInput = z.infer<typeof infraConfigSchema>;
