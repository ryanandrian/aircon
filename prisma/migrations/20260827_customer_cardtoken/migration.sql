-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "cardToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_cardToken_key" ON "Customer"("cardToken");

