# Data Dummy Demo — tenant "AC Jaya Demo" (slug: demo-ac-jaya)

Data dummy **realistis** untuk keperluan tangkapan layar (halaman Pratinjau) & testing selama development.
Memberi kesan bisnis servis AC yang **ramai & sudah lama berjalan** (puluhan pelanggan, banyak pekerjaan,
omzet & piutang terisi). HANYA menyentuh tenant demo — tenant lain aman.

## Isi (skala)
- ~40 pelanggan (perorangan + instansi) · ~145 unit AC
- 8 layanan katalog + 3 harga khusus pelanggan
- 6 teknisi (5 dummy + Andi)
- 60 pekerjaan: 40 selesai · 8 berjalan · 12 terjadwal
- 40 invoice: ~27 LUNAS (omzet ±Rp20jt) · proforma piutang · sebagian overdue
- 55 pengingat servis

## Cara isi (idempoten — hapus data demo lama lalu isi ulang)
```
node --env-file=.env scripts/demo/seed-demo-1.mjs   # pelanggan, unit, layanan, teknisi
node --env-file=.env scripts/demo/seed-demo-2.mjs   # pekerjaan, worksession, invoice, pembayaran, pengingat
```
Part 1 menulis konteks ke `/tmp/seed_ctx.json`; part 2 membacanya. Jalankan berurutan.

## HAPUS saat GO-LIVE PRODUCTION (WAJIB)
```
node --env-file=.env scripts/demo/wipe-demo.mjs
```
Mengosongkan seluruh data dummy tenant demo. Jalankan sebelum rilis komersial agar tak ada data palsu.

> Catatan: nomor telepon semua dummy (bukan nomor asli) → tak ada WhatsApp nyasar.
> Teknisi dummy PIN: 000001..000005 (phone 62899000xx).
