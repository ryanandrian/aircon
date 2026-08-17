/**
 * Sesi Teknisi (phone+PIN) — cookie wrapper. Kripto murni di tech-crypto.ts.
 * SECURITY: cookie hanya berisi userId; tenantId/role selalu dibaca ulang dari DB.
 */
import "server-only";
import { cookies } from "next/headers";
import { TECH_COOKIE, TECH_MAX_AGE, makeToken, parseToken } from "@/lib/auth/tech-crypto";

export { hashPin, verifyPin, parseToken } from "@/lib/auth/tech-crypto";

/** Set cookie sesi teknisi. */
export async function setTechSession(userId: string): Promise<void> {
  const store = await cookies();
  store.set(TECH_COOKIE, makeToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TECH_MAX_AGE,
  });
}

/** Baca userId dari cookie sesi teknisi (atau null). */
export async function getTechSessionUserId(): Promise<string | null> {
  const store = await cookies();
  return parseToken(store.get(TECH_COOKIE)?.value);
}

/** Hapus sesi teknisi (logout). */
export async function clearTechSession(): Promise<void> {
  const store = await cookies();
  store.delete(TECH_COOKIE);
}
