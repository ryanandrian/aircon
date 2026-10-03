-- FASE 6 (G7): pembuangan kolom/index CHECKLIST LEGACY per jenis servis + pekerjaan.
--
-- KONTEKS (fakta dari read-only 2026-10-03):
--  * Checklist kini SATU sistem: ChecklistTemplate.serviceId + ChecklistResult.workItemId.
--  * Jalur baca legacy (assertCompletionGuards, getJobChecklist, setChecklistItem, UI legacy)
--    dihapus dari source (FASE 5) — tidak ada pemakai tersisa.
--  * DATA LIVE: 7 template serviceId=NULL + 2 hasil workItemId=NULL (semua milik Jaya Mandiri
--    = demo dan AC Depok Jaya = test; 0 pelanggan asli). User memutuskan data demo tidak
--    menahan penghapusan fosil.
--
-- URUTAN WAJIB (semua dalam SATU transaksi di `migrate deploy`):
--   1) Hapus indeks legacy yang mencakup kolom yang akan di-drop.
--   2) Hapus BARIS legacy (yang identik dengan kolom NULL) — TANPA INI langkah 3 GAGAL
--      (PRISMA diff menghasilkan SET NOT NULL; 7+2 baris NULL akan memblokirnya).
--   3) SET NOT NULL pada kolom anchor baru (sesuai schema.prisma hasil edit).
--   4) DROP COLUMN legacy.
-- Rollback Prisma mengembalikan file ini tersimpan sebelum dijalankan; data legacy yang
-- terhapus TIDAK ikut kembali — itulah sebabnya langkah 2 diakhiri catatan: baris yang
-- dihapus HANYA milik tenant demo/test (bukti jumlah di atas).
--
-- CATATAN DEPLOY: file ini ditulis namun TIDAK dijalankan ke DB produksi oleh sesi ini —
-- eksekusi ke produksi adalah langkah terpisah yang butuh perintah eksplisit user.

-- 1) indeks legacy
DROP INDEX IF EXISTS "ChecklistTemplate_tenantId_serviceType_key";
DROP INDEX IF EXISTS "ChecklistResult_tenantId_jobId_itemKey_key";

-- 2) baris legacy (serviceId/workItemId NULL) — hanya data demo/test, dibuktikan di atas
DELETE FROM "ChecklistResult" WHERE "workItemId" IS NULL;
DELETE FROM "ChecklistTemplate" WHERE "serviceId" IS NULL;

-- 3) anchor baru wajib (skema baru)
ALTER TABLE "ChecklistResult" ALTER COLUMN "workItemId" SET NOT NULL;
ALTER TABLE "ChecklistTemplate" ALTER COLUMN "serviceId" SET NOT NULL;

-- 4) kolom legacy
ALTER TABLE "ChecklistResult" DROP COLUMN "jobId";
ALTER TABLE "ChecklistTemplate" DROP COLUMN "serviceType";
