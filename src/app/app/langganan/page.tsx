import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { getActivePlans, getBillingPolicy, withTax } from "@/lib/billing/config";
import { formatIDR } from "@/lib/billing/plans";
import { isMidtransConfigured } from "@/lib/billing/midtrans-client";
import { PlanCards } from "./plan-cards";
import { AppHeader } from "../_components/app-header";
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
    tenant.status === "TRIAL" && tenant.trialEndsAt
      ? `Masa coba gratis berakhir ${tenant.trialEndsAt.toLocaleDateString("id-ID")}.`
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
    <main className="min-h-screen bg-slate-50">
      <AppHeader title="Paket Langganan" />

      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">Paket saat ini</div>
              <div className="text-xl font-bold">{currentPlanName}</div>
            </div>
            <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">
              {STATUS_LABEL[tenant.status] ?? tenant.status}
            </span>
          </div>
          {trialInfo && <p className="mt-3 text-sm text-amber-600">{trialInfo}</p>}
        </div>

        {!configured && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Pembayaran online belum diaktifkan. Hubungi tim Aircon untuk berlangganan.
          </div>
        )}

        {!isOwner && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            Hanya pemilik usaha yang dapat mengubah paket langganan.
          </div>
        )}

        <PlanCards
          currentPlan={tenant.plan}
          canPay={configured && isOwner}
          plans={planViews}
        />

        {/* Riwayat pembayaran + faktur */}
        {payments.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-500">Riwayat Pembayaran</h2>
            <div className="mt-3 divide-y divide-slate-100">
              {payments.map((p) => {
                const paid = p.status === "PAID";
                return (
                  <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900">
                        Paket {p.plan} · {p.periodMonths} bln
                      </div>
                      <div className="text-xs text-slate-400">
                        {(p.paidAt ?? p.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold tabular-nums text-slate-700">Rp {p.amount.toLocaleString("id-ID")}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        paid ? "bg-emerald-100 text-emerald-700" : p.status === "PENDING" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                      }`}>
                        {paid ? "Lunas" : p.status === "PENDING" ? "Menunggu" : p.status}
                      </span>
                      <Link href={`/app/langganan/faktur/${p.id}`} className="text-xs font-medium text-sky-600 hover:text-sky-700">
                        {paid ? "Kwitansi" : "Faktur"} →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
