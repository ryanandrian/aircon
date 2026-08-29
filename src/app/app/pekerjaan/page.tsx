import { redirect } from "next/navigation";
import Link from "next/link";
import { tryGetServerContext } from "@/lib/auth/context";
import { listJobs } from "@/lib/services/job-management-service";
import { SERVICE_TYPE_LABEL } from "@/lib/copy/terms";
import { StatusBadge } from "./status-badge";
import { Icon } from "@/components/icons";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { AppHeader } from "../_components/app-header";

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
    <main className="min-h-screen bg-muted/40 pb-16">
      <AppHeader
        title="Pekerjaan"
        action={
          <Link
            href="/app/pekerjaan/baru"
            className={buttonVariants({ size: "sm", className: "bg-sky-500 text-white hover:bg-sky-600" })}
          >
            + Pekerjaan
          </Link>
        }
      />

      <div className="mx-auto max-w-4xl space-y-8 px-5 py-6">
        {jobs.length === 0 ? (
          <EmptyState
            icon={Icon.Job}
            title="Belum ada pekerjaan"
            desc="Mulai dari sini — catat pekerjaan pertama Anda (cuci AC, isi freon, atau perbaikan), lalu tugaskan ke teknisi."
            actionHref="/app/pekerjaan/baru"
            actionLabel="+ Buat Pekerjaan"
          />
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
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        <span className="text-xs font-medium text-muted-foreground">{jobs.length}</span>
      </div>
      {jobs.length === 0 ? (
        <Card>
          <CardContent className="px-4 py-5 text-sm text-muted-foreground">
            {emptyText}
          </CardContent>
        </Card>
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
      className="block rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition hover:ring-sky-300 hover:shadow-sm dark:hover:ring-sky-800"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{job.customer.name}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {SERVICE_TYPE_LABEL[job.serviceType] ?? job.serviceType}
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      {job.customer.address && (
        <p className="mt-2 flex items-center gap-1.5 truncate text-sm text-muted-foreground"><Icon.Location className="h-3.5 w-3.5 shrink-0" aria-hidden /> {job.customer.address}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><Icon.Calendar className="h-3.5 w-3.5" aria-hidden /> {formatTanggal(job.scheduledDate)}{jam ? ` · ${jam}` : ""}</span>
        {unit && <span className="flex items-center gap-1.5"><Icon.AC className="h-3.5 w-3.5" aria-hidden /> {unit}</span>}
        <span className="flex items-center gap-1.5"><Icon.Technician className="h-3.5 w-3.5" aria-hidden /> {teknisi ?? "Belum ada teknisi"}</span>
      </div>
    </Link>
  );
}
