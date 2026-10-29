/**
 * Cron reconciler pembayaran iPaymu (PULL).
 * Dilindungi CRON_SECRET. Dijalankan berkala (mis. tiap 30 menit).
 */
import { NextRequest, NextResponse } from "next/server";
import { reconcilePendingPayments } from "@/lib/services/reconcile-service";
import { alertJobFailure, alertIfDunningHeartbeatMissing } from "@/lib/services/job-alert-service";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }
  try {
    const result = await reconcilePendingPayments();
    // Existing reconcile timer runs 03:00 WIB; alert if the daily 01:00 dunning
    // route never recorded a successful completion. Monitoring only, no sends.
    const dunningHeartbeat = await alertIfDunningHeartbeatMissing();
    return NextResponse.json({ ok: true, result, dunningHeartbeat });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/reconcile] gagal:", err);
    // ALERT KEGAGALAN (F3/G21): jejak pasti + email opsional ke admin.
    await alertJobFailure({ job: "reconcile", error: message }).catch((e) =>
      console.error("[cron/reconcile] alert gagal:", e),
    );
    return NextResponse.json({ error: "Gagal rekonsiliasi" }, { status: 500 });
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}
export async function POST(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}
