/**
 * Google OAuth 2.0 (authorization code flow) — self-host, TANPA Supabase, TANPA library eksternal.
 * Alur: buildAuthUrl → Google → callback(code) → exchangeCode → fetchUserInfo.
 *
 * Keamanan: userinfo diambil LANGSUNG dari endpoint Google via TLS memakai access_token hasil tukar
 * (Google yang memvalidasi token) → tak perlu verifikasi tanda tangan JWT sendiri. state anti-CSRF
 * ditangani di owner-crypto/owner-session.
 */
import "server-only";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";

function clientId(): string {
  const v = process.env.GOOGLE_CLIENT_ID;
  if (!v) throw new Error("GOOGLE_CLIENT_ID belum diset");
  return v;
}
function clientSecret(): string {
  const v = process.env.GOOGLE_CLIENT_SECRET;
  if (!v) throw new Error("GOOGLE_CLIENT_SECRET belum diset");
  return v;
}

/** URL callback absolut (harus terdaftar di Google Console Authorized redirect URIs). */
export function redirectUri(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/auth/callback`;
}

/** Bangun URL authorize Google. */
export function buildAuthUrl(baseUrl: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(baseUrl),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH}?${params.toString()}`;
}

/** Tukar authorization code → access_token. Melempar bila gagal. */
export async function exchangeCode(code: string, baseUrl: string): Promise<{ accessToken: string }> {
  const res = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri(baseUrl),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Google token exchange gagal (${res.status}): ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Google token exchange: access_token kosong");
  return { accessToken: data.access_token };
}

export interface GoogleUserInfo {
  email: string;
  emailVerified: boolean;
  name: string | null;
}

/** Ambil profil user dari Google (email terverifikasi + nama). */
export async function fetchUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(GOOGLE_USERINFO, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Google userinfo gagal (${res.status}): ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    email?: string;
    email_verified?: boolean;
    name?: string;
  };
  if (!data.email) throw new Error("Google userinfo: email kosong");
  return {
    email: data.email,
    emailVerified: data.email_verified === true,
    name: data.name ?? null,
  };
}

/** Apakah driver auth aktif = google (self-host). Default: supabase (aman, tak mengubah perilaku lama). */
export function isGoogleAuthDriver(): boolean {
  return (process.env.AUTH_DRIVER ?? "supabase").toLowerCase() === "google";
}
