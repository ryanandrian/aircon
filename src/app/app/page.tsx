import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { isTenantUsable } from "@/lib/billing/gating";
import { LogoutButton } from "./logout-button";
import { AppHeader } from "./_components/app-header";
import { ServicedTrendChart } from "./_components/serviced-trend-chart";
import { WaConnectBanner } from "./_components/wa-connect-banner";
import { Icon } from "@/components/icons";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import type { ComponentType } from "react";

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
  const since30 = new Date(todayStart.getTime() - 29 * 24 * 60 * 60 * 1000); // termasuk hari ini = 30 hari

  // SECURITY: semua query tenant-scoped dari ctx.tenantId (session), bukan input.
  const [tenant, metrics, dueReminders, openAlerts, todayJobs, servicedJobs] = await Promise.all([
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
    // Unit dilayani 30 hari terakhir: pekerjaan selesai (tenant-scoped).
    prisma.jobOrder.findMany({
      where: { tenantId: ctx.tenantId, status: "COMPLETED", completedAt: { gte: since30, lte: todayEnd } },
      select: { completedAt: true },
    }),
  ]);

  // Agregasi harian unit dilayani (30 titik). Dihitung di server, bukan di klien.
  const dayMs = 24 * 60 * 60 * 1000;
  const trend: { label: string; value: number }[] = [];
  const bucket = new Map<string, number>();
  for (const j of servicedJobs) {
    if (!j.completedAt) continue;
    const d = new Date(j.completedAt); d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    bucket.set(key, (bucket.get(key) ?? 0) + 1);
  }
  for (let i = 0; i < 30; i++) {
    const d = new Date(since30.getTime() + i * dayMs);
    const key = d.toISOString().slice(0, 10);
    trend.push({ label: d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }), value: bucket.get(key) ?? 0 });
  }
  const trendTotal = trend.reduce((s, t) => s + t.value, 0);

  if (tenant && !isTenantUsable(tenant.status)) {
    redirect("/app/langganan?status=nonaktif");
  }

  return (
    <>
      <AppHeader title="Ringkasan" action={<LogoutButton />} helpKey="beranda" />
      <div className="mx-auto max-w-4xl space-y-6 px-5 py-6">
        <p className="text-sm text-muted-foreground">Ringkasan Kinerja Operasional Bisnis Anda</p>

        <WaConnectBanner />

        <ServicedTrendChart data={trend} total={trendTotal} />

        {/* Metrics */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric icon={Icon.Job} label="Pekerjaan Hari Ini" value={todayJobs} tone="sky" href="/app/pekerjaan" />
          <Metric icon={Icon.Wrench} label="Sedang Berjalan" value={metrics.activeJobs} tone="sky" href="/app/pekerjaan" />
          <Metric icon={Icon.Bell} label="Pengingat Aktif" value={dueReminders} tone="sky" />
          <Metric icon={Icon.Zap} label="Peluang IoT" value={openAlerts} tone={openAlerts > 0 ? "amber" : "sky"} href="/app/perangkat" />
        </section>

        {/* Aksi cepat — pintasan ringkas; navigasi utama via menu samping */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Aksi Cepat</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <NavCard href="/app/pekerjaan" icon={Icon.Job} title="Pekerjaan" desc="Atur & pantau job" primary />
            <NavCard href="/app/pelanggan" icon={Icon.Users} title="Pelanggan" desc="Kelola data" />
            <NavCard href="/app/unit" icon={Icon.Web} title="Kode QR" desc="Stiker & scan unit" />
            <NavCard href={`/p/${tenant?.slug ?? ""}`} icon={Icon.Web} title="Halaman Usaha" desc="Booking online" external />
          </div>
        </section>

        {/* Tip money loop */}
        <Card className="overflow-hidden border-sky-100 bg-gradient-to-br from-sky-50 to-background dark:border-sky-900/40 dark:from-sky-950/30">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white"><Icon.Repeat className="h-5 w-5" aria-hidden /></div>
              <div>
                <h3 className="font-semibold text-foreground">Pelanggan Datang Lagi</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Setiap pekerjaan selesai otomatis membuat pengingat servis berikutnya. Saat waktunya tiba, pelanggan dikabari lewat WhatsApp — servis berulang tanpa Anda harus mengingat-ingat.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Metric({ icon: IconCmp, label, value, tone, href }: {
  icon: ComponentType<{ className?: string }>; label: string; value: number; tone: "sky" | "violet" | "amber" | "slate"; href?: string;
}) {
  // Kartu SERAGAM (latar netral) — hanya ikon yang berwarna, agar tak ada kartu yang menonjol beda.
  const iconTones = {
    sky: "text-sky-500",
    violet: "text-violet-500",
    amber: "text-amber-500",
    slate: "text-muted-foreground",
  };
  const inner = (
    <div className={`rounded-2xl border border-border bg-card p-4 ${href ? "interactive" : ""}`}>
      <div className={iconTones[tone]}><IconCmp className="h-6 w-6" /></div>
      <div className="mt-2 text-2xl font-bold tabular-nums text-foreground">{value}</div>
      <div className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function NavCard({ href, icon: IconCmp, title, desc, primary, badge, external }: {
  href: string; icon: ComponentType<{ className?: string }>; title: string; desc: string; primary?: boolean; badge?: number; external?: boolean;
}) {
  return (
    <Link
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`group interactive relative flex flex-col rounded-2xl border p-4 ${
        primary
          ? "border-sky-200 bg-card shadow-sm ring-1 ring-sky-100 hover:ring-sky-200 dark:border-sky-900/50 dark:ring-sky-900/40"
          : "border-border bg-card hover:border-sky-200 dark:hover:border-sky-900/50"
      }`}
    >
      {badge ? (
        <span className="absolute right-3 top-3 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-bold text-white">
          {badge}
        </span>
      ) : null}
      <span className="text-sky-500"><IconCmp className="h-6 w-6" /></span>
      <span className="mt-2 font-semibold text-foreground">{title}</span>
      <span className="mt-0.5 text-xs text-muted-foreground">{desc}</span>
    </Link>
  );
}
