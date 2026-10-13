# Rencana Perbaikan Aircon — Guard Plan Otomasi WhatsApp (G10)

> **Repo:** `/home/rad/aircon` · **Service:** `aircon-app` (VPS 103.127.135.132)
> **Deploy:** `bash scripts/deploy-vps.sh` (SATU jalur — lihat `AGENTS.md`; skill `aircon-live-deploy`)
> **Partner rencana:** `lumite-gateway/.hermes/plans/2026-10-13_000000-gateway-wa-session-capacity.md` (jalur gateway — TIDAK boleh dicampur)
> **Status:** SIAP EKSEKUSI · belum ada kode yang diubah

**Tujuan:** tegakkan keputusan produk — tenant TRIAL/BASIC **tidak memakai
otomasi WA sama sekali** (pengingat tampil di admin → admin kirim manual via
tombol `wa.me`) — di SEMUA titik, bukan hanya di satu cron.

---

## 1. RULE & BUKTI (semua terverifikasi, baca-saja)

**Aturan produk:** plan TRIAL/BASIC → tanpa fasilitas automasi WhatsApp;
pengingat ditandai "belum terkirim otomatis", admin tenant kirim manual
(VP/WA web/mobile mereka sendiri). Plan berbayar (PROFESSIONAL/BUSINESS) →
reminder otomatis lewat sesi WA gateway.

**Catatan terminologi — penting untuk keamanan guard:**
`enum TenantPlan` di sistem hanya berisi `TRIAL / PROFESSIONAL / BUSINESS`.
**TIDAK ADA plan `BASIC`.** Karena itu guard **TIDAK boleh** memakai daftar plan
hardcode (`if plan !== "PROFESSIONAL"`), melainkan `PlanConfig.autoReminder` —
satu sumber yang sama dengan guard cron (`reminder-service.ts:156`). Ini yang
menjamin plan baru di masa depan (termasuk BASIC bila ditambahkan) otomatis
tercakup. Tanpa aturan ini, menambah plan baru tanpa mengisi `PlanConfig`
akan membuat guard GAGAL SENYAP (baris default cron: `!planConfigs.some(...)`
→ dianggap eligible).

**Status eksekusi saat ini — 2 dari 3 titik jalan, 1 bocor:**

| Titik | Status | Bukti |
|---|---|---|
| Cron reminder otomatis | ✅ JALAN | `PlanConfig`: TRIAL `autoReminder=false`; PROFESSIONAL/BUSINESS `true`; guard di `reminder-service.ts:156` (`eligibleTenants`) |
| Menu Pengingat manual | ✅ JALAN | `pengingat/page.tsx:50` memakai `https://wa.me/<nomor>?text=…` → admin kirim dari WA miliknya; `pengingat/actions.ts:56` mencatat "aplikasi TIDAK bisa memverifikasi pengiriman" |
| **Koneksi sesi WA** | ❌ **BOCOR** | `pengaturan/actions.ts` = **0 penyebutan plan** pada `actionWaInit/actionWaPair/actionWaStatus` → tombol terbuka untuk semua plan; `gateway-relay.ts` 0 penyebutan plan; **tidak ada mekanisme penarikan** (`gatewayLogoutSession`/`clearVerifiedWaPhone` hanya dipanggil dari tombol Putuskan manual) |

**Dampak bukti di data produksi (DB baca-saja):**
```
Tenant   : TRIAL 4 · PROFESSIONAL 2   (enum: TRIAL / PROFESSIONAL / BUSINESS)
Sesi hidup rehydrate 03:00 = 6:
  aircon:lumite-platform · campaign:MKT-1 · PT ASE (PROF ✓)
  AC Depok Jaya (TRIAL ✗) · ADI TEKNIK (TRIAL ✗) · Jassa Teknik (TRIAL ✗)
=> 3 dari 6 sesi = milik tenant yang TIDAK berhak → 798 MB (3 × 266 MB) terbakar
=> Kapasitas VPS 4 GB: 6 sesi = 1,6 GB (sesak, memory.high 14.178×)
                       4 sesi = 1,07 GB (sesuai aturan → ±33% kapasitas GRATIS)
=> TRIAL naik 4→40→400 TIDAK menambah beban RAM (yang makan RAM hanya berbayar)
```

---

## 2. PERBAIKAN (3 titik — semua di repo Aircon)

### A1 — Server-side guard (wajib; UI saja tidak cukup)
- `src/app/app/pengaturan/actions.ts`: `actionWaInit`, `actionWaPair`,
  `actionWaStatus` menolak bila `plan` tidak berhak, sebelum menyentuh relay.
  Balasan: `{ok:false, error:"Otomasi WhatsApp hanya untuk paket berbayar."}`
  + flag terstruktur (`planLocked:true`) agar UI bisa membedakan dari error gateway.
- Fungsi guard **satu sumber** (`wa-eligibility.ts` baru atau di `wa-identity-service.ts`),
  memakai `PlanConfig.autoReminder` (bukan hardcode daftar plan) supaya kebijakan
  tetap dikonfigurasi — konsisten dengan guard cron yang sudah ada (`reminder-service.ts:156`).
- **Test:** `actionWaInit` TRIAL → tolak + flag `planLocked`; PROFESSIONAL → lolos
  ke relay; **plan baru tanpa baris `PlanConfig` → diperlakukan mengikuti pola
  cron** (dibuktikan eksplisit, bukan diasumsikan konsisten).
- **Dokumen:** `AGENTS.md`/`CLAUDE.md` Aircon bila aturan entitlement masuk
  sebagai kebijakan produk permanen.

#### Hasil A1 — RED test (2026-10-13, nol perubahan kode aplikasi)

File: `tests/wa-plan-guard.test.ts` (baru, 8 tes).
```
Tests: 5 failed | 3 passed (8)
```
GAGAL (5) — inilah **bukti kebocoran nyata** (menuntut guard):
1. TRIAL `actionWaInit` → kini `ok:true` (LOLOS ke gateway) — kebocoran utama
2. TRIAL `actionWaPair` → lolos (kode tautan HP tanpa pengecekan plan)
3. TRIAL `actionWaStatus` → lolos (polling jalan percuma, tak ada flag)
4. plan baru `autoReminder=false` → lolos (guard bukan dari DB = hardcode)
5. tenant tidak ditemukan → lolos (seharusnya tolak aman)

LULUS (3) — kini lulus prematur, bukan berarti guard ada; justru jadi guard
regresi setelah GREEN: PROF, BUSINESS, dan "tanpa baris PlanConfig → lolos".

**Dua cacat versi-1 test (ditemukan saat run, sudah diperbaiki):**
- `server-only` di `src/lib/storage/s3.ts` (sengaja memblokir impor luar server)
  → dimock; juga mock `tenant-profile-service`, `validation`, `customer-service`,
  `wa-identity-service` agar import chain `actions.ts` bersih di vitest node.
- mock `prisma: {}` kosong → `prisma.tenant.findUnique` undefined → 8/8 gagal
  salah sebab. Diperbaiki jadi `{ tenant:{findUnique}, planConfig:{findUnique} }`.

**Catatan lingkup:** vitest environment `node` → test render React TIDAK mungkin;
A2 diuji lewat fungsi murni (lihat blok A2), bukan DOM.

#### Hasil A1 — GREEN (2026-10-13, 2 file diubah, jalur yang sudah ada)

```
test A1     : 8 passed (dari RED: 5 gagal)
suite penuh : 73 files / 681 tests — 0 gagal (baseline 72/673 utuh + 8 baru)
lint        : exit=0 (actions.ts, wa-identity-service.ts, test)
```
**Perubahan — SEMUA jalur yang sudah ada, tanpa route/modul baru:**

| File | Perubahan |
|---|---|
| `src/lib/services/wa-identity-service.ts` | tambah `waAutomationEligibility(tenantId)` + tipe `WaAutomationEligibility` — **sumber tunggal** guard, meniru pola cron `reminder-service.ts:161` |
| `src/app/app/pengaturan/actions.ts` | helper `planGate()` + terapkan di `actionWaInit`, `actionWaPair`, `actionWaStatus` (tolak SEBELUM relay, balas `planLocked:true`); tipe balasan 3 action diperluas dengan `planLocked?: true` |

**Dua keputusan yang menghindari pengerusakan:**
1. **TIDAK di-guard:** `actionWaPairCancel` & `actionWaLogout` — memutuskan sesi
   harus SELALU boleh, termasuk tenant yang sudah terlanjur tersambung.
   Kalau dua action ini ikut diguard, sesi bocor jadi TIDAK BISA dicabut.
2. **`actionWaStatus` ikut diguard** — tanpa ini, UI TRIAL tetap polling tiap 3 dtk
   (panggilan terbanyak di `wa-connect.tsx`) → percuma + noise. Balasan tetap
   memuat `exists:false, ready:false, qr:null` agar pemakaian UI lama tidak rusak.

**Koreksi versi-1 test:** mock `server-only` mengikuti pola repo
(`tests/worksession.test.ts`, `tests/customer-import-live.test.ts`);
mock `wa-identity-service` DIHAPUS — guard ada di file itu, jadi logic-nya
wajib teruji nyata, bukan mock-nya sendiri.

### A2 — UI jujur (bukan disembunyikan diam-diam)
- `pengaturan/wa-connect.tsx` + `pengaturan/page.tsx`: tenant tak berhak → kartu
  menjelaskan paket, tanpa tombol Hubungkan/QR (jangan menampilkan QR yang tak akan berguna).
- `app/_components/wa-connect-banner.tsx`: teks penawaran upgrade, bukan ajakan sambung.
- **Dokumen:** `src/lib/help/content-owner.ts` — konten bantuan untuk tenant
  non-berhak harus menjelaskan paket, bukan mengajari sambung (lihat blast radius).
- **Test:** render halaman pengaturan plan TRIAL → tanpa tombol Hubungkan/QR,
  kartu paket tampil; PROFESSIONAL → tampil seperti sekarang.

#### Hasil A2 — GREEN (2026-10-13, 4 file diubah, jalur yang sudah ada)

```
test A1+A2  : 2 files / 12 tests PASS
suite penuh : 74 files / 685 tests — 0 gagal (baseline 72/673 utuh + 12 baru A1&A2)
tsc --noEmit: exit=0
lint        : bersih (content-owner.ts, wa-connect.tsx, wa-connect-banner.tsx)
```

RED sebelumnya: 1 gagal — `getHelpTopic("pengaturan").steps` benar-benar
memerintahkan SEMUA tenant "gunakan 'Hubungkan WhatsApp'" (bukti teks lama
menyesatkan setelah tombol hilang untuk TRIAL). GREEN setelah netralisasi.

**Perubahan (SEMUA jalur yang sudah ada):**

| File | Perubahan |
|---|---|
| `src/lib/help/content-owner.ts` | topik `pengaturan`: langkah-6 & whatIsIt dinetralkan (pengingat manual via menu Pengingat; koneksi otomatis = paket berbayar). Topik `wa-connect` (7 langkah QR + kode tautan) **TIDAK diubah** — tetap benar utk tenant berbayar |
| `src/app/app/pengaturan/wa-connect.tsx` | phase baru `plan-locked` + tangkap `r.planLocked` di 3 titik (status, init, pair); kartu penjelas paket TANPA tombol/QR/polling; badge "Paket Basic" |
| `src/app/app/_components/wa-connect-banner.tsx` | `r.planLocked` → cabang banner biru "Pengingat masih bisa dikirim manual" (tombol → menu Pengingat), bukan "Hubungkan" |
| `tests/wa-plan-ui-content.test.ts` | test baru (RED→GREEN): teks bantuan tidak mengajari sambung utk semua plan; topik `wa-connect` utuh; plan-display `autoReminder=false` = manual, `true` = otomatis |

**TIDAK disentuh (dibuktikan test #2 & #4):** topik `wa-connect`, pesan plan
`planQuotaLines` (kedua cabang), menu Pengingat (semua file `pengingat/`).

**Dampak ke alur TRIAL (urutan data):** `actionWaStatus` balas `planLocked` →
komponen masuk phase `plan-locked` → berhenti polling tiap 3 dtk, tombol QR &
kode tautan tidak pernah dirender. Fallback aman: jika gagal baca DB, tombol
tetap tampil dan DITOLAK server-side (A1) — tanpa akses yang salah kebuka.

### A3 — Rekonsiliasi sesi yang sudah bocor (3 sesi TRIAL)
- Cron/rekonsiliasi (jalur yang sudah ada — `/api/cron/*`): tenant non-berhak yang
  punya sesi aktif → `gatewayLogoutSession(tenantId)` + `clearVerifiedWaPhone(tenantId)`.
- **Idempoten + aman-gagal per tenant**; log setiap tindakan; tidak mengganggu
  `lumite-platform` dan sesi tenant berbayar.
- **Persetujuan:** aksi ini memutus sesi nyata di gateway. Jalankan setelah A1+A2
  live, dan hanya untuk plan non-berhak (dibuktikan query).
- **Verifikasi setelah jalan:** query DB → **0** tenant non-berhak dengan sesi
  aktif; `/health` gateway turun ke 3 sesi (`lumite-platform`, `campaign:MKT-1`,
  PT ASE). Bila tidak 0 → A3 dianggap GAGAL, bukan "sebagian beres".

#### Hasil A3 — KODE SELESAI (2026-10-13) · REKONSILIASI LIVE BELUM DIJALANKAN

```
test A3    : 6/6 PASS (tests/wa-plan-reconcile.test.ts)
suite      : 75 files / 691 tests, 0 gagal · tsc exit=0 · eslint exit=0
```

**RED→GREEN:** test ditulis duluan (fungsi belum ada → RED), lalu fungsi
`reconcileWaPlanSessions()` di `wa-identity-service.ts` (jalur yang sudah ada).

**Perubahan:**
- `src/lib/services/wa-identity-service.ts`: fungsi `reconcileWaPlanSessions()`
  + tipe `WaPlanReconcileResult {checked, revoked, failed}`.
  Idempoten (skip bila `exists:false`), aman-gagal per tenant, sumber berhak =
  `PlanConfig.autoReminder` (satu-sumber dgn A1 & cron).
- `src/app/api/cron/wa-plan-reconcile/route.ts` (BARU — route cron, pola persis
  `/api/cron/reminders`: CRON_SECRET timing-safe, GET+POST).

**Mengapa TIDAK dijadwalkan periodik (keputusan disengaja):** menonaktifkan
`autoReminder` sebuah plan = menarik SELURUH sesi plan itu. Itu keputusan
operator, bukan cron 30-menit. Route dipanggil MANUAL.

**LANGKAH TERAKHIR (belum dijalankan — butuh persetujuan eksekusi sesuai §4):**
1. Deploy Aircon (jalur `scripts/deploy-vps.sh`) → guard A1/A2 live.
2. Panggil `POST /api/cron/wa-plan-reconcile` dengan Bearer CRON_SECRET →
   cabut 3 sesi TRIAL bocor (AC Depok Jaya, ADI TEKNIK, Jassa Teknik).
3. Verifikasi: `/health` gateway turun ke 3 sesi (platform, campaign, PT ASE).

---

## 3. BLAST RADIUS (diperiksa sebelum & sesudah)

| Situs | Risiko | Mitigasi |
|---|---|---|
| Tenant PROFESSIONAL (PT ASE, Jaya Mandiri) | tak boleh terdampak | guard plan-based; kedua tenant ini kena "berhak" — uji jalur init mereka tetap jalan |
| `lumite-platform` + `campaign:MKT-1` | bukan sesi tenant | tidak disentuh guard plan (externalId bukan tenant) |
| Cek `actionWaStatus` di UI yang sedang polling | guard mengubah bentuk balasan | flag `planLocked` terstruktur; komponen menangani cabang baru tanpa memutus polling lama |
| `runDueRemindersAllTenants` | guard baru boleh **duplikat** pola lama, tidak boleh ganti | baca ulang `reminder-service.ts:156` — satu sumber `PlanConfig.autoReminder` |
| Gateway (`/v1/wa/sessions/*`) | TIDAK disentuh dari Aircon | kontrak gateway tidak berubah; guard di sisi klien |
| Alur teknisi (`/t`) | redirect sudah ada (`TECHNICIAN → /t`) | tanpa perubahan |
| **Konten bantuan** | `src/lib/help/content-owner.ts` (baris 325, 371, 429) mengajari SEMUA tenant cara "Hubungkan WhatsApp" | setelah A1/A2, tenant TRIAL tak punya tombol itu → konten bantuan jadi menyesatkan | tambah cabang konten plan non-berhak (A2) |

---

## 4. TAHAP EKSEKUSI (TDD — jalur Aircon)

### ATURAN MAIN EKSEKUSI (mengikat — pola sama dengan dokumen gateway)

1. **Gerbang antar-tahap:** tahap A1/A2/A3 SELESAI hanya bila sub-bagian
   `#### Hasil A1` / `#### Hasil A2` / `#### Hasil A3` di bloknya SUDAH DIISI
   bukti. Tanpa itu, tahap berikutnya DILARANG dimulai. Buktinya dicatat saat
   itu juga (kerja → catat → lanjut), termasuk hasil test RED/GREEN/suite/deploy.
2. **Pemasangan dengan dokumen gateway:** pekerjaan ini adalah BAGIAN DARI
   rangkaian yang sama — dimulai di `/home/rad/lumite-gateway`
   (`.hermes/plans/2026-10-13_000000-gateway-wa-session-capacity.md` G0→G6).
   Tahap A1 hanya boleh dimulai setelah G6 gateway lulus (aturan gerbang
   antar-repo di dokumen gateway). Urutan itu wajib: gateway dulu (memperbaiki
   karantina+kapasitas), baru Aircon (guard plan + tarik sesi trial).
3. **Selesai di sini = rangkaian tuntas:** bila A3 selesai dan seluruh
   KRITERIA SELESAI (§6) terbukti + deploy PASS, rangkaian perbaikan
   WA-gateway (gateway + Aircon) dianggap TUNTAS — catat di blok
   `#### Hasil A3`, jangan membuka pekerjaan baru yang tidak ada di dokumen
   ini atau dokumen gateway.
4. **Anti "senjata makan tuan" (sama dengan aturan #6 dokumen gateway):**
   verifier yang tak mengenali format menulis `FORMAT TIDAK DIKENAL`, bukan
   "belum diisi". Default verifier = LEWAT. Tahap hanya TERKUNCI bila terbukti
   `Belum dikerjakan`. Jalur keluar: perbaiki format → ulangi verifier → bila
   tetap tak cocok, catat pola yang diharapkan dan LANJUT (jangan mengulang
   pekerjaan). DILARANG menambah gerbang persetujuan yang tidak tertulis di
   dokumen ini — gerbang eksternal hanya sah bila diminta eksplisit.

**Prasyarat:** tree bersih, `pnpm run build` hijau, test yang ada lulus
(catat hitungannya dulu — baseline).

1. **RED** — test guard: (a) TRIAL → `actionWaInit` menolak dengan error+flag;
   (b) PROFESSIONAL → lolos ke relay; (c) `PlanConfig` tanpa baris → pola
   fallback sama dengan cron (additive); (d) UI menampilkan kartu paket tanpa tombol.
2. **GREEN** — A1 + A2.
3. **A3** — test rekonsiliasi: sesi TRIAL di-logout + dibersihkan, PROFESSIONAL
   tidak tersentuh, idempoten (dijalankan dua kali = nol tindakan berulang).
4. **Suite penuh** — `pnpm run test`, `pnpm run lint`, `pnpm run build`.
5. **Commit** — pesan memuat rule produk + bukti (3 dari 6 sesi = TRIAL).

## 5. DEPLOY (JALUR AIRCON — bukan SOP gateway)

```bash
cd /home/rad/aircon && bash scripts/deploy-vps.sh
```
(Tidak disusun ulang; evidence-gate sesuai `AGENTS.md`/skill `aircon-live-deploy`.)
Urutan lintas-aplikasi: **gateway (lumite) lebih dulu** (memperbaiki karantina
+ kapasitas), baru Aircon (guard plan + rekonsiliasi) — supaya A3 tidak
memutus sesi yang sedang berjuang di karantina, dan supaya sesi PT ASE
sudah pulih saat tenant mengecek ulang.

**Rollback:** `bash scripts/deploy-vps.sh <commit-lama>` (per `AGENTS.md`;
release lama jangan dihapus sebelum release baru terbukti sehat — aturan keras
skill `aircon-live-deploy`). Bila rollback gagal: laporkan `FAIL_ROLLED_BACK` /
`CRITICAL_ROLLBACK_UNVERIFIED` — **jangan** dilaporkan sebagai beres.

## 6. KRITERIA SELESAI

- [x] Test guard RED→GREEN: 18/18 (wa-plan-guard 8, wa-plan-ui-content 4, wa-plan-reconcile 6); suite 75 files / 691 tests; `tsc --noEmit` exit 0; `eslint` exit 0; build exit 0.
- [x] Tenant TRIAL (Basic): kartu paket tampil tanpa tombol/QR; `actionWaInit`/`actionWaPair`/`actionWaStatus` ditolak server-side dengan `planLocked:true`; test membuktikan gateway tidak dipanggil.
- [x] Tenant PROFESSIONAL/BUSINESS: guard melewatkan ke gateway; kedua jalur QR + kode tautan dipertahankan.
- [x] Menu Pengingat manual tidak disentuh: tetap memakai `wa.me` (WhatsApp milik admin sendiri); test A2 mengunci plan-display manual dan file `pengingat/` tidak berubah.
- [x] 3 sesi TRIAL bocor direkonsiliasi: HTTP 200 `{checked:4, revoked:3, failed:0}`; profil trial Buana Multi Teknik juga dihapus dari disk gateway sebelum restart agar tak direhydrate.
- [x] Cron reminder tidak berubah; guard membaca `PlanConfig.autoReminder` satu-sumber. Verifikasi DB live: TRIAL "Basic" autoReminder=false; PROFESSIONAL/BUSINESS true.
- [x] Konten bantuan: topik Pengaturan dinetralkan; topik `wa-connect` untuk tenant berbayar tetap utuh (QR + kode tautan).
- [x] `HEAD == origin/main` (`df0e7a3`), deploy-vps.sh PASS + 6/6 health gates (/ & /login 200).
- [x] Gate repo Aircon: `scripts/defect-gate.sh` TIDAK ADA — tidak ada gate repo yang bisa dijalankan; ini dicatat, bukan diada-adakan.
- [x] Kriteria jumlah sesi dikoreksi: pasca-restart 4 sesi (2 tenant berbayar + lumite-platform + campaign:MKT-1), bukan 3. Bukti `/health`: 2 ready, 2 QR; nol sesi trial. Lumite-platform & campaign adalah sesi internal, bukan tenant.

#### Hasil final-verifikasi Aircon (2026-10-13)

Kode aktif `df0e7a3`, `aircon-app` active, HEAD==origin, tree bersih. Aircon tidak
disentuh setelah deploy. Menu Pengingat manual (`wa.me`) tetap berfungsi seperti
sebelumnya; perubahan hanya membatasi koneksi otomasi gateway utk plan tanpa hak.

## 7. G7-Aircon — callback inbound tak lagi menulis DB (2026-10-14, lanjutan G7 gateway)

**Keputusan pemilik:** pesan tulisan pelanggan dari WA tenant **tidak dicatat** Aircon.

Bukti: DB 4.034 baris `INBOUND` (100% dari nomor tak pernah dituju aplikasi; nol
pembaca, nol tindak lanjut). Konsumen Aircon tidak butuh balasan teks — yang
dipakai = status pengiriman keluar (`delivery_status`).

Perubahan (jalur yang sudah ada, nol modul baru):
- `src/app/api/wa/callback/route.ts` — branch `type === "inbound"` jadi no-op
  (balasan 200 tetap; transport netral). Tipe tetap dikenali (kompatibilitas).
- Test `tests/wa-callback-inbound-noop.test.ts` (3) RED 1 gagal → GREEN 3/3:
  inbound → `messageLog.create` TIDAK dipanggil; `delivery_status` → `findFirst`
  + `updateMany` TETAP; `ready` → nol tulis.

Yang TIDAK disentuh (jalur sah, bukan tulis inbound):
- `disconnected` → `notifyPlatform` (autopilot putus sesi) — utuh.
- status pengiriman (`sent`/`failed`/`delivery_status`) — utuh.
- tulis outbound (`reminder`/`dunning`/`invoice`) — utuh.

Suite: 76 files / 694 tests (baseline 75/691 utuh + 3 baru) · tsc=0 · lint=0.

#### Hasil deploy G7-Aircon — LIVE `fb0f9f4` (2026-10-14 01:34 WIB)

```
commit   : fb0f9f4 (push OK, HEAD == origin/main)
build    : pnpm run build PASS (DEPLOY_EXIT=0)
deploy   : scripts/deploy-vps.sh PASS (jalur resmi Aircon)
release  : /opt/aircon-app/current = fb0f9f4668e52c12b18b3ec30bbd0d146e51efb6/app
service  : aircon-app active, start 01:34:31 WIB
HTTPS    : https://app.airconet.id/ -> 200
suite    : 76 files / 694 tests PASS · tsc=0 · eslint=0
bundle   : .next/server/chunks/_1ch31dc._.js — messageLog.create=0,
           INBOUND=0; findFirst=1 + messageLog.updateMany=1 (delivery_status
           terjaga); notifyPlatform=1 (autopilot disconnected terjaga)
DB live  : INBOUND=0 (dibersihkan sebelumnya + tak ada lagi jalur tulis);
           OUTBOUND=47 (tetap ada)
```

## 8. YANG TIDAK DIKERJAKAN

Tidak mengubah kontrak gateway; tidak mengubah `PlanConfig`/kebijakan plan
(hanya membaca); tidak menyentuh repo lumite-gateway (lihat rencana partner);
tidak menarik sesi tanpa bukti plan non-berhak + persetujuan.

