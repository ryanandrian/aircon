/**
 * Fungsi kripto MURNI untuk auth teknisi — TANPA server-only/cookies (aman diuji).
 * PIN hashing (scrypt) + HMAC token signing. tech-session.ts membungkus + cookie.
 */
import crypto from "crypto";

function secret(): string {
  const s = process.env.SESSION_SECRET || process.env.CRON_SECRET || "";
  if (!s) throw new Error("SESSION_SECRET belum diset");
  return s;
}

export const TECH_COOKIE = "aircon_tech";
export const TECH_MAX_AGE = 60 * 60 * 24 * 30; // 30 hari

/** PIN valid = 6 digit angka. */
export function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

/** Hash PIN: scrypt → "salt:hash" (hex). */
export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(pin, salt, 32);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

/** Verifikasi PIN (timing-safe). */
export function verifyPin(pin: string, stored: string | null): boolean {
  if (!stored) return false;
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const derived = crypto.scryptSync(pin, Buffer.from(saltHex, "hex"), 32);
  const a = Buffer.from(hashHex, "hex");
  if (a.length !== derived.length) return false;
  return crypto.timingSafeEqual(a, derived);
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

/** Buat token sesi: base64(userId.exp).sig */
export function makeToken(userId: string): string {
  const exp = Date.now() + TECH_MAX_AGE * 1000;
  const body = Buffer.from(`${userId}.${exp}`).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Verifikasi token → userId bila valid & belum kedaluwarsa. */
export function parseToken(token: string | undefined): string | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const [userId, expStr] = Buffer.from(body, "base64url").toString().split(".");
    if (!userId || !expStr) return null;
    if (Date.now() > Number(expStr)) return null;
    return userId;
  } catch {
    return null;
  }
}
