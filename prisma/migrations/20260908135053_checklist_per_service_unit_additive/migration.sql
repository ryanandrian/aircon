-- FASE 2 checklist per LAYANAN × UNIT — ADDITIVE + REVERSIBEL.
-- Prinsip: hanya TAMBAH kolom nullable + index; TIDAK drop/ubah kolom lama (dual-read tetap hidup).
-- Unique index atas kolom nullable → banyak NULL diizinkan Postgres, tak bentrok data lama.

-- 1) Legacy dijadikan nullable (agar baris BARU boleh tak mengisi kolom lama). Data lama tetap.
ALTER TABLE "ChecklistTemplate" ALTER COLUMN "serviceType" DROP NOT NULL;
ALTER TABLE "ChecklistResult"  ALTER COLUMN "jobId"       DROP NOT NULL;

-- 2) Kolom BARU (nullable).
ALTER TABLE "ChecklistTemplate" ADD COLUMN "serviceId" TEXT;
ALTER TABLE "ChecklistResult"  ADD COLUMN "workItemId" TEXT;

-- 3) Unique baru (nullable-safe) + FK cascade.
CREATE UNIQUE INDEX "ChecklistTemplate_tenantId_serviceId_key" ON "ChecklistTemplate"("tenantId", "serviceId");
CREATE UNIQUE INDEX "ChecklistResult_tenantId_workItemId_itemKey_key" ON "ChecklistResult"("tenantId", "workItemId", "itemKey");

ALTER TABLE "ChecklistTemplate"
  ADD CONSTRAINT "ChecklistTemplate_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "ServiceCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChecklistResult"
  ADD CONSTRAINT "ChecklistResult_workItemId_fkey"
  FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
