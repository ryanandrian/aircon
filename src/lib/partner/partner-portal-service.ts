/**
 * Partner Portal Service — F2/F3: aktivasi login, login PIN, dasbor agen, reseller.
 * Reuse hashPin/verifyPin (scrypt) dari tech-crypto. Isolasi ketat: agen hanya lihat
 * datanya; reseller hanya miliknya. Adaptasi mesinviral F2/F3.
 */
import { prisma } from "@/lib/prisma";
import { hashPin, verifyPin, isValidPin } from "@/lib/auth/tech-crypto";
import { encryptSecret, maskAccount } from "@/lib/partner/vault-crypto";
import { normalizeCode } from "@/lib/partner/commission-logic";
import crypto from "crypto";

export class PartnerPortalError extends Error {}

function genToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

async function uniquePartnerCode(): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let i = 0; i < 12; i++) {
    let c = "";
    const b = crypto.randomBytes(8);
    for (let j = 0; j < 8; j++) c += chars[b[j] % chars.length];
    if (!(await prisma.partnerCode.findUnique({ where: { code: c } }))) return c;
  }
  throw new PartnerPortalError("gagal membuat kode unik");
}

/** ADMIN: buat token aktivasi login agen (kirim link ke PIC). */
export async function issueAgentLoginToken(agentId: string): Promise<string> {
  const token = genToken();
  await prisma.agent.update({ where: { id: agentId }, data: { loginToken: token } });
  return token;
}

/** Aktivasi: set PIN via token (agen/reseller). Token sekali-pakai. */
export async function activatePartner(kind: "agent" | "reseller", token: string, pin: string): Promise<{ id: string }> {
  if (!isValidPin(pin)) throw new PartnerPortalError("PIN harus 6 angka");
  if (kind === "agent") {
    const agent = await prisma.agent.findUnique({ where: { loginToken: token } });
    if (!agent) throw new PartnerPortalError("Tautan tidak valid / sudah dipakai");
    await prisma.agent.update({ where: { id: agent.id }, data: { pinHash: hashPin(pin), loginToken: null } });
    return { id: agent.id };
  }
  const rs = await prisma.reseller.findUnique({ where: { loginToken: token } });
  if (!rs) throw new PartnerPortalError("Tautan tidak valid / sudah dipakai");
  await prisma.reseller.update({ where: { id: rs.id }, data: { pinHash: hashPin(pin), loginToken: null } });
  return { id: rs.id };
}

/** Login via email + PIN (agen) atau nama+kode+PIN (reseller pakai email). */
export async function loginAgent(email: string, pin: string): Promise<{ id: string }> {
  const agent = await prisma.agent.findUnique({ where: { picEmail: email.trim().toLowerCase() } });
  if (!agent || !verifyPin(pin, agent.pinHash)) throw new PartnerPortalError("Email atau PIN salah");
  if (agent.status !== "ACTIVE") throw new PartnerPortalError("Akun agen nonaktif");
  return { id: agent.id };
}

export async function loginReseller(email: string, pin: string): Promise<{ id: string }> {
  const rs = await prisma.reseller.findFirst({ where: { email: email.trim().toLowerCase() } });
  if (!rs || !verifyPin(pin, rs.pinHash)) throw new PartnerPortalError("Email atau PIN salah");
  if (rs.status !== "ACTIVE") throw new PartnerPortalError("Akun reseller belum aktif");
  return { id: rs.id };
}

/** DASBOR AGEN — semua tenant bawaan + komisi + reseller + pencairan (isolasi ketat). */
export async function agentDashboard(agentId: string) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) throw new PartnerPortalError("Agen tak ditemukan");

  const period = new Date();
  const periodStart = new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth(), 1));

  const [code, resellers, attributions, monthAgg, totalAgg, payouts] = await Promise.all([
    prisma.partnerCode.findFirst({ where: { agentId, ownerKind: "agent" }, select: { code: true } }),
    prisma.reseller.findMany({ where: { agentId }, orderBy: { createdAt: "desc" } }),
    prisma.tenantAttribution.findMany({
      where: { agentId },
      include: { tenant: { select: { name: true, status: true } }, reseller: { select: { name: true } } },
      orderBy: { lockedAt: "desc" }, take: 100,
    }),
    prisma.commissionLedger.aggregate({
      where: { agentId, periodMonth: periodStart, status: { in: ["ACCRUED", "APPROVED"] } },
      _sum: { agentAmountIdr: true },
    }),
    prisma.commissionLedger.aggregate({
      where: { agentId, status: { in: ["ACCRUED", "APPROVED", "PAID"] } },
      _sum: { agentAmountIdr: true },
    }),
    prisma.agentPayout.findMany({ where: { agentId }, orderBy: { periodMonth: "desc" }, take: 12 }),
  ]);

  return {
    agent: {
      companyName: agent.companyName,
      commissionType: agent.commissionType,
      commissionValue: agent.commissionValue,
      code: code?.code ?? null,
      joinCode: agent.joinCode,
      bankMasked: agent.bankAccountEnc ? "tersimpan (terenkripsi)" : null,
    },
    stats: {
      tenantCount: attributions.length,
      resellerCount: resellers.length,
      commissionThisMonth: monthAgg._sum.agentAmountIdr ?? 0,
      commissionTotal: totalAgg._sum.agentAmountIdr ?? 0,
    },
    tenants: attributions.map((a) => ({
      name: a.tenant?.name ?? "—",
      status: a.tenant?.status ?? "—",
      viaReseller: a.reseller?.name ?? null,
      since: a.lockedAt,
    })),
    resellers: resellers.map((r) => ({
      id: r.id, name: r.name, status: r.status,
      commissionType: r.commissionType, commissionValue: r.commissionValue,
      bankMasked: r.bankAccountEnc ? "✓" : null,
    })),
    payouts: payouts.map((p) => ({
      period: p.periodMonth, gross: p.grossCommissionIdr, net: p.netPaidIdr ?? 0, status: p.status,
    })),
  };
}

/** PUBLIK: pendaftaran reseller via joinCode agen. Status PENDING (tunggu approve). */
export async function registerReseller(joinCode: string, input: {
  name: string; email: string; phone?: string;
  bankName?: string; bankAccount?: string; bankHolder?: string;
}): Promise<{ resellerId: string }> {
  const agent = await prisma.agent.findUnique({ where: { joinCode } });
  if (!agent || agent.status !== "ACTIVE") throw new PartnerPortalError("Tautan pendaftaran tidak valid");
  const email = input.email.trim().toLowerCase();
  const dup = await prisma.reseller.findFirst({ where: { agentId: agent.id, email } });
  if (dup) throw new PartnerPortalError("Email sudah terdaftar di agen ini");

  const rs = await prisma.reseller.create({
    data: {
      agentId: agent.id, name: input.name.trim(), email, phone: input.phone?.trim() || null,
      status: "PENDING",
      bankName: input.bankName?.trim() || null,
      bankAccountEnc: input.bankAccount?.trim() ? encryptSecret(input.bankAccount.trim()) : null,
      bankHolder: input.bankHolder?.trim() || null,
    },
  });
  return { resellerId: rs.id };
}

/** AGEN: setujui reseller → aktif + kode + token aktivasi. */
export async function approveReseller(agentId: string, resellerId: string, commission: { type: "FLAT_IDR" | "PERCENT"; value: number }): Promise<{ code: string; token: string }> {
  const rs = await prisma.reseller.findFirst({ where: { id: resellerId, agentId } });
  if (!rs) throw new PartnerPortalError("Reseller tak ditemukan");
  if (commission.type === "PERCENT" && (commission.value < 0 || commission.value > 100)) throw new PartnerPortalError("Komisi persen 0-100");
  const code = await uniquePartnerCode();
  const token = genToken();
  await prisma.$transaction([
    prisma.reseller.update({
      where: { id: resellerId },
      data: { status: "ACTIVE", commissionType: commission.type, commissionValue: commission.value, loginToken: token },
    }),
    prisma.partnerCode.create({ data: { code, ownerKind: "reseller", agentId, resellerId } }),
  ]);
  return { code, token };
}

/** AGEN: tolak reseller. */
export async function rejectReseller(agentId: string, resellerId: string): Promise<void> {
  const rs = await prisma.reseller.findFirst({ where: { id: resellerId, agentId } });
  if (!rs) throw new PartnerPortalError("Reseller tak ditemukan");
  await prisma.reseller.update({ where: { id: resellerId }, data: { status: "REJECTED" } });
}

/** AGEN: rincian komisi per-reseller untuk periode (dasar Excel transfer-massal). */
export async function resellerBreakdown(agentId: string, periodMonth: Date) {
  const periodStart = new Date(Date.UTC(periodMonth.getUTCFullYear(), periodMonth.getUTCMonth(), 1));
  const resellers = await prisma.reseller.findMany({ where: { agentId } });
  const rows = [];
  for (const r of resellers) {
    const agg = await prisma.commissionLedger.aggregate({
      where: { agentId, resellerId: r.id, periodMonth: periodStart, entryKind: "ACCRUAL" },
      _sum: { resellerAmountIdr: true },
    });
    const total = agg._sum.resellerAmountIdr ?? 0;
    if (total <= 0) continue;
    // Dekripsi rekening HANYA saat export (dibutuhkan agen utk transfer).
    let account = "";
    try {
      const { decryptSecret } = await import("@/lib/partner/vault-crypto");
      account = r.bankAccountEnc ? decryptSecret(r.bankAccountEnc) : "";
    } catch { account = ""; }
    rows.push({
      name: r.name, bankName: r.bankName ?? "", account, holder: r.bankHolder ?? "",
      accountMasked: account ? maskAccount(account) : "", total,
    });
  }
  return rows;
}

/** DASBOR RESELLER — pencapaian miliknya per periode (isolasi). */
export async function resellerDashboard(resellerId: string) {
  const rs = await prisma.reseller.findUnique({ where: { id: resellerId }, include: { agent: { select: { companyName: true } } } });
  if (!rs) throw new PartnerPortalError("Reseller tak ditemukan");
  const period = new Date();
  const periodStart = new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth(), 1));
  const [code, tenantCount, monthAgg, totalAgg] = await Promise.all([
    prisma.partnerCode.findFirst({ where: { resellerId, ownerKind: "reseller" }, select: { code: true } }),
    prisma.tenantAttribution.count({ where: { resellerId } }),
    prisma.commissionLedger.aggregate({ where: { resellerId, periodMonth: periodStart, entryKind: "ACCRUAL" }, _sum: { resellerAmountIdr: true } }),
    prisma.commissionLedger.aggregate({ where: { resellerId, entryKind: "ACCRUAL" }, _sum: { resellerAmountIdr: true } }),
  ]);
  return {
    name: rs.name, agentName: rs.agent.companyName,
    commissionType: rs.commissionType, commissionValue: rs.commissionValue,
    code: code?.code ?? null, tenantCount,
    commissionThisMonth: monthAgg._sum.resellerAmountIdr ?? 0,
    commissionTotal: totalAgg._sum.resellerAmountIdr ?? 0,
  };
}
