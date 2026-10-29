/**
 * Cron endpoint dunning — dipanggil terjadwal (mis. Vercel Cron / cron eksternal) harian.
 * Menjalankan siklus penagihan lalu purge tenant yang sudah lewat masa tenggang hapus.
 * SECURITY: dilindungi header rahasia CRON_SECRET (bukan endpoint publik).
 */
import { NextRequest, NextResponse } from "next/server";
import { runDunningCycle, purgeMarkedTenants } from "@/lib/services/dunning-service";
import { runInactivitySweep } from "@/lib/services/inactivity-sweeper-service";
import { flushQueuedMessages } from "@/lib/services/message-dispatch-service";
import { runPlatformNotifyCycle } from "@/lib/services/platform-notify-cycle";
import { dispatchPlatformNotifications } from "@/lib/services/platform-notification-dispatch";
import { alertJobFailure, alertStaleNotificationQueues } from "@/lib/services/job-alert-service";

/** Cek otorisasi cron: header Bearer CRON_SECRET (dipakai Vercel Cron & pemanggilan manual). */
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }
  // TERISOLASI PER TAHAP (F2): sebelumnya SEMUA tahap dalam satu try, sehingga
  // exception di `runDunningCycle` diam-diam melewatkan purge, dispatch WA, dan
  // platform notify hari itu — padahal ketiganya jalur berbeda. Sekarang tiap
  // tahap dijalankan & dicatat meski tahap lain gagal; respons tetap 500 bila ADA
  // kegagalan agar `curl -fsS` di run-cron.sh membuat journal non-zero (kegagalan
  // tak hilang diam-diam).
  type Stage = { name: string; ok: boolean; value?: unknown; error?: string };
  const stages: Stage[] = [];
  const run = async (name: string, fn: () => Promise<unknown>) => {
    try { stages.push({ name, ok: true, value: await fn() }); }
    catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`[cron/dunning] tahap ${name} gagal:`, err);
      stages.push({ name, ok: false, error });
    }
  };

  await run("dunning", runDunningCycle);
  await run("purge", purgeMarkedTenants);
  await run("inactivity", runInactivitySweep);
  await run("dispatch", flushQueuedMessages);
  await run("platformNotify", runPlatformNotifyCycle);
  await run("platformDispatch", dispatchPlatformNotifications);
  // Read-only queue health check. It only records/email-alerts; never changes
  // queue status or replays messages. Run after dispatch to avoid reporting
  // rows that were just eligible and successfully handled in this cycle.
  await run("queueHealth", alertStaleNotificationQueues);

  const failed = stages.filter((s) => !s.ok).map((s) => s.name);
  const body: Record<string, unknown> = { ok: failed.length === 0, failed };
  for (const s of stages) body[s.name] = s.ok ? s.value : { error: s.error };

  // ALERT KEGAGALAN (F3/G21/G30): kegagalan cron tak boleh hilang diam-diam.
  // Jejak pasti di PlatformAuditLog + email opsional ke admin platform.
  // Alert TIDAK mengubah status job (respon 500 tetap), dan kegagalannya sendiri
  // tak menjatuhkan route.
  if (failed.length > 0) {
    for (const s of stages.filter((x) => !x.ok)) {
      await alertJobFailure({
        job: "dunning",
        stage: s.name,
        error: s.error ?? "tanpa pesan error",
        details: { failedStages: failed },
      }).catch((e) => console.error("[cron/dunning] alert gagal:", e));
    }
  }
  return NextResponse.json(body, { status: failed.length ? 500 : 200 });
}

// Vercel Cron memanggil via GET dengan header Authorization: Bearer $CRON_SECRET.
export async function GET(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}
// POST didukung untuk pemanggilan manual/eksternal.
export async function POST(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}
