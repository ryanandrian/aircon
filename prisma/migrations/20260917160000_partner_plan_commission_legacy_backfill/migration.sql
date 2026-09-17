-- Backfill canonical per-plan rules from legacy partner rates.
-- Idempotent: existing canonical rows are preserved.
INSERT INTO "PartnerPlanCommission" ("id", "agentId", "plan", "commissionType", "commissionValue", "updatedAt")
SELECT md5(a."id" || ':' || p.plan), a."id", p.plan, a."commissionType", a."commissionValue", CURRENT_TIMESTAMP
FROM "Agent" a
CROSS JOIN (VALUES ('TRIAL'::"TenantPlan"), ('PROFESSIONAL'::"TenantPlan"), ('BUSINESS'::"TenantPlan")) AS p(plan)
WHERE NOT EXISTS (
  SELECT 1 FROM "PartnerPlanCommission" r WHERE r."agentId" = a."id" AND r."plan" = p.plan
);
INSERT INTO "PartnerPlanCommission" ("id", "resellerId", "plan", "commissionType", "commissionValue", "updatedAt")
SELECT md5(r."id" || ':' || p.plan), r."id", p.plan, r."commissionType", r."commissionValue", CURRENT_TIMESTAMP
FROM "Reseller" r
CROSS JOIN (VALUES ('TRIAL'::"TenantPlan"), ('PROFESSIONAL'::"TenantPlan"), ('BUSINESS'::"TenantPlan")) AS p(plan)
WHERE NOT EXISTS (
  SELECT 1 FROM "PartnerPlanCommission" x WHERE x."resellerId" = r."id" AND x."plan" = p.plan
);
