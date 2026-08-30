import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { tryGetServerContext } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { getJob } from "@/lib/services/job-management-service";
import { getJobChecklist } from "@/lib/services/job-work-service";
import { isStorageConfigured } from "@/lib/storage/s3";
import { normalizePhone } from "@/lib/wa/gateway";
import { JOB_STATUS_LABEL, JOB_STATUS_COLOR } from "@/lib/copy/job-status";
import { TechJobWork } from "./work";
import { SaveLocationButton } from "./save-location";
import { Icon } from "@/components/icons";
import { Card, CardContent } from "@/components/ui/card";

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
    <main className="min-h-screen bg-muted/40 pb-28">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Link href="/t" className="text-muted-foreground" aria-label="Kembali">←</Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-foreground">{job.customer.name}</h1>
            <p className="truncate text-xs text-muted-foreground">
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
        <Card className="py-0">
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold text-muted-foreground">Pelanggan</h2>
            <p className="mt-1 font-medium text-foreground">{job.customer.name}</p>
            {job.customer.address && <p className="mt-0.5 text-sm text-muted-foreground">{job.customer.address}</p>}
            <div className="mt-3 grid grid-cols-3 gap-2">
              {job.customer.phone && (
                <a href={`https://wa.me/${normalizePhone(job.customer.phone)}`} target="_blank" rel="noopener noreferrer"
                  className="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl bg-emerald-500 text-[11px] font-medium leading-none text-white hover:bg-emerald-600">
                  <Icon.Message className="h-5 w-5" aria-hidden /> <span className="whitespace-nowrap">WhatsApp</span>
                </a>
              )}
              {(job.geoLat && job.geoLng) || job.customer.address ? (
                <a
                  href={job.geoLat && job.geoLng
                    ? `https://www.google.com/maps/search/?api=1&query=${job.geoLat},${job.geoLng}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.customer.address ?? "")}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl bg-sky-100 text-[11px] font-medium leading-none text-sky-700 hover:bg-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-900/60"
                >
                  <Icon.Navigate className="h-5 w-5" aria-hidden /> <span className="whitespace-nowrap">Navigasi</span>
                </a>
              ) : null}
              <SaveLocationButton jobId={job.id} hasLocation={Boolean(job.customer.geoLat && job.customer.geoLng)} />
            </div>
          </CardContent>
        </Card>

        {/* Mulai pengerjaan → WorkSession (K8): entry per unit → invoice/proforma */}
        <a href={`/t/kerja/${job.customerId}?job=${job.id}`}
          className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-sky-500 font-semibold text-white hover:bg-sky-600">
          <Icon.Job className="h-5 w-5" aria-hidden /> Catat Pekerjaan & Buat Tagihan
        </a>

        {job.notes && (
          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold text-muted-foreground">Catatan</h2>
              <p className="mt-1 text-sm text-foreground">{job.notes}</p>
            </CardContent>
          </Card>
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
