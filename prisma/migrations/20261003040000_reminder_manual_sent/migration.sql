-- Rencana A modul Pengingat: penanda pengiriman MANUAL (tenant konfirmasi sendiri).
-- ADDITIVE: kolom nullable, baris lama NULL (semua historis = jalur otomatis/tak tercatat).
ALTER TABLE "RepeatReminder" ADD COLUMN IF NOT EXISTS "manualSentAt" TIMESTAMP(3);
