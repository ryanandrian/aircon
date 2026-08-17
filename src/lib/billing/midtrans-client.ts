/**
 * Midtrans Snap client — pembayaran langganan.
 * Sandbox/production via MIDTRANS_IS_PRODUCTION. Server key WAJIB dari env (server-only).
 * Verifikasi signature webhook: sha512(order_id+status_code+gross_amount+ServerKey).
 */
import crypto from "crypto";

const IS_PROD = process.env.MIDTRANS_IS_PRODUCTION === "true";
const SERVER_KEY = process.env.MIDTRANS_SERVER_KEY ?? "";

const SNAP_BASE = IS_PROD
  ? "https://app.midtrans.com/snap/v1"
  : "https://app.sandbox.midtrans.com/snap/v1";

export function isMidtransConfigured(): boolean {
  return SERVER_KEY.length > 0;
}

function authHeader(): string {
  return "Basic " + Buffer.from(SERVER_KEY + ":").toString("base64");
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
    throw new Error("MIDTRANS_SERVER_KEY belum diset");
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

  const res = await fetch(`${SNAP_BASE}/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: authHeader(),
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
  if (!SERVER_KEY) return false;
  const raw = params.orderId + params.statusCode + params.grossAmount + SERVER_KEY;
  const expected = crypto.createHash("sha512").update(raw).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(params.signatureKey ?? "", "utf8");
  // Panjang harus sama sebelum timingSafeEqual (hindari throw & bocor panjang).
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
