# SECURITY MODEL — Tenant Isolation & Auth

**Status:** keputusan arsitektur keamanan Aircon. Ditegakkan, bukan aspiratif.

## Model akses data
Semua akses data melewati **server Next.js** (Server Components, Server Actions, Route Handlers) via **Prisma**. Klien browser TIDAK mengakses Postgres langsung (supabase-js anon hanya dipakai untuk Auth/session, bukan query data). Konsekuensi: satu-satunya jalur data = server tepercaya kita.

## Tenant isolation (boundary utama)
- Prisma terkoneksi sebagai role `postgres` (Supabase) yang `rolbypassrls=true` → RLS Postgres TIDAK menjadi penjaga pada jalur aplikasi.
- Maka isolasi tenant ditegakkan di **service layer** melalui konteks terpusat: setiap query WAJIB scoped `tenantId` yang berasal dari **session terverifikasi**, bukan dari input klien.
- `getServerContext()` = satu-satunya sumber `tenantId` + `role`. Service menerima `tenantId` hanya dari sini. Endudukan `?tenantId=` dari query HANYA diperbolehkan di jalur /demo (data dummy) dan akan dihapus saat auth aktif.
- Diuji: test memastikan akses lintas-tenant mengembalikan not-found (bukan data tenant lain), dan entity soft-deleted tak muncul.

## RLS sebagai backstop (defense-in-depth)
- RLS tetap `ENABLE` di semua tabel. Karena role app mem-bypass, RLS aktif melindungi bila kelak ada koneksi non-bypass (mis. akses supabase anon tak sengaja terbuka) — fail-closed (tanpa policy = deny).
- Kita TIDAK memakai `SET app.tenant_id` per-request karena transaction pooler (pgbouncer) tidak menjaga session state antar statement dengan andal. Enforcement di aplikasi lebih deterministik untuk arsitektur ini.

## Auth (lihat docs/Auth_Decision_Phone_PIN.md)
- Owner/Admin: **Google SSO** via Supabase Auth (aktif setelah OAuth client dikonfigurasi).
- Teknisi: undangan link WA → **PIN 6 digit** (argon2). Identitas = nomor HP.
- Sesi: Supabase Auth (JWT httpOnly cookie via @supabase/ssr). Middleware me-refresh session. RBAC ditegakkan per endpoint/aksi di server (bukan hanya UI).
- Sementara Google OAuth belum aktif: jalur **email+password** Supabase tersedia untuk pengujian internal, tanpa memblokir pembangunan.

## Aturan yang tidak boleh dilanggar
1. Tidak ada query Prisma tanpa `tenantId` (kecuali tabel global: Device pra-provision, _prisma_migrations).
2. `tenantId` tidak pernah datang dari body/query yang bisa dimanipulasi user pada jalur ber-auth — selalu dari session.
3. RBAC dicek di server sebelum mutasi.
4. Endpoint publik (booking) rate-limited + validasi Zod + honeypot.
5. Rahasia hanya di server env; tak pernah ke klien (kecuali NEXT_PUBLIC_*).
