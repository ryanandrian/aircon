# Dokumen Keuangan: FAKTUR vs KWITANSI (SSOT)

Arsitektur & kaidah akuntansi Indonesia untuk dokumen keuangan Aircon (Lumite → tenant).
Satu halaman `src/app/app/langganan/faktur/[id]/page.tsx` merender DUA dokumen berbeda menurut status Payment.

## Prinsip: dua dokumen, tujuan berbeda (JANGAN disamakan)
| | FAKTUR (Invoice) | KWITANSI (Receipt) |
|---|---|---|
| Kapan | status BELUM lunas (PENDING/FAILED/EXPIRED) | status PAID |
| Tujuan | TAGIHAN — menuntut pembayaran | BUKTI TERIMA uang (bukti kas masuk) |
| Menghadap | ke depan (yang harus dibayar) | ke belakang (yang sudah diterima) |
| Inti | "TOTAL TAGIHAN" + tombol Bayar | "Telah diterima dari … sejumlah … terbilang … untuk …" |
| Angka utama | total tagihan Lumite | uang yang DITERIMA Lumite |

## Kaidah akuntansi Indonesia yang dipatuhi
- **Non-PKP**: Lumite (CompanyProfile.isPkp=false) HANYA menerbitkan faktur komersial + kwitansi. DILARANG "Faktur Pajak" (khusus PKP via e-Faktur DJP) & DILARANG memungut PPN → taxPercent efektif 0.
- **Kwitansi wajib "terbilang"** (angka → huruf) — ciri kwitansi sah Indonesia. Helper `terbilangRupiah` (PURE, teruji).
- **Meterai**: bea meterai Rp10.000 hanya WAJIB bila dokumen penerimaan uang > Rp5.000.000 (UU 10/2020). Transaksi kecil tak perlu. (Masa depan: e-Meterai untuk paket tahunan besar.)
- **Pengakuan pendapatan** (PSAK 72): langganan dibayar di muka secara teknis unearned revenue diakui bertahap — urusan ledger, BUKAN kwitansi. Kwitansi cukup bukti kas masuk.

## Perlakuan biaya payment gateway (INTI — sering salah)
Midtrans dua mode (diatur di DASHBOARD Midtrans, BUKAN kode):
- **Customer-imposed fee** (kondisi saat ini): fee channel DITAMBAHKAN ke tagihan, DIBAYAR pelanggan. gross = harga + fee (mis. 10.000 + 4.440 = 14.440). Midtrans kirim rincian di `metadata.extra_info.gross_amount_info`.
  - Jurnal Lumite: Kas 10.000 | Pendapatan 10.000. Fee 4.440 TIDAK masuk buku Lumite (transaksi pelanggan↔channel).
  - **Kwitansi Lumite = 10.000** (yang diterima). Fee = CATATAN KAKI informatif ("dibayar pelanggan ke channel, di luar penerimaan Lumite"), TIDAK menambah total kwitansi.
- **Merchant-borne (MDR)**: fee ditanggung Lumite, dipotong dari settlement. Jurnal: Kas 9.550 | Beban Adm Bank 450 | Pendapatan 10.000. MDR = beban INTERNAL Lumite, TETAP TIDAK muncul di kwitansi pelanggan.
- **Kesimpulan**: apa pun mode, pendapatan & kwitansi Lumite = harga jual. MDR/fee TIDAK PERNAH jadi baris di dokumen pelanggan (maks. catatan kaki bila customer-imposed).

## Sumber angka (PURE, teruji — `src/lib/domain/finance-doc.ts`)
- `extractGrossInfo(rawNotif)` → {originalAmount, customerImposedFee, grossPaidByCustomer} dari gross_amount_info (kosong bila tak ada).
- `computeFinanceBreakdown({amount, discount, taxPercent, channelFee})` → {normalPrice, discount, subtotal, taxPercent, taxAmount, total, channelFee, grandTotalPaid}.
  - `total` = payment.amount (ditagih & DITERIMA Lumite). `grandTotalPaid` = total + channelFee (dibayar pelanggan).
- Rincian diskon: normalPrice (harga sebelum diskon) → −discount (couponCode) → subtotal → pajak → total.

## Configurable (admin /admin/perusahaan → CompanyProfile)
Catatan kaki EDITABLE (kosong = default sistem):
- `invoiceNote` — catatan kaki faktur.
- `receiptNote` — catatan kaki kwitansi.
- `paymentFeeNote` — penjelasan biaya channel (saat customer-imposed).
Juga configurable: legalName, npwp, isPkp, taxLabel, alamat, logo, checkoutExpiryHours, finishUrl.

## File terkait
- `src/app/app/langganan/faktur/[id]/page.tsx` — render faktur/kwitansi.
- `src/lib/domain/terbilang.ts` — angka → kata (teruji `tests/finance-doc.test.ts`).
- `src/lib/domain/finance-doc.ts` — extractGrossInfo + computeFinanceBreakdown (teruji).
- `src/app/admin/perusahaan/company-editor.tsx` — editor catatan configurable.
- Anti-tamper fee-aware & pemulihan: lihat `Billing_Midtrans.md`.
