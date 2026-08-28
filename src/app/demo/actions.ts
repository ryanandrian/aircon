"use server";

import { getDemoTenant } from "@/lib/demo";
import { createRepeatJob } from "@/lib/services/reminder-service";
import { transitionJob } from "@/lib/services/job-service";
import { prisma } from "@/lib/prisma";
import { renderTemplate } from "@/lib/wa/gateway";
import { revalidatePath } from "next/cache";

/**
 * DEMO: JANGAN kirim WhatsApp nyata. Halaman /demo publik & tanpa auth — memicu gateway WA
 * sungguhan dari sini = celah abuse (spam WA, bakar kuota/reputasi nomor saat warm-up).
 * Jadi ini hanya MENSIMULASIKAN: render teks pesan dari template + data reminder, kembalikan preview.
 */
export async function actionSendReminder(reminderId: string) {
  const tenant = await getDemoTenant();
  if (!tenant) return { error: "Tenant demo tidak ada" };
  try {
    const reminder = await prisma.repeatReminder.findFirst({ where: { id: reminderId, tenantId: tenant.id } });
    if (!reminder) return { error: "Reminder tidak ditemukan" };
    const asset = await prisma.asset.findUnique({
      where: { id: reminder.assetId },
      select: { brand: true, roomLocation: true, customer: { select: { name: true } } },
    });
    const template = await prisma.messageTemplate.findUnique({
      where: { tenantId_key: { tenantId: tenant.id, key: "reminder" } },
    });
    const preview = renderTemplate(
      template?.body ?? "Halo {{customer}}, saatnya servis AC {{unit}}. Balas untuk jadwalkan. — {{usaha}}",
      {
        customer: asset?.customer?.name ?? "Pelanggan",
        unit: `${asset?.brand ?? ""} ${asset?.roomLocation ?? ""}`.trim() || "AC",
        usaha: tenant.name ?? "",
      },
    );
    revalidatePath("/demo");
    // demo=true menandakan ke UI bahwa ini simulasi (tak benar-benar terkirim)
    return { ok: true, demo: true, preview };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function actionCreateRepeatJob(reminderId: string) {
  const tenant = await getDemoTenant();
  if (!tenant) return { error: "Tenant demo tidak ada" };
  const owner = await prisma.user.findFirst({ where: { tenantId: tenant.id, role: "OWNER" } });
  try {
    const job = await createRepeatJob(tenant.id, reminderId, owner?.id ?? "system");
    revalidatePath("/demo");
    return { ok: true, jobId: job.id };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function actionCompleteJob(jobId: string) {
  const tenant = await getDemoTenant();
  if (!tenant) return { error: "Tenant demo tidak ada" };
  const tech = await prisma.user.findFirst({ where: { tenantId: tenant.id, role: "TECHNICIAN" } });
  try {
    // demo: paksa job ke IN_PROGRESS dulu (lewati alur teknisi penuh) lalu COMPLETE
    const job = await prisma.jobOrder.findFirst({ where: { id: jobId, tenantId: tenant.id } });
    if (!job) return { error: "Job tidak ada" };
    // set langsung IN_PROGRESS untuk demo (tanpa guard checklist di OTHER/kosong)
    if (job.status !== "IN_PROGRESS") {
      await prisma.jobOrder.update({ where: { id: job.id }, data: { status: "IN_PROGRESS" } });
    }
    const res = await transitionJob({
      tenantId: tenant.id, jobId, toStatus: "COMPLETED",
      actorId: tech?.id ?? "system", role: "TECHNICIAN",
      clientEventId: `demo-${jobId}-${Date.now()}`,
    });
    revalidatePath("/demo");
    return { ok: true, nextServiceDate: res.nextServiceDate };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
