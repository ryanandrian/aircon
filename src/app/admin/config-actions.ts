"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import {
  planConfigSchema,
  billingPolicySchema,
  iotProductSchema,
  companyProfileSchema,
} from "@/lib/validation/admin-config";
import {
  updatePlanConfig,
  updateBillingPolicy,
  updateIotProduct,
  updateIotOrderStatus,
} from "@/lib/services/admin-config-service";
import { updateCompanyProfile } from "@/lib/services/company-service";
import type { TenantPlan, IotOrderStatus } from "@prisma/client";

export type ActionResult = { ok: true } | { ok: false; error: string };

function num(fd: FormData, k: string): number {
  return Number(fd.get(k));
}
function boolean(fd: FormData, k: string): boolean {
  return fd.get(k) === "on" || fd.get(k) === "true";
}
function nullableNum(fd: FormData, k: string): number | null {
  const v = fd.get(k);
  if (v === null || String(v).trim() === "") return null;
  return Number(v);
}

/** Ubah PlanConfig. PLATFORM-ADMIN-ONLY. */
export async function actionUpdatePlan(plan: TenantPlan, fd: FormData): Promise<ActionResult> {
  try {
    await requirePlatformAdmin();
    const parsed = planConfigSchema.safeParse({
      displayName: String(fd.get("displayName") ?? ""),
      priceMonthly: num(fd, "priceMonthly"),
      taxable: boolean(fd, "taxable"),
      active: boolean(fd, "active"),
      sortOrder: num(fd, "sortOrder"),
      tagline: String(fd.get("tagline") ?? ""),
      maxAdmins: nullableNum(fd, "maxAdmins"),
      maxTechnicians: nullableNum(fd, "maxTechnicians"),
      maxCustomers: nullableNum(fd, "maxCustomers"),
      maxAcUnits: nullableNum(fd, "maxAcUnits"),
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
    await updatePlanConfig(plan, parsed.data);
    revalidatePath("/admin/paket");
    return { ok: true };
  } catch (err) {
    console.error("[actionUpdatePlan]", err);
    return { ok: false, error: "Gagal menyimpan paket." };
  }
}

/** Ubah BillingPolicy. PLATFORM-ADMIN-ONLY. */
export async function actionUpdatePolicy(fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requirePlatformAdmin();
    const parsed = billingPolicySchema.safeParse({
      taxPercent: num(fd, "taxPercent"),
      trialDays: num(fd, "trialDays"),
      graceDaysBeforeSuspend: num(fd, "graceDaysBeforeSuspend"),
      daysBeforeDelete: num(fd, "daysBeforeDelete"),
      dunningReminderDays: String(fd.get("dunningReminderDays") ?? ""),
      deleteWarningDay: num(fd, "deleteWarningDay"),
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
    await updateBillingPolicy(parsed.data, admin.email);
    revalidatePath("/admin/kebijakan");
    return { ok: true };
  } catch (err) {
    console.error("[actionUpdatePolicy]", err);
    return { ok: false, error: "Gagal menyimpan kebijakan." };
  }
}

/** Ubah IotProduct. PLATFORM-ADMIN-ONLY. */
export async function actionUpdateIotProduct(id: string, fd: FormData): Promise<ActionResult> {
  try {
    await requirePlatformAdmin();
    const parsed = iotProductSchema.safeParse({
      name: String(fd.get("name") ?? ""),
      description: String(fd.get("description") ?? ""),
      priceUnit: num(fd, "priceUnit"),
      warrantyDays: num(fd, "warrantyDays"),
      active: boolean(fd, "active"),
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
    await updateIotProduct(id, parsed.data);
    revalidatePath("/admin/iot");
    return { ok: true };
  } catch (err) {
    console.error("[actionUpdateIotProduct]", err);
    return { ok: false, error: "Gagal menyimpan produk." };
  }
}

/** Ubah status pesanan IoT. PLATFORM-ADMIN-ONLY. */
export async function actionUpdateIotOrderStatus(
  orderId: string,
  status: IotOrderStatus,
  trackingNote: string,
): Promise<ActionResult> {
  try {
    await requirePlatformAdmin();
    await updateIotOrderStatus(orderId, status, trackingNote || undefined);
    revalidatePath("/admin/iot");
    return { ok: true };
  } catch (err) {
    console.error("[actionUpdateIotOrderStatus]", err);
    return { ok: false, error: "Gagal memperbarui pesanan." };
  }
}

/** Ubah profil perusahaan (Lumite). PLATFORM-ADMIN-ONLY. */
export async function actionUpdateCompany(fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requirePlatformAdmin();
    const parsed = companyProfileSchema.safeParse({
      legalName: String(fd.get("legalName") ?? ""),
      brandName: String(fd.get("brandName") ?? ""),
      logoUrl: String(fd.get("logoUrl") ?? ""),
      isPkp: boolean(fd, "isPkp"),
      npwp: String(fd.get("npwp") ?? ""),
      taxLabel: String(fd.get("taxLabel") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      addressLine: String(fd.get("addressLine") ?? ""),
      city: String(fd.get("city") ?? ""),
      province: String(fd.get("province") ?? ""),
      postalCode: String(fd.get("postalCode") ?? ""),
      countryCode: String(fd.get("countryCode") ?? "IDN"),
      checkoutExpiryHours: num(fd, "checkoutExpiryHours"),
      finishUrl: String(fd.get("finishUrl") ?? ""),
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
    await updateCompanyProfile(parsed.data, admin.email);
    revalidatePath("/admin/perusahaan");
    return { ok: true };
  } catch (err) {
    console.error("[actionUpdateCompany]", err);
    return { ok: false, error: "Gagal menyimpan profil perusahaan." };
  }
}

export async function actionUpdateInfra(fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requirePlatformAdmin();
    const { infraConfigSchema } = await import("@/lib/validation/admin-config");
    const { updateInfraConfig } = await import("@/lib/services/infra-config-service");
    const parsed = infraConfigSchema.safeParse({
      waGatewayUrl: String(fd.get("waGatewayUrl") ?? ""),
      waGatewayKey: String(fd.get("waGatewayKey") ?? ""),
      waCallbackSecret: String(fd.get("waCallbackSecret") ?? ""),
      waMinGapMs: num(fd, "waMinGapMs"),
      waMaxGapMs: num(fd, "waMaxGapMs"),
      waMaxPerMin: num(fd, "waMaxPerMin"),
      waMaxPerDay: num(fd, "waMaxPerDay"),
      waWarmupEnabled: boolean(fd, "waWarmupEnabled"),
      waWarmupDays: num(fd, "waWarmupDays"),
      waWarmupDay1Cap: num(fd, "waWarmupDay1Cap"),
      waQuietStartHour: num(fd, "waQuietStartHour"),
      waQuietEndHour: num(fd, "waQuietEndHour"),
      waTzOffset: num(fd, "waTzOffset"),
      waMaxLiveSessions: num(fd, "waMaxLiveSessions"),
      waIdleEvictMs: num(fd, "waIdleEvictMs"),
      mqttBrokerHost: String(fd.get("mqttBrokerHost") ?? ""),
      mqttBrokerPort: num(fd, "mqttBrokerPort"),
      mqttTlsEnabled: boolean(fd, "mqttTlsEnabled"),
      mqttTopicPrefix: String(fd.get("mqttTopicPrefix") ?? "aircon"),
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
    await updateInfraConfig(parsed.data, admin.email);
    revalidatePath("/admin/infra");
    return { ok: true };
  } catch (err) {
    console.error("[actionUpdateInfra]", err);
    return { ok: false, error: "Gagal menyimpan konfigurasi infra." };
  }
}
