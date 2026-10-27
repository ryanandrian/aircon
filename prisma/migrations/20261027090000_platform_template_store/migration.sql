-- F5 Template Center (rencana kerja notifikasi, 27 Okt 2026).
-- Copy notifikasi platform yang bisa diedit admin. ADDITIVE: tabel baru saja;
-- tidak menyentuh tabel lama. Baris belum ada = default kode (PLATFORM_TEMPLATES).
-- Rollback: DROP TABLE "PlatformTemplate"; (tidak ada data lain yang bergantung).
CREATE TABLE IF NOT EXISTS "PlatformTemplate" (
    "key"       TEXT NOT NULL,
    "subject"   TEXT NOT NULL DEFAULT '',
    "body"      TEXT NOT NULL,
    "version"   INTEGER NOT NULL DEFAULT 1,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformTemplate_pkey" PRIMARY KEY ("key")
);
