import { redirect, notFound } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { getCustomer, ServiceError } from "@/lib/services/customer-service";
import { listAssetsByCustomer } from "@/lib/services/asset-service";
import { getOrCreateCardToken } from "@/lib/services/customer-card-service";
import { listCustomerPricing } from "@/lib/services/service-catalog-service";
import { listJobs } from "@/lib/services/job-management-service";
import { appBaseUrl } from "@/lib/unit-code/urls";
import { AppHeader } from "../../_components/app-header";
import { CustomerHub } from "./customer-hub";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await tryGetServerContext();
  if (!ctx) redirect(`/login?next=/app/pelanggan/${id}`);

  let customer;
  try {
    customer = await getCustomer(ctx.tenantId, id);
  } catch (e) {
    if (e instanceof ServiceError && e.code === "NOT_FOUND") notFound();
    throw e;
  }

  const [assets, cardToken, pricing, jobsRes] = await Promise.all([
    listAssetsByCustomer(ctx.tenantId, id),
    getOrCreateCardToken(ctx.tenantId, id),
    listCustomerPricing(ctx.tenantId, id).catch(() => []),
    listJobs(ctx.tenantId, { customerId: id }).catch(() => ({ jobs: [] })),
  ]);
  const jobs = jobsRes.jobs ?? [];

  const cardUrl = cardToken ? `${appBaseUrl()}/riwayat/${cardToken}` : null;

  return (
    <main className="min-h-screen bg-background pb-16">
      <AppHeader title={customer.name} back="/app/pelanggan" />
      <div className="mx-auto max-w-4xl space-y-6 px-5 py-6">
        <CustomerHub
          customer={{
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            address: customer.address ?? null,
            customerType: customer.customerType,
          }}
          assets={assets.map((a) => ({
            id: a.id,
            brand: a.brand,
            model: a.model,
            type: a.type,
            capacityPk: a.capacityPk,
            roomLocation: a.roomLocation,
            nextServiceDate: a.nextServiceDate ? a.nextServiceDate.toISOString() : null,
          }))}
          cardUrl={cardUrl}
          pricingCount={pricing.length}
          jobsCount={jobs.length}
        />
      </div>
    </main>
  );
}
