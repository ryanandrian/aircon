import { redirect } from "next/navigation";
import Link from "next/link";
import { tryGetServerContext } from "@/lib/auth/context";
import { listTenantOrders } from "@/lib/services/iot-order-service";
import { formatIDR } from "@/lib/billing/plans";
import { AppHeader } from "../../_components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING_PAYMENT: { label: "Menunggu Pembayaran", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400" },
  PAID: { label: "Dibayar", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400" },
  PROCESSING: { label: "Diproses", cls: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400" },
  SHIPPED: { label: "Dikirim", cls: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400" },
  DELIVERED: { label: "Tiba", cls: "bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-400" },
  INSTALLED: { label: "Terpasang", cls: "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400" },
  CANCELLED: { label: "Dibatalkan", cls: "bg-muted text-muted-foreground" },
};

export default async function PesananPerangkatPage() {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/perangkat/pesanan");

  const orders = await listTenantOrders(ctx.tenantId);

  return (
    <main className="min-h-screen bg-muted/40">
      <AppHeader title="Pesanan Perangkat" back="/app/perangkat" backLabel="Pemantauan Perangkat" />

      <div className="mx-auto max-w-3xl space-y-4 p-6">
        {orders.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400"><Icon.Package className="h-7 w-7" aria-hidden /></div>
              <h2 className="text-lg font-bold text-foreground">Belum ada pesanan</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Anda belum memesan perangkat apa pun.{" "}
                <Link href="/app/perangkat/pesan" className="font-medium text-sky-600 underline dark:text-sky-400">Pesan sekarang</Link>
              </p>
            </CardContent>
          </Card>
        ) : (
          orders.map((o) => {
            const s = STATUS[o.status] ?? { label: o.status, cls: "bg-muted text-muted-foreground" };
            return (
              <Card key={o.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-muted-foreground">{o.orderNo}</span>
                    <Badge variant="secondary" className={s.cls}>{s.label}</Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{o.quantity} unit</span>
                    <span className="font-bold text-foreground">{formatIDR(o.total)}</span>
                  </div>
                  {o.trackingNote && <p className="mt-2 text-sm text-muted-foreground">Info: {o.trackingNote}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{o.createdAt.toLocaleDateString("id-ID")}</p>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </main>
  );
}
