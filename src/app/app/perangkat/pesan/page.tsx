import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { listProducts } from "@/lib/services/iot-order-service";
import { getBillingPolicy } from "@/lib/billing/config";
import { formatIDR } from "@/lib/billing/plans";
import { OrderForm } from "./order-form";
import { AppHeader } from "../../_components/app-header";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function PesanPerangkatPage() {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/perangkat/pesan");
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") redirect("/app/perangkat");

  const [products, policy] = await Promise.all([listProducts(), getBillingPolicy()]);

  return (
    <main className="min-h-screen">
      <AppHeader title="Pesan Perangkat" back="/app/perangkat" backLabel="Pemantauan Perangkat" />

      <div className="mx-auto max-w-4xl space-y-6 px-5 py-6">
        {products.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            Produk perangkat belum tersedia. Hubungi tim Aircon.
          </div>
        ) : (
          <Card>
            <CardContent className="p-6">
              <OrderForm
                taxPercent={policy.taxPercent}
                products={products.map((p) => ({
                  id: p.id,
                  name: p.name,
                  description: p.description ?? "",
                  price: p.priceUnit,
                  priceLabel: formatIDR(p.priceUnit),
                  warrantyDays: p.warrantyDays,
                }))}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
