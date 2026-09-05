import { NextResponse } from "next/server";
import { isGoogleAuthDriver, buildAuthUrl } from "@/lib/auth/google-oauth";
import { makeOAuthState } from "@/lib/auth/owner-crypto";

/**
 * Inisiasi login Google (self-host) — Route Handler GET.
 *
 * POLA KANONIK OAuth: cookie state anti-CSRF di-set PADA RESPONSE REDIRECT ini. Browser
 * menjamin cookie ter-commit sebelum mengikuti redirect ke Google — menghindari kelas bug
 * "cookie belum tersimpan" pada pola server-action + window.location.
 *
 * redirect_uri KANONIK (NEXT_PUBLIC_APP_URL) agar cocok persis dgn Google Console.
 */
export const dynamic = "force-dynamic";

const STATE_COOKIE = "aircon_oauth_state";
const NEXT_COOKIE = "aircon_oauth_next";

function canonicalBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  return envUrl ? envUrl.replace(/\/$/, "") : "https://app.airconet.id";
}

export async function GET(request: Request) {
  const base = canonicalBaseUrl();

  // Driver supabase (fallback) → jangan tangani di sini; arahkan ke /login.
  if (!isGoogleAuthDriver()) {
    return NextResponse.redirect(`${base}/login`);
  }

  const { searchParams } = new URL(request.url);
  const nextParam = searchParams.get("next");
  const state = makeOAuthState();
  const googleUrl = buildAuthUrl(base, state);

  const res = NextResponse.redirect(googleUrl);
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600, // 10 menit
  };
  res.cookies.set(STATE_COOKIE, state, opts);
  if (nextParam && nextParam.startsWith("/")) {
    res.cookies.set(NEXT_COOKIE, nextParam, opts);
  }
  return res;
}
