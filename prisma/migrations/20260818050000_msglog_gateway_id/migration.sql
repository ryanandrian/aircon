-- AlterTable
ALTER TABLE "MessageLog" ADD COLUMN     "gatewayMessageId" TEXT;

-- CreateIndex
CREATE INDEX "MessageLog_tenantId_gatewayMessageId_idx" ON "MessageLog"("tenantId", "gatewayMessageId");

