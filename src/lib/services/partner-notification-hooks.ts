/**
 * Hook notifikasi untuk lifecycle mitra (F4).
 *
 * PRINSIP:
 *  - Notifikasi dibuat SETELAH operasi bisnis commit (ledger/payout/approval).
 *    Event = fakta yang sudah terjadi, bukan niat.
 *  - Kegagalan notifikasi TIDAK menggagalkan operasi bisnis (gagal-jujur).
 *    Kehilangan notifikasi lebih baik daripada gagalkan pencatatan komisi.
 *  - Idempoten: dedupe per identitas event (ledgerId / payoutId / resellerId).
 *    Event yang sama tak menghasilkan notifikasi ganda walau dipanggil ulang.
 *  - Privasi: tak ada nomor rekening, tak ada data pelanggan, hanya nama+status
 *    minimum dan nominal komisi.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import {
  notifyPartner, loadPartnerTarget, formatIdr, formatPeriod,
} from "@/lib/services/partner-notification-service";

async function safeNotify(
  kind: "agent" | "reseller",
  id: string,
  fn: () => Promise<unknown>,
  label: string,
): Promise<void> {
  try {
    await fn();
  } catch (e) {
    console.error(`[partner-notify] ${label} gagal (${kind}:${id}):`, e instanceof Error ? e.message : e);
  }
}

/**
 * Tenant ter-atribusi ke kode mitra (agen/reseller).
 * Event: satu tenant satu atribusi (atribusi terkunci) ⇒ dedupe per tenant.
 * Data: nama tenant + status (minimum). Tanpa kontak/data pelanggan lain.
 */
export async function notifyTenantAttributed(params: {
  tenantId: string;
  tenantName: string;
  tenantStatus: string;
  agentId: string;
  resellerId: string | null;
  code: string;
}): Promise<void> {
  const targets: { kind: "agent" | "reseller"; id: string }[] = [
    { kind: "agent", id: params.agentId },
    ...(params.resellerId ? [{ kind: "reseller" as const, id: params.resellerId }] : []),
  ];
  for (const t of targets) {
    const target = await loadPartnerTarget(t.kind, t.id);
    if (!target) continue;
    await safeNotify(t.kind, t.id, () => notifyPartner(
      target,
      "partner_tenant_attributed",
      { kode: params.code, status_tenant: params.tenantStatus, nama_tenant: params.tenantName },
      {
        dedupeKey: `tenant_attributed:${params.tenantId}:${t.kind}:${t.id}`,
        inapp: {
          type: "TENANT_ATTRIBUTED",
          title: "Pelanggan baru masuk lewat kode Anda",
          body: `${params.tenantName} (status: ${params.tenantStatus})`,
          entityId: params.tenantId,
        },
      },
    ), "tenant_attributed");
  }
}

/**
 * Komisi tercatat (ledger ACCRUAL committed).
 * Accrual BUKAN janji payout — copy menyatakan demikian.
 * Dedupe per ledgerId (ledger = identitas event, bukan teks).
 */
export async function notifyCommissionAccrued(params: {
  ledgerId: number;
  agentId: string;
  resellerId: string | null;
  agentAmountIdr: number;
  resellerAmountIdr: number;
  periodMonth: Date;
}): Promise<void> {
  const agentTarget = await loadPartnerTarget("agent", params.agentId);
  if (agentTarget && params.agentAmountIdr > 0) {
    await safeNotify("agent", params.agentId, () => notifyPartner(
      agentTarget,
      "partner_commission_accrued",
      { nominal_komisi: formatIdr(params.agentAmountIdr), periode: formatPeriod(params.periodMonth) },
      {
        dedupeKey: `commission_accrued:${params.ledgerId}:agent`,
        inapp: {
          type: "COMMISSION_ACCRUED",
          title: "Komisi Anda bertambah",
          body: `${formatIdr(params.agentAmountIdr)} untuk periode ${formatPeriod(params.periodMonth)} — pencatatan, belum pembayaran.`,
          entityId: String(params.ledgerId),
        },
      },
    ), "commission_accrued_agent");
  }
  if (params.resellerId && params.resellerAmountIdr > 0) {
    const rsTarget = await loadPartnerTarget("reseller", params.resellerId);
    if (rsTarget) {
      await safeNotify("reseller", params.resellerId, () => notifyPartner(
        rsTarget,
        "partner_commission_accrued",
        { nominal_komisi: formatIdr(params.resellerAmountIdr), periode: formatPeriod(params.periodMonth) },
        {
          dedupeKey: `commission_accrued:${params.ledgerId}:reseller`,
          inapp: {
            type: "COMMISSION_ACCRUED",
            title: "Komisi Anda bertambah",
            body: `${formatIdr(params.resellerAmountIdr)} untuk periode ${formatPeriod(params.periodMonth)} — pencatatan, belum pembayaran.`,
            entityId: String(params.ledgerId),
          },
        },
      ), "commission_accrued_reseller");
    }
  }
}

/**
 * Komisi dibatalkan (ledger REVERSAL committed).
 * Reversal menjelaskan status sumber (ref = sumber).
 */
export async function notifyCommissionReversed(params: {
  ledgerId: number;
  sourceLedgerId: number;
  agentId: string;
  resellerId: string | null;
  agentAmountIdr: number;
  resellerAmountIdr: number;
  periodMonth: Date;
}): Promise<void> {
  const agentTarget = await loadPartnerTarget("agent", params.agentId);
  if (agentTarget && params.agentAmountIdr !== 0) {
    await safeNotify("agent", params.agentId, () => notifyPartner(
      agentTarget,
      "partner_commission_reversed",
      {
        nominal_komisi: formatIdr(Math.abs(params.agentAmountIdr)),
        periode: formatPeriod(params.periodMonth),
        ref: `ledger #${params.sourceLedgerId}`,
      },
      {
        dedupeKey: `commission_reversed:${params.ledgerId}:agent`,
        inapp: {
          type: "COMMISSION_REVERSED",
          title: "Komisi sebelumnya dibatalkan",
          body: `${formatIdr(Math.abs(params.agentAmountIdr))} untuk periode ${formatPeriod(params.periodMonth)} — pembatalan dari ledger #${params.sourceLedgerId}.`,
          entityId: String(params.ledgerId),
        },
      },
    ), "commission_reversed_agent");
  }
  if (params.resellerId && params.resellerAmountIdr !== 0) {
    const rsTarget = await loadPartnerTarget("reseller", params.resellerId);
    if (rsTarget) {
      await safeNotify("reseller", params.resellerId, () => notifyPartner(
        rsTarget,
        "partner_commission_reversed",
        {
          nominal_komisi: formatIdr(Math.abs(params.resellerAmountIdr)),
          periode: formatPeriod(params.periodMonth),
          ref: `ledger #${params.sourceLedgerId}`,
        },
        {
          dedupeKey: `commission_reversed:${params.ledgerId}:reseller`,
          inapp: {
            type: "COMMISSION_REVERSED",
            title: "Komisi sebelumnya dibatalkan",
            body: `${formatIdr(Math.abs(params.resellerAmountIdr))} untuk periode ${formatPeriod(params.periodMonth)} — pembatalan dari ledger #${params.sourceLedgerId}.`,
            entityId: String(params.ledgerId),
          },
        },
      ), "commission_reversed_reseller");
    }
  }
}

/**
 * Payout dibayar (transferRef tersimpan).
 * Hanya setelah `markPayoutPaid` sukses.
 */
export async function notifyPayoutPaid(params: {
  payoutId: string;
  agentId: string;
  periodMonth: Date;
  netPaidIdr: number;
  transferRef: string;
}): Promise<void> {
  const target = await loadPartnerTarget("agent", params.agentId);
  if (!target) return;
  await safeNotify("agent", params.agentId, () => notifyPartner(
    target,
    "partner_payout_paid",
    {
      nominal_komisi: formatIdr(params.netPaidIdr),
      periode: formatPeriod(params.periodMonth),
      ref: params.transferRef,
    },
    {
      dedupeKey: `payout_paid:${params.payoutId}`,
      inapp: {
        type: "PAYOUT_PAID",
        title: "Pembayaran komisi telah diproses",
        body: `${formatIdr(params.netPaidIdr)} untuk periode ${formatPeriod(params.periodMonth)} — referensi ${params.transferRef}.`,
        entityId: params.payoutId,
      },
    },
  ), "payout_paid");
}

/**
 * Pendaftaran reseller diterima (ke agen).
 * Dedupe per resellerId (satu pendaftaran = satu event).
 */
export async function notifyResellerRegistered(params: {
  resellerId: string;
  resellerName: string;
  agentId: string;
}): Promise<void> {
  const target = await loadPartnerTarget("agent", params.agentId);
  if (!target) return;
  await safeNotify("agent", params.agentId, () => notifyPartner(
    target,
    "partner_reseller_registered",
    { mitra: params.resellerName },
    {
      dedupeKey: `reseller_registered:${params.resellerId}`,
      inapp: {
        type: "RESELLER_REGISTERED",
        title: "Pendaftaran reseller baru",
        body: `${params.resellerName} mendaftar lewat kode Anda. Tinjau di portal.`,
        entityId: params.resellerId,
      },
    },
  ), "reseller_registered");
}

/**
 * Reseller disetujui (ke reseller). Berisi kode + tautan aktivasi.
 * Dedupe per resellerId + versi approval (kode berubah bila approve ulang).
 */
export async function notifyResellerApproved(params: {
  resellerId: string;
  agentId: string;
  code: string;
  activationUrl: string;
}): Promise<void> {
  const target = await loadPartnerTarget("reseller", params.resellerId);
  if (!target) return;
  await safeNotify("reseller", params.resellerId, () => notifyPartner(
    target,
    "partner_reseller_approved",
    { kode: params.code, link: params.activationUrl },
    {
      dedupeKey: `reseller_approved:${params.resellerId}:${params.code}`,
      inapp: {
        type: "RESELLER_APPROVED",
        title: "Pendaftaran Anda disetujui",
        body: `Kode Anda: ${params.code}. Aktifkan akun lewat tautan yang kami kirim ke email Anda.`,
        entityId: params.resellerId,
      },
    },
  ), "reseller_approved");
}

/**
 * Reseller ditolak (ke reseller).
 * Dedupe per resellerId.
 */
export async function notifyResellerRejected(params: {
  resellerId: string;
  agentId: string;
}): Promise<void> {
  const target = await loadPartnerTarget("reseller", params.resellerId);
  if (!target) return;
  await safeNotify("reseller", params.resellerId, () => notifyPartner(
    target,
    "partner_reseller_rejected",
    {},
    {
      dedupeKey: `reseller_rejected:${params.resellerId}`,
      inapp: {
        type: "RESELLER_REJECTED",
        title: "Pendaftaran Anda belum disetujui",
        body: "Hubungi agen Anda untuk keterangan.",
        entityId: params.resellerId,
      },
    },
  ), "reseller_rejected");
}

/**
 * Akun mitra aktif (agen atau reseller) — setelah PIN diset & token hangus.
 * Dedupe per partner id + epoch token (token baru = event baru).
 */
export async function notifyPartnerActivated(params: {
  kind: "agent" | "reseller";
  id: string;
  tokenIssuedAt: string;
  portalUrl: string;
}): Promise<void> {
  const target = await loadPartnerTarget(params.kind, params.id);
  if (!target) return;
  const template = params.kind === "agent" ? "partner_agent_activated" : "partner_reseller_activated";
  await safeNotify(params.kind, params.id, () => notifyPartner(
    target,
    template,
    { link: params.portalUrl },
    {
      dedupeKey: `partner_activated:${params.kind}:${params.id}:${params.tokenIssuedAt}`,
      inapp: {
        type: "PARTNER_ACTIVATED",
        title: "Akun Anda aktif",
        body: "Akun mitra Anda sudah aktif. Silakan masuk ke portal mitra.",
        entityId: params.id,
      },
    },
  ), "partner_activated");
}

/**
 * Undangan agen (ke agen). Dipanggil saat admin menerbitkan token aktivasi.
 * Dedupe per token (token baru = undangan baru).
 */
export async function notifyAgentInvited(params: {
  agentId: string;
  activationUrl: string;
  tokenIssuedAt: string;
}): Promise<void> {
  const target = await loadPartnerTarget("agent", params.agentId);
  if (!target) return;
  await safeNotify("agent", params.agentId, () => notifyPartner(
    target,
    "partner_agent_invited",
    { link: params.activationUrl },
    {
      dedupeKey: `agent_invited:${params.agentId}:${params.tokenIssuedAt}`,
      inapp: {
        type: "AGENT_INVITED",
        title: "Undangan kemitraan",
        body: "Anda mendapat undangan kemitraan. Aktifkan akun lewat tautan yang kami kirim ke email Anda.",
        entityId: params.agentId,
      },
    },
  ), "agent_invited");
}

/** Hitung baris notifikasi mitra (untuk admin monitoring). */
export async function countPartnerNotifications(): Promise<{ total: number; unread: number }> {
  const [total, unread] = await Promise.all([
    prisma.partnerNotification.count(),
    prisma.partnerNotification.count({ where: { readAt: null } }),
  ]);
  return { total, unread };
}
