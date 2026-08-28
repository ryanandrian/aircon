-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('MAINTENANCE', 'SERVICE', 'CONSUMABLE', 'SPAREPART', 'PAKET', 'SURVEI', 'GARANSI', 'LAINNYA');

-- CreateEnum
CREATE TYPE "IncentiveType" AS ENUM ('PERCENT', 'VALUE');

-- CreateTable
CREATE TABLE "ServiceCatalog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL DEFAULT 'SERVICE',
    "standardPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'unit',
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "techIncentiveType" "IncentiveType" NOT NULL DEFAULT 'VALUE',
    "techIncentiveValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "kernetIncentiveType" "IncentiveType" NOT NULL DEFAULT 'VALUE',
    "kernetIncentiveValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerPricing" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerPricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceCatalog_tenantId_category_idx" ON "ServiceCatalog"("tenantId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCatalog_tenantId_code_key" ON "ServiceCatalog"("tenantId", "code");

-- CreateIndex
CREATE INDEX "CustomerPricing_tenantId_idx" ON "CustomerPricing"("tenantId");

-- CreateIndex
CREATE INDEX "CustomerPricing_serviceId_idx" ON "CustomerPricing"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPricing_customerId_serviceId_key" ON "CustomerPricing"("customerId", "serviceId");

-- AddForeignKey
ALTER TABLE "ServiceCatalog" ADD CONSTRAINT "ServiceCatalog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPricing" ADD CONSTRAINT "CustomerPricing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPricing" ADD CONSTRAINT "CustomerPricing_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPricing" ADD CONSTRAINT "CustomerPricing_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

