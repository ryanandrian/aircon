/**
 * Identitas WA terverifikasi — anti akun-ganda "1 WhatsApp = 1 tenant".
 * Nomor TERVERIFIKASI (hasil scan gateway, client.info.wid.user) disimpan di
 * Tenant.waVerifiedPhone — TERPISAH dari Tenant.phone (yang diketik owner, tak pernah ditimpa).
 *
 * Aturan re-link (WAJIB tidak mengganggu):
 *  - Tenant yang MELEPAS lalu MENAUTKAN ULANG nomor yang SAMA → selalu boleh (dicek `id != tenantId`,
 *    dan idempoten bila nilainya sudah sama).
 *  - Saat putuskan (logout) nomor verifikasi DIBERSIHKAN → nomor bebas ditautkan ulang tanpa hambatan.
 *  - Konflik HANYA bila nomor sedang tertaut di tenant LAIN.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/wa/gateway";
import { gatewaySessionStatus, gatewayLogoutSession } from "@/lib/wa/gateway-relay";

export type ReconcileResult =
  | { ok: true }
  | { ok: false; conflict: true; error: string };

/**
 * Catat nomor WA terverifikasi milik tenant + tegakkan keunikan global.
 * Dipanggil saat sesi gateway `ready` (nomor sudah pasti benar).
 */
export async function reconcileVerifiedWaPhone(tenantId: string, phone: string | null | undefined): Promise<ReconcileResult> {
  const norm = normalizePhone(phone ?? "");
  if (!norm) return { ok: true }; // tak ada nomor untuk diproses

  // Sudah tercatat sebagai milik tenant ini? → idempoten, tidak melakukan apa-apa (aman untuk polling berulang).
  const mine = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { waVerifiedPhone: true } });
  if (mine?.waVerifiedPhone === norm) return { ok: true };

  // Sedang tertaut di tenant LAIN? → konflik. (Re-link nomor sama oleh tenant sendiri TIDAK kena sini.)
  const other = await prisma.tenant.findFirst({
    where: { waVerifiedPhone: norm, id: { not: tenantId } },
    select: { id: true },
  });
  if (other) return { ok: false, conflict: true, error: "Nomor WhatsApp sudah terdaftar." };

  // Klaim untuk tenant ini (menimpa nilai verifikasi lama tenant ini bila ganti nomor — itu datanya sendiri).
  await prisma.tenant.update({ where: { id: tenantId }, data: { waVerifiedPhone: norm } });
  return { ok: true };
}

/** Bersihkan nomor verifikasi tenant saat putuskan (logout) → nomor bebas ditautkan ulang. */
/**
 * Bersihkan nomor WA terverifikasi milik tenant.
 * @returns jumlah baris yang terpengaruh (0 = memang tak ada nomor).
 */
export async function clearVerifiedWaPhone(tenantId: string): Promise<number> {
  const res = await prisma.tenant.updateMany({
    where: { id: tenantId, waVerifiedPhone: { not: null } },
    data: { waVerifiedPhone: null },
  });
  return res.count;
}

// ---------------------------------------------------------------------------
// ATURAN PRODUK (2026-10-13): paket Basic (enum DB: TRIAL) TIDAK memakai
// otomasi WhatsApp — termasuk TIDAK boleh punya sesi gateway (QR/kode tautan).
// Pengingatnya TETAP manual lewat menu Pengingat (link wa.me, WA milik admin
// sendiri) — jalur itu TIDAK melewati gateway dan TIDAK disentuh guard ini.
//
// SUMBER SATU: PlanConfig.autoReminder — BUKAN daftar plan hardcode.
// Alasan: enum TenantPlan kini hanya TRIAL/PROFESSIONAL/BUSINESS; "Basic"
// hanyalah displayName untuk TRIAL (seed src/lib/billing/plans.ts). Bila
// hardcode `plan === "PROFESSIONAL"`, plan baru masa depan bisa lolos senyap.
//
// Semantik MENIRU pola cron reminder-service.ts:161 (additive):
//   - plan TIDAK punya baris PlanConfig → LOLOS (agar rollout tak mematikan
//     tenant paket lama);
//   - baris ada & autoReminder=false    → TOLAK (paket tanpa otomasi);
//   - baris ada & autoReminder=true     → lolos.
// ---------------------------------------------------------------------------

export type WaAutomationEligibility =
  | { ok: true }
  | { ok: false; planLocked: true; error: string };

/** Cek kelayakan otomasi WA untuk sesi gateway. Tenant tidak ada → tolak aman. */
export async function waAutomationEligibility(tenantId: string): Promise<WaAutomationEligibility> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } });
  if (!t) return { ok: false, planLocked: true, error: "Tenant tidak ditemukan." };
  const cfg = await prisma.planConfig.findUnique({ where: { plan: t.plan } });
  // Pola cron: tanpa baris PlanConfig → dianggap eligible (additive).
  if (cfg && !cfg.autoReminder) {
    return {
      ok: false,
      planLocked: true,
      error: "Otomasi WhatsApp hanya untuk paket berbayar. Pengingat dapat dikirim manual dari menu Pengingat.",
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// A3 — Rekonsiliasi sesi paket Basic (yang seharusnya TIDAK punya sesi).
// Dipanggil dari cron route /api/cron/* (jalur yang sudah ada, CRON_SECRET).
//
// IDEMPOTEN: run kedua → sesi sudah tak ada → nol tindakan.
// AMAN-GAGAL: satu tenant gagal logout TIDAK membatalkan sisanya.
// Sumber "berhak" = PlanConfig.autoReminder (satu-sumber, pola cron).
// ---------------------------------------------------------------------------
export type WaPlanReconcileResult = {
  checked: number;
  /** Sesi gateway yang dicabut (logout). */
  revoked: number;
  /** Nomor WA terverifikasi yang dibersihkan (sesi sudah tak ada sebelumnya). */
  numbersCleared: number;
  failed: number;
};

export async function reconcileWaPlanSessions(): Promise<WaPlanReconcileResult> {
  const [tenants, configs] = await Promise.all([
    prisma.tenant.findMany({ select: { id: true, plan: true } }),
    prisma.planConfig.findMany({ select: { plan: true, autoReminder: true } }),
  ]);
  // Pola cron: tanpa baris PlanConfig → dianggap eligible (additive).
  const ineligiblePlans = new Set(configs.filter((c) => !c.autoReminder).map((c) => c.plan));
  const targets = tenants.filter((t) => ineligiblePlans.has(t.plan));

  let revoked = 0;
  let numbersCleared = 0;
  let failed = 0;
  for (const t of targets) {
    try {
      const st = await gatewaySessionStatus(t.id);
      if (!st.ok) {
        // Gateway tak bisa dibaca (s_down/masalah) → JANGAN hapus nomor di sini:
        // risks data bila ternyata sesi masih hidup. Cron lain + reconcile
        // berikutnya akan mencoba lagi.
        continue;
      }
      if (!st.exists) {
        // Sesi SUDAH tak ada (mis. dilepas manual / rules lama). Nomor WA
        // terverifikasi yang tertinggal HARUS ikut dibersihkan — kalau tidak,
        // tenant Basic menyimpan nomor asing selamanya (BUG 2026-10-28:
        // `continue` di sini menyebabkan nomor tak pernah terhapus).
        // Idempoten: clearVerifiedWaPhone hanya affect baris yang terisi.
        const cleared = await clearVerifiedWaPhone(t.id);
        if (cleared) numbersCleared += 1;
        continue;
      }
      await gatewayLogoutSession(t.id);
      revoked += 1;
      const cleared = await clearVerifiedWaPhone(t.id);
      if (cleared) numbersCleared += 1;
    } catch (e) {
      console.error(`[wa-plan-reconcile] gagal utk ${t.id}:`, e);
      failed++;
    }
  }
  return { checked: targets.length, revoked, numbersCleared, failed };
}
