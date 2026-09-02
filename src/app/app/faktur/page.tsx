import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { listInvoicesByBucket, countInvoicesByBucket } from "@/lib/services/invoice-service";
import { AppHeader } from "../_components/app-header";
import { InvoicesBoard } from "./invoices-board";

export const dynamic = "force-dynamic";

export default async function FakturListPage() {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/faktur");
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") redirect("/app");

  // Hitung dulu; buka tab "Perlu Ditagih" bila ada proforma, jika tidak "Belum Lunas".
  const counts = await countInvoicesByBucket(ctx.tenantId);
  const initialBucket = counts.proforma > 0 ? "proforma" : counts.unpaid > 0 ? "unpaid" : "all";
  const { items, nextCursor } = await listInvoicesByBucket(ctx.tenantId, initialBucket, {});

  return (
    <main className="min-h-screen bg-muted/40">
      <AppHeader title="Invoice & Proforma" />
      <div className="mx-auto max-w-4xl space-y-4 px-5 py-6">
        <p className="text-sm text-muted-foreground">
          Dokumen otomatis dibuat saat teknisi menutup sesi pekerjaan. Pantau mana yang perlu ditagih & belum lunas.
        </p>
        <InvoicesBoard
          initialBucket={initialBucket}
          initialItems={items}
          initialCursor={nextCursor}
          initialCounts={counts}
        />
      </div>
    </main>
  );
}
