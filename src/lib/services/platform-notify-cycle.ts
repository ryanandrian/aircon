/**
 * Platform Notify Cycle — evaluasi kondisi tenant → antre notifikasi platform (event-driven).
 *
 * HANYA MEMBACA kondisi tenant + MENULIS PlatformNotification (tabel terpisah). TIDAK mengubah
 * status tenant/subscription/dunning → nol regresi ke jalur billing yang sudah jalan.
 * Idempoten via dedupeKey harian (aman dipanggil tiap hari; tak kirim ganda).
 *
 * Event:
 *   - subscription_due     : nextDueDate dalam 0..3 hari ke depan (tenant ACTIVE, berbayar)
 *   - subscription_overdue : nextDueDate sudah lewat (PAST_DUE/ACTIVE), belum SUSPENDED
 *   - trial_ending         : TRIAL, nextDueDate dalam 0..3 hari
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { notifyPlatform } from "@/lib/services/platform-notification-service";

const DAY_MS = 86_400_000;
const fmtDate = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
const dayStamp = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD utk dedupe harian

export interface PlatformNotifySummary {
  due: number; overdue: number; trialEnding: number; queued: number;
}

export async function runPlatformNotifyCycle(now: Date = new Date()): Promise<PlatformNotifySummary> {
  const soon = new Date(now.getTime() + 3 * DAY_MS);
  const stamp = dayStamp(now);
  let due = 0, overdue = 0, trialEnding = 0, queued = 0;

  // Kandidat: tenant dengan nextDueDate terisi & belum SUSPENDED/CANCELLED.
  const tenants = await prisma.tenant.findMany({
    where: {
      nextDueDate: { not: null },
      status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] },
    },
    select: { id: true, status: true, nextDueDate: true },
  });

  for (const t of tenants) {
    if (!t.nextDueDate) continue;
    const dueDate = t.nextDueDate;

    if (dueDate < now) {
      // Sudah lewat jatuh tempo.
      const r = await notifyPlatform({
        tenantId: t.id, templateKey: "subscription_overdue",
        vars: { link: "https://app.aircon.web.id/app/langganan" },
        dedupeKey: `subscription_overdue:${t.id}:${stamp}`,
      });
      queued += r.created; overdue += 1;
    } else if (dueDate <= soon) {
      // 0..3 hari ke depan.
      if (t.status === "TRIAL") {
        const r = await notifyPlatform({
          tenantId: t.id, templateKey: "trial_ending",
          vars: { tanggal: fmtDate(dueDate), link: "https://app.aircon.web.id/app/langganan" },
          dedupeKey: `trial_ending:${t.id}:${stamp}`,
        });
        queued += r.created; trialEnding += 1;
      } else {
        const r = await notifyPlatform({
          tenantId: t.id, templateKey: "subscription_due",
          vars: { tanggal: fmtDate(dueDate), link: "https://app.aircon.web.id/app/langganan" },
          dedupeKey: `subscription_due:${t.id}:${stamp}`,
        });
        queued += r.created; due += 1;
      }
    }
  }

  return { due, overdue, trialEnding, queued };
}
