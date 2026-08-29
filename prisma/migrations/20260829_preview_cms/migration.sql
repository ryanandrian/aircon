-- Landing: CS WhatsApp + tier custom + toggle preview (editable admin). Additive.
ALTER TABLE "LandingContent" ADD COLUMN IF NOT EXISTS "csWhatsapp" TEXT NOT NULL DEFAULT '';
ALTER TABLE "LandingContent" ADD COLUMN IF NOT EXISTS "customTierTitle" TEXT NOT NULL DEFAULT '';
ALTER TABLE "LandingContent" ADD COLUMN IF NOT EXISTS "customTierDesc" TEXT NOT NULL DEFAULT '';
ALTER TABLE "LandingContent" ADD COLUMN IF NOT EXISTS "showPreview" BOOLEAN NOT NULL DEFAULT true;

-- Pratinjau CMS (pengganti demo)
CREATE TABLE IF NOT EXISTS "PreviewItem" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "caption" TEXT NOT NULL DEFAULT '',
  "imageUrl" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT '',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "published" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PreviewItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PreviewItem_published_sortOrder_idx" ON "PreviewItem"("published", "sortOrder");
