import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { listInvoices } from "@/lib/services/invoice-service";
import { AppHeader } from "../_components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const rp = (n: number) => "Rp" + n.toLocaleString("id-ID");
const STATUS: Record<string, string> = { DRAFT: "Draf", ISSUED: "Terbit", PAID: "Lunas", OVERDUE: "Jatuh Tempo", CANCELLED: "Batal" };
const fmt = (d: Date | null) => d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default async function FakturListPage() {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/faktur");
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") redirect("/app");

  const invoices = await listInvoices(ctx.tenantId);

  return (
    <>
      <AppHeader title="Invoice & Proforma" />
      <div className="mx-auto max-w-4xl space-y-4 px-5 py-6">
        {invoices.length === 0 ? (
          <Card className="border-dashed text-center">
            <CardContent className="p-8 text-sm text-muted-foreground">
              Belum ada invoice. Dokumen otomatis dibuat saat teknisi menutup sesi pekerjaan.
            </CardContent>
          </Card>
        ) : (
          invoices.map((inv) => (
            <a key={inv.id} href={`/app/faktur/${inv.id}`}>
              <Card className="transition hover:border-sky-300">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{inv.number}</span>
                      <Badge variant={inv.docType === "PROFORMA" ? "outline" : "secondary"}>{inv.docType === "PROFORMA" ? "Proforma" : "Invoice"}</Badge>
                      <Badge variant={inv.status === "PAID" ? "secondary" : "outline"}>{STATUS[inv.status] ?? inv.status}</Badge>
                    </div>
                    <div className="mt-0.5 truncate text-sm font-medium text-foreground">{inv.customerName}</div>
                    <div className="text-xs text-muted-foreground">Terbit {fmt(inv.issueDate)}{inv.dueDate ? ` · Jatuh tempo ${fmt(inv.dueDate)}` : ""}</div>
                  </div>
                  <div className="shrink-0 text-right font-bold text-foreground">{rp(inv.total)}</div>
                </CardContent>
              </Card>
            </a>
          ))
        )}
      </div>
    </>
  );
}
