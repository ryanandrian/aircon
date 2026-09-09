-- Anti akun-ganda: nomor WA TERVERIFIKASI (hasil scan gateway) unik global (1 WA = 1 tenant).
-- Additive nullable: banyak NULL diizinkan Postgres pada UNIQUE; nol backfill; aman DB produksi.
ALTER TABLE "Tenant" ADD COLUMN "waVerifiedPhone" TEXT;
CREATE UNIQUE INDEX "Tenant_waVerifiedPhone_key" ON "Tenant"("waVerifiedPhone");
