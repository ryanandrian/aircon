import { createClient } from "@/lib/supabase/server";
import { findDomainUser } from "@/lib/services/onboarding-service";
import { NextResponse } from "next/server";

/**
 * OAuth callback (Google SSO) — tukar code jadi session, lalu arahkan:
 *  - Sudah punya usaha  → /app (atau ?next=).
 *  - Belum punya usaha  → /onboarding (wizard setup usaha eksplisit).
 *
 * TIDAK lagi auto-provision usaha di sini. Pembuatan usaha dilakukan eksplisit
 * oleh owner lewat wizard (lihat src/app/onboarding).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  // Kenali user (baca saja) — putuskan tujuan tanpa membuat apa pun.
  try {
    const domainUser = await findDomainUser({
      email: user.email ?? null,
      phone: user.phone ?? null,
    });

    if (domainUser) {
      // Sudah punya usaha → lanjut ke aplikasi.
      return NextResponse.redirect(`${origin}${next}`);
    }

    // Belum punya usaha → arahkan ke wizard setup usaha.
    return NextResponse.redirect(`${origin}/onboarding`);
  } catch (e) {
    console.error("[auth/callback] gagal mengenali user:", e);
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }
}
