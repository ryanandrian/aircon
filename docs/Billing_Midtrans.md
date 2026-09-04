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

## Kupon Diskon (admin-driven, SSOT harga tetap di PlanConfig)
Model: `Coupon` + `CouponRedemption` (audit). TIDAK mengubah PlanConfig/kuota tenant — hanya harga bayar.
- Tipe (`CouponType`): PERCENT (n%), FIXED (potong Rp n), OVERRIDE (harga jadi Rp n tetap — dipakai uji Midtrans production nilai kecil mis. Rp1.000).
- Diskon dihitung SERVER-SIDE dari harga dasar PRA-PAJAK, SEBELUM pajak: `base → −discount → withTax`. gross_amount = amount tersimpan → anti-tamper utuh. item_details: harga langganan = subtotal SETELAH diskon (TANPA baris negatif — Midtrans aman), hemat ditulis di NAMA item; jumlah item = gross_amount.
- Satu sumber kebenaran harga: `resolveCheckout(base,discount,taxPercent)` (pure) dipakai `previewCheckout` (UI) & `startSubscriptionPayment` → total di layar checkout DIJAMIN = gross ke Midtrans. Diskon di-resolve `resolveCheckoutDiscount` (dipakai preview & bayar).
- GUARD total ≤ 0: kupon yang membuat total Rp0 (OVERRIDE 0 / PERCENT 100) DITOLAK (BillingError ZERO_TOTAL) — untuk gratis pakai paket gratis, bukan transaksi Rp0.
- Aturan: `maxRedemptions` (kuota total, naik saat penebusan AWAL PAID), `perTenantLimit`, `validFrom/validUntil`, `appliesToPlans` (kosong=semua berbayar), `minMonths`.
- RECURRING semantik `recurringMonths` = TOTAL periode berdiskon TERMASUK pembelian awal: null=selamanya; N≥2 → sisa (N-1) perpanjangan (couponPeriodsLeft=N-1); N≤1 → tak melekat. Diskon melekat di `Tenant.activeCouponCode`+`couponPeriodsLeft`, OTOMATIS di perpanjangan tanpa ketik ulang. Tiap perpanjangan LUNAS: couponPeriodsLeft−1; habis → lepas (activeCouponCode=null).
- Cabang tebus dibedakan `Payment.couponRecurringApplied`: false=penebusan awal manual (naikkan kuota + attach recurring); true=perpanjangan otomatis (decrement periode, TANPA reset/naik kuota). Redeem HANYA saat PAID, idempoten via `CouponRedemption.paymentOrderId` unik (mustahil double-count walau webhook fire 2×).
- Prioritas: kode manual owner > diskon recurring melekat. Kupon manual baru meng-attach ulang recurring bila kuponnya recurring.
- Komisi keagenan otomatis benar: dihitung dari `payment.amount` (sudah ter-diskon) / (1+pajak).
- UI: owner pilih paket → sheet checkout tampil rincian LENGKAP dari server (base/diskon/pajak/TOTAL) → input kode opsional. Nol hitung pajak di client. Admin CRUD di /admin/kupon.
- Pure calc + test: `src/lib/domain/coupon-calc.ts` (computeDiscount + resolveCheckout, 14 test). Validasi+tebus: `src/lib/services/coupon-service.ts`.
