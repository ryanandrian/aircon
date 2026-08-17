/**
 * Reminder Service — sisi output money loop.
 * List reminder due, kirim WA (antre ke wa-worker), buat repeat job.
 */
import { prisma } from "@/lib/prisma";
import { renderTemplate, normalizePhone } from "@/lib/wa/gateway";

/** Reminder yang sudah waktunya ditindak (lead time terlewati, status QUEUED). */
export async function listDueReminders(tenantId: string) {
  const today = new Date();
  const reminders = await prisma.repeatReminder.findMany({
    where: { tenantId, status: "QUEUED" },
    orderBy: { dueDate: "asc" },
  });
  // filter due berdasarkan leadTime
  const due = reminders.filter((r) => {
    const trigger = new Date(r.dueDate);
    trigger.setDate(trigger.getDate() - r.leadTimeDays);
    return trigger.getTime() <= today.getTime();
  });
  // enrich dengan asset + customer
  const enriched = await Promise.all(
    due.map(async (r) => {
      const asset = await prisma.asset.findUnique({
        where: { id: r.assetId },
        include: { customer: true },
      });
      return { reminder: r, asset };
    }),
  );
  return enriched;
}

/** Kirim reminder WA: render template, antre ke MessageLog (driver WEB), tandai reminder SENT. */
export async function sendReminderWa(tenantId: string, reminderId: string) {
  const reminder = await prisma.repeatReminder.findFirst({ where: { id: reminderId, tenantId } });
  if (!reminder) throw new Error("Reminder tidak ditemukan");

  const asset = await prisma.asset.findUnique({
    where: { id: reminder.assetId },
    include: { customer: true },
  });
  if (!asset?.customer) throw new Error("Customer tidak ditemukan");

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const template = await prisma.messageTemplate.findUnique({
    where: { tenantId_key: { tenantId, key: "reminder" } },
  });
  const body = renderTemplate(template?.body ?? "Halo {{customer}}, saatnya servis AC. — {{usaha}}", {
    customer: asset.customer.name,
    unit: `${asset.brand ?? ""} ${asset.roomLocation ?? ""}`.trim() || "AC",
    usaha: tenant?.name ?? "",
  });

  const toPhone = normalizePhone(asset.customer.phone);

  // Antre ke wa-worker (driver WEB) + tandai reminder SENT
  const [msg] = await prisma.$transaction([
    prisma.messageLog.create({
      data: {
        tenantId, customerId: asset.customer.id, channel: "WA", driver: tenant?.waDriver ?? "WEB",
        templateKey: "reminder", direction: "OUTBOUND", status: "QUEUED", toPhone, body,
      },
    }),
    prisma.repeatReminder.update({ where: { id: reminder.id }, data: { status: "SENT", sentAt: new Date() } }),
  ]);

  return { messageLogId: msg.id, toPhone, body };
}

/** Buat repeat job dari reminder (prefill dari job sebelumnya di asset yang sama). */
export async function createRepeatJob(tenantId: string, reminderId: string, createdById: string) {
  const reminder = await prisma.repeatReminder.findFirst({ where: { id: reminderId, tenantId } });
  if (!reminder) throw new Error("Reminder tidak ditemukan");

  const asset = await prisma.asset.findUnique({ where: { id: reminder.assetId } });
  if (!asset) throw new Error("Asset tidak ditemukan");

  // Ambil job terakhir di asset ini sebagai template prefill
  const lastJob = await prisma.jobOrder.findFirst({
    where: { tenantId, assetId: asset.id, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
  });

  const job = await prisma.$transaction(async (tx) => {
    const created = await tx.jobOrder.create({
      data: {
        tenantId, customerId: asset.customerId, assetId: asset.id,
        serviceType: lastJob?.serviceType ?? "CLEANING",
        status: "DRAFT", source: "REPEAT",
        price: lastJob?.price ?? null,
        parentJobId: lastJob?.id ?? null,
        createdById,
      },
    });
    await tx.repeatReminder.update({
      where: { id: reminder.id },
      data: { status: "CONVERTED", jobId: created.id },
    });
    return created;
  });

  return job;
}
