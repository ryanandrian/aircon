"use server";

import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createCoupon, updateCoupon, toggleCoupon, type CouponInput } from "@/lib/services/coupon-admin-service";
import { revalidatePath } from "next/cache";
import type { CouponType, TenantPlan } from "@prisma/client";

type Result = { ok: true } | { ok: false; error: string };

export interface CouponFormData {
  code: string;
  description: string;
  type: CouponType;
  value: number;
  active: boolean;
  maxRedemptions: number | null;
  perTenantLimit: number;
  validFrom: string | null; // ISO date (yyyy-mm-dd) atau null
  validUntil: string | null;
  appliesToPlans: TenantPlan[];
  minMonths: number;
  recurring: boolean;
  recurringMonths: number | null;
}

function toInput(f: CouponFormData): CouponInput {
  return {
    code: f.code,
    description: f.description,
    type: f.type,
    value: f.value,
    active: f.active,
    maxRedemptions: f.maxRedemptions,
    perTenantLimit: f.perTenantLimit,
    validFrom: f.validFrom ? new Date(f.validFrom) : null,
    validUntil: f.validUntil ? new Date(f.validUntil) : null,
    appliesToPlans: f.appliesToPlans,
    minMonths: f.minMonths,
    recurring: f.recurring,
    recurringMonths: f.recurringMonths,
  };
}

export async function actionCreateCoupon(f: CouponFormData): Promise<Result> {
  try {
    await requirePlatformAdmin();
    if (!f.code.trim()) return { ok: false, error: "Kode wajib diisi." };
    await createCoupon(toInput(f));
    revalidatePath("/admin/kupon");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error && err.message.includes("Unique") ? "Kode kupon sudah dipakai." : "Gagal menyimpan kupon.";
    console.error("[actionCreateCoupon]", err);
    return { ok: false, error: msg };
  }
}

export async function actionUpdateCoupon(id: string, f: CouponFormData): Promise<Result> {
  try {
    await requirePlatformAdmin();
    await updateCoupon(id, toInput(f));
    revalidatePath("/admin/kupon");
    return { ok: true };
  } catch (err) {
    console.error("[actionUpdateCoupon]", err);
    return { ok: false, error: "Gagal memperbarui kupon." };
  }
}

export async function actionToggleCoupon(id: string, active: boolean): Promise<Result> {
  try {
    await requirePlatformAdmin();
    await toggleCoupon(id, active);
    revalidatePath("/admin/kupon");
    return { ok: true };
  } catch (err) {
    console.error("[actionToggleCoupon]", err);
    return { ok: false, error: "Gagal mengubah status." };
  }
}
