/**
 * Cron endpoint reminders — memicu WA pengingat servis (money loop) harian.
 * Untuk SEMUA tenant aktif: kirim reminder due -> antre ke wa-worker (MessageLog QUEUED).
 * SECURITY: header Bearer CRON_SECRET (timing-safe). Dipakai Vercel Cron.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { runDueRemindersAllTenants } from "@/lib/services/reminder-service";
import { flushQueuedMessages } from "@/lib/services/message-dispatch-service";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }
  try {
    const result = await runDueRemindersAllTenants();
    // Flush antrean WA (reminder + dunning) ke gateway. Menutup money loop end-to-end.
    const dispatch = await flushQueuedMessages();
    return NextResponse.json({ ok: true, ...result, dispatch });
  } catch (err) {
    console.error("[cron/reminders] gagal:", err);
    return NextResponse.json({ error: "Gagal menjalankan reminders" }, { status: 500 });
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}
export async function POST(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}
