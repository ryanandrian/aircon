-- CreateEnum
CREATE TYPE "UnitCodeStatus" AS ENUM ('POOL', 'BOUND');

-- CreateTable
CREATE TABLE "UnitCode" (
    "code" TEXT NOT NULL,
    "status" "UnitCodeStatus" NOT NULL DEFAULT 'POOL',
    "tenantId" TEXT,
    "assetId" TEXT,
    "batchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "boundAt" TIMESTAMP(3),

    CONSTRAINT "UnitCode_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnitCode_assetId_key" ON "UnitCode"("assetId");

-- CreateIndex
CREATE INDEX "UnitCode_tenantId_status_idx" ON "UnitCode"("tenantId", "status");

-- CreateIndex
CREATE INDEX "UnitCode_batchId_idx" ON "UnitCode"("batchId");

-- AddForeignKey
ALTER TABLE "UnitCode" ADD CONSTRAINT "UnitCode_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

