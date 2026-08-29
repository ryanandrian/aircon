-- Identitas usaha: alamat + moto/tagline (tampil di invoice & permukaan publik). Additive, aman.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "address" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "tagline" TEXT NOT NULL DEFAULT '';
