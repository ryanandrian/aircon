import { TenantLogo } from "@/components/tenant-logo";
import { Card, CardContent } from "@/components/ui/card";
import { terbilangRupiah } from "@/lib/domain/terbilang";
import { receiptNumber } from "@/lib/domain/receipt";

type Inv = {
  number: string; total: unknown;
  payMethod: string | null; paidAt: Date | null; issueDate: Date;
  customer: { name: string; phone: string; address: string | null };
};
type Tenant = {
  name: string; logoUrl: string | null; tagline?: string | null;
  phone?: string | null; address?: string | null;
  bankName: string | null; bankAccountNo: string | null; bankAccountName: string | null;
} | null;

const rp = (n: unknown) => "Rp" + Number(n).toLocaleString("id-ID");
const fmtDate = (d: Date | null) => d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }) : "—";
const PAY_LABEL: Record<string, string> = { CASH: "Tunai", TRANSFER: "Transfer Bank", QRIS: "QRIS" };

/**
 * Kwitansi (bukti terima pembayaran) — tampilan dari invoice LUNAS. Wajib "terbilang".
 * Bill-to: entitas yang membayar (billTo bila kantor pusat), lokasi servis = customer outlet.
 */
export function KwitansiView({ inv, tenant, backHref, billTo, serviceLocation }: {
  inv: Inv; tenant: Tenant; backHref?: string;
  billTo?: { name: string; phone: string; address: string | null } | null;
  serviceLocation?: string | null;
}) {
  const payer = billTo ?? inv.customer;
  return (
    <div className="space-y-4">
      {backHref && <a href={backHref} className="text-xs text-muted-foreground print:hidden">← Kembali</a>}
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <TenantLogo name={tenant?.name ?? "Aircon"} logoUrl={tenant?.logoUrl ?? ""} size={48} />
              <div>
                <div className="font-bold text-foreground">{tenant?.name ?? "—"}</div>
                {tenant?.tagline && <div className="text-xs italic text-muted-foreground">{tenant.tagline}</div>}
                {tenant?.address && <div className="text-xs text-muted-foreground">{tenant.address}</div>}
                {tenant?.phone && <div className="text-xs text-muted-foreground">Telp: {tenant.phone}</div>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold tracking-wide text-foreground">KWITANSI</div>
              <div className="font-mono text-xs text-muted-foreground">{receiptNumber(inv.number)}</div>
              <div className="mt-1 inline-block rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-medium text-white">LUNAS</div>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4 text-sm">
            <Row label="Telah terima dari" value={payer.name} />
            <Row label="Uang sejumlah" value={<span className="font-semibold text-foreground">{rp(inv.total)}</span>} />
            <div className="rounded-lg bg-muted/60 px-3 py-2">
              <div className="text-xs text-muted-foreground">Terbilang</div>
              <div className="text-sm font-medium italic text-foreground">{terbilangRupiah(Number(inv.total))}</div>
            </div>
            <Row label="Untuk pembayaran" value={`Invoice ${inv.number}`} />
            {serviceLocation && <Row label="Lokasi servis" value={serviceLocation} />}
            <Row label="Metode" value={inv.payMethod ? (PAY_LABEL[inv.payMethod] ?? inv.payMethod) : "—"} />
            <Row label="Tanggal bayar" value={fmtDate(inv.paidAt)} />
          </div>

          <div className="flex items-end justify-between border-t pt-6">
            <div className="text-xs text-muted-foreground">
              Kwitansi ini sah sebagai bukti pembayaran yang telah diterima.
            </div>
            <div className="text-center text-sm">
              <div className="text-xs text-muted-foreground">Hormat kami,</div>
              <div className="mt-10 border-t border-dashed pt-1 font-medium text-foreground">{tenant?.name ?? "—"}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right text-foreground">{value}</span>
    </div>
  );
}
