import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kebijakan Privasi — Aircon",
  description: "Kebijakan Privasi aplikasi Aircon (PT Lumite Automasi Indonesia).",
};

const UPDATED = "5 September 2026";

/**
 * Kebijakan Privasi PUBLIK — WAJIB untuk publish OAuth Google (production) & kepercayaan tenant.
 * Statis, dapat diakses tanpa login. Konten disusun untuk SaaS B2B Indonesia (UU PDP No. 27/2022).
 */
export default function PrivasiPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-5 py-12">
        <Link href="/" className="text-sm text-sky-600 hover:underline">← Kembali ke Beranda</Link>
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-foreground">Kebijakan Privasi</h1>
        <p className="mt-2 text-sm text-muted-foreground">Terakhir diperbarui: {UPDATED}</p>

        <div className="prose-sm mt-8 space-y-6 text-foreground/85">
          <section className="space-y-2">
            <p>
              Kebijakan Privasi ini menjelaskan bagaimana <strong>Aircon</strong>, layanan perangkat lunak
              yang dioperasikan oleh <strong>PT Lumite Automasi Indonesia</strong> (&ldquo;kami&rdquo;),
              mengumpulkan, menggunakan, dan melindungi data Anda saat menggunakan aplikasi di
              <strong> app.airconet.id</strong> (&ldquo;Layanan&rdquo;). Dengan menggunakan Layanan, Anda
              menyetujui praktik yang diuraikan di sini.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">1. Data yang Kami Kumpulkan</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Data akun:</strong> nama, alamat email, dan foto profil dari akun Google Anda saat masuk (Sign in with Google).</li>
              <li><strong>Data usaha:</strong> nama usaha, kota, nomor WhatsApp, logo, dan data operasional yang Anda masukkan (pelanggan, unit AC, pekerjaan, faktur).</li>
              <li><strong>Data pelanggan Anda:</strong> nama, nomor telepon/WhatsApp, dan alamat pelanggan yang Anda kelola melalui Layanan.</li>
              <li><strong>Data teknis:</strong> alamat IP, jenis perangkat, dan log aktivitas untuk keamanan dan pemeliharaan sistem.</li>
              <li><strong>Data pembayaran:</strong> diproses oleh mitra pembayaran resmi (Midtrans); kami tidak menyimpan nomor kartu Anda.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">2. Penggunaan Data Google</h2>
            <p>
              Kami hanya mengakses informasi dasar profil Google Anda (nama, email, foto) untuk membuat dan
              mengautentikasi akun Anda. Kami <strong>tidak</strong> membaca email Gmail, kontak, atau data
              Google lain, dan <strong>tidak</strong> menjual atau membagikan data Google Anda kepada pihak ketiga
              untuk tujuan periklanan.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">3. Cara Kami Menggunakan Data</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Menyediakan dan mengoperasikan fitur Layanan (jadwal servis, faktur, laporan).</li>
              <li>Mengirim pengingat servis melalui WhatsApp kepada pelanggan Anda, atas instruksi Anda.</li>
              <li>Memproses pembayaran langganan dan mengirim notifikasi terkait akun.</li>
              <li>Menjaga keamanan, mencegah penyalahgunaan, dan meningkatkan Layanan.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">4. WhatsApp</h2>
            <p>
              Layanan membantu Anda mengirim pesan pengingat kepada pelanggan Anda melalui WhatsApp. Pesan
              dikirim atas kehendak dan tanggung jawab Anda sebagai pemilik usaha. Kami tidak membaca isi
              percakapan pribadi Anda.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">5. Berbagi Data dengan Pihak Ketiga</h2>
            <p>Kami hanya membagikan data seperlunya kepada penyedia layanan yang mendukung operasional:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Midtrans</strong> — pemrosesan pembayaran.</li>
              <li><strong>Supabase & penyedia infrastruktur cloud</strong> — penyimpanan data & autentikasi.</li>
              <li><strong>Penyedia gateway WhatsApp</strong> — pengiriman pesan pengingat.</li>
            </ul>
            <p>Kami tidak menjual data pribadi Anda kepada siapa pun.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">6. Keamanan & Penyimpanan</h2>
            <p>
              Kami menerapkan langkah keamanan yang wajar (enkripsi saat transit/HTTPS, kontrol akses, isolasi
              data antar-pengguna) untuk melindungi data Anda. Data disimpan selama akun Anda aktif dan dapat
              dihapus sesuai kebijakan penonaktifan akun.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">7. Hak Anda</h2>
            <p>
              Sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi, Anda berhak mengakses, memperbaiki,
              dan meminta penghapusan data pribadi Anda. Hubungi kami untuk menggunakan hak tersebut.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">8. Perubahan Kebijakan</h2>
            <p>
              Kami dapat memperbarui Kebijakan Privasi ini dari waktu ke waktu. Perubahan penting akan
              diberitahukan melalui Layanan atau email.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">9. Kontak</h2>
            <p>
              Pertanyaan mengenai privasi dapat dikirim ke: <strong>admin@lumite.biz.id</strong><br />
              PT Lumite Automasi Indonesia — Depok, Jawa Barat, Indonesia.
            </p>
          </section>
        </div>

        <div className="mt-10 border-t pt-6 text-sm text-muted-foreground">
          <Link href="/ketentuan" className="text-sky-600 hover:underline">Ketentuan Layanan</Link>
          <span className="mx-2">·</span>
          <Link href="/" className="text-sky-600 hover:underline">Beranda</Link>
        </div>
      </div>
    </main>
  );
}
