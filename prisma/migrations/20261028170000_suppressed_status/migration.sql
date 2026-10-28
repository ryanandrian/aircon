-- G28: penerima tujuan yang hilang tak boleh hilang diam-diam.
--
-- (1) Enum MessageStatus ditambah nilai `SUPPRESSED`: pesan DITAHAN karena tak
--     ada penerima (nomor WA / email kosong). BUKAN `FAILED` — tak ada attempt,
--     tak akan dikirim ulang, dan tak boleh menggagalkan beban lain.
--     Alasan disimpan terpisah di `suppressedReason` supaya operator tahu
--     apa yang harus diperbaiki (data kontak, bukan logika).
--
-- (2) `PlatformNotification.suppressedReason` + `MessageLog.suppressedReason`:
--     kolom alasan (TEXT, nullable). Baris lama = NULL (tidak ada perubahan
--     perilaku).
--
-- CATATAN: nilai enum baru di-append (tidak disisip di tengah) supaya urutan
-- tipe Postgres tak berubah dan tak ada baris lama yang perlu ditulis ulang.
--
-- Rollback:
--   ALTER TABLE "MessageLog" DROP COLUMN IF EXISTS "suppressedReason";
--   ALTER TABLE "PlatformNotification" DROP COLUMN IF EXISTS "suppressedReason";
--   DELETE FROM "PlatformNotification" WHERE "status" = 'SUPPRESSED';
--   DELETE FROM "MessageLog" WHERE "status" = 'SUPPRESSED';
--   ALTER TYPE "MessageStatus" RENAME VALUE 'SUPPRESSED' TO 'SUPPRESSED_TMP';

ALTER TYPE "MessageStatus" ADD VALUE IF NOT EXISTS 'SUPPRESSED';

ALTER TABLE "PlatformNotification"
  ADD COLUMN IF NOT EXISTS "suppressedReason" TEXT;
ALTER TABLE "MessageLog"
  ADD COLUMN IF NOT EXISTS "suppressedReason" TEXT;
