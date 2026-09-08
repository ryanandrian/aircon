# Rencana Perbaikan Checklist Servis — Per Layanan × Unit (Aircon, GO-LIVE)

Status: TERLAKSANA (FASE 1a + FASE 2) 2026-09-08. Disusun dari deep-dive kode.
Tujuan: checklist relevan di lapangan, opt-in per tenant, granular per layanan & per unit — tanpa bug/ranjau di produksi.

## STATUS EKSEKUSI (2026-09-08)
- FASE 1a SELESAI (commit 17842b7): default KOSONG/opt-in; provisioning tak lagi seed checklist; layar admin jujur (applied vs example).
- FASE 2 SKEMA+BE SELESAI (commit a96372e): migrasi ADDITIVE `20260908135053_checklist_per_service_unit_additive`
  diterapkan ke DB PRODUKSI (Supabase) — ChecklistTemplate.+serviceId, ChecklistResult.+workItemId; kolom lama (serviceType/jobId)
  jadi nullable & DIPERTAHANKAN (dual-read). Guard penyelesaian job DUAL-READ (utamakan WorkItem, fallback serviceType).
  Data lama utuh (14 template + 2 hasil). Terbukti E2E (A/B/C/D ALL PASS) thd DB nyata dgn tenant _tmp_ throwaway.
- FASE 2 FE SELESAI (commit 6965a59): /app/checklist per LAYANAN katalog; /t/kerja checklist per WorkItem (unit×layanan).
- Backup data checklist pra-migrasi: `.backups/checklist_backup_*.json` (gitignored).
- CATATAN LINGKUNGAN: `.env` lokal == DB PRODUKSI (Supabase). Tak ada DB dev terpisah → `prisma migrate deploy` = tindakan prod.

## 0. Keputusan owner (dasar)
1. Checklist idealnya diterapkan per LAYANAN dan per UNIT (mis. cuci 10 unit → checklist tiap unit).
2. Default KOSONG (opt-in): tenant baru TIDAK otomatis punya checklist; tidak berlaku sampai admin membuatnya.
3. Checklist dibuat admin tenant per LAYANAN (format item sama seperti sekarang), tenant-scoped (tak bocor antar tenant), tenant menentukan sendiri item + mana wajib/opsional.

## 1. Realita kode saat ini (fakta)
- DUA dunia paralel:
  - Dunia Job+Checklist: `JobOrder.serviceType` (enum 7) + `ChecklistTemplate(tenantId, serviceType)` + `ChecklistResult(tenantId, jobId, itemKey)`. Guard `assertCompletionGuards` memblokir IN_PROGRESS→COMPLETED bila item wajib belum diisi.
  - Dunia WorkSession+WorkItem (penagihan): `WorkItem(serviceId→ServiceCatalog, assetId→Asset/unit, qty, harga snapshot)`. TIDAK ada checklist.
- Layar teknisi `/t/pekerjaan/[id]` menampilkan KEDUANYA: tombol "Catat Pekerjaan & Buat Tagihan" (WorkSession per unit) + kartu "Checklist Pekerjaan" (per-job serviceType).
- Granularitas layanan×unit SUDAH ADA di WorkItem — hanya belum tersambung ke checklist.
- Default seed MENGISI banyak item wajib (kebalikan dari keputusan owner) → sumber "bumerang".

## 2. Target arsitektur
- Template: `ChecklistTemplate` di-key `(tenantId, serviceId)` (serviceId = ServiceCatalog). Default KOSONG.
- Hasil: `ChecklistResult` di-anchor ke `workItemId` (1 WorkItem = 1 layanan pada 1 unit) → otomatis per layanan × unit.
- Guard penyelesaian: job boleh COMPLETED bila SEMUA WorkItem-nya yang layanannya punya template → item wajibnya terpenuhi. WorkItem tanpa template = tak mengunci (opt-in).
- Tenant-scoped ketat di semua query (sudah pola di kode).

## 3. Perubahan per lapis (INVENTARIS — jangan ada yang lewat)

### 3.1 DB / Prisma (`prisma/schema.prisma` + migration)
- [ ] `ChecklistTemplate`: tambah `serviceId String?` (FK ServiceCatalog), unique baru `(tenantId, serviceId)`. Pertahankan `serviceType` sementara (transisi) → hapus di fase akhir.
- [ ] `ChecklistResult`: tambah `workItemId String?` (FK WorkItem, onDelete Cascade), unique baru `(tenantId, workItemId, itemKey)`. Pertahankan `jobId` sementara.
- [ ] Relasi balik di `ServiceCatalog` (checklistTemplate) & `WorkItem` (checklistResults).
- [ ] Migration additive (nullable dulu) → backfill → baru non-null/rename di fase akhir. TANPA drop kolom di awal (reversibel).

### 3.2 BE (services)
- [ ] `defaults.ts`: JANGAN pakai DEFAULT_CHECKLISTS utk seeding (default kosong). Simpan sbg contoh/opsional "template siap pakai" saja.
- [ ] `provision.ts`: HAPUS pembuatan checklist otomatis (tetap seed WA templates).
- [ ] `checklist-template-service.ts`: CRUD berbasis serviceId (list per Layanan tenant, save/reset per serviceId).
- [ ] `job-work-service.ts`: `getJobChecklist`→`getWorkItemChecklist(workItemId)`, `setChecklistItem` anchor workItemId.
- [ ] `job-service.ts` `assertCompletionGuards`: iterasi seluruh WorkItem job → cek template per serviceId → kumpulkan missing lintas unit.
- [ ] `worksession-service.ts`: saat addWorkItem, siapkan akses template checklist layanan itu (utk FE render).
- [ ] `dunning-service.ts` (hapus tenant): pastikan cascade ChecklistResult/Template baru ikut.
- [ ] `onboarding-service.ts`: definisi "checklist siap" disesuaikan (opsional, bukan wajib).

### 3.3 FE
- [ ] `/app/checklist/page.tsx` + `checklist-editor.tsx` + `actions.ts`: daftar per LAYANAN (ServiceCatalog), default kosong + tombol "Aktifkan checklist" / "Pakai template contoh". Wajib/opsional per item tetap.
- [ ] `/app/layanan`: tambah indikator + tautan "Checklist" per layanan (kaitan visual).
- [ ] `/t/kerja/[customerId]/work-session.tsx`: tiap WorkItem tampil checklist-nya (bila layanan punya template); isi per unit.
- [ ] `/t/pekerjaan/[id]/work.tsx` + `page.tsx`: selaraskan agar checklist tak dobel; sumber checklist = WorkItem.
- [ ] `app-nav.tsx`, `icons.tsx`: label/ikon bila perlu.

### 3.4 Konten & SSOT
- [ ] `help/content-owner.ts`, `help/content-tech.ts`: perbarui penjelasan (opt-in, per layanan×unit).
- [ ] `prisma/seed.ts`: hentikan seeding checklist wajib (biar cocok dgn default kosong) — atau seed sbg contoh non-wajib untuk tenant demo saja.
- [ ] SSOT dok (PROJECT_STATUS / build spec) disinkronkan.

## 4. Rencana MIGRASI DATA (go-live, reversibel)
Prod: 4 tenant, ~60 pekerjaan, ChecklistTemplate(serviceType) & ChecklistResult(jobId) berisi data nyata.
- FASE 1 (additive, nol hapus):
  1. Tambah kolom nullable (serviceId, workItemId) + unique baru. Kolom lama tetap.
  2. Default kosong berlaku utk tenant BARU. Tenant lama: template serviceType lama tetap dihormati (dual-read) agar job berjalan tak putus.
  3. FE admin baru per-layanan hidup berdampingan; guard baca dua sumber (serviceId bila ada, else fallback serviceType) — TIDAK memutus job in-flight.
- FASE 2 (granular unit):
  4. ChecklistResult anchor workItemId aktif utk job BARU. Job lama (sudah COMPLETED) tak tersentuh.
  5. Setelah stabil: konversi/arsip data serviceType→serviceId satu kali (script idempoten, dry-run dulu), lalu hapus kolom lama.
- ROLLBACK: tiap fase punya titik balik (kolom lama masih ada; guard fallback). Backup DB sebelum tiap migrate.

## 5. Gerbang keamanan (WAJIB tiap langkah)
- Lokal: `pnpm prisma validate`, `pnpm prisma migrate dev` (shadow), `pnpm run build`, `pnpm run test`, `pnpm run lint` = semua hijau.
- Prod: backup DB → `prisma migrate deploy` → smoke test alur teknisi (buat job → work item → checklist → complete) di 1 tenant uji.
- Bukti nyata (bukan klaim): jalankan alur end-to-end, tampilkan hasil query.

## 6. Urutan eksekusi (bertahap, tiap fase deployable)
FASE 1: default kosong + template per serviceId + admin UI per layanan + kaitan /app/layanan + guard dual-read. (checklist masih per-job, tapi sumber = layanan)
FASE 2: ChecklistResult per workItemId + checklist per unit di WorkSession + guard lintas WorkItem + migrasi/cleanup + hapus kolom lama.

## 7. Risiko & mitigasi
- Guard memutus job in-flight → mitigasi: dual-read + default kosong (job tanpa template tak terkunci).
- Data lama hilang → mitigasi: additive dulu, cleanup paling akhir, backup + dry-run.
- Dobel checklist di FE teknisi → mitigasi: satu sumber (WorkItem) di FASE 2, sembunyikan kartu lama.
