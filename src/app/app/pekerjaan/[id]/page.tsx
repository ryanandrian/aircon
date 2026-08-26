import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { tryGetServerContext } from "@/lib/auth/context";
import { getJob } from "@/lib/services/job-management-service";
import { prisma } from "@/lib/prisma";
import { JOB_STATUS_LABEL, SERVICE_TYPE_LABEL } from "@/lib/copy/terms";
import { StatusBadge } from "../status-badge";
import { OwnerActions } from "./owner-actions";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/** Status di mana pekerjaan masih boleh di-assign/batalkan oleh owner. */
const ASSIGNABLE: string[] = ["DRAFT", "ASSIGNED"];
const CANCELLABLE: string[] = [
  "DRAFT",
  "ASSIGNED",
  "ACCEPTED",
  "EN_ROUTE",
  "ARRIVED",
  "IN_PROGRESS",
  "WAITING",
];

function fmtTanggal(d: Date | null): string {
  if (!d) return "Belum diatur";
  return new Date(d).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtJam(d: Date | null): string | null {
  if (!d) return null;
  return new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function fmtWaktu(d: Date): string {
  return new Date(d).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtRupiah(price: unknown): string {
  const n = Number(price);
  if (Number.isNaN(n)) return "—";
  return "Rp" + n.toLocaleString("id-ID");
}

export default async function PekerjaanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ctx = await tryGetServerContext();
  if (!ctx) redirect(`/login?next=/app/pekerjaan/${id}`);
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") redirect("/app");

  // SECURITY: tenantId dari sesi; service sudah tenant-scoped.
  const job = await getJob(ctx.tenantId, id);
  if (!job) notFound();

  // Daftar teknisi tenant untuk aksi assign (tenant-scoped).
  const technicianRows = await prisma.technician.findMany({
    where: { tenantId: ctx.tenantId, active: true },
    select: { id: true, user: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const technicians = technicianRows.map((t) => ({ id: t.id, name: t.user.name }));

  const unit = job.asset
    ? [job.asset.brand, job.asset.model].filter(Boolean).join(" ").trim() || "Unit AC"
    : null;
  const jam = fmtJam(job.scheduledDate);
  const todayStr = new Date().toISOString().slice(0, 10);
  const defaultDate = job.scheduledDate
    ? new Date(job.scheduledDate).toISOString().slice(0, 10)
    : todayStr;

  return (
    <main className="min-h-screen bg-muted/40 pb-16">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <Link
              href="/app/pekerjaan"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ← Semua Pekerjaan
            </Link>
            <h1 className="text-lg font-bold text-foreground">
              {SERVICE_TYPE_LABEL[job.serviceType] ?? job.serviceType}
            </h1>
          </div>
          <StatusBadge status={job.status} />
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
        {/* Pelanggan */}
        <Card>
          <CardContent className="p-5">
            <h2 className="text-base font-bold text-foreground">Pelanggan</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Nama" value={job.customer.name} />
              <Row label="Telepon" value={job.customer.phone ?? "—"} />
              <Row label="Alamat" value={job.addressSnapshot ?? job.customer.address ?? "—"} />
            </dl>
          </CardContent>
        </Card>

        {/* Unit AC */}
        <Card>
          <CardContent className="p-5">
            <h2 className="text-base font-bold text-foreground">Unit AC</h2>
            {job.asset ? (
              <dl className="mt-3 space-y-2 text-sm">
                <Row label="Unit" value={unit ?? "—"} />
                <Row label="Lokasi" value={job.asset.roomLocation ?? "—"} />
                <Row label="Tipe" value={job.asset.type ?? "—"} />
              </dl>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Tidak terkait unit AC tertentu.</p>
            )}
          </CardContent>
        </Card>

        {/* Jadwal & teknisi */}
        <Card>
          <CardContent className="p-5">
            <h2 className="text-base font-bold text-foreground">Jadwal &amp; Teknisi</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row
                label="Jadwal"
                value={`${fmtTanggal(job.scheduledDate)}${jam ? ` · ${jam}` : ""}`}
              />
              <Row label="Teknisi" value={job.technician?.user.name ?? "Belum ditugaskan"} />
              <Row label="Harga" value={job.price != null ? fmtRupiah(job.price) : "—"} />
            </dl>
            {job.notes && (
              <div className="mt-3 rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Catatan: </span>
                {job.notes}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Aksi owner */}
        <OwnerActions
          jobId={job.id}
          canAssign={ASSIGNABLE.includes(job.status)}
          canCancel={CANCELLABLE.includes(job.status)}
          technicians={technicians}
          defaultDate={defaultDate}
        />

        {/* Foto */}
        <Card>
          <CardContent className="p-5">
            <h2 className="text-base font-bold text-foreground">Foto</h2>
            {job.photos.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Belum ada foto.</p>
            ) : (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {job.photos.map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={p.id}
                    src={p.url}
                    alt={`Foto ${p.kind} pekerjaan`}
                    className="aspect-square w-full rounded-xl object-cover"
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardContent className="p-5">
            <h2 className="text-base font-bold text-foreground">Riwayat</h2>
            {job.events.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Belum ada riwayat.</p>
            ) : (
              <ol className="mt-3 space-y-3">
                {job.events.map((ev) => (
                  <li key={ev.id} className="flex gap-3">
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                    <div className="text-sm">
                      <p className="font-medium text-foreground">
                        {JOB_STATUS_LABEL[ev.toStatus] ?? ev.toStatus}
                      </p>
                      <p className="text-xs text-muted-foreground">{fmtWaktu(ev.at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
