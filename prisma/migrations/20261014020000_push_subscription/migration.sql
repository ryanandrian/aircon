-- FASE 1 Web Push (keputusan pemilik 2026-10-14): notifikasi PENUGASAN ke
-- teknisi/kernet via PWA /t. Satu baris = 1 perangkat browser dengan izin push.
-- ADDITIVE: tabel baru; tidak menyentuh tabel lama.
-- revokedAt dipertahankan sebagai jejak audit (unsubscribe/endpoint basi 410).
CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "lastSentAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- Unik: 1 perangkat per user (upsert idempoten) + endpoint global unik (FCM).
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_tenantId_userId_deviceId_key"
    ON "PushSubscription"("tenantId", "userId", "deviceId");
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key"
    ON "PushSubscription"("endpoint");

-- Baca kirim: semua subscription aktif milik tenant.
CREATE INDEX IF NOT EXISTS "PushSubscription_tenantId_revokedAt_idx"
    ON "PushSubscription"("tenantId", "revokedAt");

-- FK (tenant & user) — pola onDelete: Cascade.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PushSubscription_tenantId_fkey') THEN
    ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PushSubscription_userId_fkey') THEN
    ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
