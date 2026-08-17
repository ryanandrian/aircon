/**
 * Cron endpoint dunning — dipanggil terjadwal (mis. Vercel Cron / cron eksternal) harian.
 * Menjalankan siklus penagihan lalu purge tenant yang sudah lewat masa tenggang hapus.
 * SECURITY: dilindungi header rahasia CRON_SECRET (bukan endpoint publik).
 */
import { NextRequest, NextResponse } from "next/server";
import { runDunningCycle, purgeMarkedTenants } from "@/lib/services/dunning-service";

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
    return NextResponse.json({ ok: true, dunning, purge });
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
