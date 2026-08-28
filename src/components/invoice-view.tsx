import { TenantLogo } from "@/components/tenant-logo";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/** Serialisasi longgar (Decimal → number via Number()). Komponen ini server-safe (dipakai di page server). */
type InvItem = { assetId: string | null; descSnapshot: string; category: string; qty: unknown; unit: string; unitPrice: unknown; lineTotal: unknown };
type Inv = {
  docType: string; number: string; status: string;
  issueDate: Date; dueDate: Date | null;
  subtotal: unknown; discountAmount: unknown; ppnPercent: number; ppnAmount: unknown; total: unknown;
  payMethod: string | null; paidAt: Date | null;
  customer: { name: string; phone: string; address: string | null; customerType: string; npwp: string | null };
  items: InvItem[];
};
type Tenant = {
  name: string; logoUrl: string | null; isPkp: boolean; npwp: string | null;
  bankName: string | null; bankAccountNo: string | null; bankAccountName: string | null; qrisImageUrl: string | null;
} | null;

const rp = (n: unknown) => "Rp" + Number(n).toLocaleString("id-ID");
const fmtDate = (d: Date | null) => d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }) : "—";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draf", ISSUED: "Terbit", PAID: "Lunas", OVERDUE: "Jatuh Tempo", CANCELLED: "Batal",
};

export function InvoiceView({ inv, tenant, assetMap, backHref }: {
  inv: Inv; tenant: Tenant; assetMap: Map<string, string>; backHref?: string;
}) {
  const isProforma = inv.docType === "PROFORMA";
  const title = isProforma ? "PROFORMA INVOICE" : "INVOICE";

  // Kelompokkan item per unit (K9). Item tanpa unit → grup "Umum".
  const groups = new Map<string, InvItem[]>();
  for (const it of inv.items) {
    const key = it.assetId ? (assetMap.get(it.assetId) ?? "Unit AC") : "Umum";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(it);
  }

  return (
    <div className="space-y-4">
      {backHref && <a href={backHref} className="text-xs text-muted-foreground">← Kembali</a>}
      <Card>
        <CardContent className="space-y-5 p-6">
          {/* Header: logo tenant (K2) + judul dokumen */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <TenantLogo name={tenant?.name ?? "Aircon"} logoUrl={tenant?.logoUrl ?? ""} size={48} />
              <div>
                <div className="font-bold text-foreground">{tenant?.name ?? "—"}</div>
                {tenant?.isPkp && tenant?.npwp && <div className="text-xs text-muted-foreground">NPWP: {tenant.npwp}</div>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold tracking-wide text-foreground">{title}</div>
              <div className="font-mono text-xs text-muted-foreground">{inv.number}</div>
              <Badge variant={inv.status === "PAID" ? "secondary" : "outline"} className="mt-1">{STATUS_LABEL[inv.status] ?? inv.status}</Badge>
            </div>
          </div>

          {/* Info pelanggan + tanggal */}
          <div className="grid grid-cols-2 gap-4 border-t pt-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Ditagihkan kepada</div>
              <div className="font-medium text-foreground">{inv.customer.name}</div>
              {inv.customer.address && <div className="text-xs text-muted-foreground">{inv.customer.address}</div>}
              <div className="text-xs text-muted-foreground">{inv.customer.phone}</div>
              {inv.customer.customerType === "BADAN" && inv.customer.npwp && <div className="text-xs text-muted-foreground">NPWP: {inv.customer.npwp}</div>}
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Tanggal terbit</div>
              <div className="font-medium text-foreground">{fmtDate(inv.issueDate)}</div>
              {inv.dueDate && (<><div className="mt-1 text-xs text-muted-foreground">Jatuh tempo</div><div className="font-medium text-foreground">{fmtDate(inv.dueDate)}</div></>)}
            </div>
          </div>

          {/* Detail per unit (K9) — TANPA nama personel (K18) */}
          <div className="space-y-3 border-t pt-4">
            {[...groups.entries()].map(([unitLabel, items], gi) => (
              <div key={gi}>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">{gi + 1}. {unitLabel}</div>
                <div className="space-y-1">
                  {items.map((it, i) => (
                    <div key={i} className="flex justify-between gap-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <span className="text-foreground">{it.descSnapshot}</span>
                        <span className="ml-1 text-xs text-muted-foreground">{Number(it.qty)} {it.unit} × {rp(it.unitPrice)}</span>
                      </div>
                      <div className="shrink-0 font-medium text-foreground">{rp(it.lineTotal)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Ringkasan uang */}
          <div className="space-y-1 border-t pt-4 text-sm">
            <Row label="Subtotal" value={rp(inv.subtotal)} />
            {Number(inv.discountAmount) > 0 && <Row label="Diskon" value={"− " + rp(inv.discountAmount)} />}
            {inv.ppnPercent > 0 && <Row label={`PPN ${inv.ppnPercent}%`} value={rp(inv.ppnAmount)} />}
            <div className="flex justify-between border-t pt-2 text-base font-bold text-foreground">
              <span>Total</span><span>{rp(inv.total)}</span>
            </div>
          </div>

          {/* Rekening & QRIS (K13) */}
          {(tenant?.bankName || tenant?.qrisImageUrl) && (
            <div className="grid grid-cols-2 gap-4 border-t pt-4">
              {tenant?.bankName && (
                <div className="text-sm">
                  <div className="text-xs text-muted-foreground">Pembayaran transfer</div>
                  <div className="font-medium text-foreground">{tenant.bankName}</div>
                  <div className="font-mono text-foreground">{tenant.bankAccountNo}</div>
                  <div className="text-xs text-muted-foreground">a.n. {tenant.bankAccountName}</div>
                </div>
              )}
              {tenant?.qrisImageUrl && (
                <div className="text-right">
                  <div className="mb-1 text-xs text-muted-foreground">Scan QRIS</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={tenant.qrisImageUrl} alt="QRIS" className="ml-auto h-24 w-24 rounded-lg border object-contain" />
                </div>
              )}
            </div>
          )}

          {isProforma && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
              Ini proforma-invoice (tagihan tempo). Invoice resmi diterbitkan admin kantor.
            </p>
          )}
          {tenant?.isPkp && inv.ppnPercent > 0 && (
            <p className="text-center text-[10px] text-muted-foreground">
              Dokumen ini bukan Faktur Pajak elektronik (e-Faktur). Faktur Pajak resmi diterbitkan terpisah bila diperlukan.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span><span className="text-foreground">{value}</span>
    </div>
  );
}
