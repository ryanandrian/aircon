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

## Anti-tamper SADAR FEE (customer-imposed payment fee)
Bila akun Midtrans membebankan biaya channel ke PELANGGAN, gross_amount ditagih = harga kita + fee
(mis. 10.000 + 4.440 = 14.440). Midtrans kirim rincian di metadata.extra_info.gross_amount_info
{original_amount, customer_imposed_payment_fee}.
- `isNotifAmountValid` (PURE, teruji) menerima bila gross==amount ATAU original==amount ATAU gross==amount+fee (toleransi 1 rupiah); menolak tampering nyata. Dipakai webhook langganan & IoT.
- Aktivasi & komisi tetap dari `payment.amount` (harga kita, PRA-fee) — fee bukan pendapatan Lumite.
- Konfigurasi fee ditanggung merchant vs pelanggan = SETTING DASHBOARD Midtrans (bukan kode). Kode benar di kedua kondisi.
- PELAJARAN: anti-tamper lama (`gross !== amount → FAILED`) salah menandai transaksi LUNAS ber-fee sbg GAGAL. Diperbaiki.

## Reconcile (PULL) — penjamin + pemulih transaksi hantu
Cron reconcile PULL status ke Midtrans untuk Payment berstatus PENDING/FAILED/EXPIRED usia <48 jam,
terapkan via processPaymentNotification (idempoten, fee-aware). Ini memulihkan "transaksi hantu"
(lunas di Midtrans tapi ter-tolak lokal). Resume TIDAK menandai transaksi lama FAILED/EXPIRED kecuali
Midtrans mengonfirmasi mati (expire/cancel/deny) — VA lama yang masih hidup tak dibunuh.

## Siklus Hidup Langganan & Penagihan Otomatis (Dunning) — SSOT
Penagihan langganan Lumite→tenant BERBEDA dari reminder servis tenant→pelanggan (itu reminder-service).
Semua parameter CONFIGURABLE via `BillingPolicy` (admin), NO hardcode.

### State machine tenant
`TRIAL → ACTIVE (setelah bayar) → PAST_DUE (lewat jatuh tempo, grace) → SUSPENDED (login diblok) → hapus permanen`.
Bayar kapan pun sebelum purge → kembali ACTIVE (reversible). `activateSubscription` set `nextDueDate` = akhir
periode yang DIBELI (1/3/12 bln). `isTenantUsable`: TRIAL/ACTIVE/PAST_DUE boleh pakai; SUSPENDED/CANCELLED tidak.

### Jadwal otomatis (systemd timer VPS, bukan vercel.json)
- `aircon-dunning.timer` @01:00 → runDunningCycle + purgeMarkedTenants + inactivity sweep + flush WA + platform notify.
- `aircon-reminders.timer` @02:00 → reminder servis ke pelanggan tenant (money-loop tenant).
- `aircon-reconcile.timer` @03:00 → PULL status Midtrans (penjamin webhook + pemulih transaksi hantu).

### Aturan dunning (default world-class, editable admin)
Berdasar hari keterlambatan `late = hari sejak nextDueDate`:
- `late > graceDaysBeforeSuspend` (default **7**) → SUSPENDED (login diblok, data MASIH utuh).
- `late > daysBeforeDelete` (default **37**, ≈30 hari setelah suspend) → ditandai hapus (markedForDeletionAt).
- Selain itu (dalam grace) → PAST_DUE (masih bisa login).
- Reminder WA dikirim pada hari `dunningReminderDays` (default **"0,3,7,14,30"**), maks 1×/hari.
- Mulai hari `deleteWarningDay` (default **30**) pakai template PERINGATAN HAPUS (dunningWarningTemplate).

### Purge aman (dua tahap, reversible)
- Mark (run hari-H) dan purge terjadi di RUN BERBEDA: `purgeMarkedTenants` hanya menghapus tenant yang
  `markedForDeletionAt` lebih tua dari `purgeGraceHours` (default 24 jam) & masih SUSPENDED.
- `purgeTenantData` hapus SEMUA tabel anak tenant-scoped lalu tenant, dalam 1 transaksi (idempoten, hormati FK).
- Bayar sebelum purge → status kembali ACTIVE, batal hapus.

### Catatan model
- TIDAK ada auto-charge kartu (recurring charge). Model = invoice + reminder WA + bayar manual (Snap/VA/QRIS) —
  best practice untuk SaaS UMKM Indonesia (mayoritas non-kartu-kredit). Perpanjangan = tenant bayar lagi.
- Sweeper akun telantar (inactivity-sweeper) TERPISAH, default OFF + dry-run (aman); untuk tenant gratis/telantar.

### Konfigurasi (admin /admin/billing → BillingPolicy)
graceDaysBeforeSuspend, daysBeforeDelete, dunningReminderDays, deleteWarningDay, template reminder/warning,
trialDays, taxPercent, + parameter inactivity sweeper.

## Keamanan
- Signature webhook diverifikasi (hanya Midtrans yang bisa update status).
- startPayment hanya OWNER (assertRole).
- Idempoten: PAID tidak diproses dua kali.
- Server key tak pernah ke klien.

## Lanjutkan Pembayaran (resume) — best-practice Midtrans
Transaksi belum lunas (PENDING/FAILED/EXPIRED) bisa dilanjutkan owner dari panel (/app/langganan riwayat) & halaman faktur. Tombol "Bayar Sekarang" (PENDING) / "Ulangi" (FAILED/EXPIRED).
- `resumeSubscriptionPayment(orderId)` cek status ke Midtrans (sumber kebenaran) → `decideResumeAction` (PURE, teruji) memutuskan:
  - PAID → sinkronkan via processPaymentNotification (aktivasi+kupon+komisi), tampilkan lunas.
  - PENDING + token belum lewat `checkoutExpiryHours` + ada snapToken → REUSE token lama (snap.pay token lama → Snap muncul lagi, VA/metode sama). TIDAK buat order baru.
  - expire/cancel/deny ATAU pending-token-kadaluarsa ATAU 404 → REGENERATE: tandai Payment lama EXPIRED/FAILED, buat transaksi BARU (order_id BARU — Midtrans tolak order_id duplikat) utk paket+durasi yang sama.
- Kupon terbawa saat regenerate bila dulu MANUAL; bila kupon manual lama sudah tak valid (kuota habis) → ulangi tanpa kupon (harga normal, jujur). Diskon recurring melekat otomatis dihitung ulang oleh startSubscriptionPayment.
- TIDAK ada email dari aplikasi: instruksi VA/metode dikirim Midtrans sendiri (email resmi Midtrans). Aplikasi hanya menyediakan jalur in-app.
- Snap token & redirect_url disimpan di Payment (snapToken/snapRedirect) untuk reuse.

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
