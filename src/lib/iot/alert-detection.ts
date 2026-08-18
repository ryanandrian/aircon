/**
 * IoT Alert Detection — fungsi MURNI (tanpa DB), teruji.
 * Menerjemahkan telemetry AC menjadi anomali yang bisa jadi PELUANG SERVIS
 * (tesis: IoT = demand generator, bukan sekadar monitoring).
 *
 * Ambang berasal dari konfigurasi (bukan hardcode) — diteruskan sebagai argumen.
 */
import type { AlertType, AlertSeverity } from "@prisma/client";

export interface TelemetrySample {
  tempC?: number | null;
  currentA?: number | null;
  online?: boolean;
}

export interface AlertThresholds {
  /** Arus (Ampere) di atas ini = OVERCURRENT (indikasi kompresor bermasalah). */
  overcurrentA: number;
  /** Suhu ruang (°C) di atas ini saat AC menyala = NO_COOLING (tak mendinginkan). */
  noCoolingTempC: number;
  /** Arus minimal (A) yang berarti AC sedang menyala (untuk konteks no-cooling). */
  runningMinA: number;
}

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  overcurrentA: 10,
  noCoolingTempC: 30,
  runningMinA: 1,
};

export interface DetectedAlert {
  type: AlertType;
  severity: AlertSeverity;
  reason: string;
}

/**
 * Deteksi anomali dari satu sampel telemetry.
 * Mengembalikan alert terparah (satu) atau null bila normal.
 * Prioritas: OFFLINE > OVERCURRENT > NO_COOLING.
 */
export function detectAlert(
  sample: TelemetrySample,
  th: AlertThresholds = DEFAULT_THRESHOLDS,
): DetectedAlert | null {
  // Offline = tak ada data / device mati.
  if (sample.online === false) {
    return { type: "OFFLINE", severity: "WARNING", reason: "Perangkat tidak terhubung" };
  }

  // Overcurrent = arus berlebih (kompresor/kelistrikan bermasalah) → CRITICAL.
  if (typeof sample.currentA === "number" && sample.currentA > th.overcurrentA) {
    return {
      type: "OVERCURRENT",
      severity: "CRITICAL",
      reason: `Arus ${sample.currentA.toFixed(1)}A melebihi batas ${th.overcurrentA}A`,
    };
  }

  // No cooling = AC menyala (ada arus) tapi suhu tetap tinggi → WARNING (peluang servis).
  if (
    typeof sample.tempC === "number" &&
    typeof sample.currentA === "number" &&
    sample.currentA >= th.runningMinA &&
    sample.tempC > th.noCoolingTempC
  ) {
    return {
      type: "NO_COOLING",
      severity: "WARNING",
      reason: `AC menyala tapi suhu ${sample.tempC.toFixed(1)}°C masih di atas ${th.noCoolingTempC}°C`,
    };
  }

  return null;
}

/** Pesan ramah-pelanggan untuk sebuah alert (dipakai notifikasi & UI). */
export function alertMessage(type: AlertType): string {
  switch (type) {
    case "OVERCURRENT": return "AC menarik arus berlebih — berisiko rusak/korsleting. Sebaiknya segera diperiksa.";
    case "NO_COOLING": return "AC menyala tapi kurang dingin — kemungkinan perlu servis/isi freon.";
    case "OFFLINE": return "Perangkat pemantau AC terputus — cek koneksi listrik/internet.";
    case "SENSOR_FAULT": return "Sensor perangkat bermasalah — perlu pengecekan.";
    default: return "Perlu pemeriksaan perangkat AC.";
  }
}
