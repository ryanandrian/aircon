import { redirect } from "next/navigation";
import Link from "next/link";
import { tryGetServerContext } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { listTechnicianJobsToday } from "@/lib/services/job-management-service";
import { JOB_STATUS_LABEL, JOB_STATUS_COLOR } from "@/lib/copy/job-status";
import { Icon } from "@/components/icons";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

export default async function TechnicianHome() {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/t");

  const tech = await prisma.technician.findFirst({
    where: { tenantId: ctx.tenantId, userId: ctx.userId },
    select: { id: true },
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

  const jobs = await listTechnicianJobsToday(ctx.tenantId, tech.id);
  const doneCount = jobs.filter((j) => j.status === "COMPLETED").length;

  // Insentif teknisi bulan ini (K5/K6, F6.3).
  const { computeIncentives } = await import("@/lib/services/incentive-service");
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const myInc = (await computeIncentives(ctx.tenantId, monthStart, monthEnd)).find((i) => i.personId === tech.id);
  const incentiveAmount = myInc?.amount ?? 0;
  // Hide kartu insentif bila 0 (tenant tanpa program insentif, ATAU teknisi belum dapat bulan ini).
  const showIncentive = incentiveAmount > 0;
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
          <ThemeToggle />
        </div>
      </header>
      <div className="mx-auto max-w-md space-y-3 p-4">
        {showIncentive ? (
          /* Ada insentif bulan ini: kartu insentif → ketuk untuk riwayat + insentif per pekerjaan */
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
          /* Insentif 0: kartu ringkasan hari ini → tetap jadi entry point ke riwayat pekerjaan */
          <Link href="/t/riwayat" className="block">
            <div className="flex items-center justify-between rounded-2xl bg-gradient-to-br from-slate-700 to-slate-600 p-4 text-white shadow-sm transition active:brightness-95 dark:from-slate-800 dark:to-slate-700">
              <div className="flex gap-5">
                <div>
                  <p className="text-xs text-white/80">Tugas hari ini</p>
                  <p className="text-2xl font-bold tabular-nums">{jobs.length}</p>
                </div>
                <div>
                  <p className="text-xs text-white/80">Selesai</p>
                  <p className="text-2xl font-bold tabular-nums">{doneCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-white/90">
                Riwayat
                <Icon.ChevronRight className="h-4 w-4" aria-hidden />
              </div>
            </div>
          </Link>
        )}
        {jobs.length === 0 ? (
          <Card className="border-dashed text-center">
            <CardContent className="p-8">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"><Icon.Success className="h-7 w-7" aria-hidden /></div>
              <p className="font-semibold text-foreground">Tidak ada pekerjaan hari ini</p>
              <p className="mt-1 text-sm text-muted-foreground">Santai dulu — tugas baru akan muncul di sini.</p>
            </CardContent>
          </Card>
        ) : (
          jobs.map((job) => (
            <Link
              key={job.id}
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
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${JOB_STATUS_COLOR[job.status]}`}>
                  {JOB_STATUS_LABEL[job.status]}
                </span>
              </div>
              {job.customer.address && (
                <p className="mt-2 flex items-start gap-1 text-sm text-muted-foreground">
                  <Icon.Location className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span className="line-clamp-2">{job.customer.address}</span>
                </p>
              )}
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {job.windowStart
                    ? new Date(job.windowStart).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
                    : "Waktu fleksibel"}
                </span>
                <span className="font-medium text-sky-600">Buka →</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
