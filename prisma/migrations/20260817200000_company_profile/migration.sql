-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "legalName" TEXT NOT NULL DEFAULT '',
    "brandName" TEXT NOT NULL DEFAULT 'Aircon',
    "isPkp" BOOLEAN NOT NULL DEFAULT false,
    "npwp" TEXT NOT NULL DEFAULT '',
    "taxLabel" TEXT NOT NULL DEFAULT 'PPN',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "addressLine" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "province" TEXT NOT NULL DEFAULT '',
    "postalCode" TEXT NOT NULL DEFAULT '',
    "countryCode" TEXT NOT NULL DEFAULT 'IDN',
    "checkoutExpiryHours" INTEGER NOT NULL DEFAULT 24,
    "finishUrl" TEXT NOT NULL DEFAULT '',
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

