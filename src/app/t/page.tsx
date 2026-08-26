import { redirect } from "next/navigation";
import Link from "next/link";
import { tryGetServerContext } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { listTechnicianJobsToday } from "@/lib/services/job-management-service";
import { JOB_STATUS_LABEL, JOB_STATUS_COLOR } from "@/lib/copy/job-status";
import { Icon } from "@/components/icons";

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
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-amber-800">Akun ini bukan teknisi. Hubungi pemilik usaha.</p>
          <Link href="/app" className="mt-3 inline-block text-sm text-sky-600 underline">Ke Dashboard</Link>
        </div>
      </main>
    );
  }

  const jobs = await listTechnicianJobsToday(ctx.tenantId, tech.id);

  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold">Halo, {ctx.name.split(" ")[0]}</h1>
            <p className="text-xs text-slate-500">Pekerjaan hari ini</p>
          </div>
          <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-semibold text-sky-700">{jobs.length}</span>
        </div>
      </header>
      <div className="mx-auto max-w-md space-y-3 p-4">
        {jobs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600"><Icon.Success className="h-7 w-7" aria-hidden /></div>
            <p className="font-semibold text-slate-900">Tidak ada pekerjaan hari ini</p>
            <p className="mt-1 text-sm text-slate-500">Santai dulu — tugas baru akan muncul di sini.</p>
          </div>
        ) : (
          jobs.map((job) => (
            <Link
              key={job.id}
              href={`/t/pekerjaan/${job.id}`}
              className="block rounded-2xl border border-slate-200 bg-white p-4 active:bg-slate-50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{job.customer.name}</p>
                  <p className="mt-0.5 truncate text-sm text-slate-500">
                    {job.asset ? `${job.asset.brand ?? "AC"} ${job.asset.model ?? ""}`.trim() : "Servis AC"}
                    {job.asset?.roomLocation ? ` · ${job.asset.roomLocation}` : ""}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${JOB_STATUS_COLOR[job.status]}`}>
                  {JOB_STATUS_LABEL[job.status]}
                </span>
              </div>
              {job.customer.address && (
                <p className="mt-2 flex items-start gap-1 text-sm text-slate-600">
                  <Icon.Location className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span className="line-clamp-2">{job.customer.address}</span>
                </p>
              )}
              <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
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
