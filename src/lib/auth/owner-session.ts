/**
 * Sesi OWNER (Google OAuth self-host) — cookie wrapper. Kripto murni di owner-crypto.ts.
 * SECURITY: cookie hanya berisi email terverifikasi Google (ditandatangani HMAC);
 * tenantId/role SELALU dibaca ulang dari DB via getServerContext.
 */
import "server-only";
import { cookies } from "next/headers";
import {
  OWNER_COOKIE,
  OWNER_MAX_AGE,
  makeOwnerToken,
  parseOwnerToken,
} from "@/lib/auth/owner-crypto";

const STATE_COOKIE = "aircon_oauth_state";
const NEXT_COOKIE = "aircon_oauth_next";

/** Set cookie sesi owner (email terverifikasi Google). */
export async function setOwnerSession(email: string): Promise<void> {
  const store = await cookies();
  store.set(OWNER_COOKIE, makeOwnerToken(email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OWNER_MAX_AGE,
  });
}

/** Baca email dari cookie sesi owner (atau null bila tak ada/invalid/kedaluwarsa). */
export async function getOwnerSessionEmail(): Promise<string | null> {
  const store = await cookies();
  return parseOwnerToken(store.get(OWNER_COOKIE)?.value);
}

/** Hapus sesi owner (logout). */
export async function clearOwnerSession(): Promise<void> {
  const store = await cookies();
  store.delete(OWNER_COOKIE);
}

/** Simpan state anti-CSRF + tujuan `next` (dibaca ulang saat callback). */
export async function setOAuthStateCookie(state: string, next?: string): Promise<void> {
  const store = await cookies();
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600, // 10 menit
  };
  store.set(STATE_COOKIE, state, opts);
  if (next && next.startsWith("/")) store.set(NEXT_COOKIE, next, opts);
  else store.delete(NEXT_COOKIE);
}

/** Baca & hapus state + next (sekali pakai). */
export async function consumeOAuthStateCookie(): Promise<{ state: string | null; next: string | null }> {
  const store = await cookies();
  const state = store.get(STATE_COOKIE)?.value ?? null;
  const next = store.get(NEXT_COOKIE)?.value ?? null;
  if (state) store.delete(STATE_COOKIE);
  if (next) store.delete(NEXT_COOKIE);
  return { state, next };
}
