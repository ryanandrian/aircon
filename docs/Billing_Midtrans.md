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
3. Snap.js popup → user bayar
4. Midtrans kirim webhook → /api/billing/midtrans-webhook
5. verifySignature (sha512) → processPaymentNotification → bila PAID: activateSubscription (tenant ACTIVE + periode)

## Konfigurasi (yang dibutuhkan)
Set di Vercel env (dan .env lokal):
- MIDTRANS_SERVER_KEY (server-only, rahasia)
- NEXT_PUBLIC_MIDTRANS_CLIENT_KEY (publik, untuk Snap.js)
- MIDTRANS_IS_PRODUCTION / NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION ("true"/"false")

Daftarkan webhook di dashboard Midtrans (Settings > Configuration > Payment Notification URL):
  https://aircon-peach.vercel.app/api/billing/midtrans-webhook

Tanpa server key, /app/langganan menampilkan "pembayaran belum diaktifkan" (aman, tidak error).

## Keamanan
- Signature webhook diverifikasi (hanya Midtrans yang bisa update status).
- startPayment hanya OWNER (assertRole).
- Idempoten: PAID tidak diproses dua kali.
- Server key tak pernah ke klien.
