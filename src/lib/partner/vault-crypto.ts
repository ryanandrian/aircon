/**
 * Kripto rekening bank — MURNI (tanpa server-only, aman diuji/skrip).
 * AES-256-GCM, kunci dari PARTNER_ENC_KEY/SESSION_SECRET.
 */
import crypto from "crypto";

function key(): Buffer {
  const secret = process.env.PARTNER_ENC_KEY || process.env.SESSION_SECRET || "";
  if (!secret) throw new Error("PARTNER_ENC_KEY/SESSION_SECRET belum diset");
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("format terenkripsi tidak valid");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

export function maskAccount(plain: string): string {
  const s = plain.replace(/\s/g, "");
  if (s.length <= 4) return "****";
  return "****" + s.slice(-4);
}
