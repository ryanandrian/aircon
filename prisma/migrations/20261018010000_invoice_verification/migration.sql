-- L3 / K4 (keputusan pemilik 2026-10-17): VERIFIKASI transfer/QRIS oleh owner/admin
-- tenant — penerimaan baru dihitung setelah dana dipastikan masuk rekening
-- (antisipasi bukti fiktif pelanggan). null = belum diverifikasi.
-- ADDITIVE: kolom nullable. Transfer/QRIS LAMA tetap terbaca apa adanya (null =
-- belum pernah diverifikasi); CASH tidak memakai kolom ini (jalur setoran, L2).
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "verifiedById" TEXT;
