-- F3 / G11 — Idempotensi booking publik + failure semantics.
--
-- MASALAH (terbukti dari kode): `createLeadFromBooking` membuat Lead baru tiap
-- submit. Bila TenantNotification gagal, pemesan mengulang → lead ganda
-- (10 lead live sebelum perubahan ini, tanpa pengendali ganda).
--
-- PERBAIKAN: token `requestId` per render form (hidden field) + UNIQUE per tenant.
-- Submit ulang dengan token sama → lead yang sama (idempoten). NULL = lead lama
-- (Postgres mengizinkan banyak NULL pada unique).
--
-- ADDITIVE: kolom nullable + unique. Rollback:
--   ALTER TABLE "Lead" DROP CONSTRAINT IF EXISTS "Lead_tenantId_requestId_key";
--   ALTER TABLE "Lead" DROP COLUMN IF EXISTS "requestId";
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "requestId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Lead_tenantId_requestId_key"
  ON "Lead"("tenantId", "requestId");
