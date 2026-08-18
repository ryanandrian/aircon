"use server";

import { getServerContext } from "@/lib/auth/context";
import { assertRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { createJob } from "@/lib/services/job-management-service";
import { resolveAlert } from "@/lib/services/iot-ingest-service";
import { alertMessage } from "@/lib/iot/alert-detection";
import { revalidatePath } from "next/cache";

export type AlertActionResult = { ok: true; jobId?: string } | { ok: false; error: string };

/**
 * 1-TAP: ubah Alert IoT jadi Pekerjaan (INTI tesis: IoT = demand generator).
 * Membuat Job DRAFT dari device+asset+customer alert, lalu tautkan alert.createdJobId.
 * SECURITY: OWNER/ADMIN, tenant-scoped.
 */
export async function alertToJob(alertId: string): Promise<AlertActionResult> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);

    const alert = await prisma.alert.findFirst({
      where: { id: alertId, tenantId: ctx.tenantId },
    });
    if (!alert) return { ok: false, error: "Alert tidak ditemukan" };
    if (alert.createdJobId) return { ok: true, jobId: alert.createdJobId };

    // Cari asset + customer dari device/asset alert.
    const asset = alert.assetId
      ? await prisma.asset.findFirst({
          where: { id: alert.assetId, tenantId: ctx.tenantId },
          select: { id: true, customerId: true },
        })
      : null;
    if (!asset) {
      return { ok: false, error: "Unit AC untuk alert ini belum terhubung ke pelanggan. Hubungkan device ke unit dulu." };
    }

    const job = await createJob(ctx.tenantId, ctx.userId, {
      customerId: asset.customerId,
      assetId: asset.id,
      serviceType: "INSPECTION",
      source: "IOT",
      notes: `Dari peringatan IoT: ${alertMessage(alert.type)}`,
    });

    // KLAIM ATOMIK: tautkan job hanya bila alert belum punya job (cegah job ganda saat
    // dua request bersamaan). 0 baris = sudah diklaim proses lain → buang job baru.
    const claim = await prisma.alert.updateMany({
      where: { id: alert.id, tenantId: ctx.tenantId, createdJobId: null },
      data: { createdJobId: job.id, status: "ACK" },
    });
    if (claim.count === 0) {
      // Sudah ada job dari request lain: hapus job duplikat yang baru dibuat.
      await prisma.jobOrder.delete({ where: { id: job.id } }).catch(() => {});
      const fresh = await prisma.alert.findFirst({ where: { id: alert.id, tenantId: ctx.tenantId }, select: { createdJobId: true } });
      return { ok: true, jobId: fresh?.createdJobId ?? undefined };
    }

    revalidatePath("/app/perangkat");
    revalidatePath("/app/pekerjaan");
    return { ok: true, jobId: job.id };
  } catch (err) {
    console.error("[alertToJob] gagal:", err);
    return { ok: false, error: "Gagal membuat pekerjaan dari alert." };
  }
}

/** Tandai alert selesai/diabaikan. */
export async function dismissAlert(alertId: string, status: "RESOLVED" | "DISMISSED"): Promise<AlertActionResult> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);
    await resolveAlert(ctx.tenantId, alertId, status);
    revalidatePath("/app/perangkat");
    return { ok: true };
  } catch (err) {
    console.error("[dismissAlert] gagal:", err);
    return { ok: false, error: "Gagal memperbarui alert." };
  }
}
