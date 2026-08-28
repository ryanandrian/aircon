import { redirect, notFound } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { getInvoiceForView } from "@/lib/services/invoice-service";
import { InvoiceView } from "@/components/invoice-view";

export const dynamic = "force-dynamic";

export default async function TechInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await tryGetServerContext();
  if (!ctx) redirect(`/login?next=/t/faktur/${id}`);

  let data;
  try {
    data = await getInvoiceForView(ctx.tenantId, id);
  } catch {
    notFound();
  }

  return (
    <main className="min-h-screen bg-muted/40 pb-16">
      <div className="mx-auto max-w-2xl p-4">
        <InvoiceView inv={data.inv} tenant={data.tenant} assetMap={data.assetMap} backHref="/t" />
      </div>
    </main>
  );
}
