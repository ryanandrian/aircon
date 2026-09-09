import { redirect, notFound } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { getInvoiceForView } from "@/lib/services/invoice-service";
import { KwitansiView } from "@/components/kwitansi-view";
import { KwitansiActions } from "@/components/kwitansi-actions";
import { AppHeader } from "../../_components/app-header";

export const dynamic = "force-dynamic";

export default async function AppKwitansiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await tryGetServerContext();
  if (!ctx) redirect(`/login?next=/app/kwitansi/${id}`);
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") redirect("/app");

  let data;
  try {
    data = await getInvoiceForView(ctx.tenantId, id);
  } catch {
    notFound();
  }
  const inv = data.inv;
  if (inv.docType !== "INVOICE" || inv.status !== "PAID") {
    // Kwitansi hanya untuk invoice LUNAS.
    redirect(`/app/faktur/${id}`);
  }
  const serviceLocation = inv.billingCustomerId ? data.serviceCustomer.name : null;

  return (
    <main className="min-h-screen pb-16 print:pb-0">
      <div className="print:hidden">
        <AppHeader title="Kwitansi" back={`/app/faktur/${id}`} helpKey="faktur-detail" />
      </div>
      <div className="mx-auto max-w-4xl space-y-4 px-5 py-6 print:max-w-none print:p-0">
        <KwitansiView inv={inv} tenant={data.tenant} billTo={data.billTo} serviceLocation={serviceLocation} />
        <KwitansiActions invoiceId={inv.id} variant="admin" />
      </div>
    </main>
  );
}
