/**
 * Sesi Portal Partner (agen/reseller) — cookie HMAC-signed, terpisah dari owner/teknisi.
 * Kripto murni via tech-crypto (hashPin/verifyPin/sign). Cookie hanya berisi {kind,id}.
 */
import "server-only";
import { cookies } from "next/headers";
import { makeToken, parseToken } from "@/lib/auth/tech-crypto";

const COOKIE = "aircon_partner";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 hari

export type PartnerKind = "agent" | "reseller";
export interface PartnerSession { kind: PartnerKind; id: string; }

export async function setPartnerSession(kind: PartnerKind, id: string): Promise<void> {
  const value = makeToken(`${kind}:${id}`);
  const jar = await cookies();
  jar.set(COOKIE, value, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: MAX_AGE,
  });
}

export async function getPartnerSession(): Promise<PartnerSession | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  const val = parseToken(raw);
  if (!val) return null;
  const [kind, id] = val.split(":");
  if ((kind !== "agent" && kind !== "reseller") || !id) return null;
  return { kind, id };
}

export async function clearPartnerSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
