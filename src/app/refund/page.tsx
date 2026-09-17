import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kebijakan Pengembalian Dana — Aircon",
  description: "Kebijakan pengembalian dana langganan Aircon oleh PT. Lumite Automasi Indonesia.",
};

const UPDATED = "15 September 2026";

export default function RefundPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-5 py-12">
        <Link href="/" className="text-sm text-sky-600 hover:underline">← Kembali ke Beranda</Link>
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-foreground">Kebijakan Pengembalian Dana</h1>
        <p className="mt-2 text-sm text-muted-foreground">Terakhir diperbarui: {UPDATED}</p>

        <div className="prose-sm mt-8 space-y-6 text-foreground/85">
          <section className="space-y-2">
            <p>
              Kebijakan ini menjelaskan kapan <strong>PT. Lumite Automasi Indonesia</strong> (&ldquo;Lumite&rdquo;)
              mengembalikan dana langganan Aircon kepada tenant dan bagaimana proses pengajuannya.
              Kebijakan ini merupakan bagian dari <Link href="/ketentuan" className="text-sky-600 hover:underline">Ketentuan Layanan</Link> Aircon.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">1. Apa itu pengembalian dana?</h2>
            <p>
              Pengembalian dana (&ldquo;refund&rdquo;) adalah pengembalian seluruh atau sebagian dana yang telah
              diterima Lumite untuk pembayaran langganan Aircon. Refund berbeda dari pembatalan langganan:
              pembatalan menghentikan perpanjangan atau penggunaan berikutnya, sedangkan refund mengembalikan
              dana sesuai hasil verifikasi kasus.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">2. Kapan Lumite wajib mengembalikan dana?</h2>
            <p>Lumite akan mengembalikan dana apabila setelah verifikasi ditemukan salah satu kondisi berikut:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Pembayaran ganda atau kelebihan pembayaran yang tidak dapat dialihkan atas persetujuan tenant.</li>
              <li>Pembayaran berhasil tetapi paket tidak dapat diaktifkan karena kesalahan sistem Lumite.</li>
              <li>Paket, periode, atau nominal yang tercatat berbeda dari checkout dan tidak dapat dikoreksi secara adil.</li>
              <li>Lumite menghentikan layanan atau menutup akun tanpa pelanggaran tenant; refund dihitung untuk periode yang belum digunakan.</li>
              <li>Transaksi tidak sah terbukti setelah investigasi yang wajar.</li>
              <li>Refund diwajibkan oleh hukum atau instruksi resmi penyedia pembayaran.</li>
            </ul>
            <p>
              Jika masalah dapat diselesaikan dengan aktivasi ulang atau perpanjangan periode yang setara,
              Lumite dapat menawarkan penyelesaian tersebut terlebih dahulu. Tenant berhak meminta refund
              apabila penyelesaian tersebut tidak wajar atau tidak dapat dilakukan.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">3. Kondisi yang umumnya tidak memenuhi refund</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Tenant berubah pikiran setelah paket digunakan.</li>
              <li>Tenant tidak menggunakan aplikasi setelah pembayaran.</li>
              <li>Tenant lupa membatalkan sebelum melakukan pembayaran.</li>
              <li>Masalah perangkat, koneksi internet, atau konfigurasi milik tenant.</li>
              <li>Gangguan WhatsApp, iPaymu, atau pihak ketiga ketika layanan Aircon tetap dapat digunakan.</li>
            </ul>
            <p>
              Daftar ini tidak mengurangi hak tenant berdasarkan hukum yang berlaku atau hak refund yang
              secara khusus dinyatakan pada bagian sebelumnya.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">4. Jenis dan nilai refund</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Refund penuh:</strong> seluruh pembayaran dikembalikan apabila seluruh transaksi tidak dapat digunakan atau terjadi pembayaran ganda yang tidak dapat dialihkan.</li>
              <li><strong>Refund sebagian:</strong> bagian periode atau nominal yang tidak dapat digunakan dikembalikan secara proporsional.</li>
              <li><strong>Kredit layanan:</strong> atas persetujuan tenant, dana dapat dialihkan menjadi perpanjangan atau kredit periode berikutnya.</li>
            </ul>
            <p>
              Biaya payment gateway hanya dapat dipotong apabila biaya tersebut benar-benar tidak dikembalikan
              oleh penyedia pembayaran dan hal itu diinformasikan dalam keputusan refund. Lumite tidak memotong
              biaya secara sepihak tanpa penjelasan.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">5. Cara mengajukan refund</h2>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Kirim permintaan ke <a href="mailto:info@lumite.biz.id" className="text-sky-600 hover:underline">info@lumite.biz.id</a> maksimal 7 hari kalender sejak masalah diketahui.</li>
              <li>Sertakan nama usaha, email akun, order/reference ID, tanggal pembayaran, nominal, dan alasan permintaan.</li>
              <li>Lumite memverifikasi status payment, aktivasi paket, periode yang sudah digunakan, dan data dari penyedia pembayaran.</li>
              <li>Lumite menyampaikan keputusan, nominal, metode, dan estimasi waktu refund melalui email.</li>
            </ol>
            <p>Jangan mengirim API key, VA secret, PIN, kata sandi, atau data kartu melalui email.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">6. Waktu dan metode pengembalian</h2>
            <p>
              Refund dikirim melalui metode pembayaran asal jika tersedia. Setelah keputusan disetujui,
              proses biasanya memerlukan 5–14 hari kerja, bergantung pada proses Lumite dan penyedia pembayaran.
              Waktu tampil di rekening atau saldo dapat berbeda dari waktu pengiriman refund.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">7. Dampak refund</h2>
            <p>
              Jika refund disetujui, Lumite dapat membatalkan invoice/payment terkait, menyesuaikan periode
              langganan, membalikkan kupon atau komisi yang terkait, dan mencatat koreksi pada riwayat billing.
              Tidak ada data pembayaran yang dihapus; koreksi dicatat untuk audit.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">8. Kontak</h2>
            <p>
              <strong>PT. Lumite Automasi Indonesia</strong><br />
              Depok Town Square, Lt. 2 Blok SS-2 No. 9, Jl. Margonda Raya No. 1,<br />
              Depok, Jawa Barat 16424<br />
              Telepon/WhatsApp: <a href="tel:+6285880181816" className="text-sky-600 hover:underline">+62 858 8018 1816</a><br />
              Email: <a href="mailto:info@lumite.biz.id" className="text-sky-600 hover:underline">info@lumite.biz.id</a><br />
              Jam layanan: Senin–Jumat, 10:00–17:00 WIB
            </p>
          </section>
        </div>

        <div className="mt-10 border-t pt-6 text-sm text-muted-foreground">
          <Link href="/ketentuan" className="text-sky-600 hover:underline">Ketentuan Layanan</Link>
          <span className="mx-2">·</span>
          <Link href="/privasi" className="text-sky-600 hover:underline">Kebijakan Privasi</Link>
          <span className="mx-2">·</span>
          <Link href="/" className="text-sky-600 hover:underline">Beranda</Link>
        </div>
      </div>
    </main>
  );
}
