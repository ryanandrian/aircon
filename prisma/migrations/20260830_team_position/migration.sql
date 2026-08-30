-- Posisi default anggota tim (teknisi/kernet). Additive, aman.
DO $$ BEGIN
  CREATE TYPE "TeamPosition" AS ENUM ('TEKNISI', 'KERNET');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
ALTER TABLE "Technician" ADD COLUMN IF NOT EXISTS "position" "TeamPosition" NOT NULL DEFAULT 'TEKNISI';
