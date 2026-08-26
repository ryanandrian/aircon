import { getDemoTenant } from "@/lib/demo";
import { prisma } from "@/lib/prisma";
import { listDueReminders } from "@/lib/services/reminder-service";
import Link from "next/link";
import { ReminderActions, CompleteJobButton } from "./ui";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function DemoDashboard() {
  const tenant = await getDemoTenant();
  if (!tenant) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="rounded-lg bg-amber-50 p-4 text-amber-800">
          Tenant demo belum di-seed. Jalankan <code>npx tsx prisma/seed.ts</code>.
        </p>
      </main>
    );
  }

  const [jobs, dueReminders, metrics, activeReminders] = await Promise.all([
    prisma.jobOrder.findMany({
      where: { tenantId: tenant.id },
      include: { customer: true, asset: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    listDueReminders(tenant.id),
    (async () => {
      const [total, completed, revenue] = await Promise.all([
        prisma.jobOrder.count({ where: { tenantId: tenant.id } }),
        prisma.jobOrder.count({ where: { tenantId: tenant.id, status: "COMPLETED" } }),
        prisma.jobOrder.aggregate({ where: { tenantId: tenant.id, status: "COMPLETED" }, _sum: { price: true } }),
      ]);
      return { total, completed, revenue: revenue._sum.price ?? 0 };
    })(),
    prisma.repeatReminder.count({ where: { tenantId: tenant.id, status: "QUEUED" } }),
  ]);

  const rupiah = (n: unknown) =>
    "Rp" + Number(n ?? 0).toLocaleString("id-ID");

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500 text-sm font-bold text-white">A</div>
            <div>
              <div className="text-sm font-semibold">{tenant.name}</div>
              <div className="text-xs text-slate-500">Mode Demo · Dashboard Owner</div>
            </div>
          </div>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">← Beranda</Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 p-6">
        {/* Metrics */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Total Job" value={String(metrics.total)} />
          <Metric label="Selesai" value={String(metrics.completed)} />
          <Metric label="Revenue" value={rupiah(metrics.revenue)} />
          <Metric label="Pengingat Aktif" value={String(activeReminders)} accent />
        </section>

        {/* Money Loop — reminder due */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-1 flex items-center gap-2">
            <h2 className="flex items-center gap-2 text-lg font-bold"><Icon.Money className="h-5 w-5 text-emerald-500" aria-hidden /> Pengingat Servis (Money Loop)</h2>
          </div>
          <p className="mb-4 text-sm text-slate-500">
            Customer yang sudah waktunya servis lagi. Kirim WhatsApp atau langsung buat job ulang.
          </p>
          {dueReminders.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
              Belum ada pengingat yang jatuh tempo. Selesaikan sebuah job di bawah untuk
              memicu pengingat (untuk demo, ubah tanggal servis berikutnya di seed).
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {dueReminders.map(({ reminder, asset }) => (
                <li key={reminder.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <div className="font-medium">{asset?.customer?.name ?? "Customer"}</div>
                    <div className="text-sm text-slate-500">
                      {asset?.brand ?? "AC"} · {asset?.roomLocation ?? "-"} · jatuh tempo{" "}
                      {reminder.dueDate.toISOString().slice(0, 10)}
                    </div>
                  </div>
                  <ReminderActions reminderId={reminder.id} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Jobs */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-lg font-bold">Job Terbaru</h2>
          <ul className="divide-y divide-slate-100">
            {jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <div className="font-medium">{j.customer.name} · {j.serviceType}</div>
                  <div className="text-sm text-slate-500">
                    {j.asset?.brand ?? "AC"}
                    {j.nextServiceDate ? ` · servis berikutnya ${j.nextServiceDate.toISOString().slice(0, 10)}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={j.status} />
                  {j.status !== "COMPLETED" && j.status !== "CANCELLED" && (
                    <CompleteJobButton jobId={j.id} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "border-sky-200 bg-sky-50" : "border-slate-200 bg-white"}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-600",
    ASSIGNED: "bg-blue-100 text-blue-700",
    IN_PROGRESS: "bg-emerald-100 text-emerald-700",
    COMPLETED: "bg-green-100 text-green-800",
    CANCELLED: "bg-slate-200 text-slate-500",
    RESCHEDULED: "bg-orange-100 text-orange-700",
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${map[status] ?? "bg-slate-100 text-slate-600"}`}>{status}</span>;
}
