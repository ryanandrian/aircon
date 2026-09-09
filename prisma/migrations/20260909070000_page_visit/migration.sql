-- Tracking pengunjung unik landing (ukur hasil campaign). Additive, tabel baru → aman.
-- PRIVASI: ipHash (SHA-256+salt), bukan IP mentah. Unik per (ipHash, day) = idempoten per IP/hari.
CREATE TABLE "PageVisit" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "path" TEXT NOT NULL DEFAULT '/',
    "day" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PageVisit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PageVisit_ipHash_day_key" ON "PageVisit"("ipHash", "day");
CREATE INDEX "PageVisit_day_idx" ON "PageVisit"("day");
