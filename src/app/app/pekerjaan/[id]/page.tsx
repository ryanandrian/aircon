import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { tryGetServerContext } from "@/lib/auth/context";
import { getJob } from "@/lib/services/job-management-service";
import { getJobCost } from "@/lib/services/worksession-service";
import { prisma } from "@/lib/prisma";
import { JOB_STATUS_LABEL, SERVICE_TYPE_LABEL } from "@/lib/copy/terms";
import { StatusBadge } from "../status-badge";
import { OwnerActions } from "./owner-actions";
import { NotesEditor } from "./notes-editor";
import { Card, CardContent } from "@/components/ui/card";
import { HelpButton } from "@/components/help/help-button";
import { getHelpTopic } from "@/lib/help/help-content";

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

  // Biaya resmi utk baris "Biaya" — dibaca dari WorkSession/WorkItem + Invoice
  // (jalur alur teknisi → closing → tagihan), TIDAK dari JobOrder.price.
  const cost = await getJobCost(ctx.tenantId, id);

  // Tim yang ditugaskan (multi-personel, peran cair — F3.3).
  const { listAssignments } = await import("@/lib/services/assignment-service");
  const roster = await listAssignments(ctx.tenantId, id);
  // B (audit 2026-10-04): job lama (5 di DB) punya JobOrder.technicianId tanpa baris
  // JobAssignment — tanpa fallback ini baris "Tim" salah menampilkan "Belum ditugaskan".
  const team = roster.length > 0
    ? roster
    : job.technician
      ? [{ personId: job.technician.id, name: job.technician.user.name, roleOnJob: "TECHNICIAN" as const, isLead: true }]
      : [];

  const unit = job.asset
    ? [job.asset.brand, job.asset.model].filter(Boolean).join(" ").trim() || "Unit AC"
    : null;
  const jam = fmtJam(job.scheduledDate);
  const todayStr = new Date().toISOString().slice(0, 10);
  const defaultDate = job.scheduledDate
    ? new Date(job.scheduledDate).toISOString().slice(0, 10)
    : todayStr;

  return (
    <main className="min-h-screen pb-16">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3">
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
          <div className="flex items-center gap-1.5">
            <HelpButton topic={getHelpTopic("pekerjaan-detail")} />
            <StatusBadge status={job.status} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-5 px-5 py-6">
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

        {/* Jadwal & tim — view (baris data) + edit (panel OwnerActions) dalam SATU kartu */}
        <Card>
          <CardContent className="p-5">
            <h2 className="text-base font-bold text-foreground">Jadwal &amp; Tim</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-muted-foreground">Jadwal</dt>
                <dd className="text-right font-medium text-foreground">
                  {job.scheduledDate ? (
                    `${fmtTanggal(job.scheduledDate)}${jam ? ` · ${jam}` : ""}`
                  ) : (
                    <span className="flex flex-col items-end gap-1">
                      {/* Poin 4: nyatakan keadaan (Belum terjadwal) + tunjukkan tempat
                          menetapkannya; "hari ini" di panel hanyalah saran sampai disimpan. */}
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                        Belum terjadwal
                      </span>
                      {/* CTA hanya bila panel di bawah ikut dirender (kondisi yang sama
                          dengan canAssign/canCancel) — status terminal: tanpa anchor. */}
                      {(ASSIGNABLE.includes(job.status) || CANCELLABLE.includes(job.status)) && (
                        <a
                          href="#jadwal-tim"
                          className="text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
                        >
                          Atur jadwal &amp; tim →
                        </a>
                      )}
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-0.5">
                <dt className="shrink-0 text-muted-foreground">Tim</dt>
                <dd className="text-right font-medium text-foreground">
                  {team.length === 0 ? "Belum ditugaskan" : (
                    <div className="flex flex-col items-end gap-0.5">
                      {team.map((m) => (
                        <span key={m.personId}>
                          {m.name}
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({m.roleOnJob === "TECHNICIAN" ? "Teknisi" : "Kernet"}{m.isLead ? ", lead" : ""})
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </dd>
              </div>
              {/* Keputusan: baris "Harga" (angka ketiga, tak mengalir ke tagihan) DIGANTI
                  "Biaya" dari jalur resmi yang sudah jalan: WorkItem snapshot → Invoice. */}
              <div className="flex justify-between gap-4 py-0.5">
                <dt className="shrink-0 text-muted-foreground">Biaya</dt>
                <dd className="text-right font-medium text-foreground">
                  {cost === null ? (
                    <span className="text-muted-foreground">Belum ada pekerjaan tercatat</span>
                  ) : cost.invoice ? (
                    <span className="flex flex-col items-end gap-0.5">
                      <span>{fmtRupiah(cost.invoice.total)}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {cost.invoice.docType === "PROFORMA" ? "Proforma" : "Invoice"}
                        {Number(cost.invoice.discountAmount) > 0 ? " · sudah diskon" : ""}
                        {" · "}
                        <Link href={`/app/faktur/${cost.invoice.id}`} className="text-sky-600 hover:underline dark:text-sky-400">
                          lihat
                        </Link>
                      </span>
                    </span>
                  ) : (
                    <span className="flex flex-col items-end gap-0.5">
                      <span>{fmtRupiah(cost.subtotal)}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {cost.sessions.some((s) => s.status === "OPEN")
                          ? "Sedang dicatat teknisi"
                          : "Belum ditagih"}
                      </span>
                    </span>
                  )}
                </dd>
              </div>
            </dl>
            {/* Catatan — Poin 3: inline edit sebelum closing (guard status di server) */}
            <NotesEditor
              jobId={job.id}
              notes={job.notes}
              editable={job.status !== "COMPLETED" && job.status !== "CANCELLED"}
            />
            {/* Panel edit jadwal/tim — bagian dari kartu ini (keputusan gabung kartu) */}
            <OwnerActions
              jobId={job.id}
              canAssign={ASSIGNABLE.includes(job.status)}
              canCancel={CANCELLABLE.includes(job.status)}
              technicians={technicians}
              defaultDate={defaultDate}
              initialTeam={team.map((m) => ({ personId: m.personId, roleOnJob: m.roleOnJob }))}
            />
          </CardContent>
        </Card>

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
