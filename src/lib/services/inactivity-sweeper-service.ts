/**
 * Sweeper AKUN TIDAK AKTIF — untuk tenant gratis/telantar (coba-coba lalu ditinggal).
 *
 * Berbeda dari dunning (yang berbasis TELAT BAYAR). Ini berbasis INAKTIVITAS:
 *  - "aktivitas" dihitung dari DATA NYATA (pekerjaan/invoice/pelanggan/sesi kerja/login teknisi
 *    terakhir), bukan sekadar buka halaman → tahan diakali & bekerja retroaktif.
 *  - Alur (semua ambang EDITABLE ADMIN via BillingPolicy, no hardcode):
 *      hari R1 tak aktif → reminder #1
 *      hari R2 tak aktif → reminder #2 (peringatan hapus)
 *      hari D  tak aktif → HAPUS PERMANEN (reuse purge tenant)
 *  - Aktivitas kembali kapan saja → stage reset (batal hapus).
 *  - Pengecualian: pernah bayar, atau punya >= N pelanggan / >= N pekerjaan (usaha nyata).
 *  - dryRun (default true): hanya LOG calon hapus, tidak menghapus apa pun.
 *
 * SAFETY: master switch default OFF. Purge reuse purgeTenantData (transaksi child->tenant).
 */
import { prisma } from "@/lib/prisma";
import { getBillingPolicy } from "@/lib/billing/config";
import { purgeTenantData } from "@/lib/services/dunning-service";

export interface InactivitySweepSummary {
  enabled: boolean;
  dryRun: boolean;
  scanned: number;
  reminder1Sent: number;
  reminder2Sent: number;
  reset: number;
  deleted: number;
  wouldDelete: number;         // dryRun: berapa yang AKAN dihapus
  deletedTenantIds: string[];
}

const DAY_MS = 86_400_000;
const daysSince = (d: Date | null, now: Date) => (d ? Math.floor((now.getTime() - d.getTime()) / DAY_MS) : Infinity);

export type InactivityAction = "none" | "reset" | "reminder1" | "reminder2" | "delete";

/**
 * Keputusan MURNI (mudah diuji): apa yang harus dilakukan atas tenant berdasarkan
 * hari-tak-aktif, stage reminder terakhir, status pengecualian, dan ambang config.
 * Tidak menyentuh DB. Prioritas: aktif→reset, exempt→none/reset, delete, reminder2, reminder1.
 */
export function decideInactivityAction(params: {
  idleDays: number;
  stage: number;        // 0=belum, 1=reminder1 terkirim, 2=reminder2 terkirim
  exempt: boolean;
  r1: number; r2: number; del: number;
}): InactivityAction {
  const { idleDays, stage, exempt, r1, r2, del } = params;
  if (idleDays < r1) return stage !== 0 ? "reset" : "none";
  if (exempt) return stage !== 0 ? "reset" : "none";
  if (idleDays >= del) return "delete";
  if (idleDays >= r2 && stage < 2) return "reminder2";
  if (idleDays >= r1 && stage < 1) return "reminder1";
  return "none";
}

/** Hitung aktivitas NYATA terakhir tenant dari beberapa sumber data. */
export async function computeLastActivity(tenantId: string): Promise<Date | null> {
  const [job, inv, cust, ws, login, tenant] = await Promise.all([
    prisma.jobOrder.findFirst({ where: { tenantId }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    prisma.invoice.findFirst({ where: { tenantId }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    prisma.customer.findFirst({ where: { tenantId }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    prisma.workSession.findFirst({ where: { tenantId }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    prisma.user.findFirst({ where: { tenantId, lastLoginAt: { not: null } }, orderBy: { lastLoginAt: "desc" }, select: { lastLoginAt: true } }),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { createdAt: true } }),
  ]);
  const times = [
    job?.updatedAt, inv?.updatedAt, cust?.updatedAt, ws?.updatedAt, login?.lastLoginAt, tenant?.createdAt,
  ].filter(Boolean).map((d) => (d as Date).getTime());
  if (times.length === 0) return null;
  return new Date(Math.max(...times));
}

/** Apakah tenant DIKECUALIKAN dari auto-hapus (usaha nyata / pernah bayar)? */
async function isExempt(tenantId: string, minCustomers: number, minJobs: number, exemptPaid: boolean): Promise<boolean> {
  if (exemptPaid) {
    const paid = await prisma.payment.count({ where: { tenantId, status: "PAID" } }).catch(() => 0);
    if (paid > 0) return true;
  }
  const [nCust, nJob] = await Promise.all([
    prisma.customer.count({ where: { tenantId } }),
    prisma.jobOrder.count({ where: { tenantId } }),
  ]);
  if (minCustomers > 0 && nCust >= minCustomers) return true;
  if (minJobs > 0 && nJob >= minJobs) return true;
  return false;
}

function fillTpl(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

/** Antre reminder inaktivitas ke antrean WA (MessageLog QUEUED). */
async function queueInactivityReminder(tenantId: string, toPhone: string, body: string): Promise<void> {
  if (!toPhone) return;
  await prisma.messageLog.create({
    data: { tenantId, toPhone, channel: "WA", direction: "OUTBOUND", templateKey: "INACTIVITY", body, status: "QUEUED" },
  }).catch((e) => { console.error("[sweeper] gagal antre reminder:", e?.message); });
}

/**
 * Jalankan satu siklus sweeper inaktivitas. Idempoten; aman dipanggil harian dari cron.
 * TIDAK menghapus bila dryRun=true atau enabled=false.
 */
export async function runInactivitySweep(now: Date = new Date()): Promise<InactivitySweepSummary> {
  const p = await getBillingPolicy();
  const summary: InactivitySweepSummary = {
    enabled: p.inactivitySweepEnabled, dryRun: p.inactivityDryRun,
    scanned: 0, reminder1Sent: 0, reminder2Sent: 0, reset: 0, deleted: 0, wouldDelete: 0, deletedTenantIds: [],
  };
  if (!p.inactivitySweepEnabled) return summary;

  const R1 = p.inactivityReminder1Days;
  const R2 = p.inactivityReminder2Days;
  const DEL = p.inactivityDeleteDays;

  // Hanya tenant yang BUKAN dalam alur dunning berbayar (nextDueDate null = gratis/tak menunggak),
  // dan belum ditandai hapus oleh dunning. Status hidup.
  const tenants = await prisma.tenant.findMany({
    where: {
      nextDueDate: null,
      markedForDeletionAt: null,
      status: { in: ["TRIAL", "ACTIVE"] },
    },
    select: { id: true, name: true, phone: true, inactivityReminderStage: true, inactivityReminderAt: true },
  });

  for (const t of tenants) {
    summary.scanned++;
    const last = await computeLastActivity(t.id);
    const idle = daysSince(last, now);
    const exempt = idle >= R1 ? await isExempt(t.id, p.inactivityMinCustomers, p.inactivityMinJobs, p.inactivityExemptPaid) : false;
    const action = decideInactivityAction({ idleDays: idle, stage: t.inactivityReminderStage, exempt, r1: R1, r2: R2, del: DEL });

    if (action === "reset") {
      await prisma.tenant.update({ where: { id: t.id }, data: { inactivityReminderStage: 0, inactivityReminderAt: null } });
      summary.reset++;
    } else if (action === "delete") {
      if (p.inactivityDryRun) {
        summary.wouldDelete++;
        console.info(`[sweeper][DRY-RUN] AKAN hapus tenant ${t.id} (${t.name}) — idle ${idle} hari`);
      } else {
        await purgeTenantData(t.id);
        summary.deleted++;
        summary.deletedTenantIds.push(t.id);
        console.info(`[sweeper] HAPUS PERMANEN tenant ${t.id} (${t.name}) — idle ${idle} hari`);
      }
    } else if (action === "reminder2") {
      const sisa = Math.max(DEL - idle, 0);
      const body = fillTpl(p.inactivityReminder2Template, { nama: t.name, hari: String(idle), sisa: String(sisa) });
      await queueInactivityReminder(t.id, t.phone, body);
      await prisma.tenant.update({ where: { id: t.id }, data: { inactivityReminderStage: 2, inactivityReminderAt: now } });
      summary.reminder2Sent++;
    } else if (action === "reminder1") {
      const body = fillTpl(p.inactivityReminder1Template, { nama: t.name, hari: String(idle), sisa: String(Math.max(DEL - idle, 0)) });
      await queueInactivityReminder(t.id, t.phone, body);
      await prisma.tenant.update({ where: { id: t.id }, data: { inactivityReminderStage: 1, inactivityReminderAt: now } });
      summary.reminder1Sent++;
    }
  }

  return summary;
}
