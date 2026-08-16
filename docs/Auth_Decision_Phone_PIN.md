# AUTH DECISION (v2) — Google SSO (owner/admin) + Phone+PIN (teknisi)

**Direvisi setelah pertimbangan:** hampir semua pengguna Android punya akun Google → SSO Google adalah cara termudah & gratis untuk persona owner. Tapi teknisi lapangan berisiko friksi Google (HP murah/berbagi/akun bukan miliknya). Maka: **auth dibagi per peran**, pilih yang termudah untuk tiap user.

## Keputusan
| Peran | Metode utama | Cadangan | Alasan |
|---|---|---|---|
| **Owner / Admin** | **Login with Google (SSO)** | — | 1-tap, nol biaya, nol PIN; owner pasti punya akun Google di HP Android; dapat email+nama terverifikasi |
| **Teknisi** | **Undangan link WA → set PIN 6 digit** | boleh Login with Google bila punya | PIN selalu bisa dipakai, tak tergantung akun Google di HP lapangan (anti-friksi) |

**Kenapa bukan Google-only:** persona yang paling sering buka app tiap hari (teknisi) justru paling berisiko tersandung akun Google (HP berbagi/murah). PIN menjamin akses lapangan.
**Kenapa bukan PIN-only:** untuk owner, Google SSO lebih mudah daripada PIN (argumen Android+Google account benar untuk persona ini).

## Cara kerja
- **Owner onboarding:** buka app → **Continue with Google** → lengkapi profil usaha (nama, area, jam kerja) → tenant aktif. (Founder-led demo tetap jalan; nol biaya SMS.)
- **Teknisi onboarding:** owner kirim **link undangan via WhatsApp** (deep link, `technician_invite` template) → teknisi buka → set **PIN 6 digit** → aktif. (Owner menjamin identitas teknisi.)
- **Identitas:** owner/admin dikenali via Google (email) + `phone`; teknisi via `phone` + `pinHash` (argon2). Semua user tetap punya `User.phone` (nomor = identitas alami usaha AC / WhatsApp).
- **Sesi/RLS:** Supabase Auth sebagai session+JWT store. Google OAuth native Supabase. JWT membawa `tenant_id`+`role` untuk RLS.
- **Lupa akses:** owner = re-login Google. Teknisi lupa PIN → owner kirim ulang link/reset PIN.

## Jalur upgrade (fase 2)
- OTP via WhatsApp untuk verifikasi HP mandiri (self-serve onboarding) saat skala > pilot.
- Tambah SSO lain bila perlu. Arsitektur tak berubah (identitas: Google-email dan/atau phone).

## Dampak ke spec (mengganti /auth/otp/* di Build Spec Pack Part 1)
- `GET /auth/google` (redirect Supabase OAuth) → callback membuat/menautkan user owner+tenant.
- `POST /auth/complete-profile` {tenantName, area, workingHours} (setelah Google, pertama kali).
- `POST /invites/accept` {token, pin} (teknisi set PIN).
- `POST /auth/login-pin` {phone, pin} (login teknisi).
- `POST /auth/reset-pin` (owner→teknisi).
- `MessageTemplate` tambah key `technician_invite`.
- Skema: `User` — `email String?` (dari Google, owner/admin), `pinHash String?` (teknisi), `authProvider` enum {GOOGLE, PIN}. `phone` tetap; unik per tenant.
