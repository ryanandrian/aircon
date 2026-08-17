import { redirect } from "next/navigation";
import Link from "next/link";
import { tryGetServerContext } from "@/lib/auth/context";
import { listTenantOrders } from "@/lib/services/iot-order-service";
import { formatIDR } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING_PAYMENT: { label: "Menunggu Pembayaran", cls: "bg-amber-100 text-amber-700" },
  PAID: { label: "Dibayar", cls: "bg-emerald-100 text-emerald-700" },
  PROCESSING: { label: "Diproses", cls: "bg-sky-100 text-sky-700" },
  SHIPPED: { label: "Dikirim", cls: "bg-indigo-100 text-indigo-700" },
  DELIVERED: { label: "Tiba", cls: "bg-teal-100 text-teal-700" },
  INSTALLED: { label: "Terpasang", cls: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Dibatalkan", cls: "bg-slate-100 text-slate-500" },
};

export default async function PesananPerangkatPage() {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/perangkat/pesanan");

  const orders = await listTenantOrders(ctx.tenantId);

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-bold">Pesanan Perangkat</h1>
          <Link href="/app/perangkat" className="text-sm text-slate-500 hover:text-slate-800">← Kembali</Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 p-6">
        {orders.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
            Belum ada pesanan.{" "}
            <Link href="/app/perangkat/pesan" className="font-medium text-sky-600 underline">Pesan sekarang</Link>
          </div>
        ) : (
          orders.map((o) => {
            const s = STATUS[o.status] ?? { label: o.status, cls: "bg-slate-100 text-slate-500" };
            return (
              <div key={o.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-slate-500">{o.orderNo}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-slate-600">{o.quantity} unit</span>
                  <span className="font-bold text-slate-900">{formatIDR(o.total)}</span>
                </div>
                {o.trackingNote && <p className="mt-2 text-sm text-slate-500">Info: {o.trackingNote}</p>}
                <p className="mt-1 text-xs text-slate-400">{o.createdAt.toLocaleDateString("id-ID")}</p>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
