import { redirect } from "next/navigation";
import Link from "next/link";
import { tryGetServerContext } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { listTechnicianJobsToday } from "@/lib/services/job-management-service";
import { JOB_STATUS_LABEL, JOB_STATUS_COLOR } from "@/lib/copy/job-status";
import { Icon } from "@/components/icons";
import { Card, CardContent } from "@/components/ui/card";

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

  // Insentif teknisi bulan ini (K5/K6, F6.3).
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const { computeIncentives } = await import("@/lib/services/incentive-service");
  const allInc = await computeIncentives(ctx.tenantId, monthStart, monthEnd);
  const myInc = allInc.find((i) => i.personId === tech.id);
  const rp = (n: number) => "Rp" + n.toLocaleString("id-ID");

  return (
    <main className="min-h-screen bg-muted/40 pb-20">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold text-foreground">Halo, {ctx.name.split(" ")[0]}</h1>
            <p className="text-xs text-muted-foreground">Pekerjaan hari ini</p>
          </div>
          <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-semibold text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">{jobs.length}</span>
        </div>
      </header>
      <div className="mx-auto max-w-md space-y-3 p-4">
        {/* Insentif bulan ini (F6.3) */}
        <Card className="border-sky-200 bg-sky-50/60 dark:border-sky-900/40 dark:bg-sky-950/20">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">Insentif bulan ini</p>
              <p className="text-xl font-bold text-sky-600">{rp(myInc?.amount ?? 0)}</p>
            </div>
            <p className="text-xs text-muted-foreground">{myInc?.itemCount ?? 0} pekerjaan</p>
          </CardContent>
        </Card>
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
