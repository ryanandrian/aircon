"use server";

/**
 * Server action untuk memulai login. Bercabang berdasar AUTH_DRIVER:
 *  - google  : bangun URL authorize Google + set cookie state anti-CSRF (self-host).
 *  - supabase: kembalikan null → klien memakai jalur supabase.auth.signInWithOAuth (lama).
 *
 * SECURITY: GOOGLE_CLIENT_SECRET tak pernah ke klien; hanya URL authorize yang dikirim.
 */
import { headers } from "next/headers";
import { isGoogleAuthDriver, buildAuthUrl } from "@/lib/auth/google-oauth";
import { makeOAuthState } from "@/lib/auth/owner-crypto";
import { setOAuthStateCookie } from "@/lib/auth/owner-session";

async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  return envUrl ? envUrl.replace(/\/$/, "") : "https://app.airconet.id";
}

/**
 * Mulai login Google. Return { url } untuk driver google (klien redirect ke situ),
 * atau { url: null } untuk driver supabase (klien pakai jalur lama).
 */
export async function startGoogleLogin(next?: string): Promise<{ url: string | null }> {
  if (!isGoogleAuthDriver()) return { url: null };
  const base = await baseUrl();
  const state = makeOAuthState();
  await setOAuthStateCookie(state, next);
  return { url: buildAuthUrl(base, state) };
}
