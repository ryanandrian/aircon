# BILLING & SUBSCRIPTION — Midtrans

Model langganan SaaS Aircon: trial 14 hari → bayar via Midtrans (Snap) → ACTIVE.

## Paket (hipotesis pilot)
- Pemula (STARTER): Rp199.000/bln — kelola pelanggan, pekerjaan, pengingat servis, ≤3 teknisi
- Berkembang (GROWTH): Rp399.000/bln — + penjadwalan pintar, alat cari pelanggan, laporan lengkap, ≤8 teknisi
- Profesional (PRO): Rp699.000/bln — + penjadwalan ulang otomatis, teknisi tanpa batas
- IoT add-on: ~Rp100.000/device/bln

## Status tenant (lifecycle)
TRIAL → ACTIVE (setelah bayar) → PAST_DUE (periode habis, grace) → SUSPENDED (dihentikan) / CANCELLED.
- TRIAL memakai fitur PRO (biar dicoba penuh).
- isTenantUsable: TRIAL/ACTIVE/PAST_DUE boleh pakai; SUSPENDED/CANCELLED tidak.

## Alur pembayaran
1. Owner buka /app/langganan → pilih paket + durasi → startPayment (server action, OWNER only)
2. subscription-service.startSubscriptionPayment: buat Payment(PENDING) + Snap token (Midtrans)
3. startPayment JUGA balikkan midtransClientConfig() {env, clientKey, snapUrl} — SATU SUMBER KEBENARAN dari server
4. Snap.js dimuat dari config server itu (client TAK memutuskan env sendiri) → popup → user bayar
5. Midtrans kirim webhook → /api/billing/midtrans-webhook (tujuan di-override per-transaksi via header X-Override-Notification ke NEXT_PUBLIC_APP_URL, akun Midtrans dipakai bersama aiwa/mesinviral/aircon)
6. verifySignature (sha512) → processPaymentNotification → bila PAID: activateSubscription (tenant ACTIVE + periode)

## Konfigurasi env (nama PERSIS sesuai kode — SATU saklar, anti-drift)
- `MIDTRANS_ENV` = sandbox | production  (SATU saklar server, runtime)
- `MIDTRANS_SANDBOX_SERVER_KEY` / `MIDTRANS_PRODUCTION_SERVER_KEY` (server-only, keduanya permanen)
- `NEXT_PUBLIC_MIDTRANS_SANDBOX_CLIENT_KEY` / `NEXT_PUBLIC_MIDTRANS_PRODUCTION_CLIENT_KEY` (publik)
- ANTI-DRIFT: klien TIDAK membaca `NEXT_PUBLIC_MIDTRANS_ENV` (di-'bakar' saat build → sumber bug env mismatch). Server memutuskan env sekali (MIDTRANS_ENV) + memberi clientKey+snapUrl cocok ke klien. Ganti lingkungan = ubah `MIDTRANS_ENV` saja.
- Deploy VPS: `scripts/deploy-vps.sh` build memakai `.env` PRODUKSI VPS + guard bundle bebas-sandbox.

Webhook: TIDAK bergantung Payment Notification URL global dashboard (akun berbagi). Setiap transaksi aircon meng-override ke `NEXT_PUBLIC_APP_URL/api/billing/midtrans-webhook` (kini https://app.airconet.id/...).

Tanpa server key, /app/langganan menampilkan "pembayaran belum diaktifkan" (aman, tidak error).

## Keamanan
- Signature webhook diverifikasi (hanya Midtrans yang bisa update status).
- startPayment hanya OWNER (assertRole).
- Idempoten: PAID tidak diproses dua kali.
- Server key tak pernah ke klien.
