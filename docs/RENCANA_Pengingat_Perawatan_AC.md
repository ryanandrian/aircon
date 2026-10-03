# RENCANA — Modul "Pengingat Perawatan AC" (Aircon)

> **STATUS FILE INI**: rencana kerja, BUKAN laporan audit. Dibuat 2026-10-03 atas perintah user.
> **ATURAN LANJUT KOMPaksi/SESI BARU**: baca file ini dulu. Setiap fase punya checklist
> `[ ]` / `[x]` — **penanda progres adalah satu-satunya sumber kebenaran**. Jangan mengulang
> fase yang sudah `[x]`, jangan menyusun ulang rencana. Jika pengerjaan menyimpang,
> perbarui file ini di saat itu juga.

---

## 0. ATURAN KERJA (mengikat)

1. **TDD** (`test-driven-development`): tes RED dulu → GREEN → REFACTOR. Lihat `tests/*.test.ts` pola yang ada.
2. **Gate setiap fase** wajib lulus sebelum tandai `[x]`:
   `pnpm exec tsc --noEmit` · `pnpm exec eslint` · `pnpm test` · `pnpm run build`
3. **Deploy** hanya lewat `bash scripts/deploy-vps.sh` (lihat `AGENTS.md`). Gate lulus → commit → push → deploy → pastikan `PASS`.
4. **Apa pun yang menyentuh database** = backup dulu (pola `backup-*.json`, di-gitignore) → ubah → verifikasi baca-balik.
5. **Tanpa asumsi**: klaim tanpa bukti = "BELUM DIVERIFIKASI". Verifikasi selalu lewat perintah nyata.
6. **Helicopter view**: sebelum mengubah satu modul, grep dulu pembaca/penulisnya (pola survei §2).

---

## 1. FAKTA DASAR (hasil deep dive 2026-10-02/03 — semua terverifikasi)

### 1.1 Alur produksi yang sudah jalan
```
job COMPLETED → nextServiceDate dihitung (Asset.maintenanceIntervalDays ?? Tenant.maintenanceIntervalDays ?? 90)
             → RepeatReminder(QUEUED, leadTimeDays = Tenant.reminderLeadDays = 3)  [job-service.ts:97,107]
cron harian   → listDueReminders: dueDate - leadTimeDays <= sekarang                [reminder-service.ts:11]
             → digabung per pelanggan → 1 pesan                                    [runDueRemindersAllTenants]
             → MessageLog(QUEUED) + RepeatReminder = SENT (transaksi atomik)       [reminder-service.ts:105-117]
flusher       → MessageLog QUEUED → gatewaySend → SENT/FAILED + gatewayMessageId   [message-dispatch-service.ts]
callback      → status naik monoton: QUEUED < SENT < DELIVERED < READ              [api/wa/callback/route.ts]
```

### 1.2 Angka produksi (2026-10-03, DB live)
- `UNIT_aktif=141` · `JATUH_TEMPO(<=hari ini)=94` · `JOB_terbuka=20` · `UNIT_tanpa_pengingat=85`
- `QUEUED (tenant ada)=4`, **sudah masuk rentang kirim = 0**
- `SENT (tenant ada)=55`, **17 di antaranya `sentAt=null`** (tidak bisa dikorelasi lewat waktu)
- Pesan pengingat: 39 (34 SENT, 5 FAILED). Pesan `FAILED` tetap membuat reminder `SENT` → **status pengingat tidak menggambarkan kegagalan**.
- `REPEAT_ALL=65`, **6 yatim** (tenant sudah dihapus - sisa sesi purge) -> **SUDAH DIBERSIHKAN 2026-10-03** (+6 `ReviewRequest`); `lumite-platform` 3 baris MessageLog DIPERTAHANKAN (pseudo-tenant sah di kode). Backup `backup-orphan-reminders.json`.
- **DATA DUMMY JANGAN JADI DASAR (perintah user 2026-10-03):** seluruh `55 SENT` dan `21 job tanpa pengingat` berasal dari **Jaya Mandiri (dummy)**. Tenant riil (Jassa/ADI/Buana) = 0 pengingat. Validasi angka di modul ini WAJIB pakai data uji buatan.
- **CATATAN FASE 0 (perbaikan terpisah, butuh izin):** 18 dari 37 kolom `tenantId` **TANPA FK** di DB -> hapus Tenant meninggalkan yatim otomatis; `purgeTenantData` menghapus 22 tabel tapi **tidak `ReviewRequest`**. Sudah dibuktikan lewat query `information_schema` 2026-10-03.

### 1.3 Sudah ada (jangan dibuat ulang)
| Hal | Bukti |
|---|---|
| Logika money-loop lengkap | `src/lib/domain/money-loop.ts`, `reminder-service.ts`, `job-service.ts` |
| Status kirim + callback monoton | `MessageLog.status`, `api/wa/callback/route.ts` |
| Korelasi reminder↔MessageLog **tanpa kolom baru** via `sentAt` ±5s (uji 10/10 cocok) | uji 2026-10-03 |
| Enum penutupan: `DISMISSED`, `EXPIRED`, `CONVERTED` | `prisma/schema.prisma` `ReminderStatus` |
| Fungsi `CONVERTED` (`createRepeatJob`) — tak pernah dipanggil | `reminder-service.ts:133` |
| `reminderExpireDays:14` — tak pernah dipakai | `money-loop.ts:10` |
| Guard plan `Tenant.plan` + UI edit `PlanConfig` admin | `schema.prisma`, `admin/config-actions.ts` |
| Template `reminder`/`reminder_multi` bisa diedit tenant | `message-template-service.ts` (EDITABLE_KEYS) |
| Pola link `wa.me` (8 pemakaian) | grep `wa.me src/app` = 8 |
| Kernet: `AssignmentRole.KERNET` + assignment service multi-role | `schema.prisma`, `assignment-service.ts` |
| Pola halaman inbox (rujukan desain user) | `src/app/app/leads/` = page.tsx(23) + inbox(69) + actions(36) |
| Test harness mock Prisma | `tests/reminder-batch.test.ts`, `message-dispatch.test.ts` |
| Deploy 1-perintah + rollback otomatis | `scripts/deploy-vps.sh` (terbukti PASS 6x) |

### 1.4 BELUM ada (perlu dibuat — sumber pekerjaan)
- Hitungan "jatuh tempo" untuk FE tenant (yang di `/app/laporan` = jatuh tempo **invoice**, beda).
- Layar riwayat pengiriman pengingat (siapa/unit/kapan/status) untuk tenant.
- Penyaring paket di runner pengingat (`runDueRemindersAllTenants` kini `select:{id:true}` saja).
- Flag `autoReminder` di `PlanConfig` (usulan desain — TIDAK ada di repo saat ini).
- Field kernet di form pekerjaan baru (form hanya punya teknisi).
- Tulisan status `DISMISSED`/`EXPIRED` (enum ada, penulis nol).

---

## 2. PETA AREA TERKAIT (survei helicopter-view — siapa menyentuh apa)

**DB:** `RepeatReminder` (dibuat job-service, dibaca dashboard+reminder, dihapus dunning-purge) · `MessageLog` (ditulis reminder/dunning/sweeper, dibaca flusher+callback) · `Asset.nextServiceDate` (ditulis job-service, dibaca dashboard/card pelanggan/kartu publik riwayat) · `Tenant` (lead+maintenance, dipakai runner) · `PlanConfig` (admin-only) · `JobOrder`+`JobAssignment` (konversi) · `Customer` (tujuan WA).

**BE (jalur tak langsung):**
- `flushQueuedMessages` dipanggil **2 endpoint**: `cron/reminders` DAN `cron/dunning` → perubahan antrean memengaruhi dunning & sweeper.
- `dunning-service` menulis `MessageLog(QUEUED)` dengan `templateKey` berbeda → query status perlu menyaring `templateKey` pengingat.
- `purgeTenantData` menghapus `repeatReminder` (terbukti belum lengkap — lihat risiko R1).

**FE:**
- Menu: `app-nav.tsx` (satu sumber, sidebar desktop + drawer mobile).
- Terdampak langsung: `/app/page.tsx` (metrik), halaman baru `/app/pengingat/*`.
- Rujukan & terkait: `leads/*` (pola), `pelanggan/[id]/customer-hub.tsx` (tampil jadwal+riwayat), `pekerjaan/actions.ts#actionCreateJob` (target konversi), `panduan`+`help/content-owner.ts` (dokumentasi user), `riwayat/[token]` (kartu publik — indikator "jatuh tempo" sudah ada, jangan tercampur).

---

## 3. FASE KERJA

> Penanda: `[ ]` belum · `[x]` sudah. **Perbarui baris ini setiap selesai satu sub-item.**

### FASE 0 — PERSIAPAN & BERSIHKAN SISA DATA  `status: [x]`
- [x] 0.1 Backup -> hapus 12 baris yatim ASLI (RepeatReminder 6 + ReviewRequest 6). `lumite-platform` 3 baris MessageLog DIPERTAHANKAN (pseudo-tenant sah di kode). Verifikasi: yatim keduanya = 0. Backup `backup-orphan-reminders.json` sha256 `f4410548...`.
- [x] 0.2 KEPUTUSAN KRITIS (R2): **korelasi tanpa kolom baru**. Dasar kode: `MessageLog` dibuat & `RepeatReminder->SENT` dalam SATU `$transaction` (reminder-service.ts:105-117) -> join `tenantId + customerId + templateKey in {reminder,reminder_multi}` + `at ~= sentAt (+-5s)` = relasi DIJAMIN KODE. Bila `sentAt` null/tak ketemu -> status **"Tidak diketahui"** (jangan menebak). Menangkap `FAILED` yang selama ini menyesatkan.
- [x] 0.3 Tidak ada perubahan kode (hanya data + dokumen) — gate penuh kemudian lulus pada FASE 1 (TSC/LINT/test/build 0).

### FASE 1 — SUMBER DATA: VIEW PENGINGAT PER UNIT  `status: [x]`
- [x] 1.1 TDD `listReminderInbox(tenantId)` di `reminder-service.ts` — RED 15 gagal -> GREEN 15/15. Aturan due dikunci: `nextServiceDate - Tenant.reminderLeadDays <= sekarang`. Isi: unit + pelanggan + `waLink` + korelasi status via MessageLog (sentAt +-5s, sesuai 0.2) + `overdueDays`.
- [x] 1.2 Gate lulus: TSC 0, LINT 0, **425 tes** (46 file), BUILD 0. Audit dampak: 0 baris fungsi lama dihapus; pemakai cron utuh; nol circular import; kedua query terindeks (`Asset[tenantId,nextServiceDate]`, `MessageLog[tenantId,customerId,at]`).

### FASE 2 — HALAMAN BARU `/app/pengingat`  `status: [x]`
- [x] 2.1 TDD `actionCloseReminder` — RED gagal kemudian GREEN 6/6 tes (role OWNER/ADMIN, tenant-scoped, tolak CONVERTED/tenant asing/bukan string).
- [x] 2.1b **Konversi ke `CONVERTED` DITUNDA ke FASE 5** (5.1) — butuh form pekerjaan prefill + tautan reminder->job; diresmikan di sini akan membuat alur konversi setengah jadi.
- [x] 2.2 `page.tsx` + `inbox.tsx` + `actions.ts` jadi. **Kepatuhan FE (perintah user: jangan buat komponen baru):** 0 file di `src/components/ui`; import identik pola `leads` (Button/Badge/Card/Icon/sonner/Link); badge status diseragamkan ke kelas `bg-muted` milik leads; empty state div border-dashed persis leads; `<details>` sudah dipakai repo (`src/app/page.tsx:538`), bukan penemuan baru.
- [x] 2.3 Menu `Icon.Repeat` di `app-nav.tsx` di antara Pelanggan & Pekerjaan (Booking Online tetap `Icon.Bell` — tanpa bentrok ikon).
- [x] 2.4 Gate lulus: TSC 0, LINT 0, **437 tes** (47 file), BUILD 0, route `/app/pengingat` muncul di build output. (deploy menyusul setelah FASE 3, satu rilis.)
- **Sisa FASE 2 yang pindah ke FASE 5:** tombol "Jadikan Pekerjaan" mengirim query param tetapi `job-form.tsx` belum memprosesnya; `helpKey="pengingat"` belum ada topik bantuan (aman: getHelpTopic -> null, tombol ? tidak tampil).

### FASE 3 — CARD RINGKASAN  `status: [x]`
- [x] 3.1 Metrik Ringkasan diganti: query `repeatReminder.count(QUEUED)` DIHAPUS, diganti `listReminderInbox(tenantId).then(r => r.length)` — SATU sumber dengan halaman (R10 tertutup). Label "Pengingat Aktif" -> **"Jatuh Tempo"**, ikon `Icon.Bell` -> `Icon.Repeat`, `href="/app/pengingat"` (kini kartu bisa diklik, sebelumnya bukan link).
- [x] 3.2 Gate lulus: TSC 0, LINT 0, **437 tes** (47 file), BUILD 0.

### FASE 4 — GATE PAKET (Trial tanpa kirim otomatis)  `status: [x]`
- [x] 4.1 TDD runner: RED lalu GREEN 3/3 (`tests/reminder-plan-gate.test.ts`) — tenant paket `autoReminder=false` DILEWATI; config hilang = auto ON (default aman); semua ON = semua terproses.
- [x] 4.2 Kolom `PlanConfig.autoReminder Boolean @default(true)` + migrasi `20261003011000` dijalankan `prisma migrate deploy` (hanya migrasi ini, tanpa reset). Checkbox "Pengingat servis otomatis" di `/admin/paket` (satu form/action/service yang sudah ada — 0 file baru).
- [x] 4.3 Data live: TRIAL=false, PROFESSIONAL=true, BUSINESS=true, DB default=true. Backup `backup-plan-auto-reminder.json` sha256 `41cbfc2e...`. Karena Tenant TRIAL disaring runner, tenant Trial otomatis TIDAK dikirim -> status inbox tetap `BELUM_DIKIRIM` (bukan SENT) — konsisten R2.
- [x] 4.4 Gate: TSC 0, LINT 0 (bersih), **442 tes** (48 file), BUILD 0. Migrasi sudah di-apply (tidak menumpuk di deploy).

### FASE 5 — KONVERSI & PENUTUPAN  `status: [x]`
- [x] 5.1 Konversi via `actionCreateJob(reminderId)` — RED 1 gagal -> GREEN 7/7. Guard tenant-scoped: reminderId asing/unit beda/status CLOSED TIDAK diubah tapi job tetap dibuat (operasi utama tak diblokir). Prefill `?assetId&customerId&reminderId` di page form DIPERIKSA ULANG terhadap opsi tenant-scoped (ID asing tidak pernah dirender). Alasan pakai `actionCreateJob` (bukan `createRepeatJob`): tombol harus membawa user ke form yang bisa isi jadwal+teknisi; `createRepeatJob` tetap DRAFT tanpa jadwal. Catatan: `createRepeatJob` TETAP tak terpanggil (tak dihapus — ada, tak dipakai, dokumentasikan).
- [x] 5.2 **BATAL — alasan terverifikasi survei:** kernet SUDAH punya UI lengkap di detail pekerjaan (`owner-actions.tsx` + `actionAssignTeam` multi-peran, tersedia dari `page.tsx` utk status ASSIGNABLE). Menambah selector kernet di form baru = duplikasi UI (melanggar "jangan buat komponen baru"). Penugasan kernet tetap lewat jalur yang ada setelah job jadi.
- [x] 5.3 Auto-`EXPIRED` — RED 4 gagal -> GREEN 5/5 (`expireDueReminders`, dipanggil sekali di awal worker harian, spec `BuildSpecPack_Part3` baris 37 = lewat due+14). **Semantik dikunci dgn justifikasi:** hanya `SENT` yang di-expire; `QUEUED` TIDAK (kalau di-expire, pengingat belum terkirim hilang permanen — anti-duplikat unique(tenant,asset,dueDate) memblokir pembuatan ulang). Batas hari dari `REPEAT_DEFAULTS.reminderExpireDays` (bukan angka lekat). "Tanpa aksi" = tidak di-COMPLETE/DISMISSED lewat inbox dalam 14 hari.
- [x] 5.4 Gate: TSC 0, LINT 0, **454 tes** (50 file), BUILD 0.

### FASE 6 — PENUTUP: DOKUMEN PENGGUNA + VERIFIKASI LIVE  `status: [x]`
- [x] 6.1 Topik bantuan `pengingat` di `content-owner.ts` (langkah meniru label tombol asli; duplikat (group,order) terdeteksi lewat verifikasi parser 24 entry lalu dibersihkan; order Mengelola Pekerjaan disusun ulang mengikuti urutan menu).
- [x] 6.2 Smoke test end-to-end READ-ONLY `tests/reminder-smoke-live.test.ts` (DB asli, skip bersih tanpa DATABASE_URL agar CI aman; loads .env via dotenv). Repo TIDAK punya kerangka e2e browser (terverifikasi: tak ada playwright/puppeteer) — alur lengkap dibuktikan lewat test kirim di 6.3.
- [x] 6.3 Deploy final + **TEST KIRIM NYATA lewat jalur produksi resmi** (`/opt/aircon-app/run-cron.sh reminders` = jalur systemd timer): response `{"ok":true,"tenants":1,"sent":1,"failed":0,"dispatch":{"configured":true,"sent":1}}`. Pengingat `QUEUED->SENT`; `MessageLog` `SENT` ke 6281284848901, gatewayMessageId `1790968107708-174`; **pesan terkonfirmasi muncul di HP pemilik** (2026-10-03). Guard terbukti: dari 5 QUEUED hanya 1 lolos (4 tenant lain = TRIAL `autoReminder=false` + jadwal Desember) — gate FASE 4 berfungsi di produksi TANPA dinonaktifkan.
- [x] 6.4 Bukti tercatat (bagian 6. below).
- **BELUM DIVERIFIKASI (jujur):** status pesan masih `SENT`, belum `DELIVERED`/`DIBACA` — callback gateway belum menaikkan status. Pengiriman sendiri terbukti (sampai ke HP). Tahap naik status ini bergantung callback gateway, bukan kode aplikasi.

### FASE 7 — FOLLOW-UP: STATUS TERKIRIM GANDA + URUTAN KARTU  `status: [x]`
Permintaan user 2026-10-03 (dibahas & disepakati berdua sebelum dikerjakan):
- [x] 7.1 **Urutan default kartu** — sebelumnya TIDAK ADA `orderBy` (urutan tak terjamin,
      terverifikasi: tak ada sort di service maupun FE). Kini sort di `listReminderInbox`
      (SATU sumber utk daftar + kartu Ringkasan): `overdueDays` menurun -> `nextServiceDate`
      menaik -> `customerName` menaik (`localeCompare 'id'`). Sengaja TIDAK memakai
      `sendStatus` (kartu tak boleh bergeser saat status berubah mengikuti pengiriman).
- [x] 7.2 **Terkirim terpecah jadi dua**: `TERKIRIM_OTOMATIS` (bukti `MessageLog` + callback
      gateway) vs `TERKIRIM_MANUAL` (konfirmasi tenant setelah kirim via WhatsApp sendiri).
      *Penanda data:* kolom baru `RepeatReminder.manualSentAt` (nullable, additive,
      migrasi `20261003040000_reminder_manual_sent` — di-apply via `migrate deploy`).
      *Bukti menang:* cari `MessageLog` cocok -> status gateway apa adanya (GAGAL pun
      ditampilkan); tanpa pasangan korelasi + `manualSentAt` -> `TERKIRIM_MANUAL`;
      keduanya kosong -> `TIDAK_DIKETAHUI` (jangan menebak).
      *Aksi FE:* tombol "Tandai Terkirim" (baru) -> `actionMarkReminderSentManual`
      (tenant-scoped, hanya QUEUED/SENT, role OWNER/ADMIN) — MENYIMPAN KONFIRMASI TENANT,
      tidak pernah mengklaim gateway mengirim. Tombol tampil saat status
      BELUM_DIKIRIM / MENUNGGU_KRIM / TIDAK_DIKETAHUI & punya `reminderId`.
- [x] 7.3 **Filter tab "Terkirim"** (belum diverifikasi saat diskusi, kini sudah dikerjakan):
      predikat diperluas jadi `["TERKIRIM_OTOMATIS","TERKIRIM_MANUAL","DITERIMA","DIBACA"]`
      — tanpa ini kedua status baru hanya muncul di chip "Semua" (bukti: simulasi predikat
      sebelumnya memperlihatkan status baru jatuh ke SEMUA saja).
- [x] 7.4 Bantuan user (`content-owner.ts`) disesuaikan: daftar status + langkah
      "Tandai Terkirim" — supaya label bantuan = label layar.
- [x] 7.5 Gate: TSC 0, LINT 0, **466 tes (51 file)**, BUILD 0. Migrasi `manualSentAt`
      tercatat & ter-apply (49 migrasi). Smoke DB asli ikut menangkap kolom belum ada
      sebelum migrasi — persis fungsinya.

**Progres ringkas: FASE 0 [x] · 1 [x] · 2 [x] · 3 [x] · 4 [x] · 5 [x] · 6 [x] · 7 [x]**

---

## 4. HAMBATAN YANG SUDAH DIANTISIPASI (RISIKO + MITIGASI)

| # | Risiko (dasar) | Dampak | Mitigasi (wajib) |
|---|---|---|---|
| **R1** | `purgeTenantData` tak menghapus `TenantAttribution` & `RepeatReminder` yatim → webhook/cron gagal (FK RESTRICT) | cron dunning 500 → flusher ikut batal | Selesaikan FASE 0.1 dulu; pertimbangkan lengkapi daftar hapus di purge (tapi = perubahan BE terpisah, minta izin) |
| **R2** | 17 dari 55 `SENT` punya `sentAt=null`; `FAILED` tetap membuat reminder `SENT` | status di UI bisa menyesatkan (poin user!) | Keputusan 0.3. Opsi A: korelasi lewat waktu (terbukti 10/10 utk tenant ada). Opsi B: tambah kolom `messageLogId` di `RepeatReminder` (migrasi ADD COLUMN, tapi jalur tulis harus disentuh di `sendCustomerReminderWa`) |
| **R3** | `prisma migrate dev` menolak di DB ini (minta reset = **hapus semua data**) | BENCANA | Selalu `migrate deploy` saja, atau SQL manual terarah + verifikasi (pola `20261002230000_reminder_lead_default_3` yang sudah terbukti aman) |
| **R4** | `flushQueuedMessages` dipanggil cron dunning juga → perubahan status mengganggu billing | pesan tunggakan gagal kirim | Gate: `tests/dunning.test.ts` + `message-dispatch.test.ts` harus tetap lulus; jangan ubah kontrak `MessageLog` |
| **R5** | Auto-`EXPIRED` mengubah hitungan metrik mendadak (reminder hilang sendiri dari daftar) | user bingung angka turun tanpa aksi | Jalankan setelah FASE 3; tampilkan riwayat "Kedaluwarsa" di filter, bukan menghapus data |
| **R6** | Perubahan metrik Ringkasan mengubah angka yang mungkin dipakai/dikutip | inkonsistensi UI | Bandingkan angka lama-vs-baru sebelum deploy (logikanya beda: `QUEUED semua` vs `sudah masuk rentang`) |
| **R7** | `PlanConfig.autoReminder` = kolom baru → Prisma client harus di-generate | build gagal | `pnpm run build` sudah termasuk `prisma generate` — jalankan gate penuh sebelum commit |
| **R8** | Modul inti → regresi money-loop (pengingat tak terkirim = nol revenue) | kerugian bisnis langsung | Gate 410+ tes wajib hijau; `reminder-batch.test.ts` & `money-loop` tak boleh diubah kecuali ada alasan berbukti |
| **R9** | Mengubah `ReminderStatus`/`sendCustomerReminderWa` merusak batching & idempoten | kirim ganda / gagal | Jangan sentuh fungsi tulis kecuali fase terkait; tes `reminder-batch` lulus |
| **R10** | User melihat angka beda antara kartu Ringkasan & isi daftar (dual query) | hilang kepercayaan | FASE 1 memaksa SEMUA (kartu + halaman) memakai **satu** fungsi `listReminderInbox` |
| **R11** | Cron `reminders` di produksi **belum diverifikasi** dari VPS | angka tidak pernah bergerak otomatis | Saat FASE 6: verifikasi di VPS (systemd timer / eksternal), jangan asumsi dari keberhasilan 13 pesan historis |

---

## 5. PRINSIP DESAIN (dari permintaan user, 2026-10-03)

1. Kartu **"Pengingat Aktif" dihapus** dari Ringkasan → diganti **"Jatuh Tempo"** dan tautan ke daftar.
2. Halaman baru = **daftar unit jatuh tempo** (rentang: `Tenant.reminderLeadDays` hari sebelum jadwal servis — kini 3).
3. Menu **di antara Pelanggan dan Pekerjaan**; bisa juga dibuka dari card Ringkasan.
4. Tiap kartu: info unit **+ pelanggan** → riwayat unit → **status kirim WA** → aksi: Kirim Pengingat (Trial, `wa.me` + template), Buka WhatsApp (follow-up), Jadikan Pekerjaan, Tutup Pengingat.
5. **Trial = tanpa kirim otomatis** (paket `autoReminder=false`), status `Belum dikirim`, tenant kirim manual lewat tombol.
6. Status terus bergerak mengikuti follow-up; pengingat bisa **dikonversi** ATAU **ditutup** → tidak pernah menumpuk selamanya.
7. Rancangan selaras dengan pola Booking Online (pola `leads/`) — modul ini **inti produk**, kerja teliti & tuntas.

---

## 6. BUKTI / LOG (isi saat mengerjakan — jangan hapus)

> **SEMUA FASE SELESAI — 2026-10-03.**
>
> **Commit (urut):** `aa11bca` rencana · `4cc0035` FASE 1 · `681f6de` FASE 2 · `4c71ff3` FASE 3 · `3a89599` FASE 4 · `f940415` FASE 5 · `8d692e8` FASE 6. Semua push ke `origin/main`.
>
> **Gate akhir (per fase & akhir):** TSC 0 · LINT 0 bersih · **455 tes (51 file)** · BUILD 0.
>
> **Migrasi DB (jalur aman `migrate deploy`, tanpa reset):** `20261002230000_reminder_lead_default_3` (lead 7→3), `20261003011000_plan_config_auto_reminder` (autoReminder, default true).
>
> **Deploy PASS:** rilis `8d692e8` (sebelumnya `1ca46b9`/`899b44e`); https `/` 200, `/login` 200; `current` = release baru; release bersisa 2; `source-sha` cocok.
>
> **Test kirim nyata (bukti modul inti jalan end-to-end di produksi):**
> - Pemicu: `run-cron.sh reminders` (jalur resmi timer systemd `aircon-reminders.timer`, jadwal harian 02:00 WIB)
> - Response: `{"ok":true,"tenants":1,"sent":1,"failed":0,"dispatch":{"configured":true,"sent":1,"failed":0,"skipped":0}}`
> - Pengingat test `cmurc4mha…`: `QUEUED`→`SENT`, `sentAt 2026-10-02T19:08:26Z`
> - `MessageLog` `cmurc63cn…`: `SENT`, `toPhone=6281284848901`, `gatewayMessageId=1790968107708-174`, `templateKey=reminder`
> - **Pesan terkonfirmasi sampai ke HP pemilik (user), 2026-10-03**
> - Tujuan: pelanggan `Ruko Sentra Niaga` · unit LG · R. Test Pengingat · lewat 1 hari · tenant Jaya Mandiri (PROFESSIONAL, `autoReminder=true`)
>
> **Guard terbukti di produksi:** simulasi eligibility sebelum kirim → dari 5 `QUEUED` hanya **1** lolos; 4 lainnya ganda tertahan (paket TRIAL `autoReminder=false` + jadwal Desember). Tidak ada pesan tak sengaja terkirim ke tenant lain.
>
> **Belum diverifikasi:** status `DELIVERED`/`DIBACA` — callback gateway belum menaikkan status (masih `SENT`).
>
> **Backup data (semua sebelum perubahan):** `backup-tenant-reminder-lead.json` 4059e8b5 · `backup-orphan-reminders.json` f4410548 · `backup-plan-auto-reminder.json` 41cbfc2e · `backup-move-test-pengingat.json` f418d904 · `backup-rename-rsn.json` 5eb391fc · `backup-reminder-buang.json` b5bbed2b.
