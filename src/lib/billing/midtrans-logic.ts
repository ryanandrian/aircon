/**
 * Logika murni Midtrans (teruji, tanpa I/O).
 * Pemetaan status & helper order — dipisah agar mudah diuji.
 */
import type { PaymentStatus } from "@prisma/client";

/** Order ID unik untuk Midtrans. Format: AIRCON-<tenant6>-<ts>-<rand>. */
export function makeOrderId(tenantId: string): string {
  const t = tenantId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `AIRCON-${t}-${ts}-${rand}`;
}

interface MidtransNotif {
  transaction_status?: string;
  fraud_status?: string;
}

/** Peta transaction_status Midtrans -> PaymentStatus domain. */
export function parseMidtransStatus(notif: MidtransNotif): PaymentStatus {
  const s = notif.transaction_status;
  switch (s) {
    case "settlement":
      return "PAID";
    case "capture":
      // capture butuh fraud_status accept
      return notif.fraud_status === "accept" ? "PAID" : "PENDING";
    case "pending":
      return "PENDING";
    case "deny":
    case "cancel":
      return "FAILED";
    case "expire":
      return "EXPIRED";
    case "refund":
    case "partial_refund":
      return "REFUNDED";
    default:
      return "PENDING";
  }
}

/** Akhir periode langganan = start + N bulan. */
export function subscriptionPeriodEnd(start: Date, months: number): Date {
  const d = new Date(start);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * PURE: keputusan aksi "lanjutkan pembayaran" (best-practice Midtrans).
 * Input = status Midtrans yang sudah dipetakan + apakah token lokal masih hidup + ada token tersimpan.
 * Output:
 *  - "paid"       → transaksi sudah lunas (sinkronkan saja).
 *  - "reuse"      → token lama masih hidup → panggil snap.pay(token lama).
 *  - "regenerate" → token mati / expire / cancel / deny → buat transaksi baru (order_id baru).
 */
export function decideResumeAction(input: {
  mappedStatus: PaymentStatus;
  tokenExpired: boolean;
  hasStoredToken: boolean;
}): "paid" | "reuse" | "regenerate" {
  if (input.mappedStatus === "PAID") return "paid";
  if (input.mappedStatus === "PENDING" && !input.tokenExpired && input.hasStoredToken) return "reuse";
  return "regenerate";
}

/**
 * PURE: verifikasi nominal webhook cocok dengan amount tersimpan — SADAR FEE.
 *
 * Bila akun Midtrans membebankan biaya channel ke pelanggan (customer-imposed payment fee),
 * gross_amount yang ditagih = amount kita + fee. Midtrans mengirim rinciannya di
 * metadata.extra_info.gross_amount_info.{original_amount, customer_imposed_payment_fee}.
 *
 * DITERIMA bila salah satu benar (toleransi pembulatan 1 rupiah):
 *  - gross_amount == stored amount (tanpa fee, atau fee ditanggung merchant), ATAU
 *  - original_amount == stored amount (fee dibebankan ke pelanggan; original = harga kita), ATAU
 *  - gross_amount == stored amount + customer_imposed_payment_fee.
 * DITOLAK (tampering nyata) bila tak ada yang cocok.
 */
export function isNotifAmountValid(input: {
  storedAmount: number;
  grossAmount?: string | number;
  originalAmount?: string | number;
  customerImposedFee?: string | number;
}): boolean {
  const num = (v: string | number | undefined): number | null => {
    if (v === undefined || v === null || v === "") return null;
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? n : null;
  };
  const stored = input.storedAmount;
  const gross = num(input.grossAmount);
  const original = num(input.originalAmount);
  const fee = num(input.customerImposedFee) ?? 0;
  const near = (a: number | null, b: number) => a !== null && Math.abs(a - b) <= 1;

  if (gross === null && original === null) return false; // tak ada info nominal → tolak
  if (near(gross, stored)) return true;
  if (near(original, stored)) return true;
  if (gross !== null && near(gross, stored + fee)) return true;
  return false;
}
