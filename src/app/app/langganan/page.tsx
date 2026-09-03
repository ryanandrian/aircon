import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { getActivePlans, getBillingPolicy, withTax } from "@/lib/billing/config";
import { formatIDR } from "@/lib/billing/plans";
import { isMidtransConfigured } from "@/lib/billing/midtrans-client";
import { PlanCards } from "./plan-cards";
import { AppHeader } from "../_components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  TRIAL: "Masa Coba",
  ACTIVE: "Aktif",
  PAST_DUE: "Menunggu Pembayaran",
  SUSPENDED: "Dinonaktifkan",
  CANCELLED: "Berhenti",
};

export default async function LanggananPage() {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/langganan");

  const [tenant, plans, policy, payments] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: ctx.tenantId } }),
    getActivePlans(),
    getBillingPolicy(),
    prisma.payment.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);
  if (!tenant) redirect("/login");

  const configured = isMidtransConfigured();
  const isOwner = ctx.role === "OWNER";
  const currentPlanName =
    plans.find((p) => p.plan === tenant.plan)?.displayName ?? tenant.plan;

  const trialInfo =
    tenant.plan === "TRIAL" && !tenant.nextDueDate
      ? "Anda di paket Basic — gratis selamanya. Upgrade kapan saja untuk menambah kuota pelanggan & unit."
      : tenant.nextDueDate
        ? `Jatuh tempo berikutnya ${tenant.nextDueDate.toLocaleDateString("id-ID")}.`
        : null;

  const planViews = plans.map((p) => {
    const taxPercent = p.taxable ? policy.taxPercent : 0;
    const { total } = withTax(p.priceMonthly, taxPercent);
    return {
      id: p.plan,
      name: p.displayName,
      price: p.priceMonthly === 0 ? "Gratis" : formatIDR(p.priceMonthly),
      priceWithTax: p.priceMonthly === 0 ? "Gratis" : formatIDR(total),
      taxNote: p.taxable && p.priceMonthly > 0 ? `Termasuk pajak ${policy.taxPercent}%` : "",
      tagline: p.tagline ?? "",
      quotas: [
        p.maxAdmins === null ? "Admin tanpa batas" : `${p.maxAdmins} admin`,
        p.maxTechnicians === null ? "Teknisi tanpa batas" : `${p.maxTechnicians} teknisi (termasuk admin)`,
        p.maxCustomers === null ? "Pelanggan tanpa batas" : `${p.maxCustomers} pelanggan`,
        p.maxAcUnits === null ? "Unit AC tanpa batas" : `${p.maxAcUnits} unit AC`,
      ],
      isFree: p.priceMonthly === 0,
    };
  });

  return (
    <main className="min-h-screen">
      <AppHeader title="Paket Langganan" />

      <div className="mx-auto max-w-4xl space-y-6 px-5 py-6">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Paket saat ini</div>
                <div className="text-xl font-bold text-foreground">{currentPlanName}</div>
              </div>
              <Badge variant="secondary" className="bg-sky-100 px-3 py-1 text-sm text-sky-700 dark:bg-sky-950/50 dark:text-sky-400">
                {STATUS_LABEL[tenant.status] ?? tenant.status}
              </Badge>
            </div>
            {trialInfo && <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">{trialInfo}</p>}
          </CardContent>
        </Card>

        {!configured && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            Pembayaran online belum diaktifkan. Hubungi tim Aircon untuk berlangganan.
          </div>
        )}

        {!isOwner && (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              Hanya pemilik usaha yang dapat mengubah paket langganan.
            </CardContent>
          </Card>
        )}

        <PlanCards
          currentPlan={tenant.plan}
          canPay={configured && isOwner}
          plans={planViews}
        />

        {/* Riwayat pembayaran + faktur */}
        {payments.length > 0 && (
          <Card>
            <CardContent className="p-5">
              <h2 className="text-sm font-semibold text-muted-foreground">Riwayat Pembayaran</h2>
              <div className="mt-3 divide-y divide-border">
                {payments.map((p) => {
                  const paid = p.status === "PAID";
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">
                          Paket {p.plan} · {p.periodMonths} bln
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {(p.paidAt ?? p.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold tabular-nums text-foreground/80">Rp {p.amount.toLocaleString("id-ID")}</span>
                        <Badge variant="secondary" className={
                          paid ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400" : p.status === "PENDING" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400" : "bg-muted text-muted-foreground"
                        }>
                          {paid ? "Lunas" : p.status === "PENDING" ? "Menunggu" : p.status}
                        </Badge>
                        <Link href={`/app/langganan/faktur/${p.id}`} className={buttonVariants({ variant: "ghost", size: "xs", className: "text-sky-600 dark:text-sky-400" })}>
                          {paid ? "Kwitansi" : "Faktur"} →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
