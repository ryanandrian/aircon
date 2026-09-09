# RENCANA — Cetak, Kirim (WA/Email), Bill-To Kantor Pusat & Kwitansi

> Status: ✅ SELESAI & LIVE (2026-09-09). Semua lapis (A–E) dieksekusi, teruji, deploy produksi.
> Dokumen ini disimpan sebagai jejak keputusan + hasil. Bagian "STATUS AKHIR" di bawah = kondisi NYATA;
> bagian rencana asli dipertahankan sebagai konteks historis.

## STATUS AKHIR (yang benar-benar ter-ship)
- LAPIS A (bill-to kantor pusat): LIVE. `createInvoiceFromSession` memakai `resolveBillingCustomer`;
  Invoice menyimpan `customerId` (outlet) + `billingCustomerId` (pusat). InvoiceView menampilkan
  "Ditagihkan kepada: [pusat]" + "Lokasi servis: [outlet]". docType/jatuh tempo ikut TOP kantor pusat.
  **Pemilih di UI**: form Pelanggan (seksi BADAN) → "Kantor Pusat (penerima tagihan)" + tombol
  "+ Pilih kantor pusat" (cari pelanggan induk). listCustomerRows membawa billingCustomerId/Name.
- LAPIS C (email opsional): LIVE. 3 kolom nullable `picFinanceEmail`, `picWorkEmail`, `email`
  (migrasi additive). Form menampilkan Email PIC Keuangan / PIC Pekerjaan / Perusahaan. `resolveBillingContact`
  → PIC keuangan bila terisi, else kontak utama.
- LAPIS D (Cetak + Kirim WA): LIVE. Komponen `InvoiceActions` di /app/faktur/[id] & /t/faktur/[id]:
  "Cetak / Simpan PDF" (window.print + print:hidden) + "Kirim via WA" (OTOMATIS via gatewaySend,
  nomor tenant, ringkasan teks ke kontak penagihan).
- LAPIS E (Kwitansi): LIVE. `KwitansiView` + route /app/kwitansi/[id] & /t/kwitansi/[id]; tombol
  "Lihat / cetak Kwitansi" muncul saat invoice PAID; Cetak + Kirim WA. Nomor "KW/…" dari nomor invoice,
  memuat "terbilang".
- PANDUAN: topik help owner "pelanggan" & "faktur-detail" DIPERBARUI (kantor pusat, PIC keuangan, email,
  Cetak/Kirim WA, Kwitansi) — verbatim dengan label tombol UI.
- DITUNDA (milestone infra terpisah, belum dikerjakan): lampiran PDF via WA (butuh endpoint media di
  gateway VPS) + kirim EMAIL otomatis (model SMTP Gmail per-tenant). Field email sudah disimpan (siap pakai).

---

# (RENCANA ASLI — konteks historis)

> Status: RANCANGAN (belum dieksekusi). Menunggu persetujuan owner.
> Sifat: menyentuh DB produksi bersama (migrasi) + alur uang (sensitif) → WAJIB bertahap, additive, teruji.
> Sumber niat: RENCANA_INVOICING_AR.md (bill-to b.41/107, PIC ganda b.276, alur tempo b.166-168),
> Dokumen_Keuangan_Faktur_Kwitansi.md, + arahan owner (sesi ini).

## Verifikasi kondisi SEKARANG (dari kode)
- `Customer.billingCustomerId` self-relation ("kantor pusat") SUDAH ADA + fungsi `resolveBillingCustomer()`
  SUDAH ADA — TAPI TIDAK dipakai. `createInvoiceFromSession` memakai `customerId: ws.customer.id`
  (unit lokasi), bukan bill-to. → fitur setengah jadi (fondasi ada, sambungan putus).
- `Customer` punya `picFinanceName` + `picFinancePhone`, TAPI belum ada `picFinanceEmail`/`email`.
- Cabang tunai→INVOICE / tempo→PROFORMA sudah jalan (worksession-service.ts:167-168). Konversi
  proforma→invoice ada. KWITANSI sebagai dokumen belum ada (fondasi: finance-doc.ts + terbilang.ts).
- InvoiceView sudah mengelompokkan item PER UNIT (assetMap) — siap menampilkan "AC Dapur — PH Depok 1".
- Halaman faktur (admin & teknisi) belum punya tombol Cetak maupun Kirim.
- Pola reuse tersedia: `window.print()` (langganan/faktur), `wa.me` (banyak layar), print-CSS (globals.css).

## Alur bisnis target (dikonfirmasi owner)
- RUMAHAN (tunai): teknisi terbitkan INVOICE + KWITANSI (bila diminta) langsung di lokasi.
- INSTITUSI (tempo): teknisi terbitkan PROFORMA → admin pusat konversi jadi INVOICE → tagih ke
  pelanggan (PIC keuangan) → saat lunas, admin terbitkan KWITANSI → kirim ke PIC keuangan.
- Kirim tagihan: institusi tidak terbiasa via WA; UTAMAKAN EMAIL ke PIC keuangan. Aturan:
  bila PIC keuangan (phone/email) terisi → tujuan kirim = PIC keuangan; bila kosong → kontak utama.
- Kantor pusat: outlet (mis. PH Depok 1) ditagihkan ke kantor pusat (bill-to), TAPI tiap baris unit
  menyebут lokasi outlet jelas ("AC Dapur — PH Depok 1") agar pusat tahu tagihan untuk outlet mana.

## LAPIS A — Sambungkan bill-to kantor pusat  [fondasi ada, dampak besar, risiko rendah]
- `createInvoiceFromSession`: resolve `billTo = resolveBillingCustomer(tenantId, ws.customer.id)`;
  set `customerId: billTo.id`. Tambah kolom `serviceCustomerId` (unit lokasi) di Invoice agar
  jejak "servis di outlet mana" tersimpan (migrasi additive, nullable).
- InvoiceView: bila `billTo ≠ serviceCustomer`, label grup unit = `${roomLocation} — ${namaOutlet}`.
  Header "Ditagihkan kepada: [Kantor Pusat]".
- Pertimbangan: docType (tunai/tempo) mengikuti TOP milik SIAPA? Best practice: ikut bill-to
  (kantor pusat yang bayar) — perlu ditegaskan owner. (Default aman: ikut bill-to.)
- Test: bill-to kosong → tagih diri sendiri (tak berubah); bill-to terisi → invoice ke pusat +
  label outlet benar; keamanan tenant-scoped.

## LAPIS B — Label lokasi outlet
- Tanpa field baru. Label = `Asset.roomLocation` + nama customer-lokasi (service customer).
  Hanya diformat saat bill-to ≠ service customer. Sudah didukung struktur InvoiceView.

## LAPIS C — Email pelanggan / PIC keuangan  [migrasi additive kecil]
- Tambah `Customer.picFinanceEmail String?` (dan opsional `email String?` kontak umum).
- Form tambah/edit pelanggan: input email (+ email PIC keuangan untuk BADAN).
- Helper `resolveBillingContact(customer)`: kembalikan { nama, phone, email } — PIC keuangan bila
  terisi, else kontak utama. Dipakai fitur Kirim (Lapis D).
- Migrasi manual additive (nullable) — pola aman DB produksi bersama (lihat checklist-per-layanan).

## LAPIS D — Cetak + Kirim (WA/Email)  [permintaan awal owner]
- Komponen `InvoiceActions` (client) dipakai di admin `/app/faktur/[id]` & teknisi `/t/faktur/[id]`,
  `print:hidden`:
  1. Cetak/Simpan PDF — `window.print()` + bungkus print-bersih (pola langganan).
  2. Kirim WA — `wa.me/{tujuan}` (tujuan = resolveBillingContact.phone). Ringkasan teks:
     usaha, no+tanggal+jatuh tempo, total, info transfer bank. (QRIS tak bisa via wa.me → teks saja.)
  3. Kirim Email — `mailto:{email PIC keuangan}?subject&body` (auto-terisi bila email ada; institusi
     utamakan ini). Bila email kosong → sembunyikan/nonaktifkan tombol Email dengan pesan jelas.
- Catatan jujur: mailto & wa.me = buka draf di aplikasi pengirim (bukan kirim otomatis server).
  Kirim otomatis (SMTP/gateway) = proyek terpisah, di luar lapis ini.

## LAPIS E — Kwitansi (dokumen saat LUNAS)  [terpisah, menyusul]
- Dokumen KWITANSI dibuat saat Invoice PAID (fondasi: finance-doc.ts + terbilang.ts).
- Cetak + Kirim (WA/Email ke PIC keuangan), pola sama Lapis D.
- Nomor kwitansi berurut; tampilkan "terbilang".

## Urutan eksekusi disarankan (bertahap, tiap lapis teruji + deploy + verifikasi produksi)
1. LAPIS A (bill-to) — berdampak besar, fondasi ada.
2. LAPIS C (email PIC keuangan) — migrasi additive kecil.
3. LAPIS D (cetak + kirim) — permintaan awal.
4. LAPIS E (kwitansi) — dokumen saat lunas.
(Lapis B menyatu ke A.)

## Keputusan yang butuh owner sebelum eksekusi
1. docType untuk bill-to: ikut TOP kantor pusat (disarankan) atau TOP outlet?
2. Email: cukup `picFinanceEmail`, atau tambah `email` kontak umum juga?
3. Kwitansi (Lapis E) dikerjakan sekarang atau ditunda setelah A/C/D?
4. Konfirmasi: TIDAK ada kirim otomatis server (SMTP/gateway) di lingkup ini — hanya draf wa.me/mailto.

## KEPUTUSAN OWNER (sesi 2026-09-09) + REALITA INFRA (terverifikasi kode)
Owner menjawab:
1. docType ikut kantor pusat (bill-to) — SETUJU.
2. Email OPSIONAL 3 jenis: email finance, email PIC pekerjaan, email perusahaan. Semua tidak wajib;
   bila KOSONG → semua informasi lari ke WA utama. SETUJU.
3. Tuntas E2E terkait keuangan.
4. Tidak otomatis penuh: tombol Cetak PDF (admin kirim manual) + tombol Kirim WA (OTOMATIS via
   WA gateway, nomor milik tenant). Email: belum punya gateway email; opsi via SMTP Gmail akun tenant.

REALITA INFRA (dicek di kode — PENTING, membatasi #4):
- `src/lib/wa/gateway-relay.ts` → `gatewaySend(tenantId,toPhone,message)` POST `/v1/wa/send` dengan
  `{externalId,toPhone,message}` = TEKS SAJA. TIDAK ADA endpoint media/dokumen → kirim PDF via WA
  BELUM BISA tanpa upgrade gateway VPS (repo lumite-gateway) lebih dulu. externalId=tenantId (nomor tenant ✓).
- `src/lib/email/smtp.ts` → `sendEmail(to,subject,body)` via SMTP `admin@lumite.biz.id` (akun LUMITE,
  bukan Gmail tenant), teks/HTML, TANPA lampiran. "Kirim via Gmail akun tenant" = model BARU (butuh
  App Password/OAuth2 per tenant + simpan kredensial sensitif + limit Gmail) → proyek tersendiri.
- Guard anti-spam sudah ada (WA_SAFE_MODE / allowlist) — kirim nyata patuhi ini.

DAMPAK ke rencana:
- BISA sekarang: Cetak PDF (window.print) + Kirim WA TEKS otomatis (gatewaySend) ke tujuan
  (PIC keuangan bila ada, else WA utama). Reuse penuh.
- BELUM BISA sekarang (butuh milestone infra terpisah): lampiran PDF via WA (endpoint media gateway),
  email-kirim dari Gmail tenant (model SMTP Gmail per-tenant).
- Field email (Lapis C) TETAP disimpan 3 jenis (finance/pekerjaan/perusahaan) sekarang — murah &
  future-proof; tombol Email diaktifkan bila `isEmailConfigured()` (pakai SMTP Lumite + Reply-To
  email tenant) ATAU ditunda sampai model Gmail-tenant diputuskan.

REKOMENDASI ASISTEN (menunggu 1 keputusan owner — model Kirim):
- Kerjakan: Lapis A (bill-to) + Lapis C (3 email opsional + resolver kontak) + Lapis D-revisi
  (Cetak PDF + Kirim WA TEKS otomatis via gateway) + Lapis E (kwitansi: cetak + WA teks).
- TUNDA jadi milestone terpisah: lampiran PDF (WA & email) + email dari Gmail tenant.
- PILIHAN owner tersisa: (a) email-kirim pakai SMTP Lumite yang sudah ada sekarang (Reply-To tenant),
  atau (b) tunda email-kirim sampai model Gmail-tenant siap. Default aman asisten: (b) tunda,
  simpan field email dulu.

## Risiko & mitigasi
- DB produksi bersama: SEMUA migrasi additive (nullable), backup dulu, `migrate deploy` manual.
- Alur uang: LAPIS A mengubah customerId invoice → uji E2E ke DB (bill-to kosong tak berubah;
  bill-to terisi benar) SEBELUM deploy. Rollback teruji.
- Nol perubahan pada alur yang sudah jalan (tunai/tempo, konversi) selain penyisipan bill-to.
