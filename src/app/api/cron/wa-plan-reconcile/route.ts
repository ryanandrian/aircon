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
import { alertJobFailure } from "@/lib/services/job-alert-service";

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
    // Service menangkap kegagalan per tenant agar tenant lain tetap diproses;
    // tetapi failed>0 wajib jadi alert — bukan sekadar angka di respons cron.
    if (result.failed > 0) {
      await alertJobFailure({
        job: "wa-plan-reconcile",
        error: `Rekonsiliasi sebagian gagal untuk ${result.failed} tenant.`,
        details: result,
      }).catch((e) => console.error("[cron/wa-plan-reconcile] alert gagal:", e));
    }
    return NextResponse.json({ ok: result.failed === 0, ...result }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/wa-plan-reconcile] gagal:", err);
    await alertJobFailure({ job: "wa-plan-reconcile", error: message }).catch((e) =>
      console.error("[cron/wa-plan-reconcile] alert gagal:", e),
    );
    return NextResponse.json({ error: "Gagal rekonsiliasi sesi plan" }, { status: 500 });
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}
export async function POST(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}
