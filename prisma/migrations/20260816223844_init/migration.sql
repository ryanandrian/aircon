-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'TECHNICIAN');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE', 'PIN');

-- CreateEnum
CREATE TYPE "TenantPlan" AS ENUM ('STARTER', 'GROWTH', 'PRO');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "CustomerSource" AS ENUM ('REFERRAL', 'WHATSAPP', 'WALK_IN', 'MARKETING', 'WEBSITE', 'IOT_ALERT', 'REPEAT', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('SPLIT', 'CASSETTE', 'STANDING', 'WINDOW', 'CENTRAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('CLEANING', 'REFILL_FREON', 'REPAIR', 'INSTALL', 'DISMANTLE', 'INSPECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELLED', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "JobSource" AS ENUM ('MANUAL', 'REPEAT', 'IOT', 'LEAD', 'WEBSITE');

-- CreateEnum
CREATE TYPE "FeasibilityStatus" AS ENUM ('FEASIBLE', 'RISK', 'CONFLICT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUOTED', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('QUEUED', 'SENT', 'CONVERTED', 'DISMISSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('REQUESTED', 'SENT', 'RECEIVED', 'DECLINED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DONE');

-- CreateEnum
CREATE TYPE "RecipientStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('WA', 'PUSH');

-- CreateEnum
CREATE TYPE "MessageDir" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'LOGGED');

-- CreateEnum
CREATE TYPE "WaDriver" AS ENUM ('WEB', 'META');

-- CreateEnum
CREATE TYPE "DeviceProvision" AS ENUM ('UNPROVISIONED', 'PROVISIONED');

-- CreateEnum
CREATE TYPE "RentalStatus" AS ENUM ('NONE', 'ACTIVE', 'RETURNED');

-- CreateEnum
CREATE TYPE "CommandState" AS ENUM ('COMMAND_SENT', 'ACKNOWLEDGED', 'STATE_CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('OVERCURRENT', 'NO_COOLING', 'OFFLINE', 'SENSOR_FAULT');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACK', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "workingHoursDefault" JSONB NOT NULL,
    "serviceArea" JSONB NOT NULL,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 15,
    "maintenanceIntervalDays" INTEGER NOT NULL DEFAULT 90,
    "reminderLeadDays" INTEGER NOT NULL DEFAULT 7,
    "plan" "TenantPlan" NOT NULL DEFAULT 'STARTER',
    "status" "TenantStatus" NOT NULL DEFAULT 'TRIAL',
    "waDriver" "WaDriver" NOT NULL DEFAULT 'WEB',
    "publicProfile" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "role" "Role" NOT NULL,
    "authProvider" "AuthProvider" NOT NULL DEFAULT 'PIN',
    "pinHash" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "geoLat" DOUBLE PRECISION,
    "geoLng" DOUBLE PRECISION,
    "source" "CustomerSource" NOT NULL DEFAULT 'OTHER',
    "referredById" TEXT,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "type" "AssetType" NOT NULL DEFAULT 'SPLIT',
    "capacityPk" DOUBLE PRECISION,
    "roomLocation" TEXT,
    "serial" TEXT,
    "installedAt" TIMESTAMP(3),
    "maintenanceIntervalDays" INTEGER,
    "nextServiceDate" TIMESTAMP(3),
    "deviceId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Technician" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skills" TEXT[],
    "workingHours" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Technician_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "assetId" TEXT,
    "technicianId" TEXT,
    "serviceType" "ServiceType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "JobSource" NOT NULL DEFAULT 'MANUAL',
    "scheduledDate" TIMESTAMP(3),
    "windowStart" TIMESTAMP(3),
    "windowEnd" TIMESTAMP(3),
    "estDurationMin" INTEGER NOT NULL DEFAULT 60,
    "addressSnapshot" TEXT,
    "geoLat" DOUBLE PRECISION,
    "geoLng" DOUBLE PRECISION,
    "price" DECIMAL(12,2),
    "notes" TEXT,
    "nextServiceDate" TIMESTAMP(3),
    "parentJobId" TEXT,
    "createdById" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobProgressEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "fromStatus" "JobStatus",
    "toStatus" "JobStatus" NOT NULL,
    "actorId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientEventId" TEXT,
    "meta" JSONB,

    CONSTRAINT "JobProgressEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "items" JSONB NOT NULL,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistResult" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "value" TEXT,

    CONSTRAINT "ChecklistResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPhoto" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "source" "CustomerSource" NOT NULL DEFAULT 'OTHER',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "followUpAt" TIMESTAMP(3),
    "convertedCustomerId" TEXT,
    "convertedJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "referrerCustomerId" TEXT NOT NULL,
    "referredCustomerId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL DEFAULT 'WA',
    "status" "ReviewStatus" NOT NULL DEFAULT 'REQUESTED',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepeatReminder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "leadTimeDays" INTEGER NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'QUEUED',
    "jobId" TEXT,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "RepeatReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "segment" JSONB NOT NULL,
    "templateId" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignRecipient" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "RecipientStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "CampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT,
    "jobId" TEXT,
    "channel" "MessageChannel" NOT NULL,
    "driver" "WaDriver" NOT NULL DEFAULT 'WEB',
    "templateKey" TEXT,
    "direction" "MessageDir" NOT NULL DEFAULT 'OUTBOUND',
    "status" "MessageStatus" NOT NULL DEFAULT 'LOGGED',
    "toPhone" TEXT,
    "body" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "assetId" TEXT,
    "provisionStatus" "DeviceProvision" NOT NULL DEFAULT 'UNPROVISIONED',
    "rentalStatus" "RentalStatus" NOT NULL DEFAULT 'NONE',
    "fwVersion" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "health" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Telemetry" (
    "id" BIGSERIAL NOT NULL,
    "deviceId" TEXT NOT NULL,
    "tenantId" TEXT,
    "ts" TIMESTAMP(3) NOT NULL,
    "tempC" DOUBLE PRECISION,
    "humidity" DOUBLE PRECISION,
    "currentA" DOUBLE PRECISION,
    "powerW" DOUBLE PRECISION,
    "online" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Telemetry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommandLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "command" JSONB NOT NULL,
    "state" "CommandState" NOT NULL DEFAULT 'COMMAND_SENT',
    "evidence" JSONB,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ackAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "CommandLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "assetId" TEXT,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'WARNING',
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "createdJobId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plan" "TenantPlan" NOT NULL,
    "iotDevices" INTEGER NOT NULL DEFAULT 0,
    "status" "TenantStatus" NOT NULL DEFAULT 'TRIAL',
    "validUntil" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_phone_key" ON "Tenant"("phone");

-- CreateIndex
CREATE INDEX "User_tenantId_role_idx" ON "User"("tenantId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_phone_key" ON "User"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "Customer_tenantId_phone_idx" ON "Customer"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "Customer_tenantId_source_idx" ON "Customer"("tenantId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_deviceId_key" ON "Asset"("deviceId");

-- CreateIndex
CREATE INDEX "Asset_tenantId_customerId_idx" ON "Asset"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "Asset_tenantId_nextServiceDate_idx" ON "Asset"("tenantId", "nextServiceDate");

-- CreateIndex
CREATE UNIQUE INDEX "Technician_userId_key" ON "Technician"("userId");

-- CreateIndex
CREATE INDEX "Technician_tenantId_active_idx" ON "Technician"("tenantId", "active");

-- CreateIndex
CREATE INDEX "JobOrder_tenantId_status_idx" ON "JobOrder"("tenantId", "status");

-- CreateIndex
CREATE INDEX "JobOrder_tenantId_technicianId_scheduledDate_idx" ON "JobOrder"("tenantId", "technicianId", "scheduledDate");

-- CreateIndex
CREATE INDEX "JobOrder_tenantId_customerId_idx" ON "JobOrder"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "JobProgressEvent_tenantId_jobId_at_idx" ON "JobProgressEvent"("tenantId", "jobId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "JobProgressEvent_tenantId_clientEventId_key" ON "JobProgressEvent"("tenantId", "clientEventId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistTemplate_tenantId_serviceType_key" ON "ChecklistTemplate"("tenantId", "serviceType");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistResult_tenantId_jobId_itemKey_key" ON "ChecklistResult"("tenantId", "jobId", "itemKey");

-- CreateIndex
CREATE INDEX "JobPhoto_tenantId_jobId_idx" ON "JobPhoto"("tenantId", "jobId");

-- CreateIndex
CREATE INDEX "Lead_tenantId_status_idx" ON "Lead"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Lead_tenantId_followUpAt_idx" ON "Lead"("tenantId", "followUpAt");

-- CreateIndex
CREATE INDEX "RepeatReminder_tenantId_status_dueDate_idx" ON "RepeatReminder"("tenantId", "status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "RepeatReminder_tenantId_assetId_dueDate_key" ON "RepeatReminder"("tenantId", "assetId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignRecipient_tenantId_campaignId_customerId_key" ON "CampaignRecipient"("tenantId", "campaignId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_tenantId_key_key" ON "MessageTemplate"("tenantId", "key");

-- CreateIndex
CREATE INDEX "MessageLog_tenantId_customerId_at_idx" ON "MessageLog"("tenantId", "customerId", "at");

-- CreateIndex
CREATE INDEX "MessageLog_driver_status_idx" ON "MessageLog"("driver", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Device_assetId_key" ON "Device"("assetId");

-- CreateIndex
CREATE INDEX "Device_tenantId_provisionStatus_idx" ON "Device"("tenantId", "provisionStatus");

-- CreateIndex
CREATE INDEX "Telemetry_deviceId_ts_idx" ON "Telemetry"("deviceId", "ts");

-- CreateIndex
CREATE INDEX "CommandLog_tenantId_deviceId_sentAt_idx" ON "CommandLog"("tenantId", "deviceId", "sentAt");

-- CreateIndex
CREATE INDEX "Alert_tenantId_status_idx" ON "Alert"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_tenantId_key" ON "Subscription"("tenantId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Technician" ADD CONSTRAINT "Technician_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Technician" ADD CONSTRAINT "Technician_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOrder" ADD CONSTRAINT "JobOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOrder" ADD CONSTRAINT "JobOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOrder" ADD CONSTRAINT "JobOrder_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOrder" ADD CONSTRAINT "JobOrder_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobProgressEvent" ADD CONSTRAINT "JobProgressEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPhoto" ADD CONSTRAINT "JobPhoto_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Telemetry" ADD CONSTRAINT "Telemetry_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandLog" ADD CONSTRAINT "CommandLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
