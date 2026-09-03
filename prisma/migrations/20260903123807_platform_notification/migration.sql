-- AlterEnum
ALTER TYPE "MessageChannel" ADD VALUE 'EMAIL';

-- CreateTable
CREATE TABLE "PlatformNotification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "templateKey" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED',
    "dedupeKey" TEXT,
    "gatewayMessageId" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "PlatformNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformNotification_dedupeKey_key" ON "PlatformNotification"("dedupeKey");

-- CreateIndex
CREATE INDEX "PlatformNotification_status_channel_idx" ON "PlatformNotification"("status", "channel");

-- CreateIndex
CREATE INDEX "PlatformNotification_tenantId_createdAt_idx" ON "PlatformNotification"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "PlatformNotification" ADD CONSTRAINT "PlatformNotification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
