-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ResellerStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('FLAT_IDR', 'PERCENT');

-- CreateEnum
CREATE TYPE "PartnerTaxStatus" AS ENUM ('BADAN_NPWP', 'BADAN_NON_NPWP', 'PERORANGAN', 'PKP');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID');

-- CreateEnum
CREATE TYPE "LedgerEntryKind" AS ENUM ('ACCRUAL', 'REVERSAL');

-- CreateEnum
CREATE TYPE "LedgerStatus" AS ENUM ('ACCRUED', 'APPROVED', 'PAID', 'REVERSED');

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "picName" TEXT,
    "picEmail" TEXT NOT NULL,
    "picPhone" TEXT,
    "status" "PartnerStatus" NOT NULL DEFAULT 'ACTIVE',
    "commissionType" "CommissionType" NOT NULL DEFAULT 'PERCENT',
    "commissionValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxStatus" "PartnerTaxStatus" NOT NULL DEFAULT 'BADAN_NPWP',
    "npwp" TEXT,
    "bankName" TEXT,
    "bankAccountEnc" TEXT,
    "bankHolder" TEXT,
    "joinCode" TEXT,
    "userId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reseller" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "status" "ResellerStatus" NOT NULL DEFAULT 'PENDING',
    "commissionType" "CommissionType" NOT NULL DEFAULT 'FLAT_IDR',
    "commissionValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bankName" TEXT,
    "bankAccountEnc" TEXT,
    "bankHolder" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reseller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerCode" (
    "code" TEXT NOT NULL,
    "ownerKind" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "resellerId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerCode_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "TenantAttribution" (
    "tenantId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "resellerId" TEXT,
    "code" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantAttribution_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "AgentPayout" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "periodMonth" TIMESTAMP(3) NOT NULL,
    "grossCommissionIdr" INTEGER NOT NULL DEFAULT 0,
    "deductionIdr" INTEGER NOT NULL DEFAULT 0,
    "taxWithheldIdr" INTEGER NOT NULL DEFAULT 0,
    "netPaidIdr" INTEGER,
    "status" "PayoutStatus" NOT NULL DEFAULT 'DRAFT',
    "transferRef" TEXT,
    "notes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionLedger" (
    "id" SERIAL NOT NULL,
    "orderId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "resellerId" TEXT,
    "grossIdr" INTEGER NOT NULL,
    "monthsPaid" INTEGER NOT NULL DEFAULT 1,
    "agentRateType" "CommissionType" NOT NULL,
    "agentRateValue" DOUBLE PRECISION NOT NULL,
    "agentAmountIdr" INTEGER NOT NULL,
    "resellerRateType" "CommissionType",
    "resellerRateValue" DOUBLE PRECISION,
    "resellerAmountIdr" INTEGER NOT NULL DEFAULT 0,
    "entryKind" "LedgerEntryKind" NOT NULL DEFAULT 'ACCRUAL',
    "reversalOf" INTEGER,
    "status" "LedgerStatus" NOT NULL DEFAULT 'ACCRUED',
    "payoutId" TEXT,
    "periodMonth" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_picEmail_key" ON "Agent"("picEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_joinCode_key" ON "Agent"("joinCode");

-- CreateIndex
CREATE INDEX "Reseller_agentId_status_idx" ON "Reseller"("agentId", "status");

-- CreateIndex
CREATE INDEX "PartnerCode_agentId_idx" ON "PartnerCode"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentPayout_agentId_periodMonth_key" ON "AgentPayout"("agentId", "periodMonth");

-- CreateIndex
CREATE INDEX "CommissionLedger_agentId_periodMonth_status_idx" ON "CommissionLedger"("agentId", "periodMonth", "status");

-- CreateIndex
CREATE INDEX "CommissionLedger_tenantId_idx" ON "CommissionLedger"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionLedger_orderId_entryKind_key" ON "CommissionLedger"("orderId", "entryKind");

-- AddForeignKey
ALTER TABLE "Reseller" ADD CONSTRAINT "Reseller_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCode" ADD CONSTRAINT "PartnerCode_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCode" ADD CONSTRAINT "PartnerCode_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "Reseller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAttribution" ADD CONSTRAINT "TenantAttribution_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAttribution" ADD CONSTRAINT "TenantAttribution_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAttribution" ADD CONSTRAINT "TenantAttribution_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "Reseller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAttribution" ADD CONSTRAINT "TenantAttribution_code_fkey" FOREIGN KEY ("code") REFERENCES "PartnerCode"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPayout" ADD CONSTRAINT "AgentPayout_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionLedger" ADD CONSTRAINT "CommissionLedger_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionLedger" ADD CONSTRAINT "CommissionLedger_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "AgentPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

