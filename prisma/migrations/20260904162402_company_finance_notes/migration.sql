-- AlterTable
ALTER TABLE "CompanyProfile" ADD COLUMN     "invoiceNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "paymentFeeNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "receiptNote" TEXT NOT NULL DEFAULT '';
