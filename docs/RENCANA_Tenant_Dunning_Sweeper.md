# RENCANA KERJA — Perbaikan Alur Tenant Status & Dunning (Sweeper Inaktivitas)

Status dokumen: RENCANA AKTIF (tahan sesi; diperbarui tiap perubahan status)
Dibuat: 2026-10-08 · Owner keputusan: pemilik repo
Eksekusi wajib mengikuti AGENTS.md (gate → commit eksplisit → deploy `scripts/deploy-vps.sh`).

Semua fakta di bawah diverifikasi pada 2026-10-08 dari source + DB produksi (Supabase
pooler, read-only) + log VPS. Jika ada yang diulang di sesi baru, VERIFIKASI ULANG jangan dikutip.

---

## 0. Keputusan pemilik (terkunci)

- K1. **TIDAK ADA trial period.** Pembatasan = kuota jumlah pelanggan & unit AC
  (sudah jalan: `quota-guard.assertQuota` dipanggil `customer-service.ts:203`,
  `asset-service.ts:305,361`; import pelanggan lewat `createCustomer` = ikut guard).
- K2. **Pesan "trial" di onboarding harus dihapus** (T1).
- K3. **Mode simulasi sweeper DIHAPUS dari code & UI**, bukan diperbaiki
  (pilihan pemilik 2026-10-08). Aktivasi sweeper hanya setelah T3 tervalidasi.
- K4. Aktivasi = tahap: (a) kode T3 sudah di-deploy & teruji, (b) nyalakan
  `inactivitySweepEnabled` via /admin/kebijakan dengan ambang lama
  (30/45/52 hari, min 5 pelanggan/3 job, kecuali pernah bayar), (c) baca hasil
  cron ≥1 hari di journal VPS, (d) baru `inactivityDryRun` dihapus dari skema/UI.

---

## 1. FAKTA TERVERIFIKASI (code + DB produksi)

### 1.1 Lifecycle tenant (code)
- Enum `TenantStatus` = TRIAL, ACTIVE, PAST_DUE, SUSPENDED, CANCELLED (`schema.prisma:31-37`).
- Usable = TRIAL/ACTIVE/PAST_DUE (`gating-pure.ts:8-10`); SUSPENDED/CANCELLED ditolak.
- Onboarding membuat tenant: `plan=TRIAL` (label Basic gratis), `status=ACTIVE`,
  `trialEndsAt=null`, `nextDueDate=null` (`onboarding-service.ts:121-134`).
  Komentar di code: "gratis permanen, siklus dunning tak pernah menyentuh".
- `isTrialExpired`/`computeTrialEnd` **tidak pernah dipanggil** (hanya di-re-export) → mesin trial mati total (sesuai K1).
- Satu-satunya penulis status = `setTenantStatus` (`platform-service.ts:135`, via
  `/admin/tenants/[id]` StatusChanger) dan cron dunning.

### 1.2 Dunning (berbasis telat bayar) — jalan
- Filter (`dunning-service.ts:36-42`): `nextDueDate < now` AND status TRIAL/ACTIVE/PAST_DUE
  AND `markedForDeletionAt IS NULL`. → **Basic gratis (nextDueDate null) tak tersentuh.**
- Tahap: >grace(7) → SUSPENDED; >daysBeforeDelete(37) → `markedForDeletionAt=now` (reversible);
  purge terpisah butuh `marked < now-24j` AND status=SUSPENDED (`dunning-service.ts:163-181`).
- Bayar → `activateSubscription` reset `markedForDeletionAt=null` (`subscription-service.ts:101-113`).
- Cron VPS: `aircon-dunning.timer` 01:00 WIB → `/api/cron/dunning`
  (order: runDunningCycle → purgeMarkedTenants → runInactivitySweep → flush WA → platform notify;
  SATU try/catch untuk semua, `route.ts:25-37`).

### 1.3 Sweeper inaktivitas (berbasis telantar) — ADA tapi MATI
- Filter (`inactivity-sweeper-service.ts:120-127`): `nextDueDate IS NULL` AND
  `markedForDeletionAt IS NULL` AND status TRIAL/ACTIVE.
- Keputusan murni `decideInactivityAction`: idle<R1 → none/reset; exempt → none/reset;
  idle≥D → **delete**; ≥R2 → reminder2; ≥R1 → reminder1 (baris 43-56).
- DB produksi `BillingPolicy`: `inactivitySweepEnabled=false`, `inactivityDryRun=true`,
  R1=30, R2=45, D=52, minCustomers=5, minJobs=3, exemptPaid=true.
- Bukti jalan: journal VPS 2026-09-29..10-08 tiap hari
  `inactivity":{"enabled":false,"dryRun":true,"scanned":0,...}` → **tidak pernah bekerja**.
- "Aktivitas" = maks(job.updatedAt, invoice, customer, workSession, user.lastLoginAt,
  tenant.createdAt) (`baris 59-73`). **Kolom `lastActivityAt` TIDAK pernah ditulis/dibaca
  siapapun (0 match src); `User.lastLoginAt` TIDAK pernah ditulis** → hari ini fallback = `createdAt`.

### 1.4 Data 6 tenant produksi (2026-10-08)
| Tenant | status | plan | nextDue | jobs/cust | bayar |
|---|---|---|---|---|---|
| Jaya Mandiri | ACTIVE | PROFESSIONAL | 2026-10-18 | 61/43 | 6 PAID |
| AC Depok Jaya | ACTIVE | TRIAL(Basic) | null | 20/12 | 0 PAID |
| Buana Multi Teknik | ACTIVE | TRIAL(Basic) | null | 0/0 | 0 |
| ADI TEKNIK | ACTIVE | TRIAL(Basic) | null | 0/0 | 0 |
| Jassa Teknik | ACTIVE | TRIAL(Basic) | null | 0/0 | 0 |
| PT Ase Dwimitra Mandiri | ACTIVE | PROFESSIONAL | 2026-11-07 | 0/0 | 1 PAID (QRIS 149.000, 7 Okt) |
- 0 tenant SUSPENDED/PAST_DUE/CANCELLED; 0 `markedForDeletionAt`; 0 TenantAttribution hari ini
  (TES AC sudah dihapus manual 2026-10-08, `UPW87GBC` usedCount 2→1).

### 1.5 Purge / FK (dasar T3)
- `purgeTenantData` (`dunning-service.ts:136-160`) hapus 22 tabel lalu `tenant.delete` — **1 transaksi**.
- FK ke `Tenant` (information_schema): **19 anak**, di antaranya RESTRICT:
  Asset, CouponRedemption, Customer, CustomerPricing, Invite, Invoice, IotOrder,
  JobAssignment, JobOrder, Payment, ServiceCatalog, Subscription, Technician,
  **TenantAttribution**, User, WorkItem, WorkSession; CASCADE: PlatformNotification, TenantNotification.
- **Ketidaklengkapan terbukti**: 3 di antaranya TIDAK ada di daftar hapus:
  **TenantAttribution, CouponRedemption, JobPhoto** (FK `JobPhoto.jobId` RESTRICT → JobOrder).
  → `tenant.delete` pasti ditolak Postgres → seluruh transaksi rollback → `purgeMarkedTenants`
  melempar → route cron 500 → **langkah berikutnya (flush WA + platform notify) gugur hari itu**
  dan berulang tiap hari selama kandidat ada.
- Tabel ber-`tenantId` TANPA FK ke Tenant (akan jadi FOSIL bila tak dihapus): Alert, Campaign,
  CampaignRecipient, CommandLog, CommissionLedger, Device, Lead, MessageLog*, Referral,
  RepeatReminder, ReviewRequest, Telemetry, UnitCode (*MessageLog & RepeatReminder sudah di daftar hapus).
- Kenapa belum meledak: hari ini kandidat purge = 0 (tidak ada marked) dan sweeper OFF.

### 1.6 T2 — pesan status (TERKOREKSI, fakta)
- `src/lib/auth/access.ts` = **DEAD CODE** (0 import) → pesannya tidak pernah tampil.
- Aktif: `getServerContext` (`context.ts:60-70`) → status non-usable (SUSPENDED/**CANCELLED**)
  melempar: "Akun usaha dinonaktifkan karena **tunggakan langganan**. Hubungi pemilik usaha."
- Sampai ke layar HANYA lewat server action yang `instanceof AuthError → return err.message`
  (`pekerjaan/actions.ts:178` → `agenda-board.tsx:141 toast.error`; `pengaturan/maintenance-actions.ts:18`).
- 7 action /app LAIN tidak menangkap AuthError (pesan, perangkat, alert, faktur, checklist,
  langganan, laporan) → uncaught (error generik).
- Halaman /app pakai `tryGetServerContext` → `!ctx` → `redirect("/login?next=...")`;
  sehingga `app/page.tsx:70-71 redirect("/app/langganan?status=nonaktif")` **tidak pernah tercapai**,
  dan `/app/langganan` **tidak pernah membaca** param `status` (0 searchParams).
- Admin bisa set CANCELLED tanpa tunggakan (`status-changer.tsx:21`) → pesan "karena
  tunggakan" menyesatkan + saran "hubungi pemilik usaha" tidak menyelesaikan apa-apa.

### 1.7 T1 — teks onboarding (fakta)
- `src/app/onboarding/page.tsx:66`: "…langsung bisa dipakai. **Gratis coba 14 hari.**"
  Bertentangan dengan K1 & `onboarding-service.ts:127-134`.
- Pembanding benar sudah ada: `/app/langganan` "Anda di paket Basic — gratis selamanya…"
  (`app/langganan/page.tsx:60-62`).

### 1.8 SSOT (fakta)
- SSOT aktif: `docs/Payment_Dunning_SSOT.md` (ditunjuk `docs/README.md:14`).
  Isi cocok utk jalur dunning berbayar, **tapi tidak memuat**: status `CANCELLED`,
  sweeper inaktivitas + nilainya di DB, batasan purge, model gratis-berbasis-kuota.
- `docs/Billing_Midtrans.md` = HISTORICAL → **JANGAN dipakai dasar analisa** (aturan memory).

---

## 2. PEKERJAAN

### T1 — Hapus teks trial di onboarding (FIX kecil) — ✅ SELESAI 2026-10-08
- [x] `src/app/onboarding/page.tsx:66`: "Gratis coba 14 hari" →
      "Gratis untuk selamanya, dengan batas jumlah pelanggan & unit AC sesuai paket."
- Gate: tsc+lint+test+build SEMUA LULUS.

### T2 — Pesan status non-usable sesuai penyebab (FIX) — ✅ SELESAI 2026-10-08
- [x] Helper murni `tenantBlockedMessage(status)` di `gating-pure.ts`:
      SUSPENDED → pesan tunggakan+perpanjang (dipertahankan); CANCELLED →
      "Berhenti (diatur admin)… hubungi Kontak" (TANPA "tunggakan"/"perpanjang");
      default → generik netral.
- [x] Dipakai di guard aktif `context.ts:60-72` (satu-satunya guard yang berjalan).
- [x] Hapus dead code `src/lib/auth/access.ts` (0 pemanggil — terverifikasi).
- [x] Hapus cabang mati `app/page.tsx:70-72` redirect `?status=nonaktif`
      yang tak pernah tercapai & param tak pernah dibaca.
- [x] Test unit 3 kasus (SUSPENDED / CANCELLED / unknown) ditambahkan.
- Gate: tsc+lint+test+build SEMUA LULUS.

CATATAN BELUM DISELESAIKAN (didokumentasikan, bukan dilupakan): 7 action /app
(pesan, perangkat, alert, faktur, checklist, langganan, laporan) memanggil
`getServerContext()` TANPA menangkap `AuthError` → error tak tertangkap.
Ini di luar skop T1/T2 (kualitas error handling), masuk daftar tindak lanjut.

### T3 — Purge tuntas (BLOKER aktivasi sweeper; wajib sebelum K4)
- [ ] T3a. Tambah ke daftar hapus `purgeTenantData`, urut hormati FK:
  `tenantAttribution` (tenantId), `couponRedemption` (tenantId), `jobPhoto` (via jobId → JobOrder milik tenant).
- [ ] T3b. **Test kelengkapan otomatis** (inti "tuntas"): test yang membaca peta FK asli
  dari schema/migrasi (daftar 19 anak Tenant) + daftar tabel ber-tenantId, lalu memastikan
  SEMUA anak tenant-scoped tercakup daftar hapus. Gagal bila ada tabel baru kelewat.
- [ ] T3c. **Isolasi kegagalan**: `purgeMarkedTenants` bungkus tiap `purgeTenantData`
  dengan try/catch + log (1 tenant gagal ≠ mematikan flush WA & platform notify di cron).
- [ ] T3d. Skenario uji A→Z (lihat §3) — semua lulus.
- Gate: tsc+lint+test+build → commit → deploy → verifikasi cron run berikutnya di journal VPS.

### HAPUS mode simulasi (K3) — hanya SETELAH T3 deploy
- [ ] Hapus field `inactivityDryRun` dari schema+DB (migrasi), `runInactivitySweep`
  (cabang dry-run), checkbox UI `policy-editor.tsx:100-103`, `config-actions.ts:75`,
  validasi `billingPolicySchema`, dan summary `wouldDelete`.
- [ ] Gate + deploy. (Dengan ini "simulasi ada tapi tak pernah dipakai" hilang permanen.)

### Aktivasi sweeper (K4) — setelah T3 + penghapusan dry-run
- [ ] Set `inactivitySweepEnabled=true` via /admin/kebijakan (ambang lama).
- [ ] Amati cron 1 hari (scanned>0; deleted=0 diharapkan — kandidat idle <52 hari).
- [ ] Pastikan kekecualian bekerja: AC Depok Jaya (12 cust/20 job) tidak masuk daftar hapus.

### SSOT sync (setelah kode final)
- [ ] Update `docs/Payment_Dunning_SSOT.md`: lifecycle lengkap termasuk CANCELLED,
  model gratis-kuota (tanpa trial), sweeper + nilai BillingPolicy produksi,
  batasan purge nyata (§1.5), urutan cron & fallback per-tenant (T3c), evidence terbaru.

---

## 3. SKENARIO UJI A→Z (untuk T3 — semua WAJIB lulus)

Prinsip: uji di **isolasi** (DB transaksi / test DB), JANGAN menjalankan purge terhadap
6 tenant produksi. Gate otomatis (vitest) = A–F; bukti manual = G–I.

- **A. Kelengkapan schema** — test T3b: semua anak FK Tenant (19) + tabel ber-tenantId
  tercakup daftar hapus. *Lulus bila 0 kelewat.*
- **B. Hapus tenant kaya data** — seed tenant berisi: 1 TenantAttribution (+PartnerCode),
  1 CouponRedemption, ≥1 JobPhoto (via JobOrder), Payment PAID, Subscription, Invoice(+Item),
  Customer(+Asset+CustomerPricing), Technician(+JobAssignment), User, MessageTemplate,
  PlatformNotification, TenantNotification, Campaign/Lead/Device/Telemetry dsb →
  `purgeTenantData(id)` → **sukses, tanpa error FK**. *Lulus bila: baris tenant=0 dan
  seluruh baris anak tenantId=0.*
- **C. Idempoten** — panggil 2× → run ke-2 tanpa error (0 baris dihapus).
- **D. Rollback atomik** — paksa galat di tengah transaksi → **TIDAK ada baris apa pun
  yang hilang** (tenant + anak utuh).
- **E. Relasi tetangga tak tersentuh** — partnerCode & agent pemilik tetap ada;
  usedCount tidak berubah oleh purge (attribution memang ikut terhapus utk tenant tsb).
- **F. Isolasi kegagalan (T3c)** — `purgeMarkedTenants` dgn 2 kandidat, 1 sengaja gagal →
  fungsi TETAP mengembalikan hasil, kandidat gagal ter-log, kandidat baik terhapus,
  dan pemanggil cron lanjut ke langkah flush/notify (**route tidak 500**).
- **G. Dry-run logika di lokal** — `runInactivitySweep` atas data lokal: kandidat delete
  = tenant gratis idle ≥52 hari TANPA kekecualian; exempt (≥5 cust / ≥3 job / pernah bayar)
  tidak muncul.
- **H. Produksi terkendali setelah deploy** — trigger cron manual (Bearer CRON_SECRET) di
  VPS, baca journal: `purged=0`, `inactivity.scanned=0` (sweeper masih OFF), `ok:true`,
  langkah flush+platform notify ikut jalan (bukti urutan tak terputus).
- **I. Aktivasi** — set enabled=true, cron berikutnya: `scanned=4` (tenant gratis),
  `wouldDelete/deleted=0` (semua <52 hari), AC Depok Jaya kekecualian, `ok:true`.

**Definisi SELESAI T3**: A–F lulus di gate test + G lulus lokal + H terbukti di VPS
(`ok:true` tanpa 500) + SSOT diperbarui. Bila salah satu gagal → belum selesai.

---

## 4. CATATAN RANTAI KERJA
Gate: `pnpm test` → `pnpm lint` → `pnpm build` → commit **daftar file eksplisit**
(bukan `-A`, jangan sentuh file secret) → push → `bash scripts/deploy-vps.sh` → setelah PASS berhenti.
Dilarang: mutasi data tenant via DB (perbaikan lewat UI/action resmi); rollback manual.
