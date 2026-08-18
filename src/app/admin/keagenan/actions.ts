"use server";

import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import {
  createAgent, updateAgent, buildMonthlyPayouts, markPayoutPaid,
} from "@/lib/partner/partner-admin-service";
import type { CommissionType, PartnerTaxStatus, PartnerStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

export type PartnerResult = { ok: true } | { ok: false; error: string };

function num(fd: FormData, k: string): number { return Number(fd.get(k) ?? 0); }
function str(fd: FormData, k: string): string { return String(fd.get(k) ?? "").trim(); }

export async function actionCreateAgent(fd: FormData): Promise<PartnerResult> {
  try {
    await requirePlatformAdmin();
    const companyName = str(fd, "companyName");
    const picEmail = str(fd, "picEmail");
    if (!companyName || !picEmail) return { ok: false, error: "Nama perusahaan & email PIC wajib" };
    await createAgent({
      companyName,
      picName: str(fd, "picName"),
      picEmail,
      picPhone: str(fd, "picPhone"),
      commissionType: (str(fd, "commissionType") || "PERCENT") as CommissionType,
      commissionValue: num(fd, "commissionValue"),
      taxStatus: (str(fd, "taxStatus") || "BADAN_NPWP") as PartnerTaxStatus,
      npwp: str(fd, "npwp"),
      bankName: str(fd, "bankName"),
      bankAccount: str(fd, "bankAccount"),
      bankHolder: str(fd, "bankHolder"),
      notes: str(fd, "notes"),
    });
    revalidatePath("/admin/keagenan");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal membuat agen" };
  }
}

export async function actionUpdateAgent(agentId: string, fd: FormData): Promise<PartnerResult> {
  try {
    await requirePlatformAdmin();
    await updateAgent(agentId, {
      commissionType: (str(fd, "commissionType") || undefined) as CommissionType | undefined,
      commissionValue: fd.get("commissionValue") != null ? num(fd, "commissionValue") : undefined,
      status: (str(fd, "status") || undefined) as PartnerStatus | undefined,
      taxStatus: (str(fd, "taxStatus") || undefined) as PartnerTaxStatus | undefined,
      bankName: fd.get("bankName") != null ? str(fd, "bankName") : undefined,
      bankAccount: str(fd, "bankAccount") || undefined,
      bankHolder: fd.get("bankHolder") != null ? str(fd, "bankHolder") : undefined,
    });
    revalidatePath("/admin/keagenan");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal memperbarui agen" };
  }
}

/** Susun draft pencairan bulan lalu. */
export async function actionBuildPayouts(): Promise<PartnerResult> {
  try {
    await requirePlatformAdmin();
    const now = new Date();
    const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    await buildMonthlyPayouts(lastMonth);
    revalidatePath("/admin/keagenan");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal menyusun pencairan" };
  }
}

export async function actionMarkPaid(payoutId: string, transferRef: string): Promise<PartnerResult> {
  try {
    await requirePlatformAdmin();
    if (!transferRef.trim()) return { ok: false, error: "Bukti transfer wajib diisi" };
    await markPayoutPaid(payoutId, transferRef.trim());
    revalidatePath("/admin/keagenan");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal menandai lunas" };
  }
}
