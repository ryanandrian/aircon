-- F2 transisi state WhatsApp (sumber dedupe per transisi, bukan per hari).
-- Kolom INTEGER DEFAULT 0 = belum pernah ada transisi (state "unknown").
-- 0=tak diketahui, ganjil=terputus, genap>=2=tersambung (lihat wa-transition-service).
-- ADDITIVE: kolom baru dengan default aman; data lama (7 tenant) di-backfill 0
-- sehingga tenant yang sudah tersambung memperoleh epoch 1 saat callback berikutnya.
-- Rollback: ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "waSessionEpoch";
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "waSessionEpoch" INTEGER NOT NULL DEFAULT 0;
