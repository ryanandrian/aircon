-- Jarak kirim pengingat default 7 -> 3 hari sebelum jadwal servis (per keputusan owner).
-- SET DEFAULT hanya berlaku untuk INSERT Tenant BERIKUTNYA; baris yang ada tidak diubah
-- (sudah di-update terpisah ke 3 dan sudah di-backup: backup-tenant-reminder-lead.json).
ALTER TABLE "Tenant" ALTER COLUMN "reminderLeadDays" SET DEFAULT 3;
