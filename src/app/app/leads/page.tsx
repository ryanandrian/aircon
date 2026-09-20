import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { listLeads } from "@/lib/services/lead-service";
import { AppHeader } from "../_components/app-header";
import { LeadInbox } from "./lead-inbox";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/leads");
  if (ctx.role === "TECHNICIAN") redirect("/t");
  const leads = await listLeads(ctx.tenantId);
  return (
    <main className="min-h-screen">
      <AppHeader title="Booking Online" helpKey="leads" />
      <div className="mx-auto max-w-4xl space-y-6 px-5 py-6">
        <div><p className="text-sm text-muted-foreground">Calon pelanggan dari halaman usaha publik Anda.</p></div>
        <LeadInbox initialLeads={leads.map((lead) => ({ ...lead, createdAt: lead.createdAt.toISOString() }))} />
      </div>
    </main>
  );
}
