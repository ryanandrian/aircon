# SSOT — WhatsApp Customer Service Platform Aircon

Status: ACTIVE
Last reviewed: 2026-09-15

## Tujuan

Menyediakan akses Customer Service WhatsApp yang konsisten untuk calon tenant dan owner/admin tenant.

## Sumber nomor tunggal

Nomor publik Customer Service **selalu dibaca dari sesi gateway platform**:

- Gateway session: `lumite-platform`
- Endpoint status: `GET /v1/wa/sessions/lumite-platform`
- Field sumber: `phone`
- Normalisasi: hanya digit (`62...`)

Nomor tidak boleh diambil dari `LandingContent.csWhatsapp`, hardcode nomor lain, atau fallback ke nomor perusahaan. `LandingContent.csWhatsapp` hanya legacy field CMS dan bukan sumber Customer Service.

Jika sesi gateway belum `ready` atau `phone` kosong, tombol Customer Service tidak ditampilkan. Ini mencegah link menuju nomor yang tidak aktif.

## Permukaan UI

Floating button Customer Service tampil pada:

- landing page publik `/`;
- panel owner/admin tenant `/app/*`.

Floating button tidak tampil pada:

- panel teknisi `/t/*`;
- `/login`;
- halaman checkout/payment.

Label desktop: `Chat CS Aircon`. Mobile: ikon WhatsApp dengan aria-label yang jelas.

## Perilaku link

Link memakai `https://wa.me/<phone>` dan pesan pembuka umum. Link dibuka pada tab baru dengan `noopener noreferrer`.

## Gateway connection UI

Halaman Admin Platform → Notifikasi → WhatsApp Lumite memantau sesi yang sama `lumite-platform`. Setelah QR berhasil dipindai, polling wajib mengambil status fresh (`cache: no-store`) agar UI berubah menjadi `Tersambung` dan menampilkan nomor aktual.

## Operasional

- Nomor gateway dikelola dari koneksi WhatsApp platform, bukan dari CMS landing.
- Penggantian nomor dilakukan dengan menghubungkan nomor baru ke sesi `lumite-platform`.
- Admin tidak perlu mengedit nomor CS di halaman landing.
- Nomor perusahaan pada halaman Kontak boleh berbeda; itu adalah kanal kontak legal, bukan sumber floating CS.

## Verifikasi wajib

- Status gateway `lumite-platform` ready dan mengembalikan `phone`.
- Landing dan `/app` memakai nomor yang sama.
- Sesi belum ready tidak menampilkan tombol.
- Setelah QR dipindai, UI berubah tanpa hard refresh melalui polling status fresh.
- Link `wa.me` memiliki nomor yang sama dengan field gateway.
