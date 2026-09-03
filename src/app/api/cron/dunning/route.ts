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
  try {
    const dunning = await runDunningCycle();
    const purge = await purgeMarkedTenants();
    const inactivity = await runInactivitySweep();
    // Flush antrean WA dunning ke gateway (pesan penagihan benar-benar terkirim).
    const dispatch = await flushQueuedMessages();
    // PLATFORM notif (Lumite → tenant): evaluasi event → antre → kirim (WA sesi lumite-platform + email).
    const platformNotify = await runPlatformNotifyCycle();
    const platformDispatch = await dispatchPlatformNotifications();
    return NextResponse.json({ ok: true, dunning, purge, inactivity, dispatch, platformNotify, platformDispatch });
  } catch (err) {
    console.error("[cron/dunning] gagal:", err);
    return NextResponse.json({ error: "Gagal menjalankan dunning" }, { status: 500 });
  }
}

// Vercel Cron memanggil via GET dengan header Authorization: Bearer $CRON_SECRET.
export async function GET(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}
// POST didukung untuk pemanggilan manual/eksternal.
export async function POST(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}
