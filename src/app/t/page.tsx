import { redirect } from "next/navigation";
import Link from "next/link";
import { tryGetServerContext } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { monthRangeInZone } from "@/lib/domain/tenant-timezone";
import { listTechnicianJobsToday, listTechnicianBacklogJobs, listTechnicianUnpaidCashJobs, countTechnicianCompletedToday } from "@/lib/services/job-management-service";
import type { JobStatus } from "@prisma/client";
import { JOB_STATUS_LABEL, JOB_STATUS_COLOR } from "@/lib/copy/job-status";
import { Icon } from "@/components/icons";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { HelpButton } from "@/components/help/help-button";
import { getHelpTopic } from "@/lib/help/help-content";
import { PushPermission } from "./push-permission";


export const dynamic = "force-dynamic";

export default async function TechnicianHome() {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/t");

  const tech = await prisma.technician.findFirst({
    where: { tenantId: ctx.tenantId, userId: ctx.userId },
    select: { id: true, tenant: { select: { incentiveEnabled: true, timezone: true } } },
  });
  if (!tech) {
    return (
      <main className="min-h-screen bg-muted/40 p-6">
        <Card className="mx-auto max-w-md border-amber-200 bg-amber-50 text-center dark:border-amber-900/40 dark:bg-amber-950/30">
          <CardContent className="p-6">
            <p className="text-amber-800 dark:text-amber-300">Akun ini bukan teknisi. Hubungi pemilik usaha.</p>
            <Link href="/app" className="mt-3 inline-block text-sm text-sky-600 underline">Ke Dashboard</Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const [jobs, backlog, unpaidCash, doneToday] = await Promise.all([
    listTechnicianJobsToday(ctx.tenantId, tech.id),
    listTechnicianBacklogJobs(ctx.tenantId, tech.id),
    // F9c'/0.2: cash COMPLETED BELUM lunas = BELUM tuntas → tetap terlihat
    // di beranda (kelompok ini; riwayat hanya tugas+tuntas).
    listTechnicianUnpaidCashJobs(ctx.tenantId, tech.id),
    countTechnicianCompletedToday(ctx.tenantId, tech.id),
  ]);
  const doneCount = doneToday;
  const backlogCount = backlog.length; // daftar tak terbatas utk kelompok aktif

  // NIAT EKSPLISIT tenant (bukan tebak dari nilai). Off → teknisi TAK PERNAH lihat UI insentif.
  const incentiveEnabled = tech.tenant?.incentiveEnabled ?? false;
  // Insentif teknisi PERIODE SAAT INI (bulan berjalan) — hanya dihitung bila tenant menerapkan.
  const now = new Date();
  // L1 (K7): batas bulan menurut zona tenant (bawaan WIB), bukan zona server (M5).
  const { start: monthStart, end: monthEnd } = monthRangeInZone(now, tech.tenant?.timezone);
  let incentiveAmount = 0;
  if (incentiveEnabled) {
    const { computeIncentives } = await import("@/lib/services/incentive-service");
    incentiveAmount = (await computeIncentives(ctx.tenantId, monthStart, monthEnd)).find((i) => i.personId === tech.id)?.amount ?? 0;
  }
  const rp = (n: number) => "Rp" + n.toLocaleString("id-ID");
  const initials = ctx.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const todayLabel = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });

  return (
    <main className="min-h-screen bg-muted/40 pb-20">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-sky-500 text-sm font-bold text-white shadow-sm">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold leading-tight text-foreground">{ctx.name.split(" ")[0]}</h1>
            <p className="truncate text-xs text-muted-foreground">{todayLabel}</p>
          </div>
          <HelpButton topic={getHelpTopic("t-beranda")} />
          <ThemeToggle />
          <PushPermission />
        </div>
      </header>
      <div className="mx-auto max-w-md space-y-3 p-4">
        {incentiveEnabled ? (
          /* Tenant menerapkan insentif: kartu BIRU "Insentif bulan ini" (nilai boleh Rp0) → riwayat */
          <Link href="/t/riwayat" className="block">
            <div className="flex items-center justify-between rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 p-4 text-white shadow-sm transition active:brightness-95">
              <div>
                <p className="text-xs text-white/80">Insentif bulan ini</p>
                <p className="text-2xl font-bold tabular-nums">{rp(incentiveAmount)}</p>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-white/90">
                Lihat riwayat
                <Icon.ChevronRight className="h-4 w-4" aria-hidden />
              </div>
            </div>
          </Link>
        ) : (
          /* Tenant TANPA program insentif: kartu ringkasan BIRU (tanpa menyebut insentif) → riwayat */
          <Link href="/t/riwayat" className="block">
            <div className="flex items-center justify-between rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 p-4 text-white shadow-sm transition active:brightness-95">
              <div className="flex gap-6">
                <div>
                  <p className="text-xs text-white/80">Tugas hari ini</p>
                  <p className="text-2xl font-bold tabular-nums">{jobs.length}</p>
                </div>
                <div>
                  <p className="text-xs text-white/80">Selesai</p>
                  <p className="text-2xl font-bold tabular-nums">{doneCount}</p>
                </div>
                {backlogCount > 0 && (
                  <div>
                    <p className="text-xs text-white/80">Perlu ditindaklanjuti</p>
                    <p className="text-2xl font-bold tabular-nums">{backlogCount}{backlogCount > backlog.length ? "+" : ""}</p>
                  </div>
                )}
                {unpaidCash.length > 0 && (
                  <div>
                    <p className="text-xs text-white/80">Menunggu lunas</p>
                    <p className="text-2xl font-bold tabular-nums">{unpaidCash.length}</p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-sm text-white/90">
                Riwayat
                <Icon.ChevronRight className="h-4 w-4" aria-hidden />
              </div>
            </div>
          </Link>
        )}
        {jobs.length === 0 && backlog.length === 0 && unpaidCash.length === 0 ? (
          <Card className="border-dashed text-center">
            <CardContent className="p-8">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"><Icon.Success className="h-7 w-7" aria-hidden /></div>
              <p className="font-semibold text-foreground">Tidak ada pekerjaan hari ini</p>
              <p className="mt-1 text-sm text-muted-foreground">Santai dulu — tugas baru akan muncul di sini.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* F9d: daftar kerja aktif jadwalnya SUDAH lewat — "Perlu ditindaklanjuti".
                Pekerjaan tertunda tak boleh tersembunyi di riwayat (laporan pemilik 2026-10-15). */}
            {backlog.length > 0 && (
              <section aria-label="Perlu ditindaklanjuti">
                <h2 className="mb-2 mt-4 flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
                  <Icon.Clock className="h-4 w-4" aria-hidden /> Perlu ditindaklanjuti ({backlogCount}{backlogCount > backlog.length ? "+" : ""})
                </h2>
                <div className="space-y-3">
                  {backlog.map((job) => (
                    <JobCard key={`backlog-${job.id}`} job={job} overdue />
                  ))}
                </div>
              </section>
            )}
            {unpaidCash.length > 0 && (
              <section aria-label="Menunggu pelunasan cash">
                <h2 className="mb-2 mt-4 text-sm font-semibold text-amber-700 dark:text-amber-400">
                  Menunggu pelunasan cash ({unpaidCash.length})
                </h2>
                <p className="mb-2 text-xs text-muted-foreground">Tandai LUNAS setelah uang diterima dari pelanggan.</p>
                <div className="space-y-3">
                  {unpaidCash.map((job) => (
                    <JobCard key={`cash-${job.id}`} job={job} overdue unpaidCash />
                  ))}
                </div>
              </section>
            )}
            {jobs.length > 0 && (
              <section aria-label="Tugas hari ini">
                {backlog.length > 0 && (
                  <h2 className="mb-2 mt-4 text-sm font-semibold text-foreground">Hari ini</h2>
                )}
                <div className="space-y-3">
                  {jobs.map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

/** F9d: kartu pekerjaan (dipakai "Hari ini" & "Perlu ditindaklanjuti") — pola
 *  kartu beranda yang sudah ada; flag `overdue` menambah label telat. */
function JobCard({ job, overdue = false, unpaidCash = false }: {
  job: {
    id: string; status: JobStatus; windowStart: Date | null;
    scheduledDate: Date | null;
    customer: { name: string; address: string | null };
    asset: { brand: string | null; model: string | null; roomLocation: string | null } | null;
  };
  overdue?: boolean;
  /** F9d++/dual status: kartu kelompok "Menunggu pelunasan cash" — label
   *  status membawa posisi bayar (selesai dikerjakan, uang belum masuk). */
  unpaidCash?: boolean;
}) {
  return (
    <Link
      href={`/t/pekerjaan/${job.id}`}
      className="block rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition active:bg-muted/50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{job.customer.name}</p>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {job.asset ? `${job.asset.brand ?? "AC"} ${job.asset.model ?? ""}`.trim() : "Servis AC"}
            {job.asset?.roomLocation ? ` · ${job.asset.roomLocation}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${JOB_STATUS_COLOR[job.status]}`}>
            {unpaidCash ? "Selesai - Belum dibayar" : JOB_STATUS_LABEL[job.status]}
          </span>
          {overdue && (
            <p className="mt-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
              Lewat jadwal
            </p>
          )}
        </div>
      </div>
      {job.customer.address && (
        <p className="mt-2 flex items-start gap-1 text-sm text-muted-foreground">
          <Icon.Location className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span className="line-clamp-2">{job.customer.address}</span>
        </p>
      )}
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {job.scheduledDate
            ? new Date(job.scheduledDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })
            : job.windowStart
              ? new Date(job.windowStart).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
              : "Waktu fleksibel"}
        </span>
        <span className="font-medium text-sky-600">Buka →</span>
      </div>
    </Link>
  );
}
