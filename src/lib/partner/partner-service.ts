/**
 * Partner Service — otoritas tunggal uang keagenan (adaptasi mesinviral partner.py).
 * - resolveCode: validasi kode partner (untuk form daftar).
 * - attributeTenant: kunci atribusi SEKALI saat tenant lahir (permanen, anti-rebutan).
 * - accrueCommission: tulis baris ledger saat pembayaran PAID (idempoten via unique orderId).
 * - reverseCommission: refund → baris reversal (append-only).
 * Anti-komisi-diri, snapshot rate per baris, gagal-jujur (tak ganggu pembayaran tenant).
 */
import { prisma } from "@/lib/prisma";
import { computeCommission, normalizeCode, selectPlanCommissionRule } from "@/lib/partner/commission-logic";
import type { CommissionType, TenantPlan } from "@prisma/client";

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

  try {
    await prisma.$transaction(async (tx) => {
      await tx.tenantAttribution.create({
        data: { tenantId, agentId: resolved.agentId, resellerId: resolved.resellerId, code: resolved.code },
      });
      await tx.partnerCode.update({ where: { code: resolved.code }, data: { usedCount: { increment: 1 } } });
    });
    return { attributed: true };
  } catch (error) {
    // Unique tenantId is the concurrency authority: a simultaneous onboarding
    // attempt must become a harmless no-op, not an onboarding failure.
    if ((error as { code?: string }).code !== "P2002") throw error;
    return { attributed: false, reason: "tenant sudah ter-atribusi" };
  }
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
  plan: TenantPlan;
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

  const agent = await prisma.agent.findUnique({ where: { id: attribution.agentId }, include: { planCommissions: true } });
  if (!agent) return null;
  const reseller = attribution.resellerId
    ? await prisma.reseller.findUnique({ where: { id: attribution.resellerId }, include: { planCommissions: true } })
    : null;

  // Anti-komisi-diri: owner tenant = pemilik login agen/reseller → nominal di-nol-kan.
  const tenantOwners = await prisma.user.findMany({
    where: { tenantId: params.tenantId, role: "OWNER" },
    select: { id: true },
  });
  const ownerIds = new Set(tenantOwners.map((u) => u.id));
  const agentIsSelf = agent.userId ? ownerIds.has(agent.userId) : false;
  const resellerIsSelf = reseller?.userId ? ownerIds.has(reseller.userId) : false;

  const agentRule = selectPlanCommissionRule(agent.planCommissions, params.plan);
  const resellerRule = reseller
    ? selectPlanCommissionRule(reseller.planCommissions, params.plan)
    : null;
  if (!agentRule || (reseller && !resellerRule)) {
    throw new Error(`Aturan komisi plan ${params.plan} belum dikonfigurasi`);
  }

  const agentAmount = agentIsSelf
    ? 0
    : computeCommission(params.grossIdr, params.monthsPaid, agentRule.commissionType, agentRule.commissionValue);
  const resellerAmount = reseller && !resellerIsSelf
    ? computeCommission(params.grossIdr, params.monthsPaid, resellerRule!.commissionType, resellerRule!.commissionValue)
    : 0;

  const settledAt = params.settledAt ?? new Date();
  try {
    const row = await prisma.commissionLedger.create({
      data: {
        orderId: params.orderId,
        tenantId: params.tenantId,
        plan: params.plan,
        agentId: agent.id,
        resellerId: reseller?.id ?? null,
        grossIdr: params.grossIdr,
        monthsPaid: params.monthsPaid,
        agentRateType: agentRule.commissionType,
        agentRateValue: agentRule.commissionValue,
        agentAmountIdr: agentAmount,
        resellerRateType: reseller ? resellerRule!.commissionType : null,
        resellerRateValue: reseller ? resellerRule!.commissionValue : null,
        resellerAmountIdr: resellerAmount,
        entryKind: "ACCRUAL",
        status: "ACCRUED",
        periodMonth: periodMonthOf(settledAt),
      },
    });
    return { ledgerId: row.id, agentAmountIdr: agentAmount };
  } catch (error) {
    if ((error as { code?: string }).code !== "P2002") throw error;
    const concurrent = await prisma.commissionLedger.findUnique({
      where: { orderId_entryKind: { orderId: params.orderId, entryKind: "ACCRUAL" } },
    });
    if (!concurrent) throw error;
    return { ledgerId: concurrent.id, agentAmountIdr: concurrent.agentAmountIdr };
  }
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

  const existing = await prisma.commissionLedger.findUnique({
    where: { orderId_entryKind: { orderId, entryKind: "REVERSAL" } },
  });
  if (existing) return { reversed: true };

  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.commissionLedger.findUnique({
        where: { orderId_entryKind: { orderId, entryKind: "ACCRUAL" } },
      });
      if (!current) return;
      const reversal = await tx.commissionLedger.findUnique({
        where: { orderId_entryKind: { orderId, entryKind: "REVERSAL" } },
      });
      if (reversal) return;
      await tx.commissionLedger.create({
        data: {
          orderId,
          tenantId: current.tenantId,
          plan: current.plan,
          agentId: current.agentId,
          resellerId: current.resellerId,
          grossIdr: -current.grossIdr,
          monthsPaid: current.monthsPaid,
          agentRateType: current.agentRateType,
          agentRateValue: current.agentRateValue,
          agentAmountIdr: -current.agentAmountIdr,
          resellerRateType: current.resellerRateType,
          resellerRateValue: current.resellerRateValue,
          resellerAmountIdr: -current.resellerAmountIdr,
          entryKind: "REVERSAL",
          reversalOf: current.id,
          status: "ACCRUED",
          periodMonth: current.periodMonth,
        },
      });
      if (current.status === "ACCRUED") {
        await tx.commissionLedger.update({ where: { id: current.id }, data: { status: "REVERSED" } });
      }
    });
  } catch (error) {
    if ((error as { code?: string }).code !== "P2002") throw error;
  }
  return { reversed: true };
}

export type { CommissionType };