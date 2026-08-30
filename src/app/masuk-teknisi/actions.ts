"use server";

import { loginTechnician, acceptInvite, TechAuthError } from "@/lib/services/technician-service";
import { setTechSession } from "@/lib/auth/tech-session";
import { getServerContext } from "@/lib/auth/context";
import { assertRole } from "@/lib/auth/guard";
import { createInvite, revokeInvite, updateTechnician, resetTechnicianPin } from "@/lib/services/technician-service";
import { getPlanConfig } from "@/lib/billing/config";
import { prisma } from "@/lib/prisma";
import { quotaLimit, withinQuota } from "@/lib/billing/gating-pure";
import { revalidatePath } from "next/cache";

export type Result = { ok: true } | { ok: false; error: string };

/** Login teknisi (phone+PIN) → set sesi. */
export async function techLogin(phone: string, pin: string): Promise<Result> {
  try {
    const { userId } = await loginTechnician(phone, pin);
    await setTechSession(userId);
    return { ok: true };
  } catch (err) {
    if (err instanceof TechAuthError) return { ok: false, error: err.message };
    console.error("[techLogin] gagal:", err);
    return { ok: false, error: "Gagal masuk. Coba lagi." };
  }
}

/** Terima undangan + set PIN → set sesi. */
export async function techAcceptInvite(token: string, pin: string, pinConfirm: string): Promise<Result> {
  try {
    if (pin !== pinConfirm) return { ok: false, error: "Konfirmasi PIN tidak sama" };
    const { userId } = await acceptInvite(token, pin);
    await setTechSession(userId);
    return { ok: true };
  } catch (err) {
    if (err instanceof TechAuthError) return { ok: false, error: err.message };
    console.error("[techAcceptInvite] gagal:", err);
    return { ok: false, error: "Gagal menyimpan. Coba lagi." };
  }
}

/** Owner mengundang teknisi (cek kuota teknisi paket). */
export async function ownerInviteTechnician(name: string, phone: string): Promise<Result> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);

    // Kuota teknisi: hitung teknisi aktif + undangan pending vs batas paket.
    const tenant = await prisma.tenant.findUnique({ where: { id: ctx.tenantId }, select: { plan: true } });
    const plan = tenant ? await getPlanConfig(tenant.plan) : null;
    if (plan) {
      const [techCount, pendingInvites] = await Promise.all([
        prisma.technician.count({ where: { tenantId: ctx.tenantId, active: true } }),
        prisma.invite.count({ where: { tenantId: ctx.tenantId, status: "PENDING" } }),
      ]);
      const limit = quotaLimit(plan, "technicians");
      if (!withinQuota(limit, techCount + pendingInvites)) {
        return { ok: false, error: "Kuota teknisi paket sudah penuh. Upgrade paket untuk menambah." };
      }
    }

    await createInvite({ tenantId: ctx.tenantId, createdById: ctx.userId, name, phone });
    revalidatePath("/app/teknisi");
    return { ok: true };
  } catch (err) {
    if (err instanceof TechAuthError) return { ok: false, error: err.message };
    console.error("[ownerInviteTechnician] gagal:", err);
    return { ok: false, error: "Gagal membuat undangan." };
  }
}

/** Owner membatalkan undangan. */
export async function ownerRevokeInvite(inviteId: string): Promise<Result> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);
    await revokeInvite(ctx.tenantId, inviteId);
    revalidatePath("/app/teknisi");
    return { ok: true };
  } catch (err) {
    if (err instanceof TechAuthError) return { ok: false, error: err.message };
    console.error("[ownerRevokeInvite] gagal:", err);
    return { ok: false, error: "Gagal membatalkan undangan." };
  }
}

/** Owner memperbarui profil teknisi (nama/HP/posisi/status aktif). */
export async function ownerUpdateTechnician(
  technicianId: string,
  data: { name?: string; phone?: string; position?: "TEKNISI" | "KERNET"; active?: boolean },
): Promise<Result> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);
    await updateTechnician(ctx.tenantId, technicianId, data);
    revalidatePath("/app/teknisi");
    return { ok: true };
  } catch (err) {
    if (err instanceof TechAuthError) return { ok: false, error: err.message };
    console.error("[ownerUpdateTechnician] gagal:", err);
    return { ok: false, error: "Gagal menyimpan perubahan." };
  }
}

/** Owner reset PIN teknisi (mis. teknisi lupa PIN). */
export async function ownerResetTechnicianPin(technicianId: string, newPin: string): Promise<Result> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);
    await resetTechnicianPin(ctx.tenantId, technicianId, newPin);
    revalidatePath("/app/teknisi");
    return { ok: true };
  } catch (err) {
    if (err instanceof TechAuthError) return { ok: false, error: err.message };
    console.error("[ownerResetTechnicianPin] gagal:", err);
    return { ok: false, error: "Gagal reset PIN." };
  }
}
