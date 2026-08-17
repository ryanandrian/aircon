import { redirect } from "next/navigation";
import Link from "next/link";
import { tryGetServerContext } from "@/lib/auth/context";
import { listProducts } from "@/lib/services/iot-order-service";
import { getBillingPolicy } from "@/lib/billing/config";
import { formatIDR } from "@/lib/billing/plans";
import { OrderForm } from "./order-form";

export const dynamic = "force-dynamic";

export default async function PesanPerangkatPage() {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/perangkat/pesan");
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") redirect("/app/perangkat");

  const [products, policy] = await Promise.all([listProducts(), getBillingPolicy()]);

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-bold">Pesan Perangkat</h1>
          <Link href="/app/perangkat" className="text-sm text-slate-500 hover:text-slate-800">← Kembali</Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-6 p-6">
        {products.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Produk perangkat belum tersedia. Hubungi tim Aircon.
          </div>
        ) : (
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
        )}
      </div>
    </main>
  );
}
