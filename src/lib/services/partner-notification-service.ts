/**
 * Notifikasi mitra (F4): AGEN & RESELLER.
 *
 * dua kanal (dipilih pemilik):
 *  1. EMAIL — lewat antrean `PlatformNotification` yang sama dengan notifikasi
 *     tenant ke owner. Satu antrean ⇒ satu lease, satu status, satu dedupe, satu
 *     kill switch (`notifySendEnabled`), satu recovery UNKNOWN. BUKAN mailer
 *     terpisah (dilarang di rencana kerja: "Extend target model/service
 *     PlatformNotification untuk agent/reseller, bukan membuat mailer khusus").
 *  2. IN-APP — tabel `PartnerNotification` (inbox portal agen/reseller).
 *     Mitra BUKAN tenant ⇒ tak punya `tenantId`; memaksakan `tenantId` dipalsukan
 *     dilarang di rencana kerja.
 *
 * Aturan privasi (rencana kerja):
 *  - TIDAK mengirim data tenant/pelanggan beyond nama+status minimum.
 *  - TIDAK mengirim nomor rekening / data bank (hanya nominal komisi).
 *  - Akrual komisi BUKAN janji payout (copy menyatakan "pencatatan, bukan pembayaran").
 *  - Reversal menjelaskan status sumber (ref ledger).
 *  - Event partner hanya pada transisi nyata, dedupe per event.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import {
  renderPlatformTemplate, type PlatformTemplateKey,
} from "@/lib/domain/platform-templates";
import { getActiveTemplate } from "@/lib/services/platform-template-service";

export type PartnerKind = "agent" | "reseller";

export interface PartnerTarget {
  kind: PartnerKind;
  id: string;
  /** Nama untuk sapaan. */
  name: string;
  /** Email tujuan (WA tak dipakai: belum ada consent + nomor terverifikasi). */
  email: string | null;
}

export interface NotifyPartnerResult {
  emailCreated: number;
  inappCreated: number;
  skipped: string[];
}

/** Format nominal IDR tanpa desimal, mis. "Rp 125.000". */
function formatIdr(n: number): string {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

/** Periode ledger (UTC bulan) → "Oktober 2026". */
function formatPeriod(d: Date): string {
  return d.toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * Kirim notifikasi ke mitra: email (antrean platform) + in-app (inbox mitra).
 *
 * `vars` = isi placeholder. `inapp` = judul + isi ringkas untuk inbox portal.
 * Kegagalan satu kanal TIDAK menggagalkan kanal lain (email gagal ≠ in-app gagal).
 * Idempoten: dedupeKey pada kedua kanal.
 */
export async function notifyPartner(
  target: PartnerTarget,
  templateKey: PlatformTemplateKey,
  vars: Record<string, string>,
  opts: { dedupeKey: string; inapp?: { title: string; body: string; type: string; entityId?: string | null } },
): Promise<NotifyPartnerResult> {
  const result: NotifyPartnerResult = { emailCreated: 0, inappCreated: 0, skipped: [] };

  // ── EMAIL: antrean platform (EMAIL) ───────────────────────────────────────
  if (target.email) {
    try {
      const active = await getActiveTemplate(templateKey);
      const rendered = renderPlatformTemplate(
        templateKey,
        { app: "Aircon", nama: target.name, ...vars },
        { subject: active.subject, body: active.body },
      );
      await prisma.platformNotification.create({
        data: {
          tenantId: null,
          partnerKind: target.kind,
          agentId: target.kind === "agent" ? target.id : null,
          resellerId: target.kind === "reseller" ? target.id : null,
          channel: "EMAIL",
          templateKey,
          toAddress: target.email,
          subject: rendered.subject,
          body: rendered.body,
          dedupeKey: `partner:${opts.dedupeKey}:email`,
        },
      });
      result.emailCreated = 1;
    } catch (e) {
      if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
        result.skipped.push("email: dedupe (sudah diantre)");
      } else {
        result.skipped.push(`email: ${e instanceof Error ? e.message : "gagal"}`);
      }
    }
  } else {
    result.skipped.push("email: alamat email kosong");
  }

  // ── IN-APP: inbox mitra ───────────────────────────────────────────────────
  if (opts.inapp) {
    try {
      await prisma.partnerNotification.create({
        data: {
          partnerKind: target.kind,
          agentId: target.kind === "agent" ? target.id : null,
          resellerId: target.kind === "reseller" ? target.id : null,
          type: opts.inapp.type,
          title: opts.inapp.title,
          body: opts.inapp.body,
          entityId: opts.inapp.entityId ?? null,
          dedupeKey: `partner:${opts.dedupeKey}:inapp`,
        },
      });
      result.inappCreated = 1;
    } catch (e) {
      if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
        result.skipped.push("inapp: dedupe (sudah ada)");
      } else {
        result.skipped.push(`inapp: ${e instanceof Error ? e.message : "gagal"}`);
      }
    }
  }

  return result;
}

/** Ambil target mitra (email diutamakan) dari DB. Null bila tidak ada / tidak punya email. */
export async function loadPartnerTarget(
  kind: PartnerKind,
  id: string,
): Promise<PartnerTarget | null> {
  if (kind === "agent") {
    const a = await prisma.agent.findUnique({ where: { id } });
    if (!a) return null;
    return { kind: "agent", id: a.id, name: a.companyName, email: a.picEmail };
  }
  const r = await prisma.reseller.findUnique({ where: { id } });
  if (!r) return null;
  return { kind: "reseller", id: r.id, name: r.name, email: r.email };
}

/** Inbox in-app mitra (terbaru dulu), dengan flag belum dibaca. */
export async function listPartnerNotifications(
  kind: PartnerKind,
  id: string,
  limit = 30,
): Promise<{ id: string; type: string; title: string; body: string; entityId: string | null; readAt: Date | null; createdAt: Date }[]> {
  return prisma.partnerNotification.findMany({
    where: kind === "agent" ? { agentId: id } : { resellerId: id },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, type: true, title: true, body: true, entityId: true, readAt: true, createdAt: true },
  });
}

/** Tandai terbaca (hanya notifikasi milik mitra tsb). */
export async function markPartnerNotificationRead(kind: PartnerKind, id: string, notificationId: string): Promise<boolean> {
  const res = await prisma.partnerNotification.updateMany({
    where: kind === "agent" ? { id: notificationId, agentId: id } : { id: notificationId, resellerId: id },
    data: { readAt: new Date() },
  });
  return res.count > 0;
}

/** Hitungan belum dibaca (untuk lonceng portal). */
export async function countUnreadPartnerNotifications(kind: PartnerKind, id: string): Promise<number> {
  return prisma.partnerNotification.count({
    where: {
      ...(kind === "agent" ? { agentId: id } : { resellerId: id }),
      readAt: null,
    },
  });
}

export { formatIdr, formatPeriod };
