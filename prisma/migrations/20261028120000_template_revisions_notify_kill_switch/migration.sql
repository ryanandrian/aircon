-- F5 versioning/rollback template + F3/G30 kill switch.
--
-- (1) PlatformTemplateRevision: riwayat versi tiap simpan copy template platform.
--     Rollback = salin isi versi lama ke baris aktif (versi naik lagi).
-- (2) InfraConfig.notifySendEnabled: kill switch. Saat false, dispatcher platform
--     MENAH (antrean tetap QUEUED, tak ada pesan hilang). Dipakai operator saat
--     insiden. Tidak menyentuh pesan tenant ke pelanggan.
--
-- ADDITIVE: tabel baru + satu kolom boolean default true (perilaku tak berubah
-- sampai admin mematikan lewat toggle).
-- Rollback: DROP TABLE "PlatformTemplateRevision";
--   ALTER TABLE "InfraConfig" DROP COLUMN IF EXISTS "notifySendEnabled";
CREATE TABLE IF NOT EXISTS "PlatformTemplateRevision" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformTemplateRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformTemplateRevision_key_version_key"
    ON "PlatformTemplateRevision"("key", "version");
CREATE INDEX IF NOT EXISTS "PlatformTemplateRevision_key_createdAt_idx"
    ON "PlatformTemplateRevision"("key", "createdAt");

ALTER TABLE "InfraConfig" ADD COLUMN IF NOT EXISTS "notifySendEnabled" BOOLEAN NOT NULL DEFAULT true;
