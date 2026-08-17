-- CreateEnum
CREATE TYPE "IotOrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'INSTALLED', 'CANCELLED');

-- AlterEnum
BEGIN;
CREATE TYPE "TenantPlan_new" AS ENUM ('TRIAL', 'PROFESSIONAL', 'BUSINESS');
ALTER TABLE "public"."Tenant" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "Tenant" ALTER COLUMN "plan" TYPE "TenantPlan_new" USING ("plan"::text::"TenantPlan_new");
ALTER TABLE "Subscription" ALTER COLUMN "plan" TYPE "TenantPlan_new" USING ("plan"::text::"TenantPlan_new");
ALTER TABLE "Payment" ALTER COLUMN "plan" TYPE "TenantPlan_new" USING ("plan"::text::"TenantPlan_new");
ALTER TYPE "TenantPlan" RENAME TO "TenantPlan_old";
ALTER TYPE "TenantPlan_new" RENAME TO "TenantPlan";
DROP TYPE "public"."TenantPlan_old";
ALTER TABLE "Tenant" ALTER COLUMN "plan" SET DEFAULT 'TRIAL';
COMMIT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "lastDunningReminderAt" TIMESTAMP(3),
ADD COLUMN     "markedForDeletionAt" TIMESTAMP(3),
ADD COLUMN     "nextDueDate" TIMESTAMP(3),
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ALTER COLUMN "plan" SET DEFAULT 'TRIAL';

-- CreateTable
CREATE TABLE "PlanConfig" (
    "id" TEXT NOT NULL,
    "plan" "TenantPlan" NOT NULL,
    "displayName" TEXT NOT NULL,
    "priceMonthly" INTEGER NOT NULL DEFAULT 0,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "tagline" TEXT,
    "maxAdmins" INTEGER,
    "maxTechnicians" INTEGER,
    "maxCustomers" INTEGER,
    "maxAcUnits" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPolicy" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "taxPercent" DOUBLE PRECISION NOT NULL DEFAULT 11,
    "trialDays" INTEGER NOT NULL DEFAULT 14,
    "graceDaysBeforeSuspend" INTEGER NOT NULL DEFAULT 1,
    "daysBeforeDelete" INTEGER NOT NULL DEFAULT 7,
    "dunningReminderDays" TEXT NOT NULL DEFAULT '0,1,3',
    "deleteWarningDay" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "BillingPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IotProduct" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceUnit" INTEGER NOT NULL,
    "warrantyDays" INTEGER NOT NULL DEFAULT 90,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IotProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IotOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "status" "IotOrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "taxPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "paymentOrderId" TEXT,
    "snapToken" TEXT,
    "snapRedirect" TEXT,
    "paidAt" TIMESTAMP(3),
    "shippingAddress" TEXT,
    "trackingNote" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IotOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IotOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,

    CONSTRAINT "IotOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanConfig_plan_key" ON "PlanConfig"("plan");

-- CreateIndex
CREATE UNIQUE INDEX "IotProduct_sku_key" ON "IotProduct"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "IotOrder_orderNo_key" ON "IotOrder"("orderNo");

-- CreateIndex
CREATE UNIQUE INDEX "IotOrder_paymentOrderId_key" ON "IotOrder"("paymentOrderId");

-- CreateIndex
CREATE INDEX "IotOrder_tenantId_status_idx" ON "IotOrder"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "IotOrder" ADD CONSTRAINT "IotOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IotOrderItem" ADD CONSTRAINT "IotOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "IotOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IotOrderItem" ADD CONSTRAINT "IotOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "IotProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

