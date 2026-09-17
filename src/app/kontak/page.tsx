import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kontak — Aircon",
  description: "Hubungi PT. Lumite Automasi Indonesia, pengelola Aircon.",
};

export default function KontakPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-5 py-12">
        <Link href="/" className="text-sm text-sky-600 hover:underline">← Kembali ke Beranda</Link>
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-foreground">Kontak</h1>
        <p className="mt-2 text-muted-foreground">Kami siap membantu pertanyaan tentang Aircon, langganan, dan pembayaran.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border bg-card p-5">
            <h2 className="font-bold text-foreground">Kantor Pusat</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">PT. Lumite Automasi Indonesia<br />Depok Town Square, Lt. 2 Blok SS-2 No. 9<br />Jl. Margonda Raya No. 1<br />Depok, Jawa Barat 16424</p>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <h2 className="font-bold text-foreground">Hubungi Kami</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Email: <a href="mailto:info@lumite.biz.id" className="text-sky-600 hover:underline">info@lumite.biz.id</a><br />
              Telepon/WhatsApp: <a href="tel:+6285880181816" className="text-sky-600 hover:underline">+62 858 8018 1816</a><br />
              Senin–Jumat, 10:00–17:00 WIB
            </p>
          </div>
        </div>
        <div className="mt-10 border-t pt-6 text-sm text-muted-foreground">
          <Link href="/ketentuan" className="text-sky-600 hover:underline">Ketentuan Layanan</Link><span className="mx-2">·</span>
          <Link href="/privasi" className="text-sky-600 hover:underline">Kebijakan Privasi</Link><span className="mx-2">·</span>
          <Link href="/refund" className="text-sky-600 hover:underline">Kebijakan Pengembalian Dana</Link>
        </div>
      </div>
    </main>
  );
}
