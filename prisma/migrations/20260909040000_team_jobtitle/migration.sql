-- Tim/Staf: kolom jobTitle (jabatan bebas, mis. "Admin Keuangan") — opsional/nullable.
-- Additive murni: nol backfill, nol drop, backward-compatible. Aman utk DB produksi bersama.
ALTER TABLE "Invite" ADD COLUMN "jobTitle" TEXT;
ALTER TABLE "User" ADD COLUMN "jobTitle" TEXT;
