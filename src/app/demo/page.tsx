import { getDemoTenant } from "@/lib/demo";
import { prisma } from "@/lib/prisma";
import { listDueReminders } from "@/lib/services/reminder-service";
import Link from "next/link";
import { ReminderActions, CompleteJobButton } from "./ui";
import { Icon } from "@/components/icons";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function DemoDashboard() {
  const tenant = await getDemoTenant();
  if (!tenant) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="rounded-lg bg-amber-50 p-4 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
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
    <main className="min-h-screen bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500 text-sm font-bold text-white">A</div>
            <div>
              <div className="text-sm font-semibold text-foreground">{tenant.name}</div>
              <div className="text-xs text-muted-foreground">Mode Demo · Dashboard Owner</div>
            </div>
          </div>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">← Beranda</Link>
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
        <Card>
          <CardContent className="p-5">
            <div className="mb-1 flex items-center gap-2">
              <h2 className="flex items-center gap-2 text-lg font-bold text-foreground"><Icon.Money className="h-5 w-5 text-emerald-500" aria-hidden /> Pengingat Servis (Money Loop)</h2>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Customer yang sudah waktunya servis lagi. Kirim WhatsApp atau langsung buat job ulang.
            </p>
            {dueReminders.length === 0 ? (
              <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                Belum ada pengingat yang jatuh tempo. Selesaikan sebuah job di bawah untuk
                memicu pengingat (untuk demo, ubah tanggal servis berikutnya di seed).
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {dueReminders.map(({ reminder, asset }) => (
                  <li key={reminder.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <div className="font-medium text-foreground">{asset?.customer?.name ?? "Customer"}</div>
                      <div className="text-sm text-muted-foreground">
                        {asset?.brand ?? "AC"} · {asset?.roomLocation ?? "-"} · jatuh tempo{" "}
                        {reminder.dueDate.toISOString().slice(0, 10)}
                      </div>
                    </div>
                    <ReminderActions reminderId={reminder.id} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Jobs */}
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-4 text-lg font-bold text-foreground">Job Terbaru</h2>
            <ul className="divide-y divide-border">
              {jobs.map((j) => (
                <li key={j.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <div className="font-medium text-foreground">{j.customer.name} · {j.serviceType}</div>
                    <div className="text-sm text-muted-foreground">
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
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-sky-200 bg-sky-50 dark:border-sky-900/40 dark:bg-sky-950/30" : ""}>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-xl font-bold text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "bg-muted text-muted-foreground",
    ASSIGNED: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
    IN_PROGRESS: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    COMPLETED: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300",
    CANCELLED: "bg-muted text-muted-foreground",
    RESCHEDULED: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${map[status] ?? "bg-muted text-muted-foreground"}`}>{status}</span>;
}
