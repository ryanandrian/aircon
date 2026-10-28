-- F4 — notifikasi mitra (agen/reseller): target nyata, inbox in-app, token expiry.
--
-- (1) PlatformNotification: `tenantId` jadi NULLABLE + kolom target mitra
--     (partnerKind/agentId/resellerId). Mitra BUKAN tenant ⇒ `tenantId` tak boleh
--     dipalsukan (larangan eksplisit di rencana kerja Fase 4).
-- (2) CHECK constraint: setiap baris WAJIB punya tepat satu target — tenant
--     (tenantId) atau mitra (agentId/resellerId). Tanpa ini, baris tanpa
--     penerima bisa masuk dan dispatcher tak akan tahu ke mana mengirim.
-- (3) Tabel PartnerNotification: inbox in-app mitra (mitra tak punya tenantId,
--     jadi tak bisa pakai TenantNotification).
-- (4) Agent/Reseller: loginTokenExpiresAt + loginTokenIssuedAt — token aktivasi
--     punya masa berlaku dan sekali-pakai secara atomik.
--
-- ADDITIVE & backward-compatible:
--  - Kolom baru nullable/default null ⇒ baris lama tak berubah.
--  - `tenantId` DROP NOT NULL tidak merusak baris lama (nilainya tetap ada).
--  - CHECK constraint di-backfill+validasi (lihat bawah) supaya migrasi
--    tak gagal bila ada baris tak sah (tak ada: semua baris lama punya tenantId).
--
-- Rollback:
--   DROP TABLE "PartnerNotification";
--   DROP INDEX ...; ALTER TABLE "PlatformNotification" DROP CONSTRAINT ...;
--   ALTER TABLE "PlatformNotification" DROP COLUMN "agentId","partnerKind","resellerId";
--   ALTER TABLE "PlatformNotification" ALTER COLUMN "tenantId" SET NOT NULL;
--   ALTER TABLE "Agent" DROP COLUMN "loginTokenExpiresAt","loginTokenIssuedAt";
--   ALTER TABLE "Reseller" DROP COLUMN "loginTokenExpiresAt","loginTokenIssuedAt";

-- (1) Kolom target mitra + tenantId nullable
ALTER TABLE "PlatformNotification"
  ADD COLUMN IF NOT EXISTS "agentId" TEXT,
  ADD COLUMN IF NOT EXISTS "partnerKind" TEXT,
  ADD COLUMN IF NOT EXISTS "resellerId" TEXT;
ALTER TABLE "PlatformNotification" ALTER COLUMN "tenantId" DROP NOT NULL;

-- (4) Masa berlaku token aktivasi
ALTER TABLE "Agent"
  ADD COLUMN IF NOT EXISTS "loginTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "loginTokenIssuedAt" TIMESTAMP(3);
ALTER TABLE "Reseller"
  ADD COLUMN IF NOT EXISTS "loginTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "loginTokenIssuedAt" TIMESTAMP(3);

-- (3) Inbox in-app mitra
CREATE TABLE IF NOT EXISTS "PartnerNotification" (
    "id" TEXT NOT NULL,
    "partnerKind" TEXT NOT NULL,
    "agentId" TEXT,
    "resellerId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entityId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerNotification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PartnerNotification_dedupeKey_key" ON "PartnerNotification"("dedupeKey");
CREATE INDEX IF NOT EXISTS "PartnerNotification_agentId_createdAt_idx" ON "PartnerNotification"("agentId", "createdAt");
CREATE INDEX IF NOT EXISTS "PartnerNotification_resellerId_createdAt_idx" ON "PartnerNotification"("resellerId", "createdAt");
CREATE INDEX IF NOT EXISTS "PartnerNotification_partnerKind_readAt_idx" ON "PartnerNotification"("partnerKind", "readAt");
CREATE INDEX IF NOT EXISTS "PlatformNotification_agentId_createdAt_idx" ON "PlatformNotification"("agentId", "createdAt");
CREATE INDEX IF NOT EXISTS "PlatformNotification_resellerId_createdAt_idx" ON "PlatformNotification"("resellerId", "createdAt");

-- Foreign keys (CASCADE: hapus agen/reseller ⇒ notifikasi ikut hilang)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlatformNotification_agentId_fkey') THEN
    ALTER TABLE "PlatformNotification" ADD CONSTRAINT "PlatformNotification_agentId_fkey"
      FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlatformNotification_resellerId_fkey') THEN
    ALTER TABLE "PlatformNotification" ADD CONSTRAINT "PlatformNotification_resellerId_fkey"
      FOREIGN KEY ("resellerId") REFERENCES "Reseller"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PartnerNotification_agentId_fkey') THEN
    ALTER TABLE "PartnerNotification" ADD CONSTRAINT "PartnerNotification_agentId_fkey"
      FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PartnerNotification_resellerId_fkey') THEN
    ALTER TABLE "PartnerNotification" ADD CONSTRAINT "PartnerNotification_resellerId_fkey"
      FOREIGN KEY ("resellerId") REFERENCES "Reseller"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- (2) CHECK constraint: tepat satu target. Diterapkan SETELAH baris tak sah
-- dibersihkan (di bawah) supaya migrasi tak gagal.
ALTER TABLE "PlatformNotification"
  DROP CONSTRAINT IF EXISTS "PlatformNotification_target_check";

-- Bersihkan baris tanpa target (tak ada di live, tapi jangan andalkan itu):
-- baris tanpa tenantId DAN tanpa agentId/resellerId tak punya penerima ⇒
-- tak bisa dikirim; hapus agar constraint bisa ditegakkan.
DELETE FROM "PlatformNotification"
 WHERE "tenantId" IS NULL AND "agentId" IS NULL AND "resellerId" IS NULL;

ALTER TABLE "PlatformNotification"
  ADD CONSTRAINT "PlatformNotification_target_check" CHECK (
    (("tenantId" IS NOT NULL)::int + ("agentId" IS NOT NULL)::int + ("resellerId" IS NOT NULL)::int) = 1
  );
