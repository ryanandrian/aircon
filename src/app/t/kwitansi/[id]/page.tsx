import { redirect, notFound } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { getInvoiceForView } from "@/lib/services/invoice-service";
import { KwitansiView } from "@/components/kwitansi-view";
import { KwitansiActions } from "@/components/kwitansi-actions";

export const dynamic = "force-dynamic";

export default async function TechKwitansiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await tryGetServerContext();
  if (!ctx) redirect(`/login?next=/t/kwitansi/${id}`);

  let data;
  try {
    data = await getInvoiceForView(ctx.tenantId, id);
  } catch {
    notFound();
  }
  const inv = data.inv;
  if (inv.docType !== "INVOICE" || inv.status !== "PAID") redirect(`/t/faktur/${id}`);
  const serviceLocation = inv.billingCustomerId ? data.serviceCustomer.name : null;

  return (
    <main className="min-h-screen bg-muted/40 pb-16 print:bg-white print:pb-0">
      <div className="mx-auto max-w-2xl space-y-4 p-4 print:max-w-none print:p-0">
        <KwitansiView inv={inv} tenant={data.tenant} backHref={`/t/faktur/${id}`} billTo={data.billTo} serviceLocation={serviceLocation} />
        <KwitansiActions invoiceId={inv.id} variant="tech" />
      </div>
    </main>
  );
}
