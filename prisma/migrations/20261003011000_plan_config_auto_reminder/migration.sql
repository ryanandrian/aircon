-- FASE 4 modul Pengingat: flag kirim otomatis per paket.
-- ADDITIVE: DEFAULT true -> semua paket yang sudah ada tetap auto ON (rollout tak memutus
-- pengiriman tenant lama). Admin lalu menonaktifkan per paket (mis. TRIAL) lewat /admin/paket.
ALTER TABLE "PlanConfig" ADD COLUMN IF NOT EXISTS "autoReminder" BOOLEAN NOT NULL DEFAULT true;
