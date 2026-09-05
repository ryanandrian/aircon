import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Ketentuan Layanan — Aircon",
  description: "Ketentuan Layanan aplikasi Aircon (PT Lumite Automasi Indonesia).",
};

const UPDATED = "5 September 2026";

/**
 * Ketentuan Layanan PUBLIK — WAJIB untuk publish OAuth Google (production) & kejelasan hukum.
 * Statis, dapat diakses tanpa login.
 */
export default function KetentuanPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-5 py-12">
        <Link href="/" className="text-sm text-sky-600 hover:underline">← Kembali ke Beranda</Link>
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-foreground">Ketentuan Layanan</h1>
        <p className="mt-2 text-sm text-muted-foreground">Terakhir diperbarui: {UPDATED}</p>

        <div className="prose-sm mt-8 space-y-6 text-foreground/85">
          <section className="space-y-2">
            <p>
              Ketentuan Layanan ini (&ldquo;Ketentuan&rdquo;) mengatur penggunaan aplikasi <strong>Aircon</strong>
              yang dioperasikan oleh <strong>PT Lumite Automasi Indonesia</strong> (&ldquo;kami&rdquo;) di
              <strong> app.airconet.id</strong> (&ldquo;Layanan&rdquo;). Dengan mendaftar atau menggunakan
              Layanan, Anda menyetujui Ketentuan ini.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">1. Layanan</h2>
            <p>
              Aircon adalah aplikasi pengelolaan usaha jasa servis AC: mencatat pelanggan dan unit AC,
              menjadwalkan pekerjaan teknisi, membuat faktur, serta mengirim pengingat servis melalui WhatsApp.
              Fitur dapat berkembang dari waktu ke waktu.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">2. Akun</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Anda wajib memberikan informasi yang benar saat mendaftar dan menjaga keamanan akun Anda.</li>
              <li>Anda bertanggung jawab atas seluruh aktivitas yang terjadi di bawah akun Anda.</li>
              <li>Layanan ditujukan untuk pengguna usaha (bisnis), bukan untuk anak di bawah umur.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">3. Langganan & Pembayaran</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Tersedia paket gratis (dengan batasan) dan paket berbayar dengan fitur/kapasitas lebih.</li>
              <li>Pembayaran diproses melalui mitra resmi (Midtrans). Harga dan pajak yang berlaku ditampilkan sebelum pembayaran.</li>
              <li>Langganan berlaku untuk periode yang dipilih. Keterlambatan pembayaran dapat menyebabkan penonaktifan sementara sesuai kebijakan yang berlaku.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">4. Penggunaan yang Dapat Diterima</h2>
            <p>Anda setuju untuk tidak:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Menggunakan Layanan untuk mengirim spam atau pesan yang melanggar hukum kepada pihak lain.</li>
              <li>Mengganggu, meretas, atau menyalahgunakan sistem dan infrastruktur Layanan.</li>
              <li>Menggunakan Layanan untuk tujuan yang melanggar hukum yang berlaku di Indonesia.</li>
            </ul>
            <p>
              Anda bertanggung jawab memastikan bahwa pengiriman pesan kepada pelanggan Anda mematuhi hukum dan
              ketentuan platform WhatsApp yang berlaku.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">5. Data Anda</h2>
            <p>
              Data yang Anda masukkan tetap milik Anda. Kami memproses data sesuai
              {" "}<Link href="/privasi" className="text-sky-600 hover:underline">Kebijakan Privasi</Link>. Anda
              bertanggung jawab atas keabsahan dan izin penggunaan data pelanggan yang Anda kelola.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">6. Ketersediaan & Batasan Tanggung Jawab</h2>
            <p>
              Kami berupaya menjaga Layanan tersedia dan andal, namun Layanan disediakan &ldquo;sebagaimana
              adanya&rdquo;. Sepanjang diizinkan hukum, kami tidak bertanggung jawab atas kerugian tidak
              langsung yang timbul dari penggunaan Layanan, termasuk gangguan pihak ketiga (mis. platform
              WhatsApp atau penyedia pembayaran).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">7. Penghentian</h2>
            <p>
              Anda dapat berhenti menggunakan Layanan kapan saja. Kami dapat menangguhkan akun yang melanggar
              Ketentuan ini. Ketentuan penonaktifan dan penghapusan data mengikuti kebijakan yang berlaku.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">8. Perubahan</h2>
            <p>Kami dapat memperbarui Ketentuan ini. Perubahan penting akan diberitahukan melalui Layanan atau email.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">9. Hukum yang Berlaku & Kontak</h2>
            <p>
              Ketentuan ini tunduk pada hukum Republik Indonesia. Pertanyaan dapat dikirim ke:
              {" "}<strong>admin@lumite.biz.id</strong><br />
              PT Lumite Automasi Indonesia — Depok, Jawa Barat, Indonesia.
            </p>
          </section>
        </div>

        <div className="mt-10 border-t pt-6 text-sm text-muted-foreground">
          <Link href="/privasi" className="text-sky-600 hover:underline">Kebijakan Privasi</Link>
          <span className="mx-2">·</span>
          <Link href="/" className="text-sky-600 hover:underline">Beranda</Link>
        </div>
      </div>
    </main>
  );
}
