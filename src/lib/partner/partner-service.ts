/**
 * Partner Service — otoritas tunggal uang keagenan (adaptasi mesinviral partner.py).
 * - resolveCode: validasi kode partner (untuk form daftar).
 * - attributeTenant: kunci atribusi SEKALI saat tenant lahir (permanen, anti-rebutan).
 * - accrueCommission: tulis baris ledger saat pembayaran PAID (idempoten via unique orderId).
 * - reverseCommission: refund → baris reversal (append-only).
 * Anti-komisi-diri, snapshot rate per baris, gagal-jujur (tak ganggu pembayaran tenant).
 */
import { prisma } from "@/lib/prisma";
import { computeCommission } from "@/lib/partner/commission-logic";
import { normalizeCode } from "@/lib/partner/commission-logic";
import type { CommissionType } from "@prisma/client";

export interface ResolvedCode {
  code: string;
  agentId: string;
  resellerId: string | null;
}

/** Validasi kode aktif → info pemilik. null bila tak dikenal/nonaktif. */
export async function resolveCode(raw: string): Promise<ResolvedCode | null> {
  const code = normalizeCode(raw);
  if (!code) return null;
  const rec = await prisma.partnerCode.findUnique({ where: { code } });
  if (!rec || !rec.active) return null;
  // Agen/reseller pemilik harus aktif juga.
  const agent = await prisma.agent.findUnique({ where: { id: rec.agentId }, select: { status: true } });
  if (!agent || agent.status !== "ACTIVE") return null;
  if (rec.resellerId) {
    const rs = await prisma.reseller.findUnique({ where: { id: rec.resellerId }, select: { status: true } });
    if (!rs || rs.status !== "ACTIVE") return null;
  }
  return { code, agentId: rec.agentId, resellerId: rec.resellerId };
}

/**
 * Kunci atribusi tenant SEKALI (permanen). Dipanggil saat onboarding tenant selesai.
 * Idempoten: bila sudah ada atribusi, tak menimpa. Menaikkan usedCount (kode beku selamanya).
 */
export async function attributeTenant(tenantId: string, rawCode: string): Promise<{ attributed: boolean; reason?: string }> {
  const resolved = await resolveCode(rawCode);
  if (!resolved) return { attributed: false, reason: "kode tidak dikenal / nonaktif" };

  const existing = await prisma.tenantAttribution.findUnique({ where: { tenantId } });
  if (existing) return { attributed: false, reason: "tenant sudah ter-atribusi" };

  await prisma.$transaction([
    prisma.tenantAttribution.create({
      data: { tenantId, agentId: resolved.agentId, resellerId: resolved.resellerId, code: resolved.code },
    }),
    prisma.partnerCode.update({ where: { code: resolved.code }, data: { usedCount: { increment: 1 } } }),
  ]);
  return { attributed: true };
}

/** Awal bulan (tanggal 1) untuk periode komisi dari tanggal settlement. */
function periodMonthOf(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/**
 * Tulis komisi saat pembayaran PAID. Idempoten (unique [orderId, ACCRUAL]).
 * SECURITY/ANTI-CURANG: bila pembayar (owner tenant) = pemilik login agen/reseller → nominal 0.
 * Gagal-jujur: exception di-catch pemanggil; TAK mengganggu aktivasi langganan tenant.
 * @returns baris ledger atau null (tenant tak ter-atribusi).
 */
export async function accrueCommission(params: {
  orderId: string;
  tenantId: string;
  grossIdr: number;      // rupiah settlement (net)
  monthsPaid: number;
  settledAt?: Date;
}): Promise<{ ledgerId: number; agentAmountIdr: number } | null> {
  const attribution = await prisma.tenantAttribution.findUnique({ where: { tenantId: params.tenantId } });
  if (!attribution) return null; // bukan bawaan siapa pun

  // Idempotensi: sudah pernah accrue untuk order ini?
  const dup = await prisma.commissionLedger.findUnique({
    where: { orderId_entryKind: { orderId: params.orderId, entryKind: "ACCRUAL" } },
  });
  if (dup) return { ledgerId: dup.id, agentAmountIdr: dup.agentAmountIdr };

  const agent = await prisma.agent.findUnique({ where: { id: attribution.agentId } });
  if (!agent) return null;
  const reseller = attribution.resellerId
    ? await prisma.reseller.findUnique({ where: { id: attribution.resellerId } })
    : null;

  // Anti-komisi-diri: owner tenant = pemilik login agen/reseller → nominal di-nol-kan.
  const tenantOwners = await prisma.user.findMany({
    where: { tenantId: params.tenantId, role: "OWNER" },
    select: { id: true },
  });
  const ownerIds = new Set(tenantOwners.map((u) => u.id));
  const agentIsSelf = agent.userId ? ownerIds.has(agent.userId) : false;
  const resellerIsSelf = reseller?.userId ? ownerIds.has(reseller.userId) : false;

  const agentAmount = agentIsSelf
    ? 0
    : computeCommission(params.grossIdr, params.monthsPaid, agent.commissionType, agent.commissionValue);
  const resellerAmount = reseller && !resellerIsSelf
    ? computeCommission(params.grossIdr, params.monthsPaid, reseller.commissionType, reseller.commissionValue)
    : 0;

  const settledAt = params.settledAt ?? new Date();
  const row = await prisma.commissionLedger.create({
    data: {
      orderId: params.orderId,
      tenantId: params.tenantId,
      agentId: agent.id,
      resellerId: reseller?.id ?? null,
      grossIdr: params.grossIdr,
      monthsPaid: params.monthsPaid,
      agentRateType: agent.commissionType,
      agentRateValue: agent.commissionValue,
      agentAmountIdr: agentAmount,
      resellerRateType: reseller?.commissionType ?? null,
      resellerRateValue: reseller?.commissionValue ?? null,
      resellerAmountIdr: resellerAmount,
      entryKind: "ACCRUAL",
      status: "ACCRUED",
      periodMonth: periodMonthOf(settledAt),
    },
  });
  return { ledgerId: row.id, agentAmountIdr: agentAmount };
}

/**
 * Refund → baris reversal (append-only). Idempoten (unique [orderId, REVERSAL]).
 * Menarik SELURUH komisi order (konservatif, §5e partial_refund).
 */
export async function reverseCommission(orderId: string): Promise<{ reversed: boolean }> {
  const accrual = await prisma.commissionLedger.findUnique({
    where: { orderId_entryKind: { orderId, entryKind: "ACCRUAL" } },
  });
  if (!accrual) return { reversed: false };

  const dup = await prisma.commissionLedger.findUnique({
    where: { orderId_entryKind: { orderId, entryKind: "REVERSAL" } },
  });
  if (dup) return { reversed: true };

  await prisma.$transaction([
    prisma.commissionLedger.create({
      data: {
        orderId,
        tenantId: accrual.tenantId,
        agentId: accrual.agentId,
        resellerId: accrual.resellerId,
        grossIdr: -accrual.grossIdr,
        monthsPaid: accrual.monthsPaid,
        agentRateType: accrual.agentRateType,
        agentRateValue: accrual.agentRateValue,
        agentAmountIdr: -accrual.agentAmountIdr,
        resellerRateType: accrual.resellerRateType,
        resellerRateValue: accrual.resellerRateValue,
        resellerAmountIdr: -accrual.resellerAmountIdr,
        entryKind: "REVERSAL",
        reversalOf: accrual.id,
        status: "ACCRUED",
        periodMonth: accrual.periodMonth,
      },
    }),
    // Bila accrual belum dibayar/dikunci: tandai reversed (saling meniadakan).
    ...(accrual.status === "ACCRUED"
      ? [prisma.commissionLedger.update({ where: { id: accrual.id }, data: { status: "REVERSED" } })]
      : []),
  ]);
  return { reversed: true };
}

export type { CommissionType };
