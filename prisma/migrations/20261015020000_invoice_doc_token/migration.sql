-- F7a (keputusan pemilik A+C, 2026-10-15): token dokumen utk tautan publik /d/{token}.
-- ADDITIVE: kolom baru nullable (dokumen LAMA tanpa token aman — tidak rusak),
-- unique (token = 1 jangkar per dokumen; anti-enumeration via entropi acak).
-- Token DIISI saat dokumen terbit (closeWorkSession & createInvoiceFromProforma);
-- kwitansi memakai token invoice yang sama. Kolom nullable → tanpa backfill data.
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "docToken" TEXT;

-- Unique index: token = kunci akses publik, wajib unik antar dokumen
-- (pola UnitCode.code @id / Customer.cardToken @unique yang sudah mapan).
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_docToken_key" ON "Invoice"("docToken");
