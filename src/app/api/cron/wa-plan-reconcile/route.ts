/**
 * Cron rekonsiliasi sesi WhatsApp paket Basic (A3 — aturan produk 2026-10-13).
 *
 * Tenant paket Basic (enum DB: TRIAL; "Basic" = displayName) TIDAK memakai
 * otomasi WA — termasuk TIDAK boleh punya sesi gateway. Guard A1 (server
 * action) mencegah pembuatan sesi BARU; route ini mencabut sesi YANG SUDAH ADA
 * bila plan dinonaktifkan admin, atau sebagai aksi rekonsiliasi sekali.
 *
 * Sumber "berhak" = PlanConfig.autoReminder (satu-sumber dgn guard cron
 * reminder & guard A1 — lihat waAutomationEligibility).
 *
 * IDEMPOTEN: run kedua → nol tindakan. AMAN-GAGAL per tenant.
 *
 * SECURITY: header Bearer CRON_SECRET (timing-safe, pola /api/cron/reminders).
 *
 * PENGGUNAAN: route ini TIDAK dijadwalkan periodik — dipanggil MANUAL oleh
 * operator (sekali setelah deploy, atau saat plan dinonaktifkan). Alasan
 * keamanan: menonaktifkan autoReminder sebuah plan akan menarik SELURUH sesi
 * plan itu — keputusan itu harus disengaja, bukan otomatis tiap 30 menit.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { reconcileWaPlanSessions } from "@/lib/services/wa-identity-service";

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
    const result = await reconcileWaPlanSessions();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/wa-plan-reconcile] gagal:", err);
    return NextResponse.json({ error: "Gagal rekonsiliasi sesi plan" }, { status: 500 });
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}
export async function POST(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}
