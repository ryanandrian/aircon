-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "loginToken" TEXT,
ADD COLUMN     "pinHash" TEXT;

-- AlterTable
ALTER TABLE "Reseller" ADD COLUMN     "loginToken" TEXT,
ADD COLUMN     "pinHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Agent_loginToken_key" ON "Agent"("loginToken");

-- CreateIndex
CREATE UNIQUE INDEX "Reseller_loginToken_key" ON "Reseller"("loginToken");

