# HISTORICAL — BILLING & SUBSCRIPTION — Legacy Payment Notes

Primary SSOT: `docs/Payment_Dunning_SSOT.md`
Provider implementation spec: `docs/Ipaymu_Integration_Spec.md`
Migration/runbook: `docs/Ipaymu_Migration_Plan.md`, `docs/Ipaymu_Production_Runbook.md`

⚠️ HISTORICAL — bukan status kini dan bukan kontrak runtime. Payment aktif Aircon sekarang iPaymu-only.
Gunakan `docs/Payment_Dunning_SSOT.md` untuk aturan domain, `docs/Ipaymu_Integration_Spec.md` untuk kontrak
provider, dan `docs/Ipaymu_Production_Runbook.md` untuk operasi. File ini dipertahankan hanya sebagai jejak
historis dan tidak boleh dijadikan dasar konfigurasi, implementasi, atau diagnosis transaksi baru.


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
2. [HISTORIS] `subscription-service.startSubscriptionPayment` dahulu membuat Payment(PENDING) + token hosted checkout provider legacy.
3. [HISTORIS] Jalur lama menggunakan konfigurasi provider dan client popup.
4. [HISTORIS] Jalur lama menggunakan hosted checkout provider legacy.
5. [HISTORIS] Jalur lama menggunakan webhook provider legacy.
6. [HISTORIS] Verifikasi callback provider legacy → `processPaymentNotification` → bila PAID: `activateSubscription`.

## Konfigurasi env (nama PERSIS sesuai kode — SATU saklar, anti-drift)
- Konfigurasi aktif iPaymu ada di `docs/Ipaymu_Integration_Spec.md` dan `docs/Payment_Dunning_SSOT.md`.

Webhook aktif menggunakan `https://app.airconet.id/api/billing/ipaymu-webhook`.

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
Cron reconcile PULL status ke Midtrans. Semua `PENDING` dipantau tanpa batas usia sampai Midtrans mengembalikan status final,
sementara `FAILED/EXPIRED` hanya dipindai ulang selama 48 jam untuk memulihkan kasus webhook terlambat.
Jika `PENDING` berusia lebih dari 48 jam dan Midtrans mengembalikan 404 (order tidak pernah tersedia), transaksi lokal
ditutup sebagai `EXPIRED`; transaksi muda tidak ditutup otomatis. Semua perubahan diterapkan via
`processPaymentNotification` (idempoten, fee-aware). Ini mencegah transaksi lama menumpuk sebagai "Menunggu" tanpa
membunuh pembayaran aktif atau pembayaran terlambat yang benar-benar tercatat di Midtrans.
Resume TIDAK menandai transaksi lama FAILED/EXPIRED kecuali Midtrans mengonfirmasi mati (expire/cancel/deny) — VA lama
yang masih hidup tak dibunuh.

### Riwayat pembayaran
Halaman `/app/langganan` menampilkan seluruh pembayaran `PAID`, serta pembayaran belum lunas/bermasalah dalam 90 hari terakhir.
Transaksi lama yang sudah selesai tidak mengotori riwayat utama; faktur detail tetap dapat diakses melalui URL yang sudah ada.

## Siklus Hidup Langganan & Penagihan Otomatis (Dunning) — SSOT
Penagihan langganan Lumite→tenant BERBEDA dari reminder servis tenant→pelanggan (itu reminder-service).
Semua parameter CONFIGURABLE via `BillingPolicy` (admin), NO hardcode.

### State machine tenant
`TRIAL → ACTIVE (setelah bayar) → PAST_DUE (lewat jatuh tempo, grace) → SUSPENDED (login diblok) → hapus permanen`.
Bayar kapan pun sebelum purge → kembali ACTIVE (reversible). `activateSubscription` set `nextDueDate` = akhir
periode yang DIBELI (1/3/12 bln). `isTenantUsable`: TRIAL/ACTIVE/PAST_DUE boleh pakai; SUSPENDED/CANCELLED tidak.

### Jadwal otomatis (systemd timer VPS)
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
  - [HISTORIS] PENDING + token belum lewat `checkoutExpiryHours` dahulu memakai ulang token hosted checkout provider legacy. Jalur aktif kini membuat/melanjutkan redirect iPaymu.
  - expire/cancel/deny ATAU pending-token-kadaluarsa ATAU 404 → REGENERATE: tandai Payment lama EXPIRED/FAILED, buat transaksi BARU (order_id BARU — Midtrans tolak order_id duplikat) utk paket+durasi yang sama.
- Kupon terbawa saat regenerate bila dulu MANUAL; bila kupon manual lama sudah tak valid (kuota habis) → ulangi tanpa kupon (harga normal, jujur). Diskon recurring melekat otomatis dihitung ulang oleh startSubscriptionPayment.
- TIDAK ada email dari aplikasi: instruksi VA/metode dikirim Midtrans sendiri (email resmi Midtrans). Aplikasi hanya menyediakan jalur in-app.
- [HISTORIS] Token dan redirect provider legacy dahulu disimpan untuk reuse; schema aktif kini memakai `checkoutRedirect` dan `providerTransactionId`.

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
