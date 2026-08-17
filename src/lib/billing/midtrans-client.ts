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

export interface SnapItem {
  id: string;
  name: string;
  price: number; // IDR per unit
  quantity: number;
  category?: string;
}

export interface SnapCustomer {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export interface SnapAddress {
  firstName?: string;
  lastName?: string;
  phone?: string;
  address: string;
  city?: string;
  postalCode?: string;
  countryCode?: string; // default IDN
}

export interface SnapCreateParams {
  orderId: string;
  amount: number; // IDR — HARUS = sum(item.price*qty)
  customer: SnapCustomer;
  items: SnapItem[];
  /** Alamat kirim (mis. pesanan perangkat IoT). Opsional untuk langganan. */
  shipping?: SnapAddress;
}

export interface SnapResult {
  token: string;
  redirectUrl: string;
}

function splitName(full: string): { first: string; last?: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return { first: (parts[0] ?? "").slice(0, 20) };
  return { first: parts[0].slice(0, 20), last: parts.slice(1).join(" ").slice(0, 20) };
}

/**
 * Bangun body request Snap (MURNI, tanpa I/O — teruji).
 * Memastikan customer_details, item_details, dan shipping/billing terisi lengkap.
 */
export function buildSnapBody(p: SnapCreateParams): Record<string, unknown> {
  const cust: Record<string, unknown> = {
    first_name: (p.customer.firstName || "Pelanggan").slice(0, 20),
  };
  if (p.customer.lastName) cust.last_name = p.customer.lastName.slice(0, 20);
  if (p.customer.email) cust.email = p.customer.email;
  if (p.customer.phone) cust.phone = p.customer.phone.slice(0, 20);

  if (p.shipping) {
    const sn = p.shipping.firstName
      ? { first: p.shipping.firstName.slice(0, 20), last: p.shipping.lastName?.slice(0, 20) }
      : splitName(p.customer.firstName + (p.customer.lastName ? ` ${p.customer.lastName}` : ""));
    const shipAddr = {
      first_name: sn.first,
      ...(sn.last ? { last_name: sn.last } : {}),
      ...(p.shipping.phone ? { phone: p.shipping.phone.slice(0, 20) } : p.customer.phone ? { phone: p.customer.phone.slice(0, 20) } : {}),
      address: p.shipping.address,
      ...(p.shipping.city ? { city: p.shipping.city } : {}),
      ...(p.shipping.postalCode ? { postal_code: p.shipping.postalCode } : {}),
      country_code: p.shipping.countryCode ?? "IDN",
    };
    cust.shipping_address = shipAddr;
    cust.billing_address = { ...shipAddr };
  }

  return {
    transaction_details: { order_id: p.orderId, gross_amount: p.amount },
    item_details: p.items.map((it) => ({
      id: it.id,
      price: it.price,
      quantity: it.quantity,
      name: it.name.slice(0, 50), // Midtrans batas nama item 50 char
      ...(it.category ? { category: it.category } : {}),
    })),
    customer_details: cust,
    credit_card: { secure: true },
  };
}

/** Buat transaksi Snap → token + redirect url. Mengisi customer/item/shipping lengkap. */
export async function createSnapTransaction(p: SnapCreateParams): Promise<SnapResult> {
  if (!isMidtransConfigured()) {
    throw new Error("Midtrans server key belum diset (cek MIDTRANS_ENV + MIDTRANS_*_SERVER_KEY)");
  }

  const body = buildSnapBody(p);

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
