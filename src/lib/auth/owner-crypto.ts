/**
 * Fungsi kripto MURNI untuk sesi OWNER (Google OAuth self-host) — TANPA server-only/cookies.
 * HMAC token signing atas email terverifikasi Google. owner-session.ts membungkus + cookie.
 *
 * Identitas owner = EMAIL (sama seperti yang dulu dipakai Supabase → findDomainUser by email
 * tetap cocok, owner lama otomatis dikenali). tenantId/role SELALU dibaca ulang dari DB.
 */
import crypto from "crypto";

function secret(): string {
  const s = process.env.SESSION_SECRET || process.env.CRON_SECRET || "";
  if (!s) throw new Error("SESSION_SECRET belum diset");
  return s;
}

export const OWNER_COOKIE = "aircon_owner";
export const OWNER_MAX_AGE = 60 * 60 * 24 * 30; // 30 hari

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

/**
 * Buat token sesi owner: base64url(email.exp).sig
 * email di-encode base64url agar aman dari karakter pemisah.
 */
export function makeOwnerToken(email: string, now: number = Date.now()): string {
  const exp = now + OWNER_MAX_AGE * 1000;
  const body = Buffer.from(`${email}\n${exp}`).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Verifikasi token → email bila valid & belum kedaluwarsa (timing-safe). */
export function parseOwnerToken(token: string | undefined, now: number = Date.now()): string | null {
  if (!token) return null;
  const idx = token.lastIndexOf(".");
  if (idx <= 0) return null;
  const body = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const decoded = Buffer.from(body, "base64url").toString();
    const sep = decoded.lastIndexOf("\n");
    if (sep <= 0) return null;
    const email = decoded.slice(0, sep);
    const expStr = decoded.slice(sep + 1);
    if (!email || !expStr) return null;
    if (now > Number(expStr)) return null;
    return email;
  } catch {
    return null;
  }
}

/** Token acak untuk state anti-CSRF OAuth. */
export function makeOAuthState(now: number = Date.now()): string {
  const nonce = crypto.randomBytes(16).toString("base64url");
  const body = Buffer.from(`${nonce}\n${now}`).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Verifikasi state OAuth (valid & umur < 10 menit). */
export function verifyOAuthState(state: string | undefined, now: number = Date.now()): boolean {
  if (!state) return false;
  const idx = state.lastIndexOf(".");
  if (idx <= 0) return false;
  const body = state.slice(0, idx);
  const sig = state.slice(idx + 1);
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const decoded = Buffer.from(body, "base64url").toString();
    const sep = decoded.lastIndexOf("\n");
    if (sep <= 0) return false;
    const ts = Number(decoded.slice(sep + 1));
    if (!Number.isFinite(ts)) return false;
    return now - ts < 10 * 60 * 1000; // 10 menit
  } catch {
    return false;
  }
}
