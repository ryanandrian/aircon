import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { tryGetServerContext } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { getJob } from "@/lib/services/job-management-service";
import { getJobChecklist } from "@/lib/services/job-work-service";
import { isStorageConfigured } from "@/lib/storage/s3";
import { JOB_STATUS_LABEL, JOB_STATUS_COLOR } from "@/lib/copy/job-status";
import { TechJobWork } from "./work";

export const dynamic = "force-dynamic";

export default async function TechJobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await tryGetServerContext();
  if (!ctx) redirect(`/login?next=/t/pekerjaan/${id}`);

  const tech = await prisma.technician.findFirst({
    where: { tenantId: ctx.tenantId, userId: ctx.userId },
    select: { id: true },
  });
  if (!tech) redirect("/t");

  const job = await getJob(ctx.tenantId, id);
  if (!job || job.technicianId !== tech.id) notFound();

  const checklist = await getJobChecklist(ctx.tenantId, id);

  return (
    <main className="min-h-screen bg-slate-50 pb-28">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Link href="/t" className="text-slate-500" aria-label="Kembali">←</Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold">{job.customer.name}</h1>
            <p className="truncate text-xs text-slate-500">
              {job.asset ? `${job.asset.brand ?? "AC"} ${job.asset.model ?? ""}`.trim() : "Servis AC"}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${JOB_STATUS_COLOR[job.status]}`}>
            {JOB_STATUS_LABEL[job.status]}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-4 p-4">
        {/* Info pelanggan */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-500">Pelanggan</h2>
          <p className="mt-1 font-medium">{job.customer.name}</p>
          {job.customer.address && <p className="mt-0.5 text-sm text-slate-600">{job.customer.address}</p>}
          <div className="mt-3 flex gap-2">
            {job.customer.phone && (
              <a href={`tel:${job.customer.phone}`} className="flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-xl bg-slate-100 text-sm font-medium text-slate-700">
                📞 Telepon
              </a>
            )}
            {(job.geoLat && job.geoLng) || job.customer.address ? (
              <a
                href={job.geoLat && job.geoLng
                  ? `https://www.google.com/maps/search/?api=1&query=${job.geoLat},${job.geoLng}`
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.customer.address ?? "")}`}
                target="_blank" rel="noopener noreferrer"
                className="flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-xl bg-sky-100 text-sm font-medium text-sky-700"
              >
                🧭 Navigasi
              </a>
            ) : null}
          </div>
        </section>

        {job.notes && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-500">Catatan</h2>
            <p className="mt-1 text-sm text-slate-700">{job.notes}</p>
          </section>
        )}

        {/* Bagian kerja interaktif (checklist, foto, tombol status) */}
        <TechJobWork
          jobId={job.id}
          status={job.status}
          checklist={checklist}
          photos={job.photos.map((p) => ({ id: p.id, kind: p.kind, url: p.url }))}
          storageReady={isStorageConfigured()}
        />
      </div>
    </main>
  );
}
