-- AlterTable
ALTER TABLE "BillingPolicy" ADD COLUMN     "dunningReminderTemplate" TEXT NOT NULL DEFAULT 'Halo {nama}, langganan Aircon Anda jatuh tempo dan menunggak {telat} hari. Mohon segera perpanjang agar layanan tidak terputus.',
ADD COLUMN     "dunningWarningTemplate" TEXT NOT NULL DEFAULT 'Halo {nama}, langganan Aircon Anda menunggak {telat} hari. PERINGATAN: bila tidak dibayar dalam {sisa} hari lagi, data usaha Anda akan dihapus permanen. Segera perpanjang untuk menghindari kehilangan data.';

-- AlterTable
ALTER TABLE "InfraConfig" ADD COLUMN     "iotNoCoolTempC" DOUBLE PRECISION NOT NULL DEFAULT 30,
ADD COLUMN     "iotOfflineMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "iotOvercurrentA" DOUBLE PRECISION NOT NULL DEFAULT 10;

