import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { isTenantUsable } from "@/lib/billing/gating";
import { LogoutButton } from "./logout-button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AppDashboard() {
  const ctx = await tryGetServerContext();
  if (!ctx) {
    // Bedakan: belum login vs sudah login tapi belum punya usaha.
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=/app");
    // Sudah login tapi belum punya usaha → wizard setup.
    redirect("/onboarding");
  }

  // SECURITY: semua query tenant-scoped dari ctx.tenantId (session), bukan input.
  const [tenant, metrics, dueReminders] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: ctx.tenantId } }),
    (async () => {
      const [customers, jobs, completed] = await Promise.all([
        prisma.customer.count({ where: { tenantId: ctx.tenantId, deletedAt: null } }),
        prisma.jobOrder.count({ where: { tenantId: ctx.tenantId } }),
        prisma.jobOrder.count({ where: { tenantId: ctx.tenantId, status: "COMPLETED" } }),
      ]);
      return { customers, jobs, completed };
    })(),
    prisma.repeatReminder.count({ where: { tenantId: ctx.tenantId, status: "QUEUED" } }),
  ]);

  // Tenant dinonaktifkan → blok akses, arahkan ke langganan.
  if (tenant && !isTenantUsable(tenant.status)) {
    redirect("/app/langganan?status=nonaktif");
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500 text-sm font-bold text-white">A</div>
            <div>
              <div className="text-sm font-semibold">{tenant?.name ?? "Usaha Anda"}</div>
              <div className="text-xs text-slate-500">{ctx.name} · {ctx.role}</div>
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          ✓ Anda masuk sebagai <strong>{ctx.email ?? ctx.name}</strong>. Ini dashboard ber-autentikasi (data tenant Anda saja).
        </div>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Pelanggan" value={String(metrics.customers)} />
          <Metric label="Total Job" value={String(metrics.jobs)} />
          <Metric label="Selesai" value={String(metrics.completed)} />
          <Metric label="Pengingat Aktif" value={String(dueReminders)} accent />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold">Selamat datang di Aircon</h2>
          <p className="mt-2 text-sm text-slate-600">
            Modul yang sedang dibangun: Pelanggan &amp; Aset, Job Order, Penjadwalan,
            Pengingat servis (money loop), dan Smart HVAC IoT.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/demo" className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600">
              Lihat Demo Money Loop
            </Link>
            <Link href={`/p/${tenant?.slug ?? ""}`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Halaman Publik Usaha
            </Link>
          </div>
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
