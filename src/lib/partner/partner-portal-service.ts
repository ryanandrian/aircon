/**
 * Partner Portal Service — F2/F3: aktivasi login, login PIN, dasbor agen, reseller.
 * Reuse hashPin/verifyPin (scrypt) dari tech-crypto. Isolasi ketat: agen hanya lihat
 * datanya; reseller hanya miliknya. Adaptasi mesinviral F2/F3.
 */
import { prisma } from "@/lib/prisma";
import { hashPin, verifyPin, isValidPin } from "@/lib/auth/tech-crypto";
import { encryptSecret, maskAccount } from "@/lib/partner/vault-crypto";
import type { CommissionType, TenantPlan } from "@prisma/client";
import crypto from "crypto";

export class PartnerPortalError extends Error {}

function genToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/** Base URL aplikasi (link publik harus HTTPS absolut). */
function appBase(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://app.airconet.id").replace(/\/+$/, "");
}

/**
 * Tautan aktivasi sekali-pakai untuk mitra (agen/reseller).
 * Path mengikuti ROUTE yang benar-benar ada: `/agen/aktivasi/<token>` dan
 * `/reseller/aktivasi/<token>` (bukan `/agent/...`).
 */
export function activationUrlFor(kind: "agent" | "reseller", token: string): string {
  const segment = kind === "agent" ? "agen" : "reseller";
  return `${appBase()}/${segment}/aktivasi/${token}`;
}

function assertCommissionValue(type: CommissionType, value: number): void {
  if (!Number.isFinite(value) || value < 0) throw new PartnerPortalError("Nilai komisi tidak valid");
  if (type === "PERCENT" && value > 100) throw new PartnerPortalError("Komisi persen 0-100");
  if (type === "FLAT_IDR" && value > 100_000_000) throw new PartnerPortalError("Komisi flat terlalu besar");
}

export type PlanCommissionInput = { plan: TenantPlan; commissionType: CommissionType; commissionValue: number };

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

/**
 * Masa berlaku token aktivasi (F4). 72 jam — cukup untuk PIC/agen menyempatkan,
 * cukup pendek supaya tautan bocor cepat mati.
 */
export const ACTIVATION_TOKEN_TTL_HOURS = 72;

/** ADMIN: buat token aktivasi login agen (kirim link ke PIC). */
export async function issueAgentLoginToken(agentId: string): Promise<string> {
  const token = genToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ACTIVATION_TOKEN_TTL_HOURS * 60 * 60 * 1000);
  // Token baru MELETAHKAN token lama (reissue mencabut token sebelumnya) —
  // hanya satu tautan yang hidup pada satu waktu.
  await prisma.agent.update({
    where: { id: agentId },
    data: { loginToken: token, loginTokenIssuedAt: now, loginTokenExpiresAt: expiresAt },
  });
  // Notifikasi undangan (F4): email ke PIC agen berisi tautan aktivasi.
  try {
    const { notifyAgentInvited } = await import("@/lib/services/partner-notification-hooks");
    await notifyAgentInvited({
      agentId,
      activationUrl: activationUrlFor("agent", token),
      tokenIssuedAt: now.toISOString(),
    });
  } catch (e) {
    console.error("[partner-portal] notifikasi undangan agen gagal:", e instanceof Error ? e.message : e);
  }
  return token;
}

/**
 * Aktivasi: set PIN via token (agen/reseller).
 *
 * TOKEN SEKALI-PAKAI secara ATOMIK:KANULAIKAN dengan `updateMany` ber-kondisi
 * (token masih ada + belum kedaluwarsa). Kalau dua request memakai token sama,
 * HANYA SATU yang mendapat count=1; satunya ditolak. Tanpa ini, dua request
 * bersamaan bisa sama-sama "berhasil" (TOCTOU) dan PIN terakhir yang menang.
 *
 * Token kedaluwarsa ⇒ ditolak. Token tak dikenal/terpakai ⇒ ditolak.
 */
export async function activatePartner(kind: "agent" | "reseller", token: string, pin: string): Promise<{ id: string }> {
  if (!isValidPin(pin)) throw new PartnerPortalError("PIN harus 6 angka");
  const now = new Date();
  if (kind === "agent") {
    // Baca identitas baris PEMILIK token DULU (updateMany tak mengembalikan id).
    // Dicocokkan persis ke token, jadi tak mungkin salah akun walau PIN sama.
    const owner = await prisma.agent.findUnique({
      where: { loginToken: token },
      select: { id: true, loginTokenIssuedAt: true },
    });
    if (!owner) throw new PartnerPortalError("Tautan tidak valid / sudah dipakai");
    // Klaim ATOMIK: syarat token + belum kedaluwarsa. count=1 ⇒ hanya satu
    // request yang menang (TOCTOU MUSTAHIL).
    const claimed = await prisma.agent.updateMany({
      where: {
        id: owner.id,
        loginToken: token,
        OR: [{ loginTokenExpiresAt: null }, { loginTokenExpiresAt: { gt: now } }],
      },
      data: { pinHash: hashPin(pin), loginToken: null, loginTokenExpiresAt: null },
    });
    if (claimed.count !== 1) throw new PartnerPortalError("Tautan tidak valid / sudah dipakai / kedaluwarsa");
    const row = owner;
    // Notifikasi akun aktif (F4): SETELAH PIN tersimpan & token hangus.
    try {
      const { notifyPartnerActivated } = await import("@/lib/services/partner-notification-hooks");
      await notifyPartnerActivated({
        kind: "agent",
        id: row.id,
        tokenIssuedAt: (row.loginTokenIssuedAt ?? now).toISOString(),
        portalUrl: `${appBase()}/agen`,
      });
    } catch (e) {
      console.error("[partner-portal] notifikasi aktivasi agen gagal:", e instanceof Error ? e.message : e);
    }
    return { id: row.id };
  }
  const owner = await prisma.reseller.findUnique({
    where: { loginToken: token },
    select: { id: true, loginTokenIssuedAt: true },
  });
  if (!owner) throw new PartnerPortalError("Tautan tidak valid / sudah dipakai");
  const claimed = await prisma.reseller.updateMany({
    where: {
      id: owner.id,
      loginToken: token,
      OR: [{ loginTokenExpiresAt: null }, { loginTokenExpiresAt: { gt: now } }],
    },
    data: { pinHash: hashPin(pin), loginToken: null, loginTokenExpiresAt: null },
  });
  if (claimed.count !== 1) throw new PartnerPortalError("Tautan tidak valid / sudah dipakai / kedaluwarsa");
  const row = owner;
  try {
    const { notifyPartnerActivated } = await import("@/lib/services/partner-notification-hooks");
    await notifyPartnerActivated({
      kind: "reseller",
      id: row.id,
      tokenIssuedAt: (row.loginTokenIssuedAt ?? now).toISOString(),
      portalUrl: `${appBase()}/reseller`,
    });
  } catch (e) {
    console.error("[partner-portal] notifikasi aktivasi reseller gagal:", e instanceof Error ? e.message : e);
  }
  return { id: row.id };
}

/** Login via email + PIN (agen) atau nama+kode+PIN (reseller pakai email). */
export async function loginAgent(email: string, pin: string): Promise<{ id: string }> {
  const agent = await prisma.agent.findUnique({ where: { picEmail: email.trim().toLowerCase() } });
  if (!agent || !verifyPin(pin, agent.pinHash)) throw new PartnerPortalError("Email atau PIN salah");
  if (agent.status !== "ACTIVE") throw new PartnerPortalError("Akun agen nonaktif");
  return { id: agent.id };
}

export async function loginReseller(email: string, pin: string): Promise<{ id: string }> {
  const norm = email.trim().toLowerCase();
  // Email bisa terdaftar di >1 agen (dedup registerReseller per-agen). Cocokkan HANYA
  // reseller ACTIVE; bila >1 ACTIVE dgn email sama → ambigu, tolak (cegah masuk akun salah).
  const candidates = await prisma.reseller.findMany({ where: { email: norm, status: "ACTIVE" } });
  const matches = candidates.filter((r) => verifyPin(pin, r.pinHash));
  if (matches.length === 0) throw new PartnerPortalError("Email atau PIN salah");
  if (matches.length > 1) throw new PartnerPortalError("Email terdaftar di lebih dari satu agen. Hubungi agen Anda.");
  return { id: matches[0].id };
}

/** DASBOR AGEN — semua tenant bawaan + komisi + reseller + pencairan (isolasi ketat). */
export async function agentDashboard(agentId: string) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId }, include: { planCommissions: true } });
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
    prisma.commissionLedger.aggregate({ where: { agentId, periodMonth: periodStart, status: { in: ["ACCRUED", "APPROVED"] }, entryKind: { in: ["ACCRUAL", "REVERSAL"] } }, _sum: { agentAmountIdr: true } }),
    prisma.commissionLedger.aggregate({ where: { agentId, status: { in: ["ACCRUED", "APPROVED", "PAID"] }, entryKind: { in: ["ACCRUAL", "REVERSAL"] } }, _sum: { agentAmountIdr: true } }),
    prisma.agentPayout.findMany({ where: { agentId }, orderBy: { periodMonth: "desc" }, take: 12 }),
  ]);

  return {
    agent: {
      companyName: agent.companyName,
      planCommissions: agent.planCommissions,
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
  // Notifikasi agen (F4): ada pendaftaran baru yang perlu ditinjau.
  try {
    const { notifyResellerRegistered } = await import("@/lib/services/partner-notification-hooks");
    await notifyResellerRegistered({ resellerId: rs.id, resellerName: rs.name, agentId: agent.id });
  } catch (e) {
    console.error("[partner-portal] notifikasi pendaftaran gagal:", e instanceof Error ? e.message : e);
  }
  return { resellerId: rs.id };
}

/** AGEN: setujui reseller → aktif + kode + token aktivasi. */
export async function approveReseller(agentId: string, resellerId: string, commission: { type: CommissionType; value: number; planCommissions?: PlanCommissionInput[] }): Promise<{ code: string; token: string }> {
  const rs = await prisma.reseller.findFirst({ where: { id: resellerId, agentId } });
  if (!rs) throw new PartnerPortalError("Reseller tak ditemukan");
  assertCommissionValue(commission.type, commission.value);
  const rules = commission.planCommissions ?? (["TRIAL", "PROFESSIONAL", "BUSINESS"] as const).map((plan) => ({ plan, commissionType: commission.type, commissionValue: commission.value }));
  if (rules.length !== 3 || new Set(rules.map((rule) => rule.plan)).size !== 3 || !rules.every((rule) => ["TRIAL", "PROFESSIONAL", "BUSINESS"].includes(rule.plan))) {
    throw new PartnerPortalError("Aturan komisi harus lengkap untuk Basic, Professional, dan Business");
  }
  rules.forEach((rule) => assertCommissionValue(rule.commissionType, rule.commissionValue));

  const code = await uniquePartnerCode();
  const token = genToken();
  const tokenIssuedAt = new Date();
  const tokenExpiresAt = new Date(tokenIssuedAt.getTime() + ACTIVATION_TOKEN_TTL_HOURS * 60 * 60 * 1000);
  await prisma.$transaction(async (tx) => {
    await tx.reseller.update({
      where: { id: resellerId },
      data: {
        status: "ACTIVE", commissionType: commission.type, commissionValue: commission.value,
        loginToken: token, loginTokenIssuedAt: tokenIssuedAt, loginTokenExpiresAt: tokenExpiresAt,
      },
    });
    await Promise.all(rules.map((rule) => tx.partnerPlanCommission.upsert({
      where: { resellerId_plan: { resellerId, plan: rule.plan } },
      create: { resellerId, plan: rule.plan, commissionType: rule.commissionType, commissionValue: rule.commissionValue },
      update: { commissionType: rule.commissionType, commissionValue: rule.commissionValue },
    })));
    await tx.partnerCode.create({ data: { code, ownerKind: "reseller", agentId, resellerId } });
  });
  // Notifikasi reseller (F4): SETELAH approval commit. Berisi kode + tautan
  // aktivasi. Kegagalan notifikasi tak membatalkan approval.
  try {
    const { notifyResellerApproved } = await import("@/lib/services/partner-notification-hooks");
    await notifyResellerApproved({
      resellerId, agentId, code, activationUrl: activationUrlFor("reseller", token),
    });
  } catch (e) {
    console.error("[partner-portal] notifikasi approval gagal:", e instanceof Error ? e.message : e);
  }
  return { code, token };
}

/** AGEN: tolak reseller. */
export async function rejectReseller(agentId: string, resellerId: string): Promise<void> {
  const rs = await prisma.reseller.findFirst({ where: { id: resellerId, agentId } });
  if (!rs) throw new PartnerPortalError("Reseller tak ditemukan");
  await prisma.reseller.update({ where: { id: resellerId }, data: { status: "REJECTED" } });
  // Notifikasi reseller (F4): penolakan adalah keputusan yang harusKnown,
  // bukan diam-diam.
  try {
    const { notifyResellerRejected } = await import("@/lib/services/partner-notification-hooks");
    await notifyResellerRejected({ resellerId, agentId });
  } catch (e) {
    console.error("[partner-portal] notifikasi penolakan gagal:", e instanceof Error ? e.message : e);
  }
}

/** AGEN: rincian komisi per-reseller untuk periode (dasar Excel transfer-massal). */
export async function resellerBreakdown(agentId: string, periodMonth: Date) {
  const periodStart = new Date(Date.UTC(periodMonth.getUTCFullYear(), periodMonth.getUTCMonth(), 1));
  const resellers = await prisma.reseller.findMany({ where: { agentId } });
  const rows = [];
  for (const r of resellers) {
    const agg = await prisma.commissionLedger.aggregate({
      where: { agentId, resellerId: r.id, periodMonth: periodStart, entryKind: { in: ["ACCRUAL", "REVERSAL"] } },
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
  const rs = await prisma.reseller.findUnique({ where: { id: resellerId }, include: { agent: { select: { companyName: true } }, planCommissions: true } });
  if (!rs) throw new PartnerPortalError("Reseller tak ditemukan");
  const period = new Date();
  const periodStart = new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth(), 1));
  const [code, tenantCount, monthAgg, totalAgg] = await Promise.all([
    prisma.partnerCode.findFirst({ where: { resellerId, ownerKind: "reseller" }, select: { code: true } }),
    prisma.tenantAttribution.count({ where: { resellerId } }),
    prisma.commissionLedger.aggregate({ where: { resellerId, periodMonth: periodStart, entryKind: { in: ["ACCRUAL", "REVERSAL"] } }, _sum: { resellerAmountIdr: true } }),
    prisma.commissionLedger.aggregate({ where: { resellerId, entryKind: { in: ["ACCRUAL", "REVERSAL"] } }, _sum: { resellerAmountIdr: true } }),
  ]);
  return {
    name: rs.name, agentName: rs.agent.companyName,
    planCommissions: rs.planCommissions, code: code?.code ?? null, tenantCount,
    commissionThisMonth: monthAgg._sum.resellerAmountIdr ?? 0,
    commissionTotal: totalAgg._sum.resellerAmountIdr ?? 0,
  };
}