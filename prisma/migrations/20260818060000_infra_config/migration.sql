-- CreateTable
CREATE TABLE "InfraConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "waGatewayUrl" TEXT NOT NULL DEFAULT '',
    "waGatewayKeyEnc" TEXT,
    "waCallbackSecretEnc" TEXT,
    "waMinGapMs" INTEGER NOT NULL DEFAULT 6000,
    "waMaxGapMs" INTEGER NOT NULL DEFAULT 15000,
    "waMaxPerMin" INTEGER NOT NULL DEFAULT 8,
    "waMaxPerDay" INTEGER NOT NULL DEFAULT 200,
    "waWarmupEnabled" BOOLEAN NOT NULL DEFAULT true,
    "waWarmupDays" INTEGER NOT NULL DEFAULT 7,
    "waWarmupDay1Cap" INTEGER NOT NULL DEFAULT 20,
    "waQuietStartHour" INTEGER NOT NULL DEFAULT 21,
    "waQuietEndHour" INTEGER NOT NULL DEFAULT 7,
    "waTzOffset" INTEGER NOT NULL DEFAULT 7,
    "waMaxLiveSessions" INTEGER NOT NULL DEFAULT 20,
    "waIdleEvictMs" INTEGER NOT NULL DEFAULT 1800000,
    "mqttBrokerHost" TEXT NOT NULL DEFAULT '',
    "mqttBrokerPort" INTEGER NOT NULL DEFAULT 8883,
    "mqttTlsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "mqttTopicPrefix" TEXT NOT NULL DEFAULT 'aircon',
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfraConfig_pkey" PRIMARY KEY ("id")
);

