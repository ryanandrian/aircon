import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { listTenantOrders } from "@/lib/services/iot-order-service";
import { formatIDR } from "@/lib/billing/plans";
import { AppHeader } from "../../_components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icons";
import { EmptyState } from "@/components/empty-state";

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
    <main className="min-h-screen">
      <AppHeader title="Pesanan Perangkat" back="/app/perangkat" backLabel="Pemantauan Perangkat" />

      <div className="mx-auto max-w-4xl space-y-4 px-5 py-6">
        {orders.length === 0 ? (
          <EmptyState
            icon={Icon.Package}
            title="Belum ada pesanan"
            desc="Anda belum memesan perangkat apa pun. Pesan perangkat Aircon untuk mulai memantau unit AC pelanggan."
            actionHref="/app/perangkat/pesan"
            actionLabel="Pesan Perangkat"
          />
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
