"use server";

/**
 * Server action untuk memulai login. Bercabang berdasar AUTH_DRIVER:
 *  - google  : bangun URL authorize Google + set cookie state anti-CSRF (self-host).
 *  - supabase: kembalikan null → klien memakai jalur supabase.auth.signInWithOAuth (lama).
 *
 * SECURITY: GOOGLE_CLIENT_SECRET tak pernah ke klien; hanya URL authorize yang dikirim.
 */
import { isGoogleAuthDriver, buildAuthUrl } from "@/lib/auth/google-oauth";
import { makeOAuthState } from "@/lib/auth/owner-crypto";
import { setOAuthStateCookie } from "@/lib/auth/owner-session";

/**
 * Base URL KANONIK untuk redirect_uri OAuth. WAJIB sama persis dengan yang terdaftar di
 * Google Console (app.airconet.id), jadi TIDAK boleh menebak dari host request (user bisa buka
 * airconet.id tanpa 'app.' → mismatch). Selalu pakai NEXT_PUBLIC_APP_URL.
 */
function canonicalBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  return envUrl ? envUrl.replace(/\/$/, "") : "https://app.airconet.id";
}

/**
 * Mulai login Google. Return { url } untuk driver google (klien redirect ke situ),
 * atau { url: null } untuk driver supabase (klien pakai jalur lama).
 */
export async function startGoogleLogin(next?: string): Promise<{ url: string | null }> {
  if (!isGoogleAuthDriver()) return { url: null };
  const base = canonicalBaseUrl();
  const state = makeOAuthState();
  await setOAuthStateCookie(state, next);
  return { url: buildAuthUrl(base, state) };
}
