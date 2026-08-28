import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { isTenantUsable } from "@/lib/billing/gating";
import { LogoutButton } from "./logout-button";
import { AppHeader } from "./_components/app-header";
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
    <>
      <AppHeader title="Ringkasan" action={<LogoutButton />} />
      <div className="mx-auto max-w-5xl space-y-6 p-5">
        {/* Greeting */}
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">{greeting}, {firstName} <Icon.Wave className="h-6 w-6 text-amber-500" aria-hidden /></h1>
          <p className="mt-1 text-sm text-muted-foreground">Ringkasan usaha AC Anda hari ini — {roleLabel} di {tenant?.name ?? "usaha Anda"}.</p>
        </div>

        {/* Metrics */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric icon={Icon.Job} label="Pekerjaan Hari Ini" value={todayJobs} tone="sky" href="/app/pekerjaan" />
          <Metric icon={Icon.Wrench} label="Sedang Berjalan" value={metrics.activeJobs} tone="slate" href="/app/pekerjaan" />
          <Metric icon={Icon.Bell} label="Pengingat Aktif" value={dueReminders} tone="violet" />
          <Metric icon={Icon.Zap} label="Peluang IoT" value={openAlerts} tone={openAlerts > 0 ? "amber" : "slate"} href="/app/perangkat" />
        </section>

        {/* Aksi cepat — pintasan ringkas; navigasi utama via menu samping */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Aksi Cepat</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <NavCard href="/app/pekerjaan" icon={Icon.Job} title="Pekerjaan" desc="Atur & pantau job" primary />
            <NavCard href="/app/pelanggan" icon={Icon.Users} title="Pelanggan" desc="Kelola data" />
            <NavCard href="/app/unit" icon={Icon.AC} title="Unit AC" desc="Kartu perawatan" />
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
  const tones = {
    sky: "border-sky-100 bg-sky-50 dark:border-sky-900/40 dark:bg-sky-950/30",
    violet: "border-violet-100 bg-violet-50 dark:border-violet-900/40 dark:bg-violet-950/30",
    amber: "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30",
    slate: "border-border bg-card",
  };
  const iconTones = {
    sky: "text-sky-500",
    violet: "text-violet-500",
    amber: "text-amber-500",
    slate: "text-muted-foreground",
  };
  const inner = (
    <div className={`rounded-2xl border p-4 ${tones[tone]} ${href ? "interactive" : ""}`}>
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
