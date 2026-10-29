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
  const dayKey = new Date().toISOString().slice(0, 10);
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
