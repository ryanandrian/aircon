-- Additive durable tenant inbox for public booking notifications.
CREATE TABLE "TenantNotification" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "entityId" TEXT,
  "dedupeKey" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantNotification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TenantNotification_dedupeKey_key" ON "TenantNotification"("dedupeKey");
CREATE INDEX "TenantNotification_tenantId_readAt_createdAt_idx" ON "TenantNotification"("tenantId", "readAt", "createdAt");
ALTER TABLE "TenantNotification" ADD CONSTRAINT "TenantNotification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
