import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const OWNER_COOKIE = "aircon_owner";

/**
 * Middleware: lindungi route ber-auth. Bercabang berdasar AUTH_DRIVER:
 *  - google  : cek cookie owner (aircon_owner, HMAC) — tanpa Supabase.
 *  - supabase: refresh session Supabase (jalur lama).
 * Route publik: /, /login, /privasi, /ketentuan, /pratinjau, /p/*, /auth/*, /api/public/*.
 * Middleware hanya gerbang KASAR (ada/tidak sesi); validasi penuh (tenant, role) di getServerContext.
 */
function isGoogleDriver(): boolean {
  return (process.env.AUTH_DRIVER ?? "supabase").toLowerCase() === "google";
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;

  // Tentukan keberadaan sesi owner/admin sesuai driver.
  let hasOwnerSession = false;

  if (isGoogleDriver()) {
    // Driver Google: cek KEBERADAAN cookie owner (HMAC divalidasi penuh di getServerContext).
    // Middleware = edge runtime → tak validasi HMAC di sini (konsisten dgn cookie tech/partner).
    hasOwnerSession = Boolean(request.cookies.get(OWNER_COOKIE)?.value);
  } else {
    // Driver Supabase (default): refresh session + cek user.
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
    hasOwnerSession = Boolean(user);
  }

  // Portal partner (agen/reseller): login via cookie tertanda, bukan Supabase/owner.
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

  // Route yang wajib login: /app, /onboarding, /admin, /t.
  const isProtected =
    path.startsWith("/app") ||
    path.startsWith("/onboarding") ||
    path.startsWith("/t") ||
    path.startsWith("/admin");

  // Teknisi login via phone+PIN (cookie tertanda). /t cukup cek keberadaan cookie; validasi di getServerContext.
  const hasTechCookie = Boolean(request.cookies.get("aircon_tech")?.value);
  const techAllowed = path.startsWith("/t") && hasTechCookie;

  if (isProtected && !hasOwnerSession && !techAllowed) {
    const url = request.nextUrl.clone();
    url.pathname = path.startsWith("/t") ? "/masuk-teknisi" : "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
