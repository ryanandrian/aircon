-- Sweeper akun tidak aktif — config (BillingPolicy) + state (Tenant). Additive, aman.
ALTER TABLE "BillingPolicy" ADD COLUMN IF NOT EXISTS "inactivitySweepEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BillingPolicy" ADD COLUMN IF NOT EXISTS "inactivityDryRun" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "BillingPolicy" ADD COLUMN IF NOT EXISTS "inactivityReminder1Days" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "BillingPolicy" ADD COLUMN IF NOT EXISTS "inactivityReminder2Days" INTEGER NOT NULL DEFAULT 45;
ALTER TABLE "BillingPolicy" ADD COLUMN IF NOT EXISTS "inactivityDeleteDays" INTEGER NOT NULL DEFAULT 52;
ALTER TABLE "BillingPolicy" ADD COLUMN IF NOT EXISTS "inactivityMinCustomers" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "BillingPolicy" ADD COLUMN IF NOT EXISTS "inactivityMinJobs" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "BillingPolicy" ADD COLUMN IF NOT EXISTS "inactivityExemptPaid" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "BillingPolicy" ADD COLUMN IF NOT EXISTS "inactivityReminder1Template" TEXT NOT NULL DEFAULT 'Halo {nama}, akun Aircon Anda belum ada aktivitas selama {hari} hari. Kami menantikan Anda kembali — buka aplikasi kapan saja untuk melanjutkan.';
ALTER TABLE "BillingPolicy" ADD COLUMN IF NOT EXISTS "inactivityReminder2Template" TEXT NOT NULL DEFAULT 'Halo {nama}, akun Aircon Anda sudah {hari} hari tanpa aktivitas. PERINGATAN: bila tetap tidak digunakan, akun beserta seluruh data akan DIHAPUS PERMANEN dalam {sisa} hari. Buka aplikasi untuk membatalkan penghapusan.';

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "inactivityReminderAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "inactivityReminderStage" INTEGER NOT NULL DEFAULT 0;
