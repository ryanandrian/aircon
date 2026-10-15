# Alur Faktur Aircon — Arsitektur & Runbook (dari bukti nyata)

**Status: LIVE & production-accepted** · Repo: aircon · Live terakhir: `c8f7a8b` (2026-10-15)
Ditulis SETELAH bukti E2E pemilik lulus (bukan desain spekulatif).
SSOT detail temuan & rencana: `docs/SSOT_Alar_Invoicing.md` (satu-satunya rujukan analisa awal).

## 1. Alur end-to-end (terverifikasi kode + uji pemilik)

```
Teknisi closing sesi (closeWorkSession — SATU pintu, atomik, claim anti-double-close)
 ├─ CASH    → INVOICE (ISSUED) + cashRemitStatus=HELD_BY_TECH
 │            Token dokumen dibuat saat terbit. Teknisi di lapangan: PaymentPanel
 │            (Tunai/Transfer/QRIS*) → markInvoicePaid (actor WAJIB) → PAID → Kwitansi
 └─ TEMPO   → PROFORMA (ISSUED) — teknisi TIDAK bisa tandai lunas (terkunci guard)
              → Admin konversi (createInvoiceFromProforma; diskon hanya B2B,
                pajak setelah diskon) → INVOICE + token baru → Kirim WA →
                tunggu bayar → Kwitansi
 *QRIS tampil hanya bila tenant.qrisImageUrl terisi.
```

**Guard (semua di TITIK TERENDAH service — menutup semua rute & 4 aksi):**

```
F1 guard PLAN   : waAutomationEligibility sebelum gatewaySend (sendInvoiceViaWa
                  & sendReceiptViaWa). TRIAL/BASIC DITOLAK dari Gateway (keputusan
                  pemilik: tak punya nomor tertaut) + FALLBACK wa.me ("Buka
                  WhatsApp", pesan terisi — pola menu Pengingat).
F2 guard ROLE   : markInvoicePaid wajib {userId, role}; teknisi hanya utk INVOICE
                  createdById == dirinya; OWNER/ADMIN bebas; anti-double-mark
                  atomik (race → CONFLICT); actionUploadPaymentProof = OWNER/ADMIN.
```

**Dokumen & token (keputusan pemilik A+C):**

```
Invoice.docToken (String? @unique) — acak 32 char (randomBytes 24, pola
technician-service; anti-enumeration). Diisi: (a) saat dokumen terbit (2 jalur
create); (b) E2: saat DIBUKA bila null (getInvoiceForView — titik bersama
admin/teknisi/publik; race-safe; token lama TIDAK dirotasi).
Tautan publik /d/{token} (pola /riwayat/{token}): tanpa sesi; resolve via token;
404 aman; CANCELLED tampil jujur; InvoiceView + PrintButton (reuse penuh).
Pesan WA (gateway TETAP teks-only, gatewayRelay TIDAK tersentuh):
  buildInvoiceMessage/buildReceiptMessage → + baris "Dokumen: {APP_URL}/d/{token}"
  (berlaku utk GATEWAY & fallback wa.me — invoice, proforma, kwitansi).
UI: InvoiceActions = Cetak/Simpan PDF + "Salin link dokumen" (clipboard +
    fallback execCommand) + "Kirim via WA" + "Buka WhatsApp" (saat plan-locked).
Cetak/PDF bersih: FAB CS & sidebar print:hidden; badge status print:hidden;
  blok pengesahan "Hormat kami" konsisten dgn KwitansiView; Card print:rounded-none.
OVERDUE sinkron di /app/faktur (request-time, tanpa cron baru).
```

## 2. Peran & scope (terkunci)

```
TEKNISI : closing sesi; menandai lunas INVOICE CASH buatannya sendiri (tanpa upload);
          kirim WA dokumen (guard plan berlaku).
ADMIN   : semua di atas + konversi proforma, diskon B2B, markPaid semua invoice,
          upload bukti, batalkan (kecuali PAID), kirim WA (guard plan berlaku).
```

## 3. Bukti & gates

```
Live : releases 0347cdb (F4/F6/F7a/F8) → b39a9fc (F7b–F7d) → e54dcad (E2) → c8f7a8b (docs)
Suite: 92 files / 807 tests · tsc=0 · eslint=0 · build=0
E2E pemilik lulus (2026-10-15): token terisi saat dibuka → Salin link → /d/{token}
       tampil + cetak bersih → TRIAL: Kirim WA → "Buka WhatsApp".
DB   : docToken (text) + unique index live; createdById aman (61/61).
Test kunci: invoice-wa-plan-guard (6/6) · invoice-payment-guard (10/10) ·
  invoice-wa-fallback (6/6) · print-clean-chrome (3/3) · print-doc-professional (3/3) ·
  overdue-sync-invoice-list (3/3) · invoice-doc-token (6/6) · invoice-doc-token-ensure (5/5) ·
  public-doc-token-link (14/14).
```

## 4. Pengembangan lanjutan (bukan defect; butuh arahan pemilik)

- Token QRIS di halaman publik (saat ini gambar QRIS tenant ditampilkan apa adanya).
- Status sesi WA & progress per-kirim di UI (G-2 lanjutan; butuh polling relai).
- Backfill token dokumen lama massal — TIDAK dibutuhkan (E2 mengisi saat dibuka).
- Dokumen arsitektur billing LUMITE (tenant → Lumite) = `Dokumen_Keuangan_Faktur_Kwitansi.md`
  (berbeda jalur dari dokumen ini — tenant → pelanggan).
