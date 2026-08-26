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

/**
 * Kirim reminder WA per PELANGGAN (batch): 1 pesan untuk SEMUA unit yang due milik pelanggan itu.
 * Cegah banjir notifikasi bagi institusi ber-AC banyak. Semua reminder di grup ditandai SENT,
 * merujuk ke SATU MessageLog.
 *
 * items: daftar { reminder, asset } milik SATU pelanggan (sudah difilter due).
 */
export async function sendCustomerReminderWa(
  tenantId: string,
  customerId: string,
  reminderIds: string[],
) {
  // Ambil ulang reminder (guard tenant + status QUEUED, cegah dobel-kirim balapan).
  const reminders = await prisma.repeatReminder.findMany({
    where: { id: { in: reminderIds }, tenantId, status: "QUEUED" },
  });
  if (reminders.length === 0) return null;

  const assets = await prisma.asset.findMany({
    where: { id: { in: reminders.map((r) => r.assetId) }, tenantId },
    include: { customer: true },
  });
  const customer = assets[0]?.customer;
  if (!customer) throw new Error("Customer tidak ditemukan");

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const labelOf = (aId: string) => {
    const a = assets.find((x) => x.id === aId);
    if (!a) return "AC";
    return `${a.brand ?? ""} ${a.roomLocation ?? ""}`.trim() || "AC";
  };

  let body: string;
  if (reminders.length === 1) {
    const template = await prisma.messageTemplate.findUnique({
      where: { tenantId_key: { tenantId, key: "reminder" } },
    });
    body = renderTemplate(template?.body ?? "Halo {{customer}}, saatnya servis AC {{unit}}. Balas untuk jadwalkan. — {{usaha}}", {
      customer: customer.name,
      unit: labelOf(reminders[0].assetId),
      usaha: tenant?.name ?? "",
    });
  } else {
    // Versi banyak-unit: 1 pesan berisi daftar. Template key terpisah + fallback default.
    const template = await prisma.messageTemplate.findUnique({
      where: { tenantId_key: { tenantId, key: "reminder_multi" } },
    });
    const daftar = reminders.map((r) => `• ${labelOf(r.assetId)}`).join("\n");
    body = renderTemplate(
      template?.body ??
        "Halo {{customer}}, {{jumlah}} unit AC Anda sudah waktunya servis/cuci:\n{{daftar}}\n\nBalas pesan ini untuk jadwalkan. — {{usaha}}",
      {
        customer: customer.name,
        jumlah: String(reminders.length),
        daftar,
        usaha: tenant?.name ?? "",
      },
    );
  }

  const toPhone = normalizePhone(customer.phone);

  // SATU MessageLog + tandai SEMUA reminder di grup SENT (atomik).
  const [msg] = await prisma.$transaction([
    prisma.messageLog.create({
      data: {
        tenantId, customerId, channel: "WA", driver: tenant?.waDriver ?? "WEB",
        templateKey: reminders.length > 1 ? "reminder_multi" : "reminder",
        direction: "OUTBOUND", status: "QUEUED", toPhone, body,
      },
    }),
    prisma.repeatReminder.updateMany({
      where: { id: { in: reminders.map((r) => r.id) }, tenantId, status: "QUEUED" },
      data: { status: "SENT", sentAt: new Date() },
    }),
  ]);

  return { messageLogId: msg.id, toPhone, body, count: reminders.length };
}

/** Kirim reminder WA (SATU unit) — dipakai tombol manual per-reminder di dashboard/demo. */
export async function sendReminderWa(tenantId: string, reminderId: string) {
  const reminder = await prisma.repeatReminder.findFirst({ where: { id: reminderId, tenantId } });
  if (!reminder) throw new Error("Reminder tidak ditemukan");
  const asset = await prisma.asset.findUnique({ where: { id: reminder.assetId }, select: { customerId: true } });
  if (!asset) throw new Error("Asset tidak ditemukan");
  return sendCustomerReminderWa(tenantId, asset.customerId, [reminderId]);
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

/**
 * RUNNER money loop (dipanggil cron harian): untuk SEMUA tenant aktif,
 * kirim WA reminder untuk RepeatReminder yang due. Dikelompokkan PER PELANGGAN:
 * 1 pelanggan dengan banyak unit due di hari sama -> 1 pesan WA (cegah banjir notifikasi).
 * Idempoten: hanya proses QUEUED. Aman-gagal per grup.
 */
export async function runDueRemindersAllTenants(): Promise<{ tenants: number; sent: number; failed: number }> {
  const tenants = await prisma.tenant.findMany({
    where: { status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] } },
    select: { id: true },
  });

  let sent = 0;
  let failed = 0;
  for (const t of tenants) {
    const due = await listDueReminders(t.id);
    // Kelompokkan per pelanggan.
    const byCustomer = new Map<string, string[]>();
    for (const item of due) {
      const cId = item.asset?.customer?.id;
      if (!cId) continue;
      const arr = byCustomer.get(cId) ?? [];
      arr.push(item.reminder.id);
      byCustomer.set(cId, arr);
    }
    // Kirim 1 pesan per pelanggan (berisi semua unit due-nya).
    for (const [customerId, reminderIds] of byCustomer) {
      try {
        await sendCustomerReminderWa(t.id, customerId, reminderIds);
        sent += 1; // hitung per PESAN terkirim (bukan per unit)
      } catch (err) {
        failed += 1;
        console.error(`[reminder-runner] gagal tenant=${t.id} customer=${customerId}:`, err);
      }
    }
  }
  return { tenants: tenants.length, sent, failed };
}
