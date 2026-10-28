-- F3 / G10 — Lease pengiriman & status UNKNOWN.
--
-- MASALAH: dispatcher mengklaim QUEUED -> SENDING lalu memanggil provider.
-- Bila proses crash di tengah, baris tertahan SENDING selamanya, tak pernah
-- diambil lagi (hanya QUEUED yang dicari) — kehilangan pesan tanpa jejak.
-- LALU: outcome provider TIDAK dapat ditanyakan (gateway tanpa endpoint lookup
-- job), jadi kirim ulang otomatis = risiko duplikat ke pelanggan.
--
-- PERBAIKAN: lease `leaseExpiresAt` saat klaim. Stale lease -> status UNKNOWN
-- (bukan kirim ulang). Operator melihat UNKNOWN di admin dan memutuskan replay.
--
-- PG 17.6: ALTER TYPE ADD VALUE diizinkan dalam transaksi (PG >= 12).
-- ADDITIVE: kolom nullable + indeks + satu nilai enum baru; data lama tak tersentuh.
-- Rollback: DROP INDEX; ALTER TABLE DROP COLUMN; (nilai enum sulit dibalik — biarkan).
ALTER TYPE "MessageStatus" ADD VALUE IF NOT EXISTS 'UNKNOWN';

ALTER TABLE "MessageLog" ADD COLUMN IF NOT EXISTS "sendingAt" TIMESTAMP(3);
ALTER TABLE "MessageLog" ADD COLUMN IF NOT EXISTS "leaseExpiresAt" TIMESTAMP(3);
ALTER TABLE "PlatformNotification" ADD COLUMN IF NOT EXISTS "sendingAt" TIMESTAMP(3);
ALTER TABLE "PlatformNotification" ADD COLUMN IF NOT EXISTS "leaseExpiresAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "MessageLog_status_leaseExpiresAt_idx"
  ON "MessageLog"("status", "leaseExpiresAt");
CREATE INDEX IF NOT EXISTS "PlatformNotification_status_leaseExpiresAt_idx"
  ON "PlatformNotification"("status", "leaseExpiresAt");
