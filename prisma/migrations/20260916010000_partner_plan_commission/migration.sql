-- Canonical partner commission rule schema.
-- Legacy Agent/Reseller rate columns remain for backward compatibility.
CREATE TABLE "PartnerPlanCommission" (
  "id" TEXT NOT NULL,
  "agentId" TEXT,
  "resellerId" TEXT,
  "plan" "TenantPlan" NOT NULL,
  "commissionType" "CommissionType" NOT NULL,
  "commissionValue" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerPlanCommission_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PartnerPlanCommission_one_owner_ck" CHECK (("agentId" IS NOT NULL)::int + ("resellerId" IS NOT NULL)::int = 1),
  CONSTRAINT "PartnerPlanCommission_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PartnerPlanCommission_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "Reseller"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PartnerPlanCommission_agentId_plan_key" ON "PartnerPlanCommission"("agentId", "plan");
CREATE UNIQUE INDEX "PartnerPlanCommission_resellerId_plan_key" ON "PartnerPlanCommission"("resellerId", "plan");
CREATE INDEX "PartnerPlanCommission_plan_idx" ON "PartnerPlanCommission"("plan");
