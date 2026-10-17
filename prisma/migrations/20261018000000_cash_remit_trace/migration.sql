-- L2 / K5 (keputusan pemilik 2026-10-17): JEJAK SETORAN kas teknisi.
-- Setoran kini wajib mencatat: WAKTU setoran, ADMIN PENERIMA (tenant bisa >1 admin),
-- dan FOTO BUKTI (S3). Sebelumnya setoran hanya membalik status tanpa jejak (M2).
-- ADDITIVE: kolom nullable — baris REMITTED LAMA tetap aman (null) dan tetap terbaca.
-- Tanpa DEFAULT → tidak ada data lama yang diisi nilai palsu; jejak hanya terisi
-- untuk setoran BARU setelah kolom ini ada.
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "remittedAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "remittedById" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "remitProofUrl" TEXT;
