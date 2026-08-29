-- Landing: seksi "Fitur Unggulan" (Fase 2-7) — editable admin. Additive, aman.
ALTER TABLE "LandingContent" ADD COLUMN IF NOT EXISTS "featuresTitle" TEXT NOT NULL DEFAULT '';
ALTER TABLE "LandingContent" ADD COLUMN IF NOT EXISTS "featuresSubtitle" TEXT NOT NULL DEFAULT '';
ALTER TABLE "LandingContent" ADD COLUMN IF NOT EXISTS "showFeatures" BOOLEAN NOT NULL DEFAULT true;
