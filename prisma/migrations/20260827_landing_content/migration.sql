-- CreateTable
CREATE TABLE "LandingContent" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "heroBadge" TEXT NOT NULL DEFAULT '',
    "heroTitle" TEXT NOT NULL DEFAULT '',
    "heroTitleAccent" TEXT NOT NULL DEFAULT '',
    "heroSubtitle" TEXT NOT NULL DEFAULT '',
    "heroCtaPrimary" TEXT NOT NULL DEFAULT '',
    "heroCtaSecondary" TEXT NOT NULL DEFAULT '',
    "heroMicrocopy" TEXT NOT NULL DEFAULT '',
    "heroImageUrl" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT NOT NULL DEFAULT '',
    "ogImageUrl" TEXT NOT NULL DEFAULT '',
    "howTitle" TEXT NOT NULL DEFAULT '',
    "howSubtitle" TEXT NOT NULL DEFAULT '',
    "ctaTitle" TEXT NOT NULL DEFAULT '',
    "ctaSubtitle" TEXT NOT NULL DEFAULT '',
    "ctaButton" TEXT NOT NULL DEFAULT '',
    "footerTagline" TEXT NOT NULL DEFAULT '',
    "showRoi" BOOLEAN NOT NULL DEFAULT true,
    "showHow" BOOLEAN NOT NULL DEFAULT true,
    "showSegments" BOOLEAN NOT NULL DEFAULT true,
    "showPricing" BOOLEAN NOT NULL DEFAULT true,
    "showTestimonials" BOOLEAN NOT NULL DEFAULT false,
    "showFaq" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Testimonial" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "business" TEXT NOT NULL DEFAULT '',
    "quote" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL DEFAULT '',
    "rating" INTEGER NOT NULL DEFAULT 5,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Testimonial_published_sortOrder_idx" ON "Testimonial"("published", "sortOrder");

