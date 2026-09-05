# Rencana Migrasi Auth: Supabase → Google OAuth Self-Host (GRATIS)

> **STATUS: DOKUMEN RENCANA/TRANSISI — BUKAN SSOT.** SSOT keamanan & auth tetap
> `docs/Security_Model.md`. Dokumen ini hanya memandu eksekusi migrasi. Saat cutover selesai,
> **UPDATE `Security_Model.md` bagian Auth** (baris "Owner/Admin: Google SSO via Supabase" →
> "Google OAuth self-host, sesi cookie HMAC `aircon_owner`") lalu **HAPUS/arsipkan dokumen ini**
> agar tak ada dua sumber kebenaran. `Auth_Decision_Phone_PIN.md` (teknisi) TIDAK berubah.

Tujuan: layar login Google menampilkan **airconet.id** (bukan `...supabase.co`), tanpa biaya bulanan,
tanpa merusak login yang sedang berjalan. Callback pindah ke `app.airconet.id/auth/callback`.

## Kenapa ini AMAN & KECIL (hasil audit)
Sistem SUDAH punya abstraksi bagus:
- `getServerContext()` (context.ts) — satu-satunya sumber tenantId/role. Hanya baris 25-28 yang
  Supabase-spesifik (ambil email/phone dari sesi). Sisanya (map email→domainUser via DB, tenantId
  dari DB) TETAP. → cukup ganti "cara dapat email dari sesi".
- Pola cookie HMAC tertanda SUDAH ADA & terbukti: `aircon_tech` (teknisi), `aircon_partner` (agen).
  Owner tinggal pakai pola SAMA: cookie `aircon_owner` berisi email (atau userId), ditandatangani HMAC
  SESSION_SECRET. Tak ada dependency baru yang berat.

## Arsitektur baru (minimal, tanpa library berat)
Google OAuth 2.0 langsung (authorization code flow), TANPA Supabase, TANPA NextAuth (agar ringan &
tak menambah abstraksi). Alur:
1. `/login` → tombol Google → redirect ke Google `accounts.google.com/o/oauth2/v2/auth`
   dengan `redirect_uri=https://app.airconet.id/auth/callback`, scope `openid email profile`, state anti-CSRF.
2. Google → callback `app.airconet.id/auth/callback?code=...&state=...`.
3. Server tukar `code` → token di `oauth2.googleapis.com/token` (pakai GOOGLE_CLIENT_ID/SECRET —
   client yang SAMA dengan yang kini dipakai Supabase, tinggal tambah redirect_uri baru).
4. Ambil email/nama dari `id_token` (JWT Google) atau userinfo endpoint.
5. Set cookie `aircon_owner` (HMAC, httpOnly, secure) berisi email terverifikasi.
6. Redirect ke /app atau /onboarding (logika findDomainUser TETAP).

Sesi = cookie HMAC (pola tech-session). tenantId/role SELALU dari DB (tak dipercaya dari cookie).

## Titik yang diubah (11 file → tapi perubahan kecil per file)
| File | Perubahan |
|---|---|
| `src/lib/auth/owner-session.ts` (BARU) | set/get/clear cookie `aircon_owner` (tiru tech-session) |
| `src/lib/auth/owner-crypto.ts` (BARU) | HMAC token (tiru tech-crypto) |
| `src/lib/auth/google-oauth.ts` (BARU) | buildAuthUrl, exchangeCode, verifyIdToken |
| `src/lib/auth/context.ts` | ganti `supabase.auth.getUser()` → `getOwnerSessionEmail()` |
| `src/lib/auth/platform-admin.ts` | idem |
| `src/middleware.ts` | ganti cek Supabase user → cek cookie `aircon_owner` (pola hasTechCookie) |
| `src/app/auth/callback/route.ts` | tukar code Google (bukan Supabase), set cookie owner |
| `src/app/login/google-button.tsx` | redirect ke Google authorize URL (server action) |
| `src/app/onboarding/{page,actions}.ts` | ganti getUser → getOwnerSessionEmail |
| `src/app/app/page.tsx` | idem (cek sesi) |
| `src/app/app/logout-button.tsx` | clear cookie owner (bukan supabase.signOut) |

Supabase-js TETAP terpasang (dipakai hal lain? cek) — hanya AUTH yang berhenti dipakai.

## Strategi BERDAMPINGAN + ROLLBACK (anti-rusak)
- **Feature flag** `AUTH_DRIVER` env: `supabase` (lama, default) | `google` (baru).
  `getServerContext`/middleware/callback bercabang berdasar flag. Set `google` HANYA saat siap.
- Kerja & uji dgn flag `google` di LOKAL/preview. Produksi tetap `supabase` sampai lolos uji.
- **Rollback = flip 1 env** `AUTH_DRIVER=supabase` + restart. Teruji sebelum cutover.
- Cookie owner & sesi Supabase bisa hidup berdampingan (beda nama cookie) → tak bentrok.

## Prasyarat di Google Console (Anda, sekali)
- OAuth Client (yang sama, 972061874202-...) → Authorized redirect URIs → TAMBAH:
  `https://app.airconet.id/auth/callback` (JANGAN hapus yang Supabase, biar rollback aman).
- Authorized JavaScript origins → `https://app.airconet.id`.

## Env baru (VPS)
- `AUTH_DRIVER=google`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (dari Console — sama dgn yang di Supabase).
- `SESSION_SECRET` (sudah ada, dipakai HMAC).

## Definition of Done
1. Login Google via app.airconet.id berhasil (layar Google tampil "airconet.id").
2. Owner lama (yang sudah punya usaha) login → masuk /app.
3. Owner baru → /onboarding → buat usaha → /app.
4. Admin platform (ryan) tetok bisa akses /admin.
5. Teknisi (phone+PIN) & partner TAK terpengaruh (jalur cookie sendiri).
6. Proteksi route tetap benar (tanpa sesi → /login).
7. Logout bersih.
8. Rollback flag teruji (flip → Supabase jalan lagi).
9. Verifikasi live + tsc/build 0.

## Risiko & mitigasi
| Risiko | Mitigasi |
|---|---|
| Login produksi putus | Flag default `supabase`; cutover hanya setelah uji; rollback 1-flip |
| Owner lama tak dikenali | Identitas = email (sama di Google & Supabase) → findDomainUser by email TETAP cocok |
| id_token Google tak terverifikasi | Verifikasi signature via JWKS Google + cek aud/iss/exp |
| CSRF di callback | state param acak disimpan cookie, dicek saat callback |
