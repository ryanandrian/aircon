/**
 * Dunning Service — jalankan siklus penagihan & purge aman.
 * Dipanggil oleh cron harian. Semua durasi dari BillingPolicy (DB).
 * Penghapusan data BERTAHAP & AMAN: mark-for-deletion (reversible) lalu purge terpisah.
 */
import { prisma } from "@/lib/prisma";
import { getBillingPolicy } from "@/lib/billing/config";
import {
  daysLate,
  dunningAction,
  shouldSendReminderToday,
} from "@/lib/billing/dunning-pure";
import { renderTemplate, normalizePhone } from "@/lib/wa/gateway";

export interface DunningSummary {
  checked: number;
  movedPastDue: number;
  suspended: number;
  markedDelete: number;
  remindersSent: number;
}

/**
 * Siklus dunning harian. Untuk tenant dengan nextDueDate lewat:
 *  - tentukan aksi (none/suspend/delete) via kebijakan
 *  - update status + tandai; antre reminder WA sesuai jadwal
 * SECURITY: hanya dipanggil dari cron/endpoint terproteksi.
 */
export async function runDunningCycle(now: Date = new Date()): Promise<DunningSummary> {
  const policy = await getBillingPolicy();
  const summary: DunningSummary = {
    checked: 0, movedPastDue: 0, suspended: 0, markedDelete: 0, remindersSent: 0,
  };

  // Tenant yang punya jatuh tempo lewat & belum ditandai hapus.
  const tenants = await prisma.tenant.findMany({
    where: {
      nextDueDate: { lt: now },
      status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] },
      markedForDeletionAt: null,
    },
  });

  for (const t of tenants) {
    summary.checked++;
    const late = daysLate(t.nextDueDate, now);
    const action = dunningAction(late, policy);

    if (action === "delete") {
      // AMAN: tandai untuk dihapus (reversible bila bayar). Purge dilakukan terpisah.
      await prisma.tenant.update({
        where: { id: t.id },
        data: {
          status: "SUSPENDED",
          markedForDeletionAt: now,
          suspendedAt: t.suspendedAt ?? now,
        },
      });
      summary.markedDelete++;
      console.info(`[dunning] tenant ${t.id} ditandai hapus (telat ${late} hari)`);
    } else if (action === "suspend") {
      if (t.status !== "SUSPENDED") {
        await prisma.tenant.update({
          where: { id: t.id },
          data: { status: "SUSPENDED", suspendedAt: t.suspendedAt ?? now },
        });
        summary.suspended++;
      }
    } else {
      // Masih grace → tandai PAST_DUE (masih bisa login) bila belum.
      if (t.status !== "PAST_DUE") {
        await prisma.tenant.update({ where: { id: t.id }, data: { status: "PAST_DUE" } });
        summary.movedPastDue++;
      }
    }

    // Reminder WA (maks 1x/hari sesuai jadwal), termasuk peringatan khusus hari hapus.
    if (shouldSendReminderToday(late, policy.dunningReminderDays, t.lastDunningReminderAt, now)) {
      await queueDunningReminder(t.id, t.phone, t.name, late, policy.daysBeforeDelete, policy.deleteWarningDay);
      await prisma.tenant.update({
        where: { id: t.id },
        data: { lastDunningReminderAt: now },
      });
      summary.remindersSent++;
    }
  }

  return summary;
}

/** Antre pesan pengingat tunggakan ke wa-worker (MessageLog QUEUED). */
async function queueDunningReminder(
  tenantId: string,
  toPhone: string,
  tenantName: string,
  late: number,
  daysBeforeDelete: number,
  deleteWarningDay: number,
): Promise<void> {
  const sisaHapus = Math.max(daysBeforeDelete - late, 0);
  let body: string;
  if (late >= deleteWarningDay) {
    body = renderTemplate(
      "Halo {nama}, langganan Aircon Anda menunggak {telat} hari. PERINGATAN: bila tidak dibayar dalam {sisa} hari lagi, data usaha Anda akan dihapus permanen. Segera perpanjang untuk menghindari kehilangan data.",
      { nama: tenantName, telat: String(late), sisa: String(sisaHapus) },
    );
  } else {
    body = renderTemplate(
      "Halo {nama}, langganan Aircon Anda jatuh tempo dan menunggak {telat} hari. Mohon segera perpanjang agar layanan tidak terputus.",
      { nama: tenantName, telat: String(late) },
    );
  }

  await prisma.messageLog.create({
    data: {
      tenantId,
      channel: "WA",
      direction: "OUTBOUND",
      status: "QUEUED",
      toPhone: normalizePhone(toPhone),
      body,
    },
  });
}

/**
 * Purge tenant yang sudah ditandai hapus & tetap menunggak.
 * Dipanggil terpisah (cron), setelah masa tenggang mark-delete.
 * Menghapus seluruh data anak lalu tenant, dalam transaksi. Idempoten.
 */
export async function purgeMarkedTenants(now: Date = new Date()): Promise<{ purged: number; tenantIds: string[] }> {
  const marked = await prisma.tenant.findMany({
    where: { markedForDeletionAt: { lt: now, not: null }, status: "SUSPENDED" },
    select: { id: true, name: true },
  });

  const purged: string[] = [];
  for (const t of marked) {
    const id = t.id;
    // SECURITY: hapus semua child tenant-scoped lalu tenant, dalam satu transaksi.
    await prisma.$transaction([
      prisma.messageLog.deleteMany({ where: { tenantId: id } }),
      prisma.repeatReminder.deleteMany({ where: { tenantId: id } }),
      prisma.jobProgressEvent.deleteMany({ where: { job: { tenantId: id } } }),
      prisma.jobOrder.deleteMany({ where: { tenantId: id } }),
      prisma.asset.deleteMany({ where: { tenantId: id } }),
      prisma.customer.deleteMany({ where: { tenantId: id } }),
      prisma.invite.deleteMany({ where: { tenantId: id } }),
      prisma.payment.deleteMany({ where: { tenantId: id } }),
      prisma.iotOrderItem.deleteMany({ where: { order: { tenantId: id } } }),
      prisma.iotOrder.deleteMany({ where: { tenantId: id } }),
      prisma.technician.deleteMany({ where: { tenantId: id } }),
      prisma.messageTemplate.deleteMany({ where: { tenantId: id } }),
      prisma.checklistTemplate.deleteMany({ where: { tenantId: id } }),
      prisma.subscription.deleteMany({ where: { tenantId: id } }),
      prisma.user.deleteMany({ where: { tenantId: id } }),
      prisma.tenant.delete({ where: { id } }),
    ]);
    purged.push(id);
    console.info(`[dunning] PURGE tenant ${id} (${t.name}) — data dihapus permanen`);
  }
  return { purged: purged.length, tenantIds: purged };
}
