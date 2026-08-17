"use server";

import { getDemoTenant } from "@/lib/demo";
import { sendReminderWa, createRepeatJob } from "@/lib/services/reminder-service";
import { transitionJob } from "@/lib/services/job-service";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function actionSendReminder(reminderId: string) {
  const tenant = await getDemoTenant();
  if (!tenant) return { error: "Tenant demo tidak ada" };
  try {
    const res = await sendReminderWa(tenant.id, reminderId);
    revalidatePath("/demo");
    return { ok: true, ...res };
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
