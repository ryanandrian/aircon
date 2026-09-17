CREATE TYPE "IpaymuEnvironment" AS ENUM ('SANDBOX', 'PRODUCTION');
CREATE TABLE "IpaymuConfig" (
  "id" TEXT NOT NULL DEFAULT 'singleton',
  "activeEnvironment" "IpaymuEnvironment" NOT NULL DEFAULT 'SANDBOX',
  "sandboxVaEnc" TEXT,
  "sandboxApiKeyEnc" TEXT,
  "productionVaEnc" TEXT,
  "productionApiKeyEnc" TEXT,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IpaymuConfig_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PlatformAuditLog" (
  "id" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "target" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlatformAuditLog_target_createdAt_idx" ON "PlatformAuditLog"("target", "createdAt");