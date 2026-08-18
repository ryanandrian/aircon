import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { isTenantUsable } from "@/lib/billing/gating";
import { LogoutButton } from "./logout-button";
import Link from "next/link";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function AppDashboard() {
  const ctx = await tryGetServerContext();
  if (!ctx) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=/app");
    redirect("/onboarding");
  }

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  // SECURITY: semua query tenant-scoped dari ctx.tenantId (session), bukan input.
  const [tenant, metrics, dueReminders, openAlerts, todayJobs] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: ctx.tenantId } }),
    (async () => {
      const [customers, activeJobs, completed] = await Promise.all([
        prisma.customer.count({ where: { tenantId: ctx.tenantId, deletedAt: null } }),
        prisma.jobOrder.count({ where: { tenantId: ctx.tenantId, status: { in: ["ASSIGNED", "ACCEPTED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS", "WAITING"] } } }),
        prisma.jobOrder.count({ where: { tenantId: ctx.tenantId, status: "COMPLETED" } }),
      ]);
      return { customers, activeJobs, completed };
    })(),
    prisma.repeatReminder.count({ where: { tenantId: ctx.tenantId, status: "QUEUED" } }),
    prisma.alert.count({ where: { tenantId: ctx.tenantId, status: { in: ["OPEN", "ACK"] } } }),
    prisma.jobOrder.count({ where: { tenantId: ctx.tenantId, scheduledDate: { gte: todayStart, lte: todayEnd }, status: { notIn: ["CANCELLED", "COMPLETED"] } } }),
  ]);

  if (tenant && !isTenantUsable(tenant.status)) {
    redirect("/app/langganan?status=nonaktif");
  }

  const firstName = ctx.name.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 19 ? "Selamat sore" : "Selamat malam";
  const roleLabel = { OWNER: "Pemilik", ADMIN: "Admin", TECHNICIAN: "Teknisi", CUSTOMER: "Pelanggan" }[ctx.role] ?? ctx.role;

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2.5">
            <Image src="/brand/aircon-logo.png" alt="Aircon" width={34} height={34} className="h-8 w-8 object-contain" priority />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-slate-900">{tenant?.name ?? "Usaha Anda"}</div>
              <div className="text-xs text-slate-500">{roleLabel}</div>
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 p-5">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{greeting}, {firstName} 👋</h1>
          <p className="mt-1 text-sm text-slate-500">Ringkasan usaha AC Anda hari ini.</p>
        </div>

        {/* Metrics */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric icon="📋" label="Pekerjaan Hari Ini" value={todayJobs} tone="sky" href="/app/pekerjaan" />
          <Metric icon="🔧" label="Sedang Berjalan" value={metrics.activeJobs} tone="slate" href="/app/pekerjaan" />
          <Metric icon="🔔" label="Pengingat Aktif" value={dueReminders} tone="violet" />
          <Metric icon="⚡" label="Peluang IoT" value={openAlerts} tone={openAlerts > 0 ? "amber" : "slate"} href="/app/perangkat" />
        </section>

        {/* Aksi cepat */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-500">Menu</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <NavCard href="/app/pekerjaan" icon="📋" title="Pekerjaan" desc="Atur & pantau job teknisi" primary />
            <NavCard href="/app/teknisi" icon="👷" title="Teknisi" desc="Undang & kelola tim" />
            <NavCard href="/app/perangkat" icon="📡" title="Pemantauan AC" desc="Sensor & peluang servis" badge={openAlerts > 0 ? openAlerts : undefined} />
            <NavCard href="/t" icon="📱" title="Mode Teknisi" desc="Kerjakan job di lapangan" />
            <NavCard href="/app/langganan" icon="💳" title="Langganan" desc="Paket & pembayaran" />
            <NavCard href={`/p/${tenant?.slug ?? ""}`} icon="🌐" title="Halaman Usaha" desc="Terima booking online" external />
          </div>
        </section>

        {/* Tip money loop */}
        <section className="overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-lg text-white">🔁</div>
            <div>
              <h3 className="font-semibold text-slate-900">Pelanggan Datang Lagi</h3>
              <p className="mt-1 text-sm text-slate-600">
                Setiap pekerjaan selesai otomatis membuat pengingat servis berikutnya. Saat waktunya tiba, pelanggan dikabari lewat WhatsApp — servis berulang tanpa Anda harus mengingat-ingat.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ icon, label, value, tone, href }: {
  icon: string; label: string; value: number; tone: "sky" | "violet" | "amber" | "slate"; href?: string;
}) {
  const tones = {
    sky: "border-sky-100 bg-sky-50",
    violet: "border-violet-100 bg-violet-50",
    amber: "border-amber-200 bg-amber-50",
    slate: "border-slate-200 bg-white",
  };
  const inner = (
    <div className={`rounded-2xl border p-4 transition ${tones[tone]} ${href ? "hover:shadow-sm active:scale-[0.98]" : ""}`}>
      <div className="text-lg">{icon}</div>
      <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{value}</div>
      <div className="mt-0.5 text-xs font-medium text-slate-500">{label}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function NavCard({ href, icon, title, desc, primary, badge, external }: {
  href: string; icon: string; title: string; desc: string; primary?: boolean; badge?: number; external?: boolean;
}) {
  return (
    <Link
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`group relative flex flex-col rounded-2xl border p-4 transition active:scale-[0.98] ${
        primary
          ? "border-sky-200 bg-white shadow-sm ring-1 ring-sky-100 hover:ring-sky-200"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      {badge ? (
        <span className="absolute right-3 top-3 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-bold text-white">
          {badge}
        </span>
      ) : null}
      <span className="text-2xl">{icon}</span>
      <span className="mt-2 font-semibold text-slate-900">{title}</span>
      <span className="mt-0.5 text-xs text-slate-500">{desc}</span>
    </Link>
  );
}
