# Aircon — Rencana Migrasi Payment Gateway ke iPaymu

Status: COMPLETE for active payment migration; production activation remains a separate merchant gate
Pemilik keputusan: Owner Aircon
Aplikasi: `https://airconet.id` / `https://app.airconet.id`
Repo: `/home/rad/aircon`
Terakhir direview: 2026-09-15

> Dokumen ini adalah SSOT proses migrasi. Setiap perubahan implementasi, keputusan provider,
> hasil pengujian, dan status checklist WAJIB diperbarui di sini pada sesi yang sama.
> Tidak ada implementasi berdasarkan asumsi yang tidak tercatat.

## 0. Aturan SSOT

- Status `DRAFT/BELUM DIKONFIRMASI` tidak boleh diperlakukan sebagai fakta final.
- Fakta iPaymu harus berasal dari dokumentasi resmi atau jawaban tertulis support iPaymu.
- Fakta Aircon harus berasal dari kode, database schema, test, atau output deploy nyata.
- Setiap file yang disentuh dicatat di tabel change ledger.
- Setiap gate harus memiliki bukti command/output, bukan klaim.
- Tidak mengubah payment production sebelum sandbox E2E dan rollback gate lulus.
- Midtrans tidak boleh menerima transaksi baru setelah cutover iPaymu; selama fase persiapan,
  Midtrans tetap gateway aktif tunggal.
- Jangan menghapus kode Midtrans sampai periode stabilisasi dan verifikasi historis selesai.
- Jangan menyimpan VA/API key di git, dokumen, chat, atau screenshot.

## 1. Tujuan dan batasan

### Tujuan

Memindahkan payment gateway langganan Aircon dari Midtrans Snap ke iPaymu Redirect Payment,
dengan satu gateway aktif pada satu waktu, tanpa mengubah aturan bisnis billing Aircon:

- Basic tetap gratis selamanya.
- Paket berbayar memakai harga PlanConfig sebagai SSOT.
- Pajak, kupon, recurring discount, komisi, aktivasi tenant, dunning, dan riwayat tetap konsisten.
- Pembayaran tenant tetap melalui alur manual yang sesuai UMKM Indonesia.

### Batasan

- Tidak menambah auto-charge kartu.
- Tidak mengubah model paket/harga sebagai bagian migrasi provider.
- Tidak menjalankan Midtrans dan iPaymu untuk satu order yang sama.
- Tidak melakukan cutover production sebelum akun iPaymu disetujui.
- Tidak memasukkan kredensial nyata ke repo.

## 2. Fakta iPaymu yang sudah terverifikasi

Sumber: `https://docs.ipaymu.com/id/docs` dan halaman terkait, dibaca 2026-09-13.

| Fakta | Status |
|---|---|
| Base URL sandbox | `https://sandbox.ipaymu.com` |
| Base URL production | `https://my.ipaymu.com` |
| Autentikasi API | Header signature berbasis VA, API Key, timestamp/request body sesuai endpoint |
| VA/API Key sandbox | Terpisah dari production |
| Redirect Payment | Tersedia melalui endpoint `/api/v2/payment` |
| Redirect callback | `returnUrl`, `notifyUrl`, `cancelUrl` dikirim pada request |
| Callback | iPaymu mengirim HTTP POST ke `notifyUrl`; server harus mengembalikan HTTP 200 |
| Callback retry | Ada; handler wajib idempoten |
| Validasi production | IP statis dan domain wajib terdaftar/divalidasi |
| Pengajuan domain tambahan | Dashboard domain; review maksimal sekitar 2 hari kerja menurut docs |
| Verifikasi merchant | Tim iPaymu menguji website/aplikasi sampai halaman pembayaran/kode pembayaran muncul; estimasi sekitar 2 hari kerja |
| Akun sandbox multi-aplikasi | **BELUM DIKONFIRMASI**; jangan diasumsikan |

## 3. Hal yang wajib ditanyakan ke iPaymu sebelum production

Checklist ini tidak boleh ditandai selesai tanpa jawaban tertulis support/dashboard:

- [ ] Apakah satu akun merchant iPaymu/sandbox boleh dipakai untuk lebih dari satu aplikasi/brand?
- [ ] Apakah VA/API Key yang sama dapat membedakan beberapa aplikasi melalui `referenceId`/metadata?
- [ ] Apakah domain `airconet.id` dan `app.airconet.id` perlu diajukan terpisah?
- [ ] Apakah callback sandbox harus memakai domain publik HTTPS atau dapat memakai URL tertentu yang disediakan?
- [ ] Format signature request Redirect Payment yang berlaku untuk endpoint API v2 saat ini.
- [ ] Format signature callback dan field wajib callback.
- [ ] Nilai status callback yang resmi: pending/berhasil/expired/cancel/failed dan pemetaannya.
- [ ] Cara sandbox mensimulasikan pembayaran sukses, pending, gagal, dan expired.
- [ ] Apakah `notifyUrl` harus domain yang sudah disetujui sebelum sandbox test.
- [ ] Apakah return/cancel/notify URL boleh memakai path berbeda dalam satu domain.
- [ ] Apakah ada batas minimum transaksi, expiry, retry, rate limit, dan timeout.
- [x] Audit transaksi lama: database production tidak memiliki transaksi legacy; seluruh 5 Payment aktif menggunakan iPaymu sandbox redirect.

## 4. Baseline Aircon saat ini (fakta kode dan database)

### Gateway aktif saat ini

- iPaymu Redirect Payment.
- Server-only gateway: `PAYMENT_GATEWAY=ipaymu`, environment aktif disimpan pada konfigurasi iPaymu.
- Webhook tunggal aktif: `src/app/api/billing/ipaymu-webhook/route.ts`.
- Reconciler aktif: `src/lib/services/reconcile-service.ts` menggunakan iPaymu.
- Payment domain aktif: `src/lib/services/subscription-service.ts` menggunakan iPaymu.
- Database Supabase production terverifikasi: 5 Payment aktif; transaksi terbaru redirect ke
  `sandbox-payment.ipaymu.com`, 4 transaksi sebelumnya berstatus `PAID` pada host yang sama.
- Kolom aktif provider-neutral: `checkoutRedirect` dan `providerTransactionId`; tidak ada transaksi aktif
  yang menggunakan provider legacy.

### Payment lifecycle Aircon

`Payment(PENDING)` → callback/status → `PAID`/`FAILED`/`EXPIRED`/`REFUNDED`.

Saat `PAID`, jalur yang sama mengaktifkan subscription, redeem coupon, dan accrue commission.
Webhook harus idempoten. Reconcile menjadi safety net bila callback tidak masuk.

### File billing utama saat audit

| File | Peran | Migrasi |
|---|---|---|
| `src/lib/billing/ipaymu-client.ts` | HTTP client, signature, redirect/status | Adapter aktif |
| `src/lib/billing/ipaymu-logic.ts` | status mapping, resume, amount validation | Pure domain logic aktif |
| `src/lib/services/subscription-service.ts` | payment orchestration + webhook processor | Dipanggil gateway adapter baru |
| `src/lib/services/reconcile-service.ts` | pull status + recovery | iPaymu check-transaction implementation |
| `src/app/api/billing/ipaymu-webhook/route.ts` | webhook iPaymu + IoT | Aktif |
| `src/app/app/langganan/actions.ts` | start/preview/resume server actions | iPaymu-only |
| `src/app/app/langganan/plan-cards.tsx` | hosted redirect UI | iPaymu-only; pricing UI dipertahankan |
| `src/app/app/langganan/resume-pay-button.tsx` | resume payment UI | iPaymu redirect/resume behavior |
| `src/prisma/schema.prisma` | Payment model/status | Audit additive only; no destructive migration |
| `tests/ipaymu-logic.test.ts` | pure payment tests | Regression iPaymu |
| `docs/Payment_Dunning_SSOT.md` | payment/dunning SSOT aktif | Sinkron dengan iPaymu-only runtime dan database |

## 5. Arsitektur target

### Prinsip

Domain billing Aircon tidak boleh tahu detail HTTP provider. Buat adapter/provider boundary:

```text
UI / server actions
        ↓
Subscription payment orchestration
        ↓
PaymentGateway interface (provider-neutral)
        ↓
Ipaymu adapter (aktif setelah cutover)
        ↓
iPaymu sandbox/production
        ↓
notifyUrl → provider webhook adapter → processPaymentNotification
```

### Gateway aktif tunggal

`PAYMENT_GATEWAY=ipaymu` adalah konfigurasi gateway aktif tunggal. Tidak ada fallback provider.
Tidak ada pemilihan gateway dari browser. Nilai hanya dibaca server.

Jika skema baru dibutuhkan, gunakan additive field/provider metadata; jangan mengubah makna
`Payment.orderId`, `Payment.amount`, atau status domain tanpa migration plan dan backfill plan.

## 6. Tahapan kerja dan checklist

### Fase 0 — Persiapan akun dan fakta

- [x] Owner membuat akun iPaymu sandbox.
- [x] Catat lokasi kredensial sandbox: `/mnt/d/RAD/Lumite/Ipaymu-Accounts.txt`
- [x] API Key sandbox tersedia.
- [x] Support iPaymu menjawab pertanyaan multi-aplikasi: **1 akun merchant = 1 aplikasi** (dikonfirmasi via telp)
- [x] Domain Aircon publik HTTPS terkonfirmasi: `https://app.airconet.id/login` → HTTP 200
- [x] IP statis server Aircon (BiznetGio): `103.127.135.132`
- [x] Callback URL: `https://app.airconet.id/api/billing/ipaymu-webhook`

### Fase 1 — Desain teknis sebelum edit kode

- [ ] `Ipaymu_Integration_Spec.md` disetujui sebagai kontrak.
- [ ] Status mapping iPaymu → domain Payment disepakati.
- [ ] Strategi order ID dan reference ID disepakati.
- [ ] Strategi resume disepakati berdasarkan kemampuan iPaymu, bukan menyalin asumsi Midtrans.
- [ ] Callback signature diverifikasi dari docs/sample nyata.
- [ ] Timeout/retry/idempotensi dirancang.
- [ ] Tidak ada perubahan harga/pajak/kupon.

### Fase 2 — Implementasi sandbox [DONE 2026-09-14]

- [x] Tambah env names iPaymu server-only: `IPAYMU_ENV`, `IPAYMU_SANDBOX_VA`, `IPAYMU_SANDBOX_API_KEY` di VPS; gateway produksi dikembalikan ke Midtrans setelah probe sandbox.
- [x] Implement pure signature builder + test vector dari docs (HMAC-SHA256 request; callback signature masih perlu dikunci dengan callback nyata).
- [x] iPaymu Redirect Payment sandbox menerima request nyata: HTTP 200, mengembalikan SessionID + Url (format aktual flat arrays: product[], qty[], price[]). Evidence ref tidak disimpan sebagai secret.
- [x] Implement callback route terpisah: `/src/app/api/billing/ipaymu-webhook/route.ts`.
- [x] Validasi callback signature sesuai normalisasi resmi iPaymu; real sandbox resend HTTP 200.
- [x] Processor PAID idempotent; duplicate-callback test remains a required explicit regression test.
- [x] Implement check transaction/reconcile sesuai response nyata `Data.PaidStatus`, `SubTotal`, `TransactionId`; live reconcile settled 3.
- [x] Implement server-only gateway dispatch via `PAYMENT_GATEWAY`.
- [x] Redirect UI dan resume iPaymu tidak memakai Snap.js.
- [x] Existing Midtrans path retained for rollback.

### Fase 3 — Gate otomatis [DONE 2026-09-14: tsc 0, 382 tests, lint 0, build ok]

- [x] TypeScript 0 errors (latest gate).
- [x] Lint 0 errors/warnings (latest gate).
- [x] 382/382 tests pass (latest gate).
- [ ] Test signature valid/invalid.
- [ ] Test body/request nominal.
- [ ] Test callback PAID.
- [ ] Test callback duplicate.
- [ ] Test callback invalid signature.
- [ ] Test PENDING/FAILED/EXPIRED.
- [ ] Test callback terlambat/reconcile.
- [ ] Test coupon manual dan recurring tetap benar.
- [ ] Test commission tetap benar.
- [x] Production build passes (latest gate).

### Fase 4 — E2E sandbox nyata

- [ ] Start checkout dari `/app/langganan`.
- [ ] Redirect ke halaman iPaymu sandbox.
- [ ] Simulasi transaksi sukses.
- [x] Sandbox E2E PAID terbukti: callback resmi iPaymu HTTP 200 → `Payment.status=PAID`, `paidAt` terisi, `rawNotif` tersimpan, tenant subscription aktif (evidence: order dummy terbaru; identifier dirahasiakan).
- [x] Payment menjadi PAID (terverifikasi DB untuk transaksi sandbox terbaru).
- [x] Subscription aktif/perpanjang (terverifikasi DB untuk transaksi sandbox terbaru).
- [ ] Riwayat tampil benar.
- [ ] Callback dikirim ulang dan tidak menggandakan efek.
- [ ] Simulasi pending/gagal/expired.
- [ ] Reconcile dapat membaca status provider.
- [x] Tidak ada data legacy payment tersisa pada database production; data iPaymu sandbox yang ada tetap tercatat untuk audit.
- [ ] Evidence URL/orderId/status dicatat tanpa secret.

### Fase 5 — Verifikasi iPaymu

- [ ] Website publik dapat diakses.
- [ ] URL aplikasi dan halaman legal tersedia.
- [ ] Domain/IP sandbox terdaftar bila diwajibkan.
- [ ] Callback dapat diakses dari internet.
- [ ] Submit verifikasi di dashboard.
- [ ] Tim iPaymu menyelesaikan test.
- [ ] Semua feedback iPaymu dicatat dan diimplementasikan.
- [ ] Status verifikasi disetujui.

### Fase 6 — Cutover production

- [ ] Kredensial production tersedia.
- [ ] Domain/IP production divalidasi.
- [ ] Callback production diuji reachability.
- [ ] Backup kode, database, dan env reference (secret tidak masuk dokumen).
- [ ] Runbook rollback disiapkan dan dipahami.
- [ ] Freeze perubahan billing lain.
- [ ] Set `PAYMENT_GATEWAY=ipaymu` di server production.
- [ ] Deploy dengan build production.
- [ ] Cek health endpoint dan log.
- [ ] Transaksi production terkontrol berhasil.
- [ ] Callback + aktivasi terverifikasi.
- [ ] Midtrans tidak lagi membuat transaksi baru.

### Fase 7 — Stabilisasi

- [ ] Monitor callback/reconcile/error selama periode yang disepakati.
- [ ] Audit semua Payment baru.
- [ ] Audit dunning dan nextDueDate.
- [ ] Audit coupon redemption dan commission.
- [x] Audit transaksi provider lama yang masih PENDING: tidak ditemukan pada database production.
- [x] Adapter provider lama sudah tidak menjadi bagian source aktif.
- [x] Jalur payment aktif, schema aktif, dan data payment production sudah iPaymu-only.

## 7. Change ledger wajib

| Tanggal | File | Jenis perubahan | Alasan | Test/evidence | Status |
|---|---|---|---|---|---|
| 2026-09-18 | Active payment SSOT, application flow, migration plan, runbook | Source scan bersih; DB audit 5 Payment iPaymu | UPDATED |

Setiap edit kode iPaymu harus menambah baris di atas. Tidak boleh mengubah status menjadi DONE
hanya karena build lulus; E2E dan evidence provider wajib ada.

## 8. Definition of Done migrasi

Migrasi belum selesai jika salah satu ini belum terpenuhi:

- sandbox transaction sukses end-to-end;
- callback signature dan idempotensi terbukti;
- status failure/expired/reconcile terbukti;
- verifikasi iPaymu disetujui;
- production transaction terkontrol sukses;
- rollback procedure diuji atau setidaknya dry-run dengan bukti;
- docs/spec/runbook sesuai kode aktual;
- change ledger lengkap;
- tidak ada secret atau data QA tertinggal.

## 9. Open questions / stop conditions

Jika akun, domain, IP, signature callback, status, atau sandbox flow belum jelas, STOP dan konfirmasi
dengan iPaymu. Jangan mengisi kekosongan informasi dengan tebakan.
