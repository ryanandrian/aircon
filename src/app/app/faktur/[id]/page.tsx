import { redirect, notFound } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { getInvoiceForView } from "@/lib/services/invoice-service";
import { InvoiceView } from "@/components/invoice-view";
import { PaymentPanel } from "@/components/payment-panel";
import { ProformaConvert } from "./proforma-convert";
import { CancelInvoiceButton } from "./cancel-button";

export const dynamic = "force-dynamic";

export default async function AppInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await tryGetServerContext();
  if (!ctx) redirect(`/login?next=/app/faktur/${id}`);
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") redirect("/app");

  let data;
  try {
    data = await getInvoiceForView(ctx.tenantId, id);
  } catch {
    notFound();
  }

  const inv = data.inv;
  const isProforma = inv.docType === "PROFORMA";
  const canConvert = isProforma && inv.status !== "CANCELLED";
  const canPay = inv.docType === "INVOICE" && (inv.status === "ISSUED" || inv.status === "OVERDUE");
  const canCancel = inv.status !== "PAID" && inv.status !== "CANCELLED";

  return (
    <main className="min-h-screen bg-muted/40 pb-16">
      <div className="mx-auto max-w-4xl space-y-4 px-5 py-6">
        <InvoiceView inv={inv} tenant={data.tenant} assetMap={data.assetMap} backHref="/app/faktur" />
        {canConvert && <ProformaConvert proformaId={inv.id} isB2B={inv.customer.customerType === "BADAN"} />}
        {canPay && <PaymentPanel invoiceId={inv.id} tenantHasQris={Boolean(data.tenant?.qrisImageUrl)} />}
        {canCancel && <CancelInvoiceButton invoiceId={inv.id} isProforma={isProforma} />}
      </div>
    </main>
  );
}
