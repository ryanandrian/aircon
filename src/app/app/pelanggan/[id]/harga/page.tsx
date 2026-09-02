import { redirect, notFound } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { getCustomer } from "@/lib/services/customer-service";
import { listCatalog, listCustomerPricing } from "@/lib/services/service-catalog-service";
import { AppHeader } from "../../../_components/app-header";
import { CustomerPricingManager } from "./pricing-manager";

export const dynamic = "force-dynamic";

export default async function CustomerPricingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await tryGetServerContext();
  if (!ctx) redirect(`/login?next=/app/pelanggan/${id}/harga`);

  let customer;
  try {
    customer = await getCustomer(ctx.tenantId, id);
  } catch {
    notFound();
  }

  const [catalogRaw, overridesRaw] = await Promise.all([
    listCatalog(ctx.tenantId, { activeOnly: true }),
    listCustomerPricing(ctx.tenantId, id),
  ]);

  const catalog = catalogRaw.map((c) => ({
    id: c.id, code: c.code, name: c.name, unit: c.unit, standardPrice: Number(c.standardPrice),
  }));
  const initialOverrides = overridesRaw.map((o) => ({
    serviceId: o.serviceId,
    code: o.service.code,
    name: o.service.name,
    unit: o.service.unit,
    standardPrice: Number(o.service.standardPrice),
    price: Number(o.price),
  }));

  return (
    <main className="min-h-screen bg-muted/40">
      <AppHeader title="Harga Khusus Pelanggan" back="/app/pelanggan" />
      <div className="mx-auto max-w-4xl space-y-6 px-5 py-6">
        <CustomerPricingManager
          customerId={id}
          customerName={customer.name}
          catalog={catalog}
          initialOverrides={initialOverrides}
        />
      </div>
    </main>
  );
}
