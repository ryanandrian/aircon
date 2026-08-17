/**
 * Admin Config Service — kelola PlanConfig, BillingPolicy, IotProduct, IotOrder.
 * PLATFORM-ADMIN-ONLY: setiap fungsi HANYA boleh dipanggil setelah requirePlatformAdmin().
 * Semua nilai bisnis editable di sini (no hardcode).
 */
import { prisma } from "@/lib/prisma";
import type {
  PlanConfig, BillingPolicy, IotProduct, IotOrder, TenantPlan, IotOrderStatus,
} from "@prisma/client";
import type {
  PlanConfigInput, BillingPolicyInput, IotProductInput,
} from "@/lib/validation/admin-config";

// ---------- Plan ----------

/** PLATFORM-ADMIN-ONLY. */
export async function listPlanConfigs(): Promise<PlanConfig[]> {
  return prisma.planConfig.findMany({ orderBy: { sortOrder: "asc" } });
}

/** PLATFORM-ADMIN-ONLY. Perubahan berlaku untuk tagihan/aktivasi berikutnya. */
export async function updatePlanConfig(plan: TenantPlan, data: PlanConfigInput): Promise<PlanConfig> {
  return prisma.planConfig.update({
    where: { plan },
    data: {
      displayName: data.displayName,
      priceMonthly: data.priceMonthly,
      taxable: data.taxable,
      active: data.active,
      sortOrder: data.sortOrder,
      tagline: data.tagline || null,
      maxAdmins: data.maxAdmins,
      maxTechnicians: data.maxTechnicians,
      maxCustomers: data.maxCustomers,
      maxAcUnits: data.maxAcUnits,
    },
  });
}

// ---------- Billing Policy ----------

/** PLATFORM-ADMIN-ONLY. */
export async function getBillingPolicyForAdmin(): Promise<BillingPolicy> {
  const existing = await prisma.billingPolicy.findUnique({ where: { id: "singleton" } });
  if (existing) return existing;
  return prisma.billingPolicy.create({ data: { id: "singleton" } });
}

/** PLATFORM-ADMIN-ONLY. */
export async function updateBillingPolicy(data: BillingPolicyInput, adminEmail: string): Promise<BillingPolicy> {
  return prisma.billingPolicy.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data, updatedBy: adminEmail },
    update: { ...data, updatedBy: adminEmail },
  });
}

// ---------- IoT Product ----------

/** PLATFORM-ADMIN-ONLY. */
export async function listIotProducts(): Promise<IotProduct[]> {
  return prisma.iotProduct.findMany({ orderBy: { createdAt: "asc" } });
}

/** PLATFORM-ADMIN-ONLY. */
export async function updateIotProduct(id: string, data: IotProductInput): Promise<IotProduct> {
  return prisma.iotProduct.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description || null,
      priceUnit: data.priceUnit,
      warrantyDays: data.warrantyDays,
      active: data.active,
    },
  });
}

// ---------- IoT Orders (admin proses) ----------

/** PLATFORM-ADMIN-ONLY. */
export async function listAllIotOrders(status?: IotOrderStatus): Promise<IotOrder[]> {
  return prisma.iotOrder.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

/** PLATFORM-ADMIN-ONLY. */
export async function updateIotOrderStatus(
  orderId: string,
  status: IotOrderStatus,
  trackingNote?: string,
): Promise<IotOrder> {
  return prisma.iotOrder.update({
    where: { id: orderId },
    data: { status, ...(trackingNote !== undefined ? { trackingNote } : {}) },
  });
}
