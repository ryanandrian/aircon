/**
 * Platform Notify Cycle — evaluasi kondisi tenant → antre notifikasi platform (event-driven).
 *
 * HANYA MEMBACA kondisi tenant + MENULIS PlatformNotification (tabel terpisah). TIDAK mengubah
 * status tenant/subscription/dunning → nol regresi ke jalur billing yang sudah jalan.
 * Idempoten via dedupeKey harian (aman dipanggil tiap hari; tak kirim ganda).
 *
 * Event (audit 2026-10-26):
 *   - subscription_due     : nextDueDate dalam 0..3 hari ke depan — PENGGUNA BAYAR saja
 *   - subscription_overdue : nextDueDate sudah lewat — PENGGUNA BAYAR saja
 *
 * Paket Basic (`TRIAL`) GRATIS SELAMANYA: tidak punya tagihan langganan dan tidak
 * punya masa trial. Karena itu cycle ini tidak pernah mengirimi Basic pesan due/overdue,
 * dan template `trial_ending` sudah dihapus dari katalog (G4).
 *
 * Variabel `paket` + `nominal` WAJIB ada di kedua template (G3): sebelumnya hanya
 * `tanggal`/`link` dikirim sehingga copy tagihan kehilangan nama paket & nilai tagihan.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { notifyPlatform } from "@/lib/services/platform-notification-service";
import { getBillingPolicy } from "@/lib/billing/config";
import { overdueMilestoneDue, overdueDedupeKey } from "@/lib/domain/overdue-milestone";
import { dayKeyInZone, dayDifferenceInZone } from "@/lib/domain/tenant-timezone";
import { formatIDR } from "@/lib/billing/plans";
import type { TenantPlan } from "@prisma/client";

const fmtDate = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
/** Dedupe harian memakai tanggal kalender ZONA TENANT (bukan UTC server). */
export interface PlatformNotifySummary {
  due: number;
  overdue: number;
  /** Tenant paket gratis yang tidak punya tagihan — sengaja dilewati. */
  skippedFreePlan: number;
  queued: number;
}

/**
 * Variabel tagihan dari sumber yang benar-benar ada, tanpa menebak nilai:
 * - `paket`   : displayName PlanConfig (dapat diubah admin, bukan hardcode).
 * - `nominal` : Subscription.amountMonthly (snapshot harga saat berlangganan),
 *               fallback ke harga PlanConfig bila Subscription belum ada.
 * TIDAK memakai pembayaran lama: nilai pembayaran bisa memuat pajak/diskon yang
 * tidak sama dengan tagihan berikutnya.
 */
async function resolveBillingVars(
  tenantId: string,
  plan: TenantPlan,
): Promise<{ paket: string; nominal: string }> {
  const [tenant, planConfig] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { subscription: { select: { amountMonthly: true } } },
    }),
    prisma.planConfig.findUnique({
      where: { plan },
      select: { displayName: true, priceMonthly: true },
    }),
  ]);
  const monthly = tenant?.subscription?.amountMonthly ?? planConfig?.priceMonthly ?? 0;
  return { paket: planConfig?.displayName ?? plan, nominal: formatIDR(monthly) };
}

export async function runPlatformNotifyCycle(now: Date = new Date()): Promise<PlatformNotifySummary> {
  let due = 0, overdue = 0, skippedFreePlan = 0, queued = 0;
  const policy = await getBillingPolicy();

  // Kandidat: tenant dengan nextDueDate terisi & belum SUSPENDED/CANCELLED.
  const tenants = await prisma.tenant.findMany({
    where: {
      nextDueDate: { not: null },
      status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] },
    },
    select: { id: true, status: true, nextDueDate: true, plan: true, timezone: true },
  });

  for (const t of tenants) {
    if (!t.nextDueDate) continue;
    const dueDate = t.nextDueDate;

    // Basic gratis selamanya → tidak ada tagihan, tidak ada pengingat jatuh tempo.
    // (Normal flow membuat nextDueDate=null untuk Basic; guard ini menutup data lama
    // yang mungkin terisi, sehingga tak ada copy "bayar" yang salah alamat.)
    if (t.plan === "TRIAL") { skippedFreePlan += 1; continue; }

    const billing = await resolveBillingVars(t.id, t.plan);

    if (dueDate < now) {
      // Lewat jatuh tempo: HANYA pada milestone (BillingPolicy.dunningReminderDays),
      // bukan tiap hari. Dedupe per milestone & periode (overdueDedupeKey).
      const milestone = overdueMilestoneDue(dueDate, now, policy.dunningReminderDays, t.timezone);
      if (milestone.due) {
        const r = await notifyPlatform({
          tenantId: t.id, templateKey: "subscription_overdue",
          channels: ["EMAIL"],
          vars: { paket: billing.paket, nominal: billing.nominal, tanggal: fmtDate(dueDate) },
          dedupeKey: overdueDedupeKey(t.id, dueDate, milestone.late, t.timezone),
        });
        queued += r.created;
        overdue += 1;
      }
    } else {
      // Jatuh tempo dalam 0..3 HARI KALENDER zona tenant (bukan 72 jam absolut).
      // Kanal TAGIHAN ke owner = EMAIL saja (F2/G5). Alasannya terverifikasi dari
      // data live: `Tenant.phone` == nomor OWNER untuk 6 dari 7 tenant, jadi pesan
      // WA platform + WA dunning (MessageLog) mendarat di nomor yang sama pada hari
      // yang sama — bukti live: tenant Jaya Mandiri menerima WA + EMAIL overdue di
      // hari yang sama, 5 hari berturut-turut, plus WA dunning.
      const daysToDue = dayDifferenceInZone(now, dueDate, t.timezone);
      if (daysToDue > 3) continue;
      const r = await notifyPlatform({
        tenantId: t.id, templateKey: "subscription_due",
        channels: ["EMAIL"],
        vars: { paket: billing.paket, nominal: billing.nominal, tanggal: fmtDate(dueDate) },
        dedupeKey: `subscription_due:${t.id}:${dayKeyInZone(now, t.timezone)}`,
      });
      queued += r.created; due += 1;
    }
  }

  return { due, overdue, skippedFreePlan, queued };
}
