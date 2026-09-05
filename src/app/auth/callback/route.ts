import { findDomainUser } from "@/lib/services/onboarding-service";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { isGoogleAuthDriver, exchangeCode, fetchUserInfo } from "@/lib/auth/google-oauth";
import { verifyOAuthState } from "@/lib/auth/owner-crypto";
import { setOwnerSession, consumeOAuthStateCookie } from "@/lib/auth/owner-session";

/**
 * OAuth callback (Google SSO) — bercabang berdasar AUTH_DRIVER:
 *  - google  : verifikasi state → tukar code (Google) → set cookie owner (self-host).
 *  - supabase: exchangeCodeForSession (jalur lama).
 * Lalu arahkan: punya usaha → /app (atau ?next=); belum → /onboarding.
 *
 * CATATAN PROXY: origin dari header x-forwarded-* (nginx) → fallback NEXT_PUBLIC_APP_URL.
 */
async function resolveBaseUrl(requestUrl: string): Promise<string> {
  const h = await headers();
  const fwdHost = h.get("x-forwarded-host") ?? h.get("host");
  const fwdProto = h.get("x-forwarded-proto") ?? "https";
  if (fwdHost) return `${fwdProto}://${fwdHost}`;
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  return new URL(requestUrl).origin;
}

/**
 * Base KANONIK untuk redirect_uri OAuth (tukar token). WAJIB identik dengan yang dipakai saat
 * authorize (auth/google/start) & yang terdaftar di Google — TIDAK boleh dari host request.
 */
function canonicalBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  return envUrl ? envUrl.replace(/\/$/, "") : "https://app.airconet.id";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const base = await resolveBaseUrl(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${base}/login?error=auth`);
  }

  // Identitas terverifikasi (email/phone) hasil dari driver aktif.
  let email: string | null = null;
  let phone: string | null = null;
  let nextTarget = searchParams.get("next") ?? "/app";

  if (isGoogleAuthDriver()) {
    // --- Driver Google self-host ---
    const returnedState = searchParams.get("state");
    // Anti-forgery STATELESS: state ditandatangani HMAC + ber-nonce + kedaluwarsa 10 mnt
    // (verifyOAuthState). Tak bergantung cookie — andal pada redirect lintas-situs dari Google.
    // Cookie 'next' opsional dibaca bila ada (untuk tujuan pasca-login), tapi TAK menggagalkan.
    const { next: savedNext } = await consumeOAuthStateCookie();
    if (!returnedState || !verifyOAuthState(returnedState)) {
      console.error("[auth/callback state-fail]", {
        hasReturned: Boolean(returnedState),
        verify: returnedState ? verifyOAuthState(returnedState) : null,
      });
      return NextResponse.redirect(`${base}/login?error=state`);
    }
    if (savedNext && savedNext.startsWith("/")) nextTarget = savedNext;
    try {
      const { accessToken } = await exchangeCode(code, canonicalBaseUrl());
      const info = await fetchUserInfo(accessToken);
      if (!info.emailVerified) {
        return NextResponse.redirect(`${base}/login?error=unverified`);
      }
      email = info.email;
      // Set cookie sesi owner (email terverifikasi Google).
      await setOwnerSession(email);
    } catch (e) {
      console.error("[auth/callback google] gagal:", e);
      return NextResponse.redirect(`${base}/login?error=auth`);
    }
  } else {
    // --- Driver Supabase (default lama) ---
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${base}/login?error=auth`);
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(`${base}/login?error=auth`);
    }
    email = user.email ?? null;
    phone = user.phone ?? null;
  }

  // Kenali user (baca saja) — putuskan tujuan tanpa membuat apa pun.
  try {
    const domainUser = await findDomainUser({ email, phone });
    if (domainUser) {
      return NextResponse.redirect(`${base}${nextTarget}`);
    }
    // Bukan owner usaha → mungkin ADMIN PLATFORM (Lumite). Admin tak punya tenant.
    if (await isPlatformAdmin(email)) {
      // Bila tujuan awal memang /admin/* pertahankan; selain itu default ke /admin.
      const adminTarget = nextTarget.startsWith("/admin") ? nextTarget : "/admin";
      return NextResponse.redirect(`${base}${adminTarget}`);
    }
    // Benar-benar user baru → arahkan ke wizard setup usaha.
    return NextResponse.redirect(`${base}/onboarding`);
  } catch (e) {
    console.error("[auth/callback] gagal mengenali user:", e);
    return NextResponse.redirect(`${base}/login?error=auth`);
  }
}
