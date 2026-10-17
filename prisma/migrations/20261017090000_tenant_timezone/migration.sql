-- L1 / K7 (keputusan pemilik 2026-10-17): zona waktu MILIK TENANT.
-- Semua penanggalan laporan tenant (batas "bulan ini", "sejak X hari") dihitung di
-- zona ini — sebelumnya memakai zona server (UTC) → pembayaran subuh tanggal 1
-- terhitung ke bulan sebelumnya (fakta M5).
-- ADDITIVE: kolom baru + DEFAULT WIB → seluruh tenant LAMA otomatis dapat
-- 'Asia/Jakarta' (pemilik: seluruh tenant yang ada saat ini WIB, update langsung).
-- Tidak ada data lama yang disentuh selain pengisian default pada baris kosong.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta';
