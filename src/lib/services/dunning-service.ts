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
  sisaHapusSebelumPurge,
} from "@/lib/billing/dunning-pure";
import { normalizePhone } from "@/lib/wa/gateway";
import { renderTenantCopy, resolveTenantCopy } from "@/lib/domain/tenant-copy";

/**
 * Masa tenggang purge (jam) — SATU sumber untuk dunning (perkiraan {sisa}) dan
 * purge (eksekusi). Nilai ini sebelumnya hardcode di purgeMarkedTenants saja,
 * sehingga copy {sisa} tidak tahu tenggat hapus yang sebenarnya.
 */
export const PURGE_GRACE_HOURS = 24;

export interface DunningSummary {
  checked: number;
  movedPastDue: number;
  suspended: number;
  markedDelete: number;
  remindersSent: number;
  /** Pesan yang DITAHAN karena nomor tujuan kosong (G28) — dicatat, bukan hilang. */
  remindersSuppressed: number;
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
    checked: 0, movedPastDue: 0, suspended: 0, markedDelete: 0,
    remindersSent: 0, remindersSuppressed: 0,
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
    let markedNow: Date | null = null; // ditandai hapus di run ini (untuk {sisa} akurat)
    summary.checked++;
    const late = daysLate(t.nextDueDate, now, t.timezone);
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
      // Baris baru saja ditandai di run INI → nilai lama (null) sudah kedaluwarsa;
      // perkiraan {sisa} harus memakai mark yang baru dibuat.
      markedNow = now;
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
    if (shouldSendReminderToday(late, policy.dunningReminderDays, t.lastDunningReminderAt, now, t.timezone)) {
      // {sisa} dihitung dari tenggat purge NYATA (N+1 untuk mark + 2 run purge),
      // bukan N-late yang meleset ~2 hari. Lihat sisaHapusSebelumPurge.
      const queued = await queueDunningReminder(t.id, t.phone, t.name, late, policy.daysBeforeDelete, policy.deleteWarningDay, {
        markedForDeletionAt: t.markedForDeletionAt ?? markedNow,
        purgeGraceHours: PURGE_GRACE_HOURS,
        nextDueDate: t.nextDueDate,
        now,
      });
      if (queued) {
        await prisma.tenant.update({
          where: { id: t.id },
          data: { lastDunningReminderAt: now },
        });
        summary.remindersSent++;
      } else {
        // Pesan ditahan (tanpa nomor). lastDunningReminderAt TIDAK di-update:
        // bila nomor diperbaiki, pengingat tetap terkirim pada run berikutnya.
        summary.remindersSuppressed += 1;
      }
    }
  }

  return summary;
}

/** Antre pesan pengingat tunggakan ke antrean WA (MessageLog QUEUED). Template dari BillingPolicy (editable admin). */
async function queueDunningReminder(
  tenantId: string,
  toPhone: string,
  tenantName: string,
  late: number,
  daysBeforeDelete: number,
  deleteWarningDay: number,
  purge: { markedForDeletionAt: Date | null; purgeGraceHours: number; nextDueDate: Date | null; now: Date },
): Promise<boolean> {
  const sisaHapus = sisaHapusSebelumPurge({
    markedForDeletionAt: purge.markedForDeletionAt,
    purgeGraceHours: purge.purgeGraceHours,
    nextDueDate: purge.nextDueDate,
    daysBeforeDelete,
    now: purge.now,
  });
  const policy = await getBillingPolicy();
  const vars = { nama: tenantName, telat: String(late), sisa: String(sisaHapus) };
  // G23: sumber copy = katalog platform (dapat diedit di Admin → Notifikasi);
  // kolom BillingPolicy = warisan, dipakai selama katalog belum diisi.
  const copyKey = late >= deleteWarningDay ? "dunningWarningTemplate" : "dunningReminderTemplate";
  const policyTemplate = late >= deleteWarningDay ? policy.dunningWarningTemplate : policy.dunningReminderTemplate;
  const { body: tpl, source } = await resolveTenantCopy(copyKey, policyTemplate);
  const body = renderTenantCopy(tpl, vars);
  if (source === "policy") {
    console.warn(`[dunning] copy "${copyKey}" belum ada di katalog platform — memakai kolom BillingPolicy (warisan)`);
  }

  const phone = normalizePhone(toPhone);
  if (!phone) {
    // G28: nomor tujuan kosong ⇒ pesan DITAHAN & DICATAT (status SUPPRESSED
    // + alasan), bukan antre sia-sia yang pasti gagal saat dispatch. Pesan tak
    // hilang diam-diam: operator bisa melihat & memperbaiki data kontak.
    await prisma.messageLog.create({
      data: {
        tenantId,
        channel: "WA",
        direction: "OUTBOUND",
        status: "SUPPRESSED",
        toPhone: null,
        body,
        suppressedReason: "nomor WhatsApp tujuan kosong",
      },
    });
    return false;
  }
  await prisma.messageLog.create({
    data: {
      tenantId,
      channel: "WA",
      direction: "OUTBOUND",
      status: "QUEUED",
      toPhone: phone,
      body,
    },
  });
  return true;
}

/**
 * Purge tenant yang sudah ditandai hapus & tetap menunggak.
 * MASA TENGGANG PURGE: hanya hapus tenant yang markedForDeletionAt lebih tua dari
 * `purgeGraceHours` (default 24 jam), sehingga mark (run hari-H) dan purge terjadi di
 * run BERBEDA — memberi jendela nyata untuk membayar sebelum data hilang permanen.
 * Dipanggil terpisah (cron). Transaksi child->tenant. Idempoten.
 */
/**
 * Hapus PERMANEN seluruh data satu tenant (child tenant-scoped lalu tenant), dalam satu transaksi.
 * Dipakai bersama oleh dunning (purgeMarkedTenants) & sweeper inaktivitas. Idempoten.
 * SECURITY: urutan hapus menghormati FK (anak dulu, tenant terakhir).
 *
 * TABEL YANG DICAKUP = semua tabel anak FK ke Tenant (RESTRICT harus dihapus dulu,
 * CASCADE ikut terhapus) + semua tabel ber-`tenantId` tanpa FK (fosil) + InvoiceItem
 * (FK ke Invoice). KELLENGKAPAN DITES OTOMATIS: tests/purge-completeness.test.ts
 * mem-parse schema.prisma dan menggagalkan test bila ada tabel baru terlewat.
 *
 * PENGECUALIAN SATU-SATUNYA: CommissionLedger sengaja TIDAK dihapus — buku besar
 * komisi APPEND-ONLY (audit keuangan; koreksi = baris reversal, lihat schema). Barisnya
 * jadi arsip tanpa tenant aktif; whitelist ini dipantau test kelengkapan.
 */
export async function purgeTenantData(id: string): Promise<void> {
  await prisma.$transaction([
    // — anak FK / tenantId terdalam lebih dulu —
    prisma.checklistResult.deleteMany({ where: { tenantId: id } }),
    prisma.invoiceItem.deleteMany({ where: { invoice: { tenantId: id } } }),
    prisma.invoice.deleteMany({ where: { tenantId: id } }),
    prisma.workItem.deleteMany({ where: { tenantId: id } }),
    prisma.workSession.deleteMany({ where: { tenantId: id } }),
    prisma.messageLog.deleteMany({ where: { tenantId: id } }),
    prisma.pushSubscription.deleteMany({ where: { tenantId: id } }),
    prisma.messageTemplate.deleteMany({ where: { tenantId: id } }),
    prisma.repeatReminder.deleteMany({ where: { tenantId: id } }),
    prisma.jobProgressEvent.deleteMany({ where: { tenantId: id } }),
    prisma.jobPhoto.deleteMany({ where: { tenantId: id } }),
    prisma.jobAssignment.deleteMany({ where: { tenantId: id } }),
    prisma.jobOrder.deleteMany({ where: { tenantId: id } }),
    prisma.customerPricing.deleteMany({ where: { tenantId: id } }),
    prisma.checklistTemplate.deleteMany({ where: { tenantId: id } }),
    prisma.serviceCatalog.deleteMany({ where: { tenantId: id } }),
    prisma.unitCode.deleteMany({ where: { tenantId: id } }),
    // Device → Telemetry/CommandLog duluan (FK RESTRICT ke Device).
    prisma.telemetry.deleteMany({ where: { tenantId: id } }),
    prisma.commandLog.deleteMany({ where: { tenantId: id } }),
    prisma.device.deleteMany({ where: { tenantId: id } }),
    prisma.asset.deleteMany({ where: { tenantId: id } }),
    prisma.customer.deleteMany({ where: { tenantId: id } }),
    prisma.invite.deleteMany({ where: { tenantId: id } }),
    prisma.payment.deleteMany({ where: { tenantId: id } }),
    prisma.couponRedemption.deleteMany({ where: { tenantId: id } }),
    prisma.iotOrderItem.deleteMany({ where: { order: { tenantId: id } } }),
    prisma.iotOrder.deleteMany({ where: { tenantId: id } }),
    prisma.technician.deleteMany({ where: { tenantId: id } }),
    prisma.subscription.deleteMany({ where: { tenantId: id } }),
    prisma.tenantAttribution.deleteMany({ where: { tenantId: id } }),
    // fosil tanpa FK (tetap milik tenant — kalau tak dihapus jadi data yatim)
    prisma.alert.deleteMany({ where: { tenantId: id } }),
    prisma.campaignRecipient.deleteMany({ where: { tenantId: id } }),
    prisma.campaign.deleteMany({ where: { tenantId: id } }),
    prisma.lead.deleteMany({ where: { tenantId: id } }),
    prisma.referral.deleteMany({ where: { tenantId: id } }),
    prisma.reviewRequest.deleteMany({ where: { tenantId: id } }),
    prisma.platformNotification.deleteMany({ where: { tenantId: id } }),
    prisma.tenantNotification.deleteMany({ where: { tenantId: id } }),
    prisma.user.deleteMany({ where: { tenantId: id } }),
    // CommissionLedger: TIDAK dihapus (lihat catatan fungsi — whitelist test).
    prisma.tenant.delete({ where: { id } }),
  ]);
}

export async function purgeMarkedTenants(
  now: Date = new Date(),
  purgeGraceHours: number = PURGE_GRACE_HOURS,
): Promise<{ purged: number; failed: number; tenantIds: string[] }> {
  const threshold = new Date(now.getTime() - purgeGraceHours * 3_600_000);
  const marked = await prisma.tenant.findMany({
    // SECURITY/SAFETY: hanya tenant yang ditandai LEBIH LAMA dari ambang & masih SUSPENDED.
    where: { markedForDeletionAt: { lt: threshold }, status: "SUSPENDED" },
    select: { id: true, name: true },
  });

  const purged: string[] = [];
  const failed: string[] = [];
  for (const t of marked) {
    // ISOLASI KEGAGALAN: 1 tenant gagal TIDAK boleh menggugurkan loop (dan TIDAK boleh
    // melempar ke pemanggil cron — route dunning menjalankan flush WA & platform notify
    // SETELAH fungsi ini; satu throw = langkah berikutnya gugur hari itu, tiap hari).
    try {
      await purgeTenantData(t.id);
      purged.push(t.id);
      console.info(`[dunning] PURGE tenant ${t.id} (${t.name}) — data dihapus permanen`);
    } catch (err) {
      failed.push(t.id);
      console.error(
        `[dunning] PURGE GAGAL tenant ${t.id} (${t.name}) — lanjut ke kandidat berikutnya:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return { purged: purged.length, failed: failed.length, tenantIds: purged };
}
