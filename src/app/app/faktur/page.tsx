import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { listInvoicesByBucket, countInvoicesByBucket } from "@/lib/services/invoice-service";
import { refreshOverdueStatus } from "@/lib/services/ar-service";
import { AppHeader } from "../_components/app-header";
import { InvoicesBoard } from "./invoices-board";

export const dynamic = "force-dynamic";

export default async function FakturListPage() {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/faktur");
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") redirect("/app");

  // F8 (B-4): sinkron status OVERDUE sebelum query list (pola persis /app/laporan:
  // sinkron di request-time, tanpa cron baru) — badge "Jatuh Tempo" & daftar
  // akurat sejak render awal, bukan hanya saat laporan dibuka.
  await refreshOverdueStatus(ctx.tenantId);

  // Hitung dulu; buka tab "Perlu Ditagih" bila ada proforma, jika tidak "Belum Lunas".
  const counts = await countInvoicesByBucket(ctx.tenantId);
  const initialBucket = counts.proforma > 0 ? "proforma" : counts.unpaid > 0 ? "unpaid" : "all";
  const { items, nextCursor } = await listInvoicesByBucket(ctx.tenantId, initialBucket, {});

  return (
    <main className="min-h-screen">
      <AppHeader title="Invoice & Proforma" helpKey="faktur" />
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
