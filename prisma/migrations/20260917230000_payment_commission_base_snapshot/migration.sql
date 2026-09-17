-- Additive only: new payments snapshot their pre-tax commission basis at checkout.
-- Existing payments remain NULL and use the legacy compatibility fallback until
-- historical tax/price evidence is reconciled; never invent historical values.
ALTER TABLE "Payment" ADD COLUMN "commissionBaseIdr" INTEGER;