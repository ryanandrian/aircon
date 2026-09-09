"use server";

import { loginTechnician, acceptInvite, TechAuthError } from "@/lib/services/technician-service";
import { setTechSession } from "@/lib/auth/tech-session";
import { getServerContext } from "@/lib/auth/context";
import { assertRole } from "@/lib/auth/guard";
import { createInvite, revokeInvite, updateTechnician, resetTechnicianPin, listTechnicianAssignments, updateAdmin, resetAdminPin } from "@/lib/services/technician-service";
import { getPlanConfig } from "@/lib/billing/config";
import { prisma } from "@/lib/prisma";
import { quotaLimit, withinQuota } from "@/lib/billing/gating-pure";
import { revalidatePath } from "next/cache";

export type Result = { ok: true } | { ok: false; error: string };
export type LoginResult = { ok: true; role: "ADMIN" | "TECHNICIAN" } | { ok: false; error: string };

/** Login staf (phone+PIN) → set sesi. Mengembalikan role untuk redirect (admin→/app, teknisi→/t). */
export async function techLogin(phone: string, pin: string): Promise<LoginResult> {
  try {
    const { userId, role } = await loginTechnician(phone, pin);
    await setTechSession(userId);
    return { ok: true, role };
  } catch (err) {
    if (err instanceof TechAuthError) return { ok: false, error: err.message };
    console.error("[techLogin] gagal:", err);
    return { ok: false, error: "Gagal masuk. Coba lagi." };
  }
}

/** Terima undangan + set PIN → set sesi. Mengembalikan role untuk redirect. */
export async function techAcceptInvite(token: string, pin: string, pinConfirm: string): Promise<LoginResult> {
  try {
    if (pin !== pinConfirm) return { ok: false, error: "Konfirmasi PIN tidak sama" };
    const { userId, role } = await acceptInvite(token, pin);
    await setTechSession(userId);
    return { ok: true, role };
  } catch (err) {
    if (err instanceof TechAuthError) return { ok: false, error: err.message };
    console.error("[techAcceptInvite] gagal:", err);
    return { ok: false, error: "Gagal menyimpan. Coba lagi." };
  }
}

/** Owner mengundang anggota tim (teknisi/admin) — cek kuota paket sesuai peran. */
export async function ownerInviteTechnician(
  name: string,
  phone: string,
  role: "TECHNICIAN" | "ADMIN" = "TECHNICIAN",
  jobTitle?: string,
): Promise<Result> {
  try {
    const ctx = await getServerContext();
    // Hanya OWNER yang boleh mengundang ADMIN (admin tak bisa membuat admin lain).
    if (role === "ADMIN") assertRole(ctx.role, ["OWNER"]);
    else assertRole(ctx.role, ["OWNER", "ADMIN"]);

    // Kuota sesuai peran: teknisi vs admin (masing-masing punya batas paket).
    const tenant = await prisma.tenant.findUnique({ where: { id: ctx.tenantId }, select: { plan: true } });
    const plan = tenant ? await getPlanConfig(tenant.plan) : null;
    if (plan) {
      if (role === "TECHNICIAN") {
        const [techCount, pendingTechInvites] = await Promise.all([
          prisma.technician.count({ where: { tenantId: ctx.tenantId, active: true } }),
          prisma.invite.count({ where: { tenantId: ctx.tenantId, status: "PENDING", role: "TECHNICIAN" } }),
        ]);
        const limit = quotaLimit(plan, "technicians");
        if (!withinQuota(limit, techCount + pendingTechInvites)) {
          return { ok: false, error: "Kuota teknisi paket sudah penuh. Upgrade paket untuk menambah." };
        }
      } else {
        const [adminCount, pendingAdminInvites] = await Promise.all([
          prisma.user.count({ where: { tenantId: ctx.tenantId, role: "ADMIN", status: { in: ["ACTIVE", "INVITED"] } } }),
          prisma.invite.count({ where: { tenantId: ctx.tenantId, status: "PENDING", role: "ADMIN" } }),
        ]);
        const limit = quotaLimit(plan, "admins");
        if (!withinQuota(limit, adminCount + pendingAdminInvites)) {
          return { ok: false, error: "Kuota admin paket sudah penuh. Upgrade paket untuk menambah." };
        }
      }
    }

    await createInvite({ tenantId: ctx.tenantId, createdById: ctx.userId, name, phone, role, jobTitle });
    revalidatePath("/app/tim");
    return { ok: true };
  } catch (err) {
    if (err instanceof TechAuthError) return { ok: false, error: err.message };
    console.error("[ownerInviteTechnician] gagal:", err);
    return { ok: false, error: "Gagal membuat undangan." };
  }
}

/**
 * Kirim link undangan ke HP staf via WA GATEWAY (nomor tenant) — konsisten dgn faktur/kwitansi.
 * Bila gateway belum tersambung (mis. onboarding staf pertama), kembalikan fallback=true agar
 * UI membuka wa.me sebagai cadangan (cegah jalan buntu). Patuh guard anti-spam gateway.
 */
export async function ownerSendInviteWa(inviteId: string): Promise<
  { ok: true; to: string } | { ok: false; error: string; fallback?: boolean }
> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);
    const invite = await prisma.invite.findFirst({
      where: { id: inviteId, tenantId: ctx.tenantId, status: "PENDING" },
      select: { name: true, phone: true, token: true, role: true, jobTitle: true },
    });
    if (!invite) return { ok: false, error: "Undangan tidak ditemukan" };

    const { gatewaySend, isGatewayConfigured } = await import("@/lib/wa/gateway-relay");
    if (!(await isGatewayConfigured())) {
      // Belum tersambung → biar UI pakai wa.me sebagai cadangan.
      return { ok: false, error: "Gateway WA belum tersambung", fallback: true };
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const url = `${appUrl}/undangan/${invite.token}`;
    const peran = invite.role === "ADMIN" ? (invite.jobTitle?.trim() || "admin") : "teknisi";
    const tenant = await prisma.tenant.findUnique({ where: { id: ctx.tenantId }, select: { name: true } });
    const message = `Halo ${invite.name}, Anda diundang menjadi ${peran} di ${tenant?.name ?? "usaha kami"} (via Aircon). Buka tautan ini untuk membuat PIN & mulai:\n${url}`;

    const res = await gatewaySend(ctx.tenantId, invite.phone, message);
    if (!res.ok) return { ok: false, error: res.error ?? "Gagal mengirim WA", fallback: true };
    return { ok: true, to: invite.phone };
  } catch (err) {
    if (err instanceof TechAuthError) return { ok: false, error: err.message };
    console.error("[ownerSendInviteWa] gagal:", err);
    return { ok: false, error: "Gagal mengirim undangan.", fallback: true };
  }
}

/** Owner membatalkan undangan. */
export async function ownerRevokeInvite(inviteId: string): Promise<Result> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);
    await revokeInvite(ctx.tenantId, inviteId);
    revalidatePath("/app/tim");
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
    revalidatePath("/app/tim");
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
    revalidatePath("/app/tim");
    return { ok: true };
  } catch (err) {
    if (err instanceof TechAuthError) return { ok: false, error: err.message };
    console.error("[ownerResetTechnicianPin] gagal:", err);
    return { ok: false, error: "Gagal reset PIN." };
  }
}

/** Owner: riwayat penugasan teknisi (filter periode YYYY-MM opsional). */
export async function ownerTechnicianAssignments(
  technicianId: string,
  period?: string,
): Promise<
  | { ok: true; rows: { id: string; date: string | null; customer: string; unit: string; role: "TECHNICIAN" | "KERNET"; service: string; status: string }[]; periods: string[] }
  | { ok: false; error: string }
> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);
    const res = await listTechnicianAssignments(ctx.tenantId, technicianId, period || undefined);
    return { ok: true, ...res };
  } catch (err) {
    if (err instanceof TechAuthError) return { ok: false, error: err.message };
    console.error("[ownerTechnicianAssignments] gagal:", err);
    return { ok: false, error: "Gagal memuat riwayat penugasan." };
  }
}

/** Owner memperbarui profil admin (nama/HP/jabatan/status aktif). Owner-only. */
export async function ownerUpdateAdmin(
  userId: string,
  data: { name?: string; phone?: string; jobTitle?: string | null; active?: boolean },
): Promise<Result> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER"]);
    await updateAdmin(ctx.tenantId, userId, data);
    revalidatePath("/app/tim");
    return { ok: true };
  } catch (err) {
    if (err instanceof TechAuthError) return { ok: false, error: err.message };
    console.error("[ownerUpdateAdmin] gagal:", err);
    return { ok: false, error: "Gagal menyimpan perubahan." };
  }
}

/** Owner reset PIN admin. Owner-only. */
export async function ownerResetAdminPin(userId: string, newPin: string): Promise<Result> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER"]);
    await resetAdminPin(ctx.tenantId, userId, newPin);
    revalidatePath("/app/tim");
    return { ok: true };
  } catch (err) {
    if (err instanceof TechAuthError) return { ok: false, error: err.message };
    console.error("[ownerResetAdminPin] gagal:", err);
    return { ok: false, error: "Gagal reset PIN." };
  }
}
