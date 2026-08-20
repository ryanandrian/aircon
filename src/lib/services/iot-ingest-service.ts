/**
 * IoT Ingest Service — menerima telemetry dari iot-bridge (VPS/Mosquitto),
 * menyimpan sample, dan MEMBUKA Alert bila terdeteksi anomali.
 * Anti-spam: hanya SATU Alert OPEN per (device, type) pada satu waktu.
 * Semua tenant-scoped (device menentukan tenant).
 */
import { prisma } from "@/lib/prisma";
import { detectAlert, DEFAULT_THRESHOLDS, type AlertThresholds } from "@/lib/iot/alert-detection";

/** Ambil ambang deteksi dari InfraConfig (editable admin). Fallback ke default bila belum ada. */
export async function getIotThresholds(): Promise<AlertThresholds> {
  const c = await prisma.infraConfig.findUnique({ where: { id: "singleton" } });
  if (!c) return DEFAULT_THRESHOLDS;
  return {
    overcurrentA: c.iotOvercurrentA,
    noCoolingTempC: c.iotNoCoolTempC,
    runningMinA: DEFAULT_THRESHOLDS.runningMinA,
  };
}

export interface IngestSample {
  deviceId: string;
  ts?: string | number;
  tempC?: number | null;
  humidity?: number | null;
  currentA?: number | null;
  powerW?: number | null;
  online?: boolean;
}

export interface IngestResult {
  stored: boolean;
  alertOpened: { id: string; type: string } | null;
  reason?: string;
}

/**
 * Proses satu sample telemetry.
 * SECURITY: deviceId harus terdaftar & terhubung ke tenant (device.tenantId).
 */
export async function ingestTelemetry(sample: IngestSample, th?: AlertThresholds): Promise<IngestResult> {
  const thresholds = th ?? await getIotThresholds();
  const device = await prisma.device.findUnique({
    where: { id: sample.deviceId },
    select: { id: true, tenantId: true, assetId: true },
  });
  if (!device) return { stored: false, alertOpened: null, reason: "device tidak dikenal" };

  const ts = sample.ts ? new Date(sample.ts) : new Date();

  // Simpan telemetry + update lastSeenAt (bukti device hidup).
  await prisma.$transaction([
    prisma.telemetry.create({
      data: {
        deviceId: device.id,
        tenantId: device.tenantId,
        ts,
        tempC: sample.tempC ?? null,
        humidity: sample.humidity ?? null,
        currentA: sample.currentA ?? null,
        powerW: sample.powerW ?? null,
        online: sample.online ?? true,
      },
    }),
    prisma.device.update({
      where: { id: device.id },
      data: { lastSeenAt: ts, health: { tempC: sample.tempC ?? null, currentA: sample.currentA ?? null } as never },
    }),
  ]);

  // Deteksi anomali.
  const detected = detectAlert(sample, thresholds);
  if (!detected || !device.tenantId) return { stored: true, alertOpened: null };

  // Anti-spam: sudah ada Alert OPEN dgn tipe sama utk device ini? jangan duplikat.
  const existing = await prisma.alert.findFirst({
    where: { tenantId: device.tenantId, deviceId: device.id, type: detected.type, status: { in: ["OPEN", "ACK"] } },
    select: { id: true },
  });
  if (existing) return { stored: true, alertOpened: null, reason: "alert serupa masih terbuka" };

  const alert = await prisma.alert.create({
    data: {
      tenantId: device.tenantId,
      deviceId: device.id,
      assetId: device.assetId,
      type: detected.type,
      severity: detected.severity,
      status: "OPEN",
    },
  });
  return { stored: true, alertOpened: { id: alert.id, type: detected.type } };
}

/** Daftar alert terbuka untuk tenant (untuk UI monitor). */
export async function listOpenAlerts(tenantId: string) {
  return prisma.alert.findMany({
    where: { tenantId, status: { in: ["OPEN", "ACK"] } },
    orderBy: [{ severity: "desc" }, { at: "desc" }],
    take: 50,
  });
}

/** Tandai alert selesai/diabaikan (owner). SECURITY: tenant-scoped. */
export async function resolveAlert(tenantId: string, alertId: string, status: "RESOLVED" | "DISMISSED") {
  const alert = await prisma.alert.findFirst({ where: { id: alertId, tenantId }, select: { id: true } });
  if (!alert) throw new Error("Alert tidak ditemukan");
  return prisma.alert.update({ where: { id: alert.id }, data: { status } });
}
