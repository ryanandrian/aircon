# RENCANA KERJA — ALUR CHECKLIST SERVIS (SATU SISTEM)

> **File ini dipulihkan oleh asisten pada 2026-10-03 setelah keliru menimpa rencana 7 fase**
> dengan catatan penghentian — dan keliru menimpa KEDUA KALINYA (percobaan kedua tidak tercatat
> di git, hanya di riwayat sesi; dipulihkan kembali dari riwayat sesi yang sama).
> Semua fakta di bawah berasal dari pembacaan kode, `schema.prisma`, migrasi, query DB live
> (read-only), dan output tes yang dijalankan sendiri. Status per-bukti disertai.
> Apa yang belum diverifikasi ditulis **BELUM DIVERIFIKASI** — bukan diandaikan.

---

## 0. ATURAN KERJA (mengikat)

1. **Helicopter view**: sebelum mengubah apa pun, telusuri FE, BE, dan DB termasuk konsumen tak langsung.
2. **TDD**: tes gagal dulu (RED) → implementasi → hijau (GREEN) → refactor. Tanpa tes yang dilihat
   gagal = tidak sah.
3. **Tanpa jalur baru / fosil / tambal**: perbaiki lewat jalur yang sudah ada; kalau ada dua jalur, satukan.
4. **Gate wajib tiap fase**: `pnpm exec tsc --noEmit` · `pnpm exec eslint` · `pnpm test` · `pnpm run build`
   — semua 0.
5. **Data**: DB lokal == DB produksi. Uji tulis hanya lewat fixture/mocking; query ke DB asli hanya
   read-only. Hapus/baris data produksi = operasi terpisah yang butuh perintah eksplisit.
6. **Deploy** hanya `cd /home/rad/aircon && bash scripts/deploy-vps.sh` setelah `HEAD == origin/main`
   dan tree bersih.

---

## 1. KEBUTUHAN (dari diskusi, tidak boleh berubah diam-diam)

1. **Checklist sunah/opsional.** Tiap tenant boleh mengatur checklist untuk layanan tertentu; layanan
   tanpa checklist tidak mengunci apa pun.
2. **Default kosong.** Tenant baru mulai tanpa checklist. Tidak ada seed otomatis.
3. **Ada checklist → semua item wajib harus lengkap** sebelum pekerjaan bisa dinyatakan selesai **dan**
   invoice/proforma terbit.
4. **Pengisian PROGRESIF:** teknisi/kernet **mengisi checklist selama pekerjaan berlangsung**, per progres
   di lapangan — termasuk **foto hasil kerja** — **BUKAN** menunggu pekerjaan selesai.
5. **Tipe `photo` harus berupa unggah berkas ATAU pengambilan langsung dari kamera HP** — bukan input
   teks. (Ditegaskan user 2026-10-03.)
6. **Hapus jalur 1 (legacy) + seluruh fosil**: tidak boleh ada dua sistem checklist atau dua jalan
   penyelesaian.

---

## 2. FAKTA TERVERIFIKASI (hasil deep dive)

### 2.1 Dua jalur penyelesaian yang hidup saat ini

| | Penegakan checklist | Efek samping |
|---|---|---|
| `transitionJob(COMPLETED)` — tombol **Selesaikan** di `/t/pekerjaan/[id]` | `assertCompletionGuards()` = **legacy `serviceType` + `jobId`** (`job-service.ts:160-189`) | `completedAt`, `nextServiceDate`, **`RepeatReminder.upsert`** (asset utama + unit ekstra), **`reviewRequest.create`**, `JobProgressEvent` |
| `closeWorkSession()` — **Catat Pekerjaan & Buat Tagihan** | `assertWorkSessionChecklist()` = **`serviceId` + `workItemId`** (`worksession-service.ts:107-150`) | klaim atomik sesi `OPEN→CLOSED` + 1 Invoice/Proforma. **Tidak** menyentuh `JobOrder.status`, **tidak** membuat reminder/review |

Bukti: `grep 'status: toStatus'` hanya di `job-service.ts`; `closeWorkSession` tidak memanggil
`transitionJob`. Pintu ke sesi kerja **hanya satu** (`href="/t/kerja"` di `t/pekerjaan/[id]/page.tsx`).

- `guards: ["checklist_required_done","photo_after_if_required"]` di `job-state-machine.ts:29`
  **hanya dokumentasi** — `canTransition()` tidak pernah membaca `guards`.
- **Belum ada tes** yang memanggil `transitionJob` / `assertCompletionGuards` / `getJobChecklist`.

### 2.2 Status kode saat ini (git)

- `main == origin/main == 5e9c37f` (FASE 1–2: validator + hapus konfigurasi UI legacy per `serviceType`).
- **Live = `2ca277f`** (terverifikasi: `current -> releases/2ca277f.../app`, `source-sha` di
  `releases/<sha>/source-sha` — **bukan** `app/source-sha`), service `aircon-app` = `active`.
- Tree bersih kecuali `.hermes/` (file rencana, untracked).

Sudah dikerjakan & lulus gate (`5e9c37f`): `src/lib/domain/checklist-validation.ts`
(`collectChecklistGaps`, 13 tes) · `assertWorkSessionChecklist` memakainya + query hasil sekali
(bukan N+1) · tes `checklist-template-service` 7 kasus (tenant-scope/opt-in/opt-out) ·
smoke DB asli read-only 3 tes · `/app/checklist` hanya mode per-layanan · buang
`listChecklists/saveChecklist/removeChecklist/ChecklistView/SERVICE_LABELS/DEFAULT_CHECKLISTS`
dan seeding checklist di `prisma/seed.ts`.
**Masih ada** di source: `assertCompletionGuards`, `getJobChecklist`, `setChecklistItem`,
`techSetChecklist`, kartu "Checklist Pekerjaan" di `t/pekerjaan/[id]/work.tsx`, transisi `COMPLETED`
di `transitionJob`, kolom `ChecklistTemplate.serviceType` + `ChecklistResult.jobId`.

### 2.3 DB & data live (read-only)

- `ChecklistTemplate`: `serviceType?` (unique per tenant) + `serviceId?` (unique per tenant) — FK ke
  `ServiceCatalog`, `onDelete: Cascade`.
- `ChecklistResult`: `jobId?` (unique per tenant) + `workItemId?` (unique per tenant) — FK ke `WorkItem`,
  `onDelete: Cascade`.
- Migrasi: `20260816223844_init` + `20260908135053_checklist_per_service_unit_additive`
  (ADDITIVE: kolom lama jadi nullable, kolom baru + index + FK). `migrate status` → **49 migrasi,
  up to date** (pembacaan 2026-10-03; ulangi sebelum eksekusi apa pun).
- Data live: 9 template + 6 hasil. 7 template & 2 hasil = **Jaya Mandiri (demo/dummy per klasifikasi
  user)**; 2 template & 4 hasil = AC Depok Jaya (test). Buana Multi Teknik: 0 job/0 sesi/0 invoice.
- Anomali live: **50 job COMPLETED**; **2 `WorkSession` masih `OPEN`** tertaut job `COMPLETED`
  (AC Depok Jaya, sesi sejak 21 & 25 Sep, 0 item); 1 job COMPLETED tanpa invoice (tenant test).
  → membuktikan dua jalur pernah jalan tidak sinkron. **Tidak diubah tanpa perintah.**
- Distribusi sesi (read-only): 53 sesi = 53 ber-`jobId`, **0 tanpa `jobId`**; status job untuk sesi
  ber-job = 50 `COMPLETED`.
- `ReviewRequest` **tanpa unique key per job** → `reviewRequest.create` bisa ganda; satu-satunya
  penulis = `job-service.ts:132`; `RepeatReminder` sudah punya `@@unique([tenantId,assetId,dueDate])`.

### 2.4 Foto — kondisi nyata

- Model `JobPhoto`: **hanya `jobId`** (FK ke `JobOrder`). Tidak ada relasi ke `WorkItem`.
- `putPhoto()` (server-only) → key `jobs/{tenantId}/{jobId}/{kind}-rand.ext` + `publicUrl()`;
  `isOwnedPhotoUrl(tenantId, jobId, url)` sudah ada di `storage/s3.ts:55` — **nol pemakai** (dead code
  yang dibuat tepat untuk validasi ini).
- Upload hanya dari `t/actions.ts:techUploadPhoto` (tenant+teknisi, JPG/PNG/WebP, maks 8MB)
  → hanya dipakai `t/pekerjaan/[id]/work.tsx`.
- **UI sesi kerja (`work-session.tsx`) TIDAK punya upload foto** — item `type:"photo"` dirender
  `<input type="text">`. Data live: **10 item foto (8 wajib), semua di template legacy**;
  2 template per-layanan (jalur aktif) **nol foto**.
- Konfigurasi S3 **di VPS terisi lengkap** (7 kunci = `SET`; nilai tidak pernah dicetak). `.env` lokal
  `EMPTY` — desain server-only.
- Data live: **1 file `JobPhoto`** (`kind=after`, 17 Sep, tenant AC Depok Jaya).
- **BELUM DIVERIFIKASI**: koneksi S3 aktif / objek foto bisa dibaca (belum ada request objek).
- Prasyarat teknis: `server-only` adalah **alias Next.js**, bukan paket npm → tidak ter-resolve oleh
  Vitest. Unit test tidak boleh mengimport `s3.ts` tanpa mock.

### 2.5 Titik isi progresif (sesuai requirement 4)

- Layar sesi kerja: tiap baris `WorkItem` punya `ItemChecklist` lazy-load (`work-session.tsx:81`),
  tombol simpan per item (`actionSetItemChecklist` → `setWorkItemChecklistItem`, tenant-scoped).
  **Input terbuka selama sesi `OPEN`** → progresif untuk bool/number/text **sudah terpenuhi** di jalur
  ini; keterbatasannya **foto** (§2.4) dan **auth** (§2.6).
- `closeWorkSession` menutup sesi → setelah itu item tak bisa diubah. Gerbang gate ada **sebelum**
  `invoice.create`, dalam alur yang sama (`worksession-service.ts:173`).

### 2.6 Gap keamanan/otorisasi (faktual)

- `openWorkSession(tenantId, customerId, openedById, jobId?)` **tidak memeriksa** siapa `openedById`
  dan **tidak memverifikasi** `jobId` milik tenant/customer itu (`worksession-service.ts`).
- `actionGetItemChecklist` / `actionSetItemChecklist` / `actionCloseWorkSession`
  (`t/kerja/actions.ts`) hanya `getServerContext()` → **tanpa pemeriksaan role**; semua query di
  service tenant-scoped.
- `t/actions.ts` punya pola `requireTechnician()` (tenant+teknisi) untuk `techTransition`,
  `techSetChecklist`, `techUploadPhoto`. Catatan: `techUploadPhoto` menguji `job.technicianId` saja —
  **kernet lewat `JobAssignment` belum terbukti lolos**; harus diperiksa saat dipakai ulang.
- `t/kerja/layout.tsx` **tidak punya guard role** (hanya `viewport`).

### 2.7 Konsumen status COMPLETED (dampak penghapusan jalur 1)

`grep 'status: "COMPLETED"'`: dashboard `app/page.tsx:38,48` · kartu pelanggan
(`customer-card-service.ts:79`) · riwayat teknisi (`technician-service.ts`) · unit-code
(`unit-code-service.ts:168`) · servis terakhir asset (`asset-service.ts:215`) · prefill reminder
(`reminder-service.ts:144`) · badge tim/riwayat (`tim/manager.tsx`, `t/riwayat`) · `t/page.tsx:38`.
→ **`JobOrder.status = COMPLETED` HARUS tetap ada**; yang dihapus adalah **jalan menujunya** yang
paralel (tombol Selesaikan), bukan statusnya.

### 2.8 SSOT lama yang bertentangan

`docs/PLAN_Checklist_PerLayananUnit.md` (Status: "TERLAKSANA 2026-09-08") menyimpan **arah lama**
(dual-read legacy dipertahankan; guard COMPLETED untuk job lama). Arah sekarang: **hapus fosil**.
BuildSpec Part2 §S-T3 masih menulis `[Selesai] (→S-T3)`. Perlu disinkronkan di penutup.

---

## 3. GAP (harus dituntaskan)

| # | Gap | Bukti | Fase |
|---|---|---|---|
| G1 | Tombol **Selesaikan** masih jadi jalan penyelesaian kedua | `work.tsx` `techTransition` → `transitionJob(COMPLETED)` | 5 |
| G2 | Legacy checklist masih dipakai di layar detail job | `getJobChecklist`/`setChecklistItem`/`techSetChecklist`/kartu `work.tsx` | 5 |
| G3 | `transitionJob(COMPLETED)` menulis efek yang tak dimiliki `closeWorkSession` (reminder + review) | `job-service.ts` blok COMPLETED vs `worksession-service.ts` | 4 |
| G4 | `closeWorkSession` tidak menutup `JobOrder` → alur tak sinkron | query live: 2 sesi OPEN pada job COMPLETED | 4 |
| G5 | `ReviewRequest` bisa ganda (tanpa unique) | schema `ReviewRequest` tanpa `@@unique` | 4 |
| G6 | Foto: tak ada upload di sesi kerja; validator belum wajibkan URL | §2.4 | 3 |
| G7 | Tipe `photo` harus **unggah/kamera**, masih input teks | §2.4 + arahan user (requirement 5) | 3 |
| G8 | Otorisasi sesi kerja longgar (role & tautan `jobId`) | §2.6 | 6 |
| G9 | Kolom/index legacy `serviceType`/`jobId` masih di schema | `schema.prisma` | 6 |
| G10 | Dokumen SSOT lama bertentangan | §2.8 | 6 |
| G11 | Belum ada tes `transitionJob`/efek akhir | §2.1 | 4 |
| G12 | `5e9c37f` belum live; live `2ca277f` | verifikasi VPS | 7 |
| G13 | Koneksi/objek S3 belum diuji aktif | §2.4 | 7 |

---

## 4. TUJUH FASE

> Semua fase: RED→GREEN, gate 4 perintah lulus, commit terpisah per slice, `HEAD==origin/main`.

### FASE 0 — Peta & kontrak akhir  `[x]`
- [x] Inventaris penulis/pembaca status, sesi, dokumen, checklist, foto, reminder, review (§2).
- [x] Data live read-only + anomali tercatat; tanpa mutasi (§2.3).
- [x] Invariants: tanpa template → lolos; `required` belum sah → blokir penutupan + dokumen + status final;
      opsional tak pernah memblokir; tenant-scoped; retry idempoten; efek final tepat satu kali;
      `JobOrder.COMPLETED` tetap ada, hanya satu jalan menujunya.
- [x] Rencana dipulihkan (dua kali tertimpa — lihat catatan judul file).

### FASE 1 — Validator item wajib per tipe  `[x]`
- [x] `collectChecklistGaps` (13→14 tes, RED→GREEN): bool/number/text/photo, opsional tak memblokir,
      tipe tak dikenal aman, **photo wajib harus URL** (ditambahkan 2026-10-03, RED gagal→GREEN 14/14).
- [x] `assertWorkSessionChecklist` memakainya + query sekali. Tes worksession: 10 kasus
      (termasuk bug `!!value` yang loloskan `"   "` → `Number.isFinite`).
- [x] Smoke DB asli read-only 3 tes (`checklist-smoke-live.test.ts`) menangkap drift skema.

### FASE 2 — Konfigurasi hanya per layanan, default kosong  `[x]`
- [x] `/app/checklist` mode tunggal `serviceId`; aksi legacy & editor mode ganda dihapus; tombol
      "Muat contoh" dihapus; `DEFAULT_CHECKLISTS` & seeding `prisma/seed.ts` dibuang.
- [x] 7 tes tenant-scoping (`checklist-template-service.test.ts`).
- [x] Copy bantuan owner diselaraskan (`content-owner.ts:505`).

### FASE 3 — Isi progresif + foto **unggah/kamera** di layar sesi kerja  `[x: kode + tes; QA perangkat/live belum]
- [x] RED→GREEN validator foto: `photo` wajib menolak teks/non-URL; 14 unit tests domain.
- [x] RED→GREEN gate: `assertWorkSessionChecklist` memakai `isOwnedPhotoUrl(tenantId, jobId, url)` existing;
      URL luar tenant/job ditolak; tanpa jobId tidak bisa meloloskan foto. 3 skenario gate ditambahkan.
- [x] FE ItemChecklist menggunakan input file HTML existing-style: `accept=image/*`, `capture=environment`
      (browser HP dapat menawarkan kamera/berkas), upload `techUploadPhoto` existing → simpan URL via
      `actionSetItemChecklist`; state pending/error/sukses, 44px touch target, tombol lihat/ganti.
- [x] Job id diturunkan dari `ws.jobId` (server page) — bukan dari assetId/banner.
- [x] `assertCanOperateOnJob`: technician lead atau `JobAssignment` termasuk KERNET dapat upload.
      DB live 70 TECHNICIAN+23 KERNET; 3 sampel kernet job. Tes 4 service + 3 upload.
- [ ] **BELUM** uji upload file nyata atau kamera di HP / akses objek bucket S3; tidak menulis ke bucket prod.
- [ ] Gate setelah keseluruhan akhir + QA perangkat nyata.

### FASE 4 — `closeWorkSession` = satu-satunya finalizer (atomik)  `[x: kode + tes lokal]
- [x] Finalizer dalam transaksi sama dengan claim sesi + dokumen: cek job tenant/customer & status;
      `JobOrder.status=COMPLETED`, `completedAt`, `nextServiceDate`, asset utama+asset ekstra,
      `RepeatReminder.upsert`, `ReviewRequest.create`, `JobProgressEvent`, Invoice/Proforma.
- [x] ReviewRequest: audit read-only semua data (10 baris / 10 unique tenant+job); migration+schema
      `@@unique([tenantId,jobId])` ditambah supaya unique per job.
- [x] Checklist required gate tetap dilakukan sebelum transaksi; semua jawaban dibaca ulang dari DB.
      (Catatan teknis: transaksi claim/finalize mencegah dobel tutup; concurrency jawaban vs claim tetap
      perlu QA/code review khusus sebelum diklaim serializable.)
- [x] Tes RED→GREEN: close session menghasilkan job completed + asset main/extra + 2 reminder + 1 review
      + event; checklist gate gagal menghasilkan nol semua. Existing unit suite hijau.
- [ ] Jalur `jobId=null`: kode masih membolehkan sesi tanpa JobOrder, jadi tutupnya hanya invoice/session
      dan tidak JobOrder status/reminder/review. Live query sebelumnya 0/53 sesi tanpa job. BELUM diputuskan
      untuk menolak/mendukung sesi tanpa job; karena QR/non-job route code perlu audit bisnis lanjut.
- [ ] Tinjau status yang diizinkan: implementasi sekarang mengizinkan ARRIVED/IN_PROGRESS/WAITING.
      BuildSpec lama berkata COMPLETED hanya IN_PROGRESS. Pemilihan final status harus diselaraskan sebelum release.

### FASE 5 — Hapus jalur 1 & fosil di source  `[x: source + tes lokal]
- [x] Hapus kartu Checklist Pekerjaan & props dari detail teknisi; button Selesaikan lama diganti link
      “Selesaikan & Tagihan” menuju WorkSession; tombol Tunda nonfinal tetap.
- [x] `transitionJob(COMPLETED)` kini menolak; transisi status lain dipertahankan. Test baru membuktikan
      finalizer paralel ditolak, ARRIVED→IN_PROGRESS tetap berfungsi.
- [x] Hapus `assertCompletionGuards`, `getJobChecklist`, `setChecklistItem`, `techSetChecklist`.
- [x] State machine tak lagi memaparkan `IN_PROGRESS→COMPLETED`; tests/domain diselaraskan.
- [ ] `grep` fosil final setelah pembaruan docs/tes dan review.

### FASE 6 — Bersihkan DB schema legacy + otorisasi + SSOT  `[~: schema/migrasi lokal; deploy belum]
- [x] Schema kini mewajibkan serviceId/workItemId dan menghapus field/index legacy.
- [x] `openWorkSession` memverifikasi job tenant+customer sebelum mengaitkan sesi; tes 6 kasus termasuk
      OPEN-session re-link.
- [x] Migration ReviewRequest unique + drop kolom checklist legacy ditulis. Read-only DB diff membuktikan
      migrasi perlu menghapus 7 template + 2 result baris demo/test dengan anchor NULL, karena diff
      mengharuskan anchor baru NOT NULL. Migrasi memastikan index → delete rows → NOT NULL → drop columns.
- [ ] `migrate status` mengonfirmasi dua migration BELUM diterapkan; DB lokal == produksi. Jangan jalankan
      migrate deploy/dev sebelum izin eksplisit untuk mutasi database production.
- [x] Docs PLAN Checklist (status baru + bagian bawah diberi label archive historis) dan BuildSpec Part2
      S-T2/S-T3 diperbarui. (BuildSpec Part3/help tech masih perlu sinkronisasi akhir.)
- [ ] Tinjau billing/proforma, dunning, reminder UI, void/cancel transitions terhadap finalizer tunggal.

### FASE 7 — Verifikasi, commit, push, dan deploy  `[ ]`
- [ ] Seluruh gates lulus setelah seluruh edit terakhir: TSC, lint tanpa warning, semua test, build.
- [ ] Review diff per file, migrations, leak/security, UI HP, verify hash/snapshot; commit/push.
- [ ] Evidence gate resmi, lalu deploy satu-satunya skrip `bash scripts/deploy-vps.sh`.
- [ ] Perhatian: script deploy tidak menjalankan migrasi. Urutan produksi aman perlu kode baru live dahulu,
      lalu migrasi; jika melakukan step terpisah, minta izin eksplisit user untuk DB.
- [ ] Verifikasi source-sha/live endpoints/service/checksum/release count.
- [ ] E2E di tenant test: progresif checklist + foto kamera + invoice/proforma + finalizer effects.
      Upload S3 nyata akan menulis bucket produksi, jadi harus ada izin eksplisit atau non-prod bucket.


---

## 5. ACCEPTANCE (DoD)

- [ ] Tenant baru = 0 checklist aktif.
- [ ] Checklist per layanan; tanpa template → seluruh alur lolos.
- [ ] Required belum sah → sesi tertutup, dokumen tak terbit, job tak COMPLETED (tiga-tiganya).
- [ ] Required lengkap → ketiganya terjadi **tepat sekali**; klik ganda tak menggandakan apa pun.
- [ ] Opsional tak pernah memblokir.
- [ ] Teknisi/kernet mengisi seluruh item + **mengunggah foto lewat pilih berkas ATAU kamera HP**
      selama pekerjaan berlangsung (bukan setelah selesai).
- [ ] Item `photo` wajib hanya lolos dengan bukti URL foto yang sah untuk tenant+pekerjaan itu.
- [ ] Hanya **satu** jalur penyelesaian; `grep` legacy = nol; tanpa dual-read.
- [ ] `JobOrder.status=COMPLETED` tetap terisi — semua konsumen riwayat/metric tetap bekerja.
- [ ] Tidak ada akses lintas tenant / lintas role di sesi kerja.
- [ ] Gate 4 perintah 0 error; deploy PASS + bukti live; fakta "BELUM DIVERIFIKASI" tidak disamarkan.

---

## 6. BUKTI (diisi saat pengerjaan)

- `5e9c37f` (FASE 1–2) — TSC 0, LINT 0, **502 tes**, BUILD 0. **Belum live** (`live = 2ca277f`).
- FASE 0 — peta ini + baseline VPS + query live read-only (50 COMPLETED, 2 sesi OPEN, 1 tanpa invoice,
  53 sesi semuanya ber-jobId).
- FASE 1 (tambahan 2026-10-03) — RED tes photo-but-URL gagal 1/14 → GREEN 14/14 (`checklist-validation`).
- *(fase berikutnya diisi setelah gate hijau)*

---

## 7. RISIKO YANG WAJIB DIKUNCI

1. Efek `COMPLETED` pindah ke `closeWorkSession` → tes harus membuktikan **tak ada** reminder/review
   ganda dan tak ada yang hilang (ReviewRequest tanpa unique = risiko nyata).
2. Status non-final masih butuh `transitionJob` (ASSIGNED/CANCELLED/WAITING) — jangan menghapus fungsi
   tersebut, hanya blok `COMPLETED`.
3. `WorkSession.jobId` null → keputusan kecil tapi menentukan apakah pekerjaan tanpa job ikut final;
   data saat ini 0/53, tapi **kode mengizinkan** — bukan alasan mengabaikan.
4. Foto `photo` menyangkut storage server-only (`server-only` tak ter-resolve Vitest) → uji lewat
   `vi.mock("@/lib/storage/s3")`, jangan import `s3.ts` langsung di unit test.
5. Jangan menambah kolom/constraint sebelum semua konsumennya di-`grep`.
6. **Proses sendiri**: jangan pernah menimpa file rencana ini — tambah/patch saja (sudah tertimpa 2×,
   dipulihkan dari riwayat sesi).
