/**
 * Transisi state sesi WhatsApp tenant → event notifikasi platform (F2).
 *
 * FAKTA KONTRAK GATEWAY (apps/messaging-gateway/src/wa-manager.js):
 *   - "ready"       dipancarkan tiap klien siap (scan QR / reconnect).
 *   - "disconnected" dipancarkan saat klien putus (bisa berulang).
 * Gateway TIDAK menyimpan state koneksi di sisi app, jadi app butuh sumber state
 * sendiri: `Tenant.waSessionEpoch`.
 *
 * MODEL EPOCH (satu integer, tanpa kolom state terpisah):
 *   epoch 0        = belum pernah ada transisi (state tidak diketahui)
 *   epoch ganjil   = sesi TERPUTUS
 *   epoch genap ≥2 = sesi TERHUBUNG
 *   naik 1 tiap transisi state; jadi disconnect→reconnect→disconnect = 1,2,3
 *   dan tiap epoch adalah dedupe key unik per transisi.
 *
 * ATURAN:
 *  - Hanya paket dengan PlanConfig.autoReminder=true boleh menerima event WA
 *    (Basic gratis tak punya gateway; menyuruh Basic "menyambung ulang" = copy salah).
 *  - Satu pesan per transisi (dedupe per epoch), bukan per hari.
 *  - Kenaikan epoch ATOMIK (updateMany dengan predicate nilai lama), sehingga
 *    callback paralel tak menghasilkan dua epoch untuk satu transisi.
 *  - Kegagalan notifikasi TIDAK membatalkan pencatatan state (state adalah fakta).
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { isAutoReminderPlan } from "@/lib/services/platform-notification-service";

export type WaTransition = "connected" | "disconnected";

export interface WaTransitionResult {
  /** Epoch hasil transisi (null = tak ada transisi yang terjadi). */
  epoch: number | null;
  /** True bila transisi benar-benar terjadi (bukan pengulangan state yang sama). */
  changed: boolean;
  /** Alasan kalau tidak ada event yang diantre. */
  skipped?: string;
}

/** State sesi turunan dari epoch. epoch 0 = belum diketahui (tak ada state). */
export function waStateFromEpoch(epoch: number): WaTransition | "unknown" {
  if (epoch <= 0) return "unknown";
  return epoch % 2 === 1 ? "disconnected" : "connected";
}

/**
 * Terapkan transisi state sesi WA. Atomik & idempoten: transisi yang sama
 * berulang (gateway memancarkan `disconnected` berkali-kali) tidak menambah epoch.
 */
export async function applyWaTransition(
  tenantId: string,
  state: WaTransition,
): Promise<WaTransitionResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true, waSessionEpoch: true },
  });
  if (!tenant) return { epoch: null, changed: false, skipped: "tenant tak ditemukan" };

  const current = waStateFromEpoch(tenant.waSessionEpoch);
  // Pengulangan state yang sama = bukan transisi.
  if (current === state) {
    return { epoch: tenant.waSessionEpoch, changed: false, skipped: `state tak berubah (${state})` };
  }

  // Epoch paritas: ganjil=putus, genap≥2=tersambung, 0=tak diketahui.
  // Dari "unknown" lompat ke epoch paritas yang benar (putus→1, tersambung→2);
  // dari state yang diketahui, +1 selalu membalik paritas dengan benar.
  const nextEpoch = current === "unknown"
    ? (state === "connected" ? 2 : 1)
    : tenant.waSessionEpoch + 1;
  // Kenaikan epoch ATOMIK: hanya bila nilai lama masih sama (predicate).
  const applied = await prisma.tenant.updateMany({
    where: { id: tenantId, waSessionEpoch: tenant.waSessionEpoch },
    data: { waSessionEpoch: nextEpoch },
  });
  if (applied.count === 0) {
    // Callback paralel sudah menaikkan epoch lebih dulu → transisi ini bukan yang menang.
    return { epoch: null, changed: false, skipped: "transisi lain lebih dulu" };
  }

  // Kebijakan paket: hanya yang berhak otomasi yang diberi tahu.
  if (!(await isAutoReminderPlan(tenant.plan))) {
    return { epoch: nextEpoch, changed: true, skipped: "paket tanpa otomasi WA" };
  }

  // Dari "unknown" menuju TERSEDAMBUNG (sesi baru dipindai, tenant baru, atau
  // kolom baru di-backfill): catat state TANPA pesan — ini bukan "kembali"
  // tersambung, tidak ada sesi yang pernah diberitahukan terputus.
  // Berbeda dengan unknown → TERPUTUS: itu tetap mengirim pesan disconnect
  // (sesi paid yang mati = fakta yang perlu diketahui owner).
  if (current === "unknown" && state === "connected") {
    return { epoch: nextEpoch, changed: true, skipped: "transisi awal tersambung (state dicatat tanpa pesan)" };
  }

  const templateKey = state === "connected" ? "wa_connected" : "wa_disconnected";
  const { notifyPlatform } = await import("@/lib/services/platform-notification-service");
  await notifyPlatform({
    tenantId,
    templateKey,
    dedupeKey: `wa:${tenantId}:${state.toUpperCase()}:${nextEpoch}`,
  }).catch((err) => {
    // Pesan gagal ≠ state gagal. State tetap tercatat; operator bisa kirim ulang manual.
    console.error(`[wa-transition] gagal antre ${templateKey} tenant=${tenantId} epoch=${nextEpoch}:`, err);
  });

  return { epoch: nextEpoch, changed: true };
}
