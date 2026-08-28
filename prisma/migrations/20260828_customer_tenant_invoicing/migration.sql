-- CreateEnum
CREATE TYPE "CustomerCategory" AS ENUM ('RUMAH', 'SEKOLAH_KAMPUS', 'MASJID_MUSHOLA', 'TOKO_OUTLET', 'RUKO_RUKAN', 'KANTOR_PERUSAHAAN', 'LAINNYA');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('PERORANGAN', 'BADAN');

-- CreateEnum
CREATE TYPE "TopType" AS ENUM ('CASH', 'TEMPO_7', 'TEMPO_14', 'TEMPO_30', 'TEMPO_45', 'TEMPO_60', 'TEMPO_90');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "billingCustomerId" TEXT,
ADD COLUMN     "category" "CustomerCategory",
ADD COLUMN     "customerType" "CustomerType" NOT NULL DEFAULT 'PERORANGAN',
ADD COLUMN     "isPphWithholder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "npwp" TEXT,
ADD COLUMN     "picFinanceName" TEXT,
ADD COLUMN     "picFinancePhone" TEXT,
ADD COLUMN     "picWorkName" TEXT,
ADD COLUMN     "picWorkPhone" TEXT,
ADD COLUMN     "picWorkRole" TEXT,
ADD COLUMN     "topType" "TopType" NOT NULL DEFAULT 'CASH';

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "bankAccountName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "bankAccountNo" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "bankName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "isPkp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "logoUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "npwp" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "qrisImageUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "taxPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Customer_tenantId_category_idx" ON "Customer"("tenantId", "category");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_billingCustomerId_fkey" FOREIGN KEY ("billingCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

