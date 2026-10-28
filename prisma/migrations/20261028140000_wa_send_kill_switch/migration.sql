-- F3/G30: kill switch WA tenant -> pelanggan.
--
-- Kolom boolean default true (perilaku tak berubah sampai operator mematikan lewat
-- toggle di Admin -> Notifikasi). Memisahkan dari `notifySendEnabled` yang hanya
-- menahan pesan platform (platform -> owner): WA ke pelanggan adalah money loop
-- dan butuh sakelar sendiri.
--
-- ADDITIVE: satu kolom dengan default true.
-- Rollback: ALTER TABLE "InfraConfig" DROP COLUMN IF EXISTS "waSendEnabled";
ALTER TABLE "InfraConfig" ADD COLUMN IF NOT EXISTS "waSendEnabled" BOOLEAN NOT NULL DEFAULT true;
