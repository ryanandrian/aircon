import { notFound, redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { getCompanyProfile, effectiveTaxPercent } from "@/lib/services/company-service";
import { getBillingPolicy } from "@/lib/billing/config";
import { PrintButton } from "./print-button";
import { ResumePayButton } from "../../resume-pay-button";
import { Icon } from "@/components/icons";
import { terbilangRupiah } from "@/lib/domain/terbilang";
import { extractGrossInfo, computeFinanceBreakdown } from "@/lib/domain/finance-doc";

export const dynamic = "force-dynamic";

const rupiah = (n: number) => "Rp " + n.toLocaleString("id-ID");
const PLAN_LABEL: Record<string, string> = { TRIAL: "Trial", PROFESSIONAL: "Professional", BUSINESS: "Business" };

export default async function FakturPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await tryGetServerContext();
  if (!ctx) redirect(`/login?next=/app/langganan/faktur/${id}`);

  const payment = await prisma.payment.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!payment) notFound();

  const [company, policy, tenant] = await Promise.all([
    getCompanyProfile(),
    getBillingPolicy(),
    prisma.tenant.findUnique({ where: { id: ctx.tenantId } }),
  ]);

  const isPaid = payment.status === "PAID";
  // KWITANSI (bukti terima) bila LUNAS; FAKTUR (tagihan) bila belum.
  const docTitle = isPaid ? "KWITANSI" : "FAKTUR";

  const taxPercent = effectiveTaxPercent(company.isPkp, policy.taxPercent);
  // Fee channel (customer-imposed) hanya relevan pada transaksi LUNAS (dari rawNotif).
  const gross = isPaid ? extractGrossInfo(payment.rawNotif) : {};
  const channelFee = gross.customerImposedFee ?? 0;
  const bd = computeFinanceBreakdown({
    amount: payment.amount,
    discount: payment.discountAmount ?? 0,
    taxPercent,
    channelFee,
  });

  const planName = PLAN_LABEL[payment.plan] ?? payment.plan;
  const purpose = `Langganan ${company.brandName} — Paket ${planName}, masa ${payment.periodMonths} bulan`;
  const invoiceNo = payment.orderId;
  const dateStr = (payment.paidAt ?? payment.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const taxLabel = company.taxLabel || "PPN";
  const customerName = tenant?.name ?? "-";

  // Catatan kaki configurable (fallback default sistem bila admin belum isi).
  const defaultInvoiceNote = "Dokumen ini adalah tagihan. Pembayaran melalui tautan/kode yang tersedia. Dokumen sah tanpa tanda tangan, dihasilkan otomatis oleh sistem.";
  const defaultReceiptNote = "Dokumen ini adalah bukti penerimaan pembayaran yang sah, dihasilkan otomatis oleh sistem tanpa tanda tangan.";
  const defaultFeeNote = "Biaya layanan pembayaran dibayarkan pelanggan langsung kepada penyedia pembayaran (channel), di luar penerimaan " + (company.legalName || company.brandName) + ".";
  const footerNote = isPaid ? (company.receiptNote || defaultReceiptNote) : (company.invoiceNote || defaultInvoiceNote);
  const feeNote = company.paymentFeeNote || defaultFeeNote;

  return (
    <main className="min-h-screen py-8 print:bg-white print:py-0">
      {/* Toolbar (disembunyikan saat cetak) */}
      <div className="mx-auto mb-4 flex max-w-2xl items-center justify-between px-6 print:hidden">
        <a href="/app/langganan" className="text-sm text-slate-500 hover:text-slate-800">← Langganan</a>
        <div className="flex items-center gap-2">
          {!isPaid && ctx.role === "OWNER" && (
            <ResumePayButton orderId={payment.orderId} label={payment.status === "PENDING" ? "Bayar Sekarang" : "Ulangi"} />
          )}
          <PrintButton />
        </div>
      </div>

      {/* Dokumen */}
      <div className="mx-auto max-w-2xl bg-white p-10 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-6">
          <div className="flex items-center gap-3">
            {company.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoUrl} alt={company.brandName} className="h-12 w-auto object-contain" />
            ) : null}
            <div>
              <div className="text-base font-bold text-slate-900">{company.legalName || company.brandName}</div>
              {company.npwp && <div className="text-xs text-slate-500">NPWP: {company.npwp}</div>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tracking-tight text-slate-900">{docTitle}</div>
            <div className="mt-1 text-xs text-slate-500">No: {invoiceNo}</div>
            <div className="text-xs text-slate-500">{isPaid ? "Tanggal lunas: " : "Tanggal: "}{dateStr}</div>
          </div>
        </div>

        {/* Dari / Untuk */}
        <div className="grid grid-cols-2 gap-6 py-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Dari</div>
            <div className="mt-1 text-sm font-medium text-slate-900">{company.legalName || company.brandName}</div>
            {company.addressLine && <div className="text-sm text-slate-600">{company.addressLine}</div>}
            <div className="text-sm text-slate-600">
              {[company.city, company.province, company.postalCode].filter(Boolean).join(", ")}
            </div>
            {company.email && <div className="text-sm text-slate-600">{company.email}</div>}
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{isPaid ? "Diterima dari" : "Tagihan kepada"}</div>
            <div className="mt-1 text-sm font-medium text-slate-900">{customerName}</div>
            {tenant?.phone && <div className="text-sm text-slate-600">{tenant.phone}</div>}
          </div>
        </div>

        {/* Status badge */}
        <div className="mb-4">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            isPaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          }`}>
            {isPaid ? <span className="inline-flex items-center gap-1"><Icon.Check className="h-3.5 w-3.5" aria-hidden /> LUNAS</span> : "MENUNGGU PEMBAYARAN"}
          </span>
        </div>

        {/* KWITANSI: pernyataan penerimaan (inti kwitansi Indonesia) */}
        {isPaid && (
          <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm print:bg-white">
            <div className="grid grid-cols-[130px_1fr] gap-y-1.5">
              <div className="text-slate-500">Telah diterima dari</div>
              <div className="font-medium text-slate-900">: {customerName}</div>
              <div className="text-slate-500">Uang sejumlah</div>
              <div className="font-bold text-slate-900">: {rupiah(bd.total)}</div>
              <div className="text-slate-500">Terbilang</div>
              <div className="italic text-slate-700">: {terbilangRupiah(bd.total)}</div>
              <div className="text-slate-500">Untuk pembayaran</div>
              <div className="text-slate-900">: {purpose}</div>
            </div>
          </div>
        )}

        {/* Rincian harga (faktur & kwitansi: transparansi diskon) */}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 font-semibold">Keterangan</th>
              <th className="pb-2 text-right font-semibold">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-3">
                <div className="font-medium text-slate-900">Langganan {company.brandName} — Paket {planName}</div>
                <div className="text-xs text-slate-500">Masa {payment.periodMonths} bulan</div>
              </td>
              <td className="py-3 text-right tabular-nums text-slate-700">{rupiah(bd.normalPrice)}</td>
            </tr>
            {bd.discount > 0 && (
              <tr className="border-b border-slate-100">
                <td className="py-3 text-emerald-700">Diskon{payment.couponCode ? ` (${payment.couponCode})` : ""}</td>
                <td className="py-3 text-right tabular-nums text-emerald-700">− {rupiah(bd.discount)}</td>
              </tr>
            )}
            {bd.discount > 0 && (
              <tr className="border-b border-slate-100">
                <td className="py-3 text-slate-600">Subtotal</td>
                <td className="py-3 text-right tabular-nums text-slate-700">{rupiah(bd.subtotal)}</td>
              </tr>
            )}
            {bd.taxAmount > 0 && (
              <tr className="border-b border-slate-100">
                <td className="py-3 text-slate-600">{taxLabel} ({bd.taxPercent}%)</td>
                <td className="py-3 text-right tabular-nums text-slate-700">{rupiah(bd.taxAmount)}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-4 text-right text-sm font-semibold text-slate-500">{isPaid ? "Diterima" : "Total Tagihan"}</td>
              <td className="pt-4 text-right text-lg font-bold tabular-nums text-slate-900">{rupiah(bd.total)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Catatan fee channel (hanya bila customer-imposed, LUNAS) — di LUAR total Lumite */}
        {isPaid && bd.channelFee > 0 && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-amber-50/50 p-3 text-xs text-slate-600 print:bg-white">
            <div className="flex justify-between">
              <span>Biaya layanan pembayaran (dibayar pelanggan ke channel)</span>
              <span className="tabular-nums">{rupiah(bd.channelFee)}</span>
            </div>
            <div className="mt-1 flex justify-between font-semibold text-slate-700">
              <span>Total dibayar pelanggan</span>
              <span className="tabular-nums">{rupiah(bd.grandTotalPaid)}</span>
            </div>
            <div className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{feeNote}</div>
          </div>
        )}

        {/* Metode & catatan kaki configurable */}
        <div className="mt-8 border-t border-slate-200 pt-4 text-xs text-slate-400">
          {isPaid && payment.paymentType && <div>Metode pembayaran: {payment.paymentType.replace(/_/g, " ")}</div>}
          {isPaid && payment.midtransTxId && <div>No. transaksi: {payment.midtransTxId}</div>}
          <div className="mt-1">{footerNote}</div>
          {!company.isPkp && <div className="mt-1">{company.legalName || company.brandName} bukan Pengusaha Kena Pajak (PKP) — transaksi tidak dikenakan PPN.</div>}
        </div>
      </div>
    </main>
  );
}
