/**
 * RECONCILE TOOL (G29) — alat admin untuk MENEMUKAN pesan yang hilang/tak sengaja.
 *
 * SEMUA READ-ONLY. Tidak mengubah data; hasilnya daftar temuan berkategori:
 *  - suppressed: pesan ditahan karena penerima kosong (G28) — perbaiki kontak.
 *  - unknown: hasil kirim tak pasti — perlu review operator (G9/G10).
 *  - stale_queued: antrean menua > ambang — flusher/cron mungkin mati.
 *  - past_due_no_reminder: tenant menunggak TANPA pengingat — pengingat
 *    seharusnya terkirim tapi tidak (gap siklus, bukan salah operator).
 *  - failed_recent: kegagalan kirim 7 hari terakhir — cari pola.
 *  - wa_connected_no_phone: sesi WA tersambung TANPA nomor owner di data —
 *    pesan WA tak akan bisa dikirim walau sesi aktif.
 *
 * Dipanggil dari action admin (sudah lewat requirePlatformAdmin); hasilnya
 * juga ditulis ke PlatformAuditLog oleh action pemanggil bila perlu.
 */
import "server-only";
import { prisma } from "@/lib/prisma";

export type ReconcileFinding =
  | { kind: "past_due_no_reminder"; tenantId: string; tenantName: string; detail: string }
  | { kind: "stale_queued"; tenantId: string; tenantName: string; detail: string }
  | { kind: "wa_connected_no_phone"; tenantId: string; tenantName: string; detail: string };

export interface ReconcileReport {
  checks: string[];
  findings: ReconcileFinding[];
  stats: {
    messageLog: { queued: number; sending: number; sent: number; delivered: number; read: number; unknown: number; suppressed: number; failed7d: number };
    platformNotification: { queuedOld: number; sent: number; delivered: number; read: number; unknown: number; suppressed: number };
  };
  ok: boolean;
}

/** Umur antrean dianggap menua (jam). */
const STALE_QUEUED_HOURS = 1;

export async function runNotificationReconcile(): Promise<ReconcileReport> {
  const findings: ReconcileFinding[] = [];
  const now = new Date();

  // ── Statistik antrean ─────────────────────────────────────────────────────
  const [mlGrouped, pnGrouped] = await Promise.all([
    prisma.messageLog.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.platformNotification.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const ml = (s: string) => mlGrouped.find((g) => g.status === s)?._count._all ?? 0;
  const pn = (s: string) => pnGrouped.find((g) => g.status === s)?._count._all ?? 0;

  const failed7d = await prisma.messageLog.count({
    where: { status: "FAILED", at: { gte: new Date(now.getTime() - 7 * 86_400_000) } },
  });

  const stats = {
    messageLog: {
      queued: ml("QUEUED"), sending: ml("SENDING"), sent: ml("SENT"),
      delivered: ml("DELIVERED"), read: ml("READ_CONFIRMED") + ml("READ_UNOBSERVED"),
      unknown: ml("UNKNOWN"), suppressed: ml("SUPPRESSED"), failed7d,
    },
    platformNotification: {
      queuedOld: 0, sent: pn("SENT"), delivered: pn("DELIVERED"),
      read: pn("READ_CONFIRMED") + pn("READ_UNOBSERVED"),
      unknown: pn("UNKNOWN"), suppressed: pn("SUPPRESSED"),
    },
  };

  // ── 1) Antrean menua (tenant → pelanggan) ────────────────────────────────
  const staleBefore = new Date(now.getTime() - STALE_QUEUED_HOURS * 3_600_000);
  const staleQueued = await prisma.messageLog.findMany({
    where: { status: "QUEUED", at: { lt: staleBefore }, channel: "WA" },
    select: { tenantId: true, at: true },
    take: 20,
  });
  const pnQueuedOld = await prisma.platformNotification.count({
    where: { status: "QUEUED", createdAt: { lt: staleBefore } },
  });
  stats.platformNotification.queuedOld = pnQueuedOld;
  if (staleQueued.length > 0) {
    // Sekali per tenant (cukup sinyal, bukan daftar penuh).
    const tenantIds = [...new Set(staleQueued.map((r) => r.tenantId))];
    for (const tenantId of tenantIds) {
      findings.push({
        kind: "stale_queued", tenantId, tenantName: tenantId,
        detail: `Ada pesan WA tenant antre lebih dari ${STALE_QUEUED_HOURS} jam — flusher/cron mungkin mati`,
      });
    }
  }

  // ── 2) Tenant menunggak tanpa pengingat terkirim ────────────────────────
  // Tenant dengan nextDueDate lewat (status ACTIVE/PAST_DUE) yang TIDAK punya
  // MessageLog dunning terkirim setelah due date.
  const lateTenants = await prisma.tenant.findMany({
    where: { status: { in: ["ACTIVE", "PAST_DUE"] }, nextDueDate: { lt: now } },
    select: { id: true, name: true, nextDueDate: true },
    take: 50,
  });
  for (const t of lateTenants) {
    const sent = await prisma.messageLog.count({
      where: {
        tenantId: t.id,
        channel: "WA",
        direction: "OUTBOUND",
        status: { in: ["SENT", "DELIVERED", "READ_CONFIRMED", "READ_UNOBSERVED", "SENDING"] },
        at: { gte: t.nextDueDate ?? new Date() },
      },
    });
    if (sent === 0) {
      findings.push({
        kind: "past_due_no_reminder", tenantId: t.id, tenantName: t.name,
        detail: `Menunggak sejak ${t.nextDueDate?.toISOString().slice(0, 10)} — TIDAK ada pengingat yang terkirim`,
      });
    }
  }

  // ── 3) Sesi WA tersambung tapi nomor owner kosong ────────────────────────
  const connectedNoPhone = await prisma.tenant.findMany({
    where: { waVerifiedPhone: { not: null }, phone: "" },
    select: { id: true, name: true },
    take: 20,
  });
  for (const t of connectedNoPhone) {
    findings.push({
      kind: "wa_connected_no_phone", tenantId: t.id, tenantName: t.name,
      detail: "Sesi WA aktif tapi nomor WA owner kosong — pesan WA tak akan bisa dikirim",
    });
  }

  const checks = [
    "antrean menua (stale_queued)",
    "menunggak tanpa pengingat (past_due_no_reminder)",
    "sesi WA aktif tanpa nomor owner (wa_connected_no_phone)",
  ];

  return {
    checks,
    findings,
    stats,
    ok: findings.length === 0,
  };
}