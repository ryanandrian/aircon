-- Lapis C: kolom email opsional pelanggan (additive, nullable, backward-compatible).
-- Aman untuk DB produksi bersama: hanya ADD COLUMN nullable, nol backfill, nol drop.
ALTER TABLE "Customer" ADD COLUMN "picWorkEmail" TEXT;
ALTER TABLE "Customer" ADD COLUMN "picFinanceEmail" TEXT;
ALTER TABLE "Customer" ADD COLUMN "email" TEXT;
