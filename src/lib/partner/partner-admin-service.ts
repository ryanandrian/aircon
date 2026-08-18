/**
 * Partner Admin Service — PLATFORM-ADMIN-ONLY (panggil setelah requirePlatformAdmin).
 * Kelola agen, rate, rekening (terenkripsi), kode; buku besar; pencairan bulanan.
 * Adaptasi mesinviral: rate agen milik admin (§1c), gerbang pencairan owner (§1d).
 */
import { prisma } from "@/lib/prisma";
import { encryptSecret, maskAccount } from "@/lib/partner/vault-crypto";
import { normalizeCode, computeTaxWithholding, netPayout } from "@/lib/partner/commission-logic";
import type { CommissionType, PartnerTaxStatus, PartnerStatus } from "@prisma/client";
import crypto from "crypto";

/** Buat kode partner unik-global default (8 char A-Z0-9). */
function genCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // hindari 0/O/1/I ambigu
  let c = "";
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) c += chars[bytes[i] % chars.length];
  return c;
}

async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const c = genCode();
    const taken = await prisma.partnerCode.findUnique({ where: { code: c } });
    if (!taken) return c;
  }
  throw new Error("gagal membuat kode unik");
}

/** Guard nilai komisi (cegah salah-ketik mahal): PERCENT 0-100, FLAT_IDR 0-100jt. */
function assertCommissionValue(type: CommissionType, value: number): void {
  if (!Number.isFinite(value) || value < 0) throw new Error("Nilai komisi tidak valid");
  if (type === "PERCENT" && value > 100) throw new Error("Komisi persen tak boleh > 100%");
  if (type === "FLAT_IDR" && value > 100_000_000) throw new Error("Komisi flat terlalu besar (maks Rp100jt)");
}

export interface CreateAgentInput {
  companyName: string;
  picName?: string;
  picEmail: string;
  picPhone?: string;
  commissionType: CommissionType;
  commissionValue: number;
  taxStatus: PartnerTaxStatus;
  npwp?: string;
  bankName?: string;
  bankAccount?: string; // plaintext dari form → dienkripsi
  bankHolder?: string;
  notes?: string;
}

/** Buat agen baru + kode agen + joinCode reseller. Rekening dienkripsi. */
export async function createAgent(input: CreateAgentInput) {
  const email = input.picEmail.trim().toLowerCase();
  assertCommissionValue(input.commissionType, input.commissionValue);
  const dup = await prisma.agent.findUnique({ where: { picEmail: email } });
  if (dup) throw new Error("Email PIC agen sudah terdaftar");

  const agentCode = await uniqueCode();
  const joinCode = await uniqueCode();

  return prisma.$transaction(async (tx) => {
    const agent = await tx.agent.create({
      data: {
        companyName: input.companyName.trim(),
        picName: input.picName?.trim() || null,
        picEmail: email,
        picPhone: input.picPhone?.trim() || null,
        commissionType: input.commissionType,
        commissionValue: input.commissionValue,
        taxStatus: input.taxStatus,
        npwp: input.npwp?.trim() || null,
        bankName: input.bankName?.trim() || null,
        bankAccountEnc: input.bankAccount?.trim() ? encryptSecret(input.bankAccount.trim()) : null,
        bankHolder: input.bankHolder?.trim() || null,
        joinCode,
        notes: input.notes?.trim() || null,
      },
    });
    await tx.partnerCode.create({
      data: { code: agentCode, ownerKind: "agent", agentId: agent.id },
    });
    return agent;
  });
}

/** Ubah rate/status/rekening agen (rate agen = wewenang admin). */
export async function updateAgent(agentId: string, data: {
  commissionType?: CommissionType;
  commissionValue?: number;
  status?: PartnerStatus;
  taxStatus?: PartnerTaxStatus;
  bankName?: string;
  bankAccount?: string;
  bankHolder?: string;
}) {
  const patch: Record<string, unknown> = {};
  if (data.commissionType) patch.commissionType = data.commissionType;
  if (data.commissionValue != null) patch.commissionValue = data.commissionValue;
  if (data.commissionType || data.commissionValue != null) {
    // Validasi terhadap tipe efektif (baru bila diubah, jika tidak ambil dari DB).
    const eff = data.commissionType ?? (await prisma.agent.findUnique({ where: { id: agentId }, select: { commissionType: true } }))?.commissionType;
    const val = data.commissionValue ?? (await prisma.agent.findUnique({ where: { id: agentId }, select: { commissionValue: true } }))?.commissionValue ?? 0;
    if (eff) assertCommissionValue(eff, val);
  }
  if (data.status) patch.status = data.status;
  if (data.taxStatus) patch.taxStatus = data.taxStatus;
  if (data.bankName !== undefined) patch.bankName = data.bankName.trim() || null;
  if (data.bankHolder !== undefined) patch.bankHolder = data.bankHolder.trim() || null;
  if (data.bankAccount) patch.bankAccountEnc = encryptSecret(data.bankAccount.trim());
  return prisma.agent.update({ where: { id: agentId }, data: patch });
}

/** Daftar agen + ringkasan (komisi berjalan bulan ini, jumlah reseller/tenant). */
export async function listAgents() {
  const agents = await prisma.agent.findMany({ orderBy: { createdAt: "desc" } });
  const period = new Date();
  const periodStart = new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth(), 1));

  return Promise.all(agents.map(async (a) => {
    const [resellerCount, tenantCount, accrued, code] = await Promise.all([
      prisma.reseller.count({ where: { agentId: a.id } }),
      prisma.tenantAttribution.count({ where: { agentId: a.id } }),
      prisma.commissionLedger.aggregate({
        where: { agentId: a.id, periodMonth: periodStart, status: { in: ["ACCRUED", "APPROVED"] } },
        _sum: { agentAmountIdr: true },
      }),
      prisma.partnerCode.findFirst({ where: { agentId: a.id, ownerKind: "agent" }, select: { code: true } }),
    ]);
    return {
      id: a.id,
      companyName: a.companyName,
      picEmail: a.picEmail,
      status: a.status,
      commissionType: a.commissionType,
      commissionValue: a.commissionValue,
      taxStatus: a.taxStatus,
      bankMasked: a.bankAccountEnc ? maskAccount("xxxx") : null, // tak dekripsi di list
      code: code?.code ?? null,
      joinCode: a.joinCode,
      resellerCount,
      tenantCount,
      commissionThisMonth: accrued._sum.agentAmountIdr ?? 0,
    };
  }));
}

/** Ubah kode agen (hanya bila belum pernah dipakai — kode terpakai = beku). */
export async function changeAgentCode(agentId: string, newCodeRaw: string) {
  const code = normalizeCode(newCodeRaw);
  if (!code) throw new Error("Format kode tidak valid (A-Z0-9, 4-12)");
  const taken = await prisma.partnerCode.findUnique({ where: { code } });
  if (taken) throw new Error("Kode sudah dipakai entitas lain");
  const current = await prisma.partnerCode.findFirst({ where: { agentId, ownerKind: "agent" } });
  if (!current) throw new Error("Kode agen tak ditemukan");
  if (current.usedCount > 0) throw new Error("Kode sudah pernah dipakai mendaftar — beku selamanya");
  await prisma.$transaction([
    prisma.partnerCode.delete({ where: { code: current.code } }),
    prisma.partnerCode.create({ data: { code, ownerKind: "agent", agentId } }),
  ]);
  return code;
}

/**
 * Susun draft pencairan bulan tertentu untuk SEMUA agen (gerbang owner).
 * Total = Σ accrual − Σ reversal periode; prefill PPh dari taxStatus.
 * Idempoten: bila payout periode itu sudah ada, tak menimpa.
 */
export async function buildMonthlyPayouts(periodMonth: Date) {
  const periodStart = new Date(Date.UTC(periodMonth.getUTCFullYear(), periodMonth.getUTCMonth(), 1));
  const agents = await prisma.agent.findMany({ select: { id: true, taxStatus: true } });
  const results = [];

  for (const agent of agents) {
    // Sapu SEMUA baris ACCRUED sampai periode ini (termasuk reversal menggantung dari
    // bulan lampau — clawback §2.3: refund pasca-payout jadi pengurang bulan berikutnya).
    const rows = await prisma.commissionLedger.findMany({
      where: { agentId: agent.id, periodMonth: { lte: periodStart }, status: "ACCRUED" },
    });
    if (rows.length === 0) continue;

    // Pisah positif (accrual) vs negatif (reversal menggantung) untuk transparansi.
    const gross = rows.filter((r) => r.agentAmountIdr > 0).reduce((s, r) => s + r.agentAmountIdr, 0);
    const deduction = rows.filter((r) => r.agentAmountIdr < 0).reduce((s, r) => s - r.agentAmountIdr, 0);
    const netCommission = gross - deduction;
    if (netCommission <= 0) continue; // net-negatif/nol digulung (baris tetap ACCRUED utk bulan depan)

    const tax = computeTaxWithholding(netCommission, agent.taxStatus);
    const net = netPayout(gross, deduction, tax);

    const existing = await prisma.agentPayout.findUnique({
      where: { agentId_periodMonth: { agentId: agent.id, periodMonth: periodStart } },
    });
    if (existing) { results.push(existing); continue; }

    const payout = await prisma.$transaction(async (tx) => {
      const p = await tx.agentPayout.create({
        data: {
          agentId: agent.id, periodMonth: periodStart,
          grossCommissionIdr: gross, deductionIdr: deduction, taxWithheldIdr: tax, netPaidIdr: net, status: "DRAFT",
        },
      });
      await tx.commissionLedger.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { payoutId: p.id, status: "APPROVED" },
      });
      return p;
    });
    results.push(payout);
  }
  return results;
}

/** Tandai payout PAID (setelah owner transfer + catat bukti). Guard: hanya DRAFT/APPROVED. */
export async function markPayoutPaid(payoutId: string, transferRef: string) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.agentPayout.findUnique({ where: { id: payoutId }, select: { status: true } });
    if (!current) throw new Error("Pencairan tak ditemukan");
    if (current.status === "PAID") throw new Error("Pencairan sudah lunas");
    const p = await tx.agentPayout.update({
      where: { id: payoutId },
      data: { status: "PAID", paidAt: new Date(), transferRef, approvedAt: new Date() },
    });
    await tx.commissionLedger.updateMany({ where: { payoutId }, data: { status: "PAID" } });
    return p;
  });
}

/** Daftar payout (untuk panel). */
export async function listPayouts(status?: "DRAFT" | "APPROVED" | "PAID") {
  return prisma.agentPayout.findMany({
    where: status ? { status } : {},
    orderBy: { periodMonth: "desc" },
    include: { agent: { select: { companyName: true, picEmail: true } } },
    take: 60,
  });
}
