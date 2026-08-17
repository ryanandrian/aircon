import { createClient } from "@/lib/supabase/server";
import { ensureUserProvisioned } from "@/lib/services/onboarding-service";
import { NextResponse } from "next/server";

/**
 * OAuth callback (Google SSO) — tukar code jadi session, provision user/tenant,
 * lalu redirect ke /app.
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

  // Pastikan user punya tenant + record domain (idempoten).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    try {
      await ensureUserProvisioned({
        email: user.email ?? null,
        phone: user.phone ?? null,
        fullName:
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          null,
      });
    } catch (e) {
      console.error("[auth/callback] provisioning gagal:", e);
      return NextResponse.redirect(`${origin}/login?error=provision`);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
