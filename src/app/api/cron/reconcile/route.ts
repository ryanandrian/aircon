/**
 * Cron reconciler pembayaran (PULL) — penjamin akun Midtrans bersama.
 * Dilindungi CRON_SECRET. Dijalankan berkala (mis. tiap 30 menit).
 */
import { NextRequest, NextResponse } from "next/server";
import { reconcilePendingPayments } from "@/lib/services/reconcile-service";

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
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("[cron/reconcile] gagal:", err);
    return NextResponse.json({ error: "Gagal rekonsiliasi" }, { status: 500 });
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}
export async function POST(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}
