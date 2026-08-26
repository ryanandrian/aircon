import { listIotProducts, listAllIotOrders } from "@/lib/services/admin-config-service";
import { ProductEditor, OrderRow } from "./iot-admin";

export const dynamic = "force-dynamic";

const rupiah = (n: number) => "Rp" + n.toLocaleString("id-ID");

export default async function AdminIotPage() {
  const [products, orders] = await Promise.all([listIotProducts(), listAllIotOrders()]);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Produk IoT</h1>
          <p className="text-sm text-muted-foreground">Harga jual-putus & garansi. Editable — tanpa hardcode.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {products.map((p) => (
            <ProductEditor
              key={p.id}
              id={p.id}
              sku={p.sku}
              initial={{
                name: p.name,
                description: p.description ?? "",
                priceUnit: p.priceUnit,
                warrantyDays: p.warrantyDays,
                active: p.active,
              }}
            />
          ))}
          {products.length === 0 && <p className="text-sm text-muted-foreground">Belum ada produk.</p>}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">Pesanan Perangkat</h2>
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3">No. Pesanan</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((o) => (
                <OrderRow
                  key={o.id}
                  id={o.id}
                  orderNo={o.orderNo}
                  qty={o.quantity}
                  total={rupiah(o.total)}
                  status={o.status}
                  trackingNote={o.trackingNote ?? ""}
                />
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Belum ada pesanan.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
