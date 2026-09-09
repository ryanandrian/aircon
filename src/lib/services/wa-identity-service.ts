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
export async function clearVerifiedWaPhone(tenantId: string): Promise<void> {
  await prisma.tenant.updateMany({ where: { id: tenantId, waVerifiedPhone: { not: null } }, data: { waVerifiedPhone: null } });
}
