import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware: refresh session Supabase & lindungi route ber-auth.
 * Route publik: /, /login, /pratinjau, /p/* (halaman tenant), /auth/*, /api/public/*
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Portal partner (agen/reseller): login via cookie tertanda, bukan Supabase.
  // Path publik: login, daftar reseller, aktivasi PIN.
  const isPartnerPublic =
    path.startsWith("/agen/login") || path.startsWith("/agen/aktivasi") ||
    path.startsWith("/reseller/login") || path.startsWith("/reseller/daftar") || path.startsWith("/reseller/aktivasi");
  const isPartnerArea = (path === "/agen" || path.startsWith("/agen/") || path === "/reseller" || path.startsWith("/reseller/")) && !isPartnerPublic;
  const hasPartnerCookie = Boolean(request.cookies.get("aircon_partner")?.value);
  if (isPartnerArea && !hasPartnerCookie) {
    const url = request.nextUrl.clone();
    url.pathname = path.startsWith("/reseller") ? "/reseller/login" : "/agen/login";
    return NextResponse.redirect(url);
  }

  // Route yang wajib login (Supabase/teknisi): /app, /onboarding, /admin, /t.
  const isProtected =
    path.startsWith("/app") ||
    path.startsWith("/onboarding") ||
    path.startsWith("/t") ||
    path.startsWith("/admin");

  // Teknisi login via phone+PIN (cookie tertanda), bukan Supabase.
  // /t & /login-teknisi cukup cek keberadaan cookie; validasi penuh di getServerContext.
  const hasTechCookie = Boolean(request.cookies.get("aircon_tech")?.value);
  const techAllowed = path.startsWith("/t") && hasTechCookie;

  if (isProtected && !user && !techAllowed) {
    const url = request.nextUrl.clone();
    // Teknisi diarahkan ke login teknisi; lainnya ke login owner (Google).
    url.pathname = path.startsWith("/t") ? "/masuk-teknisi" : "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
