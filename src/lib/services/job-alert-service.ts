/**
 * ALERT KEGAGALAN JOB — F3/G21/G30/F6.
 *
 * PRINSIP: kegagalan cron tak boleh hilang diam-diam. Tadi: cron gagal →
 * hanya journal systemd + HTTP 500 (run-cron.sh `curl -fsS` → exit non-zero).
 * Operator harus tahu TANPA harus cek journal manual.
 *
 * KANAL (masing-masing independen — satu gagal tak menggagalkan lain):
 *  1. `PlatformAuditLog` — JEJAK PASTI (kanal ke admin platform yang dijamin
 *     ada: tabel ini sudah dipakai audit replay/rollback/reconcile). Selalu
 *     ditulis bila ada kegagalan.
 *  2. EMAIL ke admin platform aktif (SMTP yang sudah ada) — Opsional,
 *     terkonfigurasi; gagal → hanya log, TIDAK menggagalkan job.
 *
 * CATATAN kenapa TIDAK pakai `PlatformNotification`: CHECK constraint
 * `PlatformNotification_target_check` mewajibkan tepat satu target
 * (tenant / agent / reseller). Alert internal platform tak punya penerima
 * eksternal ⇒ tak boleh membuat baris itu (akan ditolak DB). Jejak +
 * email sudah cukup, dan Admin → Notifikasi membaca `PlatformAuditLog`.
 *
 * ANTI-SPAM: satu alert per (job, hari) — cron harian yang gagal tiap jam
 * tak boleh mengirim email tiap jam. Dedupe via `dedupeKey` unik di
 * `PlatformNotification` + pengecekan audit log pada hari yang sama.
 *
 * Anti-loop:menyebut "cron" tak boleh memicu cron. Fungsi ini murni
 * menulis DB + mengirim email; tak memanggil endpoint cron.
 */
import "server-only";
import { prisma } from "@/lib/prisma";

export interface JobFailureAlertInput {
  /** Nama job/endpoint, mis. "dunning", "reminders", "reconcile". */
  job: string;
  /** Nama tahap yang gagal (bila ada), mis. "purge". */
  stage?: string;
  /** Pesan error (dipotong agar aman disimpan). */
  error: string;
  /** Ringkasan tambahan (JSON-serializable). */
  details?: Record<string, unknown>;
  /**
   * Kunci hari untuk dedupe harian. Default = hari UTC. Pemantau harian yang
   * berjalan pada zona WIB wajib mengoper key WIB-nya sendiri, karena WIB 03:00
   * = UTC 20:00 hari sebelumnya — bila tidak, alert hari ini menelan alert
   * besok (dedupe salah hari) dan email asli tak pernah terkirim.
   */
  dayKey?: string;
}

export interface JobFailureAlertResult {
  /** Jejak audit tersimpan? (kanal yang dijamin ada) */
  audited: boolean;
  /** Email terkirim ke berapa admin? */
  emailed: number;
  /** Alasan kegagalan (kalau ada). */
  problems: string[];
}

/** Potong error agar muat & aman disimpan. */
function clip(text: string, max = 500): string {
  const s = String(text ?? "").slice(0, max);
  return s;
}


const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Kunci hari WIB (YYYY-MM-DD). Semua cron Aircon dijadwalkan dalam WIB. */
export function jakartaDayKey(date: Date = new Date()): string {
  return new Date(date.getTime() + JAKARTA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Menit sejak tengah malam WIB. */
function jakartaMinutesOfDay(date: Date): number {
  const shifted = new Date(date.getTime() + JAKARTA_OFFSET_MS);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

/** Outcome heartbeat dunning. */
export type DunningHeartbeatOutcome = "success" | "failed";

/**
 * Record bahwa cron dunning SUDAH DIJALANKAN (bukan: bahwa semua tahap
 * sukses). Ditulis di akhir route apa pun hasil tahapnya, karena pemantau
 * no-run perlu membedakan dua keadaan yang berbeda:
 *   - cron jalan → heartbeat ada (tahap gagal sudah alerting sendiri per tahap)
 *   - cron tak jalan / proses mati di tengah → heartbeat tak ada (alert no-run)
 * Tanpa pembedaan ini, cron yang jalan tapi satu tahap gagal akan mendapat
 * DUA email (satu per tahap, satu lagi "no-run") — alarm palsu.
 */
export async function recordDunningHeartbeat(now = new Date(), outcome: DunningHeartbeatOutcome = "success", failedStages: string[] = []): Promise<void> {
  const dayKey = jakartaDayKey(now);
  await prisma.platformAuditLog.create({
    data: {
      actor: "system:cron-heartbeat",
      action: "CRON_DUNNING_HEARTBEAT",
      target: `cron-heartbeat:dunning:${dayKey}`,
      metadata: {
        completedAt: now.toISOString(),
        timezone: "Asia/Jakarta",
        outcome,
        failedStages,
      },
    },
  });
}

/**
 * Dipanggil oleh timer reconcile yang SUDAH ADA (03:00 WIB). Alert bila cron
 * dunning hari ini tak pernah jalan. Dead-man switch harus "armed" dulu: tanpa
 * pernah ada heartbeat historis, monitor belum pernah bisa melihat run sukses,
 * jadi tak boleh menuduh cron tak jalan (mis. hari pertama rilis, dunning 01:00
 * jalan sebelum monitor live — kasus nyata 29 Okt 2026).
 *
 * Dedupe harian memakai key WIB, bukan UTC: WIB 03:00 = UTC 20:00 hari
 * sebelumnya, sehingga key UTC untuk "hari yang sama" bergeser dan alert hari
 * ini bisa menelan alert asli besok (email asli tak pernah terkirim).
 */
export async function alertIfDunningHeartbeatMissing(
  now = new Date(),
): Promise<{ missing: boolean; audited: boolean; emailed: number; reason: string | null }> {
  const dayKey = jakartaDayKey(now);
  // Jendela pemeriksaan: dunning terjadwal 01:00, reconcile 03:00. Pemeriksaan
  // sebelum 03:00 tak boleh menuduh cron tak jalan (dunning mungkin belum jalan).
  if (jakartaMinutesOfDay(now) < 3 * 60) {
    return { missing: false, audited: false, emailed: 0, reason: null };
  }
  const heartbeat = await prisma.platformAuditLog.findFirst({ where: { target: `cron-heartbeat:dunning:${dayKey}` } });
  if (heartbeat) {
    // Cron hari ini sudah jalan. Bila tahapnya gagal, kegagalan itu sudah
    // dialerkan sendiri oleh alertJobFailure per tahap — jangan dobelkan.
    return { missing: false, audited: false, emailed: 0, reason: null };
  }
  // Armed-check: monitor harus pernah melihat run sukses sebelum boleh menuduh.
  const armed = await prisma.platformAuditLog.findFirst({
    where: { target: { startsWith: "cron-heartbeat:dunning:" } },
  });
  if (!armed) {
    return { missing: true, audited: false, emailed: 0, reason: "monitor-belum-terbukti" };
  }
  const alert = await alertJobFailure({
    job: "dunning-no-run",
    error: `Tidak ada heartbeat sukses cron dunning hingga ${now.toISOString()} (tanggal WIB ${dayKey}).`,
    details: { dayKey, checkedAt: now.toISOString(), timezone: "Asia/Jakarta" },
    dayKey,
  });
  return { missing: true, audited: alert.audited, emailed: alert.emailed, reason: null };
}

export interface StaleQueueAlertResult {
  audited: boolean;
  emailed: number;
  queueAlerts: number;
  problems: string[];
  staleQueued: number;
  staleSending: number;
  staleMessageLogQueued: number;
  staleMessageLogSending: number;
}

/**
 * Read-only scan untuk alert antrean lama (F3). Tidak mengubah status antrean,
 * tidak mengirim ulang pesan, tidak menyentuh provider.
 * Snapshot agregat dicatat harian agar satu antrean basi tidak spam admin.
 */
export async function alertStaleNotificationQueues(
  now = new Date(),
  staleMinutes = 60,
): Promise<StaleQueueAlertResult> {
  const result: StaleQueueAlertResult = {
    audited: false, emailed: 0, queueAlerts: 0, problems: [],
    staleQueued: 0, staleSending: 0, staleMessageLogQueued: 0, staleMessageLogSending: 0,
  };
  const thresholdMinutes = Math.max(5, staleMinutes);
  const cutoff = new Date(now.getTime() - thresholdMinutes * 60_000);
  try {
    const [queued, sending, messageLogQueued, messageLogSending] = await Promise.all([
      prisma.platformNotification.count({
        where: { status: "QUEUED", createdAt: { lt: cutoff } },
      }),
      prisma.platformNotification.count({
        where: { status: "SENDING", OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }] },
      }),
      prisma.messageLog.count({
        where: { direction: "OUTBOUND", status: "QUEUED", at: { lt: cutoff } },
      }),
      prisma.messageLog.count({
        where: { direction: "OUTBOUND", status: "SENDING", OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }] },
      }),
    ]);
    result.staleQueued = queued;
    result.staleSending = sending;
    result.staleMessageLogQueued = messageLogQueued;
    result.staleMessageLogSending = messageLogSending;
  } catch (e) {
    result.problems.push(`scan: ${e instanceof Error ? e.message : String(e)}`);
    console.error("[job-alert] queue scan gagal:", result.problems[0]);
    return result;
  }

  if (result.staleQueued + result.staleSending + result.staleMessageLogQueued + result.staleMessageLogSending === 0) return result;

  const dayKey = now.toISOString().slice(0, 10);
  const counts = {
    staleQueued: result.staleQueued,
    staleSending: result.staleSending,
    staleMessageLogQueued: result.staleMessageLogQueued,
    staleMessageLogSending: result.staleMessageLogSending,
  };
  const target = `stale-notification-queues:${dayKey}`;
  let isFirstAlertToday = false;
  try {
    const previous = await prisma.platformAuditLog.findFirst({ where: { target } });
    isFirstAlertToday = !previous;
    if (!previous) {
      await prisma.platformAuditLog.create({
        data: {
          actor: "system:job-alert",
          action: "STALE_NOTIFICATION_QUEUE_ALERT",
          target,
          metadata: { ...counts, cutoff: cutoff.toISOString(), observedAt: now.toISOString() },
        },
      });
    }
    result.audited = true;
  } catch (e) {
    result.problems.push(`audit: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (isFirstAlertToday) {
    try {
      const admins = await prisma.platformAdmin.findMany({ where: { active: true }, select: { email: true } });
      if (admins.length) {
        const { sendEmail, isEmailConfigured } = await import("@/lib/email/smtp");
        if (isEmailConfigured()) {
          const body = [
            "Antrean notifikasi membutuhkan pemeriksaan operator.",
            `QUEUED platform > ${thresholdMinutes} menit: ${result.staleQueued}`,
            `SENDING platform tanpa lease / lease kedaluwarsa: ${result.staleSending}`,
            `QUEUED tenant MessageLog > ${thresholdMinutes} menit: ${result.staleMessageLogQueued}`,
            `SENDING tenant MessageLog tanpa lease / lease kedaluwarsa: ${result.staleMessageLogSending}`,
            `Waktu observasi: ${now.toISOString()}`,
            "Tidak ada status yang diubah dan tidak ada pesan yang dikirim ulang oleh pemeriksaan ini.",
            "Tinjau Admin → Notifikasi dan journal sebelum melakukan replay.",
          ].join("\n");
          for (const admin of admins) {
            const sent = await sendEmail(admin.email, `[Aircon] Antrean notifikasi stale — ${dayKey}`, body);
            if (sent.ok) result.emailed += 1;
            else result.problems.push(`email: ${sent.error ?? "gagal"}`);
          }
        }
      }
    } catch (e) {
      result.problems.push(`email: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (result.problems.length) console.error("[job-alert] stale queue alert partial failure:", result.problems.join("; "));
  result.queueAlerts = result.audited ? 1 : 0;
  return result;
}

/**
 * Kirim alert kegagalan job.
 *
 * Aman dipanggil dari mana saja: TIDAK pernah melempar error (kegagalan
 * alert tak boleh menjatuhkan job yang sedang gagal).
 */
export async function alertJobFailure(input: JobFailureAlertInput): Promise<JobFailureAlertResult> {
  const result: JobFailureAlertResult = { audited: false, emailed: 0, problems: [] };
  const job = String(input.job ?? "job").trim() || "job";
  const stage = input.stage ? String(input.stage) : null;
  const error = clip(input.error || "tanpa pesan error");

  // ── 1) JEJAK AUDIT (dijamin ada) ────────────────────────────────────────
  // Dedupe harian: satu baris audit per (job, tahap, hari). Cron harian yang
  // gagal berkali-kali tak boleh menumpuk baris audit tiap jam.
  const dayKey = input.dayKey ?? new Date().toISOString().slice(0, 10);
  const auditTarget = `job-failure:${job}:${stage ?? "-"}:${dayKey}`;
  /** True bila ini alert PERTAMA untuk job+tahap hari ini (dasar anti-spam). */
  let isFirstAlertToday = false;
  try {
    const dup = await prisma.platformAuditLog.findFirst({ where: { target: auditTarget } });
    isFirstAlertToday = !dup;
    if (!dup) {
      await prisma.platformAuditLog.create({
        data: {
          actor: "system:job-alert",
          action: "JOB_FAILURE_ALERT",
          target: auditTarget,
          metadata: {
            job,
            stage: stage ?? null,
            error,
            details: (input.details ?? {}) as never,
          },
        },
      });
    }
    result.audited = true;
  } catch (e) {
    result.problems.push(`audit: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── 2) EMAIL KE ADMIN PLATFORM (opsional) ───────────────────────────────
  // Satu email per job per hari (dedupe baris audit di atas = penanda hari ini
  // sudah dialerkan). Kegagalan email tak menggagalkan yang lain.
  // Email HANYA bila alert ini yang pertama hari ini (anti-spam: cron harian
  // yang gagal berkali-kali tak boleh email tiap jam).
  if (isFirstAlertToday) {
    try {
      const admins = await prisma.platformAdmin.findMany({
        where: { active: true },
        select: { email: true },
      });
      if (admins.length > 0) {
        const { sendEmail, isEmailConfigured } = await import("@/lib/email/smtp");
        if (isEmailConfigured()) {
          const subject = `[Aircon] Job ${job} gagal — ${dayKey}`;
          const body = [
            `Job cron "${job}" gagal.`,
            stage ? `Tahap: ${stage}` : null,
            `Waktu: ${new Date().toISOString()}`,
            `Error: ${error}`,
            input.details && Object.keys(input.details).length ? `Detail: ${JSON.stringify(input.details)}` : null,
            "",
            "Cek: journalctl -u aircon-app | tail -50",
            "Admin → Notifikasi: Jalankan Rekonsiliasi untuk melihat antrean bermasalah.",
          ].filter(Boolean).join("\n");
          for (const a of admins) {
            const r = await sendEmail(a.email, subject, body);
            if (r.ok) result.emailed += 1;
            else result.problems.push(`email ${a.email}: ${r.error ?? "gagal"}`);
          }
        }
      }
    } catch (e) {
      result.problems.push(`email: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (result.problems.length > 0) {
    console.error(`[job-alert] alert "${job}" sebagian gagal:`, result.problems.join("; "));
  }
  return result;
}
