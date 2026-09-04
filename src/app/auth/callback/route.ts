import { createClient } from "@/lib/supabase/server";
import { findDomainUser } from "@/lib/services/onboarding-service";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

/**
 * OAuth callback (Google SSO) — tukar code jadi session, lalu arahkan:
 *  - Sudah punya usaha  → /app (atau ?next=).
 *  - Belum punya usaha  → /onboarding (wizard setup usaha eksplisit).
 *
 * TIDAK lagi auto-provision usaha di sini. Pembuatan usaha dilakukan eksplisit
 * oleh owner lewat wizard (lihat src/app/onboarding).
 *
 * CATATAN PROXY: `new URL(request.url).origin` SALAH di belakang nginx (jadi
 * http://localhost:3000). Karena itu base redirect diambil dari header
 * x-forwarded-* (dikirim nginx) → fallback NEXT_PUBLIC_APP_URL → fallback origin.
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const base = await resolveBaseUrl(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";

  if (!code) {
    return NextResponse.redirect(`${base}/login?error=auth`);
  }

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

  // Kenali user (baca saja) — putuskan tujuan tanpa membuat apa pun.
  try {
    const domainUser = await findDomainUser({
      email: user.email ?? null,
      phone: user.phone ?? null,
    });

    if (domainUser) {
      // Sudah punya usaha → lanjut ke aplikasi.
      return NextResponse.redirect(`${base}${next}`);
    }

    // Belum punya usaha → arahkan ke wizard setup usaha.
    return NextResponse.redirect(`${base}/onboarding`);
  } catch (e) {
    console.error("[auth/callback] gagal mengenali user:", e);
    return NextResponse.redirect(`${base}/login?error=auth`);
  }
}
