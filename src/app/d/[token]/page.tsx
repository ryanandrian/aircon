import { getInvoiceForPublicDoc } from "@/lib/services/invoice-service";
import { InvoiceView } from "@/components/invoice-view";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

/**
 * F7b (keputusan pemilik A+C, 2026-10-14) — halaman dokumen PUBLIK bertoken.
 *
 * Tujuan: pelanggan bisa MEMBUKA & MENCETAK sendiri invoice/proforma dari tautan
 * yang dikirim via WhatsApp; admin tetap bisa Cetak/PDF lalu kirim manual via
 * WhatsApp Apps/Web miliknya bila perlu.
 *
 * Jalur yang dipakai (sesuai ATURAN JALUR keputusan pemilik):
 *  - Pola PERSIS /riwayat/{token} (customer-card-service) yang sudah mapan —
 *    token acak tinggi entropi (randomBytes(24) → base64url) = anti-enumeration.
 *  - Reuse PENUH getInvoiceForView (logika tenant/billTo/assetMap TIDAK diduplikasi)
 *    via loader getInvoiceForPublicDoc; 0 perubahan perilaku rute internal.
 *  - NOL komponen/kolektor/gaya baru: <InvoiceView> + PrintButton (pola
 *    window.print dgn Button+Icon.Print yang SUDAH ada — tanpa gaya kustom).
 *  - Dokumen CANCELLED tampil jujur (status "Batal" via InvoiceView).
 *  - TANPA sesi auth; scope hanya lewat token (1 token = 1 dokumen).
 */
export default async function PublicDocPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getInvoiceForPublicDoc(token);

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <div className="text-center">
          <h1 className="text-lg font-bold text-foreground">Dokumen tidak ditemukan</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tautan dokumen tidak valid atau sudah tidak berlaku.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-16 print:pb-0">
      <div className="mx-auto max-w-4xl space-y-4 px-5 py-6 print:max-w-none print:p-0">
        <InvoiceView inv={data.inv} tenant={data.tenant} assetMap={data.assetMap} billTo={data.billTo} />
        <div className="print:hidden">
          <PrintButton />
        </div>
      </div>
    </main>
  );
}
