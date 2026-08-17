/**
 * Midtrans Snap client (server-only).
 * Pola ENV mengikuti mesinviral (akun Midtrans berbagi, konsisten lintas-app):
 *   MIDTRANS_ENV = sandbox | production  (SATU saklar)
 *   MIDTRANS_SANDBOX_SERVER_KEY / MIDTRANS_PRODUCTION_SERVER_KEY  (keduanya permanen)
 * Ganti lingkungan = ubah MIDTRANS_ENV saja (nol tukar kunci, nol risiko env≠key).
 * Verifikasi signature webhook: sha512(order_id+status_code+gross_amount+ServerKey).
 */
import crypto from "crypto";

function isProduction(): boolean {
  return (process.env.MIDTRANS_ENV ?? "sandbox").toLowerCase() === "production";
}

/** Server key sesuai MIDTRANS_ENV. */
function serverKey(): string {
  const env = isProduction() ? "PRODUCTION" : "SANDBOX";
  return process.env[`MIDTRANS_${env}_SERVER_KEY`] ?? "";
}

function snapBase(): string {
  return isProduction()
    ? "https://app.midtrans.com/snap/v1"
    : "https://app.sandbox.midtrans.com/snap/v1";
}

function statusBase(): string {
  return isProduction()
    ? "https://api.midtrans.com/v2"
    : "https://api.sandbox.midtrans.com/v2";
}

/**
 * URL webhook aircon. Akun Midtrans dipakai bersama beberapa aplikasi
 * (aiwa, mesinviral, aircon), jadi kita TIDAK bergantung pada Notification URL
 * global di dashboard. Setiap transaksi aircon meng-override tujuan notifikasi
 * ke webhook aircon lewat header X-Override-Notification.
 */
function airconWebhookUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "";
  return base ? `${base}/api/billing/midtrans-webhook` : "";
}

export function isMidtransConfigured(): boolean {
  return serverKey().length > 0;
}

function authHeader(): string {
  return "Basic " + Buffer.from(serverKey() + ":").toString("base64");
}

export interface SnapCreateParams {
  orderId: string;
  amount: number; // IDR
  customerName: string;
  customerEmail?: string;
  itemName: string;
}

export interface SnapResult {
  token: string;
  redirectUrl: string;
}

/** Buat transaksi Snap → token + redirect url. */
export async function createSnapTransaction(p: SnapCreateParams): Promise<SnapResult> {
  if (!isMidtransConfigured()) {
    throw new Error("Midtrans server key belum diset (cek MIDTRANS_ENV + MIDTRANS_*_SERVER_KEY)");
  }
  const body = {
    transaction_details: { order_id: p.orderId, gross_amount: p.amount },
    item_details: [{ id: "plan", price: p.amount, quantity: 1, name: p.itemName }],
    customer_details: {
      first_name: p.customerName,
      ...(p.customerEmail ? { email: p.customerEmail } : {}),
    },
    credit_card: { secure: true },
  };

  const overrideUrl = airconWebhookUrl();
  const res = await fetch(`${snapBase()}/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: authHeader(),
      // Arahkan notifikasi transaksi INI ke webhook aircon, apa pun setting
      // Notification URL global (akun dipakai bersama aiwa/mesinviral/aircon).
      ...(overrideUrl ? { "X-Override-Notification": overrideUrl } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Midtrans Snap gagal (${res.status}): ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { token: string; redirect_url: string };
  return { token: json.token, redirectUrl: json.redirect_url };
}

/** Verifikasi signature webhook Midtrans (timing-safe). */
export function verifySignature(params: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
}): boolean {
  if (!serverKey()) return false;
  const raw = params.orderId + params.statusCode + params.grossAmount + serverKey();
  const expected = crypto.createHash("sha512").update(raw).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(params.signatureKey ?? "", "utf8");
  // Panjang harus sama sebelum timingSafeEqual (hindari throw & bocor panjang).
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export interface MidtransStatus {
  order_id?: string;
  transaction_status?: string;
  fraud_status?: string;
  gross_amount?: string;
  transaction_id?: string;
  payment_type?: string;
  status_code?: string;
}

/**
 * Ambil status transaksi dari API Midtrans (terautentikasi server key = tepercaya).
 * Dipakai RECONCILER (PULL) — penjamin bila webhook meleset di akun Midtrans bersama.
 * Melempar { status: 404 } bila transaksi belum ada (user belum bayar).
 */
export async function getTransactionStatus(orderId: string): Promise<MidtransStatus> {
  if (!isMidtransConfigured()) throw new Error("Midtrans server key belum diset (cek MIDTRANS_ENV + MIDTRANS_*_SERVER_KEY)");
  const res = await fetch(`${statusBase()}/${encodeURIComponent(orderId)}/status`, {
    method: "GET",
    headers: { Authorization: authHeader(), Accept: "application/json" },
  });
  if (!res.ok) {
    const err = new Error(`Midtrans status ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as MidtransStatus;
}
