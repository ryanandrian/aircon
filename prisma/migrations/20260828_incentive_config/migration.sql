-- CreateEnum
CREATE TYPE "TeamIncentiveMode" AS ENUM ('BAGI_RATA', 'PENUH');

-- CreateEnum
CREATE TYPE "IncentiveBasis" AS ENUM ('LUNAS', 'TERBIT');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "incentiveBasis" "IncentiveBasis" NOT NULL DEFAULT 'LUNAS',
ADD COLUMN     "teamIncentiveMode" "TeamIncentiveMode" NOT NULL DEFAULT 'BAGI_RATA';

