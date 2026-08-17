import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { PLANS, formatIDR } from "@/lib/billing/plans";
import { isMidtransConfigured } from "@/lib/billing/midtrans-client";
import { PlanCards } from "./plan-cards";
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

  const tenant = await prisma.tenant.findUnique({ where: { id: ctx.tenantId } });
  if (!tenant) redirect("/login");

  const configured = isMidtransConfigured();
  const isOwner = ctx.role === "OWNER";

  const trialInfo =
    tenant.status === "TRIAL" && tenant.trialEndsAt
      ? `Masa coba gratis berakhir ${tenant.trialEndsAt.toLocaleDateString("id-ID")}.`
      : null;

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-bold">Paket Langganan</h1>
          <Link href="/app" className="text-sm text-slate-500 hover:text-slate-800">← Ringkasan</Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">Paket saat ini</div>
              <div className="text-xl font-bold">{PLANS[tenant.plan].name}</div>
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
          plans={Object.values(PLANS).map((p) => ({
            id: p.id,
            name: p.name,
            price: formatIDR(p.priceMonthly),
            tagline: p.tagline,
            highlights: p.highlights,
          }))}
        />
      </div>
    </main>
  );
}
