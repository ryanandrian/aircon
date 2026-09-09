import { redirect, notFound } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { getInvoiceForView } from "@/lib/services/invoice-service";
import { InvoiceView } from "@/components/invoice-view";
import { InvoiceActions } from "@/components/invoice-actions";
import { PaymentPanel } from "@/components/payment-panel";
import { ProformaConvert } from "./proforma-convert";
import { CancelInvoiceButton } from "./cancel-button";
import { AppHeader } from "../../_components/app-header";

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
    <main className="min-h-screen pb-16 print:pb-0">
      <div className="print:hidden">
        <AppHeader title={isProforma ? "Proforma" : "Invoice"} back="/app/faktur" helpKey="faktur-detail" />
      </div>
      <div className="mx-auto max-w-4xl space-y-4 px-5 py-6 print:max-w-none print:p-0">
        <InvoiceView inv={inv} tenant={data.tenant} assetMap={data.assetMap} billTo={data.billTo} />
        {inv.status !== "CANCELLED" && (
          <InvoiceActions invoiceId={inv.id} variant="admin" docLabel={isProforma ? "Proforma" : "Invoice"} />
        )}
        {inv.status === "PAID" && inv.docType === "INVOICE" && (
          <a href={`/app/kwitansi/${inv.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:underline dark:text-sky-400 print:hidden">
            Lihat / cetak Kwitansi →
          </a>
        )}
        <div className="print:hidden space-y-4">
          {canConvert && <ProformaConvert proformaId={inv.id} isB2B={inv.customer.customerType === "BADAN"} />}
          {canPay && <PaymentPanel invoiceId={inv.id} tenantHasQris={Boolean(data.tenant?.qrisImageUrl)} />}
          {canCancel && <CancelInvoiceButton invoiceId={inv.id} isProforma={isProforma} />}
        </div>
      </div>
    </main>
  );
}
