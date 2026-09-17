-- Add immutable plan snapshot to each commission ledger entry.
ALTER TABLE "CommissionLedger" ADD COLUMN "plan" "TenantPlan";
UPDATE "CommissionLedger" l
SET "plan" = p."plan"
FROM "Payment" p
WHERE p."orderId" = l."orderId";
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "CommissionLedger" WHERE "plan" IS NULL) THEN
    RAISE EXCEPTION 'CommissionLedger.plan backfill incomplete';
  END IF;
END $$;
ALTER TABLE "CommissionLedger" ALTER COLUMN "plan" SET NOT NULL;
