import { redirect } from "next/navigation";
import Link from "next/link";
import { tryGetServerContext } from "@/lib/auth/context";
import { listJobs } from "@/lib/services/job-management-service";
import { SERVICE_TYPE_LABEL } from "@/lib/copy/terms";
import { StatusBadge } from "./status-badge";

export const dynamic = "force-dynamic";

type JobRow = Awaited<ReturnType<typeof listJobs>>["jobs"][number];

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatTanggal(d: Date | null): string {
  if (!d) return "Jadwal belum diatur";
  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatJam(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export default async function PekerjaanPage() {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/pekerjaan");
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") redirect("/app");

  // SECURITY: tenantId dari sesi; service sudah tenant-scoped.
  const { jobs } = await listJobs(ctx.tenantId, { limit: 100 });

  const today = startOfToday();
  const tomorrow = new Date(today.getTime() + DAY_MS);

  const hariIni: JobRow[] = [];
  const akanDatang: JobRow[] = [];
  const selesai: JobRow[] = [];

  for (const job of jobs) {
    if (job.status === "COMPLETED" || job.status === "CANCELLED") {
      selesai.push(job);
      continue;
    }
    const sched = job.scheduledDate;
    if (sched && sched >= today && sched < tomorrow) {
      hariIni.push(job);
    } else if (sched && sched >= tomorrow) {
      akanDatang.push(job);
    } else {
      // Belum terjadwal atau lewat & masih aktif → butuh perhatian hari ini.
      hariIni.push(job);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <Link href="/app" className="text-xs text-slate-500 hover:text-slate-800">
              ← Ringkasan
            </Link>
            <h1 className="text-lg font-bold text-slate-900">Pekerjaan</h1>
          </div>
          <Link
            href="/app/pekerjaan/baru"
            className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600"
          >
            + Pekerjaan
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-8 px-4 py-6 sm:px-6">
        {jobs.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <JobGroup title="Hari ini" emptyText="Tidak ada pekerjaan untuk hari ini." jobs={hariIni} />
            <JobGroup title="Akan datang" emptyText="Belum ada jadwal berikutnya." jobs={akanDatang} />
            <JobGroup title="Selesai" emptyText="Belum ada pekerjaan selesai." jobs={selesai} />
          </>
        )}
      </div>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-3xl">
        🧰
      </div>
      <h2 className="text-xl font-bold text-slate-900">Belum ada pekerjaan</h2>
      <p className="mx-auto mt-2 max-w-md text-slate-600">
        Catat pekerjaan pertama Anda — cuci AC, isi freon, atau perbaikan — lalu tugaskan ke teknisi.
      </p>
      <Link
        href="/app/pekerjaan/baru"
        className="mt-5 inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-sky-500 px-6 py-3 font-semibold text-white hover:bg-sky-600"
      >
        Buat Pekerjaan
      </Link>
    </div>
  );
}

function JobGroup({
  title,
  jobs,
  emptyText,
}: {
  title: string;
  jobs: JobRow[];
  emptyText: string;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <span className="text-xs font-medium text-slate-400">{jobs.length}</span>
      </div>
      {jobs.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-400">
          {emptyText}
        </p>
      ) : (
        <ul className="space-y-3">
          {jobs.map((job) => (
            <li key={job.id}>
              <JobCard job={job} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function JobCard({ job }: { job: JobRow }) {
  const jam = formatJam(job.scheduledDate);
  const teknisi = job.technician?.user.name ?? null;
  const unit = job.asset
    ? [job.asset.brand, job.asset.model].filter(Boolean).join(" ").trim() ||
      job.asset.roomLocation ||
      "Unit AC"
    : null;

  return (
    <Link
      href={`/app/pekerjaan/${job.id}`}
      className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-sky-300 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{job.customer.name}</p>
          <p className="mt-0.5 text-sm text-slate-500">
            {SERVICE_TYPE_LABEL[job.serviceType] ?? job.serviceType}
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      {job.customer.address && (
        <p className="mt-2 truncate text-sm text-slate-500">📍 {job.customer.address}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>🗓️ {formatTanggal(job.scheduledDate)}{jam ? ` · ${jam}` : ""}</span>
        {unit && <span>❄️ {unit}</span>}
        <span>👷 {teknisi ?? "Belum ada teknisi"}</span>
      </div>
    </Link>
  );
}
