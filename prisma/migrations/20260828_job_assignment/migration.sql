-- CreateEnum
CREATE TYPE "AssignmentRole" AS ENUM ('TECHNICIAN', 'KERNET');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('UMUM', 'SPESIFIK');

-- AlterTable
ALTER TABLE "JobOrder" ADD COLUMN     "assignmentType" "AssignmentType" NOT NULL DEFAULT 'SPESIFIK';

-- CreateTable
CREATE TABLE "JobAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "roleOnJob" "AssignmentRole" NOT NULL DEFAULT 'TECHNICIAN',
    "isLead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobAssignment_tenantId_jobId_idx" ON "JobAssignment"("tenantId", "jobId");

-- CreateIndex
CREATE INDEX "JobAssignment_tenantId_personId_idx" ON "JobAssignment"("tenantId", "personId");

-- CreateIndex
CREATE UNIQUE INDEX "JobAssignment_jobId_personId_key" ON "JobAssignment"("jobId", "personId");

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Technician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

