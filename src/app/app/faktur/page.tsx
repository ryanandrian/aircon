import { redirect } from "next/navigation";
import Link from "next/link";
import { tryGetServerContext } from "@/lib/auth/context";
import { listInvoices } from "@/lib/services/invoice-service";
import { AppHeader } from "../_components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icons";

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
    <main className="min-h-screen bg-muted/40">
      <AppHeader title="Invoice & Proforma" />
      <div className="mx-auto max-w-4xl space-y-4 px-5 py-6">
        <p className="text-sm text-muted-foreground">Dokumen otomatis dibuat saat teknisi menutup sesi pekerjaan.</p>
        {invoices.length === 0 ? (
          <Card className="border-dashed text-center">
            <CardContent className="p-8 text-sm text-muted-foreground">
              Belum ada invoice. Dokumen otomatis dibuat saat teknisi menutup sesi pekerjaan.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {invoices.map((inv) => {
              const isProforma = inv.docType === "PROFORMA";
              return (
                <Link key={inv.id} href={`/app/faktur/${inv.id}`}>
                  <Card className="interactive py-0">
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
                        <Icon.Billing className="h-5 w-5" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-semibold text-foreground">{inv.customerName}</span>
                          <Badge variant={isProforma ? "outline" : "secondary"} className="shrink-0">{isProforma ? "Proforma" : "Invoice"}</Badge>
                          <Badge variant={inv.status === "PAID" ? "secondary" : "outline"} className="shrink-0">{STATUS[inv.status] ?? inv.status}</Badge>
                        </div>
                        <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{inv.number}</div>
                        <div className="text-xs text-muted-foreground">Terbit {fmt(inv.issueDate)}{inv.dueDate ? ` · Jatuh tempo ${fmt(inv.dueDate)}` : ""}</div>
                      </div>
                      <div className="shrink-0 text-right font-bold text-foreground">{rp(inv.total)}</div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
