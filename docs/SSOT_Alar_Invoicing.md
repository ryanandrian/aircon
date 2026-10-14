# SSOT ALUR INVOICING AIRCON — Closing → Proforma/Invoice → Bayar → Kirim

**Status: DOKUMEN AKTIF (dibuat 2026-10-14, dari audit kode + SSOT, siap perubahan sesi)**
Sumber kebenaran ini = **kode source** (`prisma/schema.prisma` + service/action/UI). Dokumen ini
merekam hasil audit + rencana; setiap perubahan kode WAJIB memperbarui bagian STATUS di bawah.

**Rujukan SSOT yang dipahami 100% sebelum audit (dan perannya):**
```
docs/PROJECT_STATUS.md                        AKTIF — runtime closing (closeWorkSession satu pintu)
docs/SSOT_Checklist_Servis.md                 AKTIF — aturan aktif checklist/finalisasi
docs/BuildSpecPack_Part3 §3 (aturan aktif)    AKTIF — finalisasi atomik; §59+ ARSIP (non-aktif)
docs/BuildSpecPack_Part1                      schema otoritatif = prisma/schema.prisma
docs/RENCANA_INVOICING_AR.md                  HISTORIS (keputusan owner E3 tetap acuan bisnis)
docs/RENCANA_INVOICING_KIRIM_DAN_BILLTO.md    AKTIF-ARSIP — "STATUS AKHIR" = kondisi live 2026-09-09
docs/Dokumen_Keuangan_Faktur_Kwitansi.md      HISTORIS (tentang billing tenant→LUMITE, bukan tenant→pelanggan)
docs/Payment_Dunning_SSOT.md                  AKTIF (iPaymu = langganan tenant→LUMITE; BUKAN alur ini)
docs/WA_Gateway_Integration_Pointer.md        AKTIF (gateway kanonik di repo lumite-gateway)
BuildSpecPack_Part3 §6 "FEATURE GATING"       ARSIP-USAANG — nama paket Starter/Growth/Pro TIDAK
                                               sama dgn enum live (TRIAL/PROFESSIONAL/BUSINESS)
```

---

## BAGIAN 1 — ALUR AKTIF SEPERTI KODE SEKARANG (fakta, bukan harapan)

### 1.1 Closing (satu-satunya pintu — SSOT terkonfirmasi kode)
```
/t/kerja/[customerId] (WorkSession per pelanggan, items per layanan×unit)
  → actionCloseWorkSession → closeWorkSession(tenantId, wsId, createdById)
     1. sesi status OPEN; items kosong → tolak
     2. assertWorkSessionChecklist — item wajib per-unit wajib lengkap
     3. resolveBillingCustomer → bill-to (kantor pusat)
     4. TOP mengikuti bill-to; top==CASH → docType=INVOICE, selain itu → PROFORMA
     5. computeInvoiceTotals (PPN hanya bila tenant isPkp), dueDate=computeDueDate
     6. transaksi atomik:
        - klaim sesi OPEN→CLOSED (updateMany atomik, cegah dobel)
        - bila jobId: validasi customer cocok + status job ∈ {IN_PROGRESS, WAITING, ARRIVED}
          → job COMPLETED + nextServiceDate + RepeatReminder (upsert per unit) +
            ReviewRequest + JobProgressEvent
        - create Invoice (status ISSUED) + items (harga SNAPSHOT dari WorkItem)
        - INVOICE (cash) → cashRemitStatus="HELD_BY_TECH" (kas di tangan teknisi)
     return { invoiceId, docType, number }
```

### 1.2 Pembayaran CASH (lapangan)
```
UI PaymentPanel (di detail invoice INVOICE berstatus ISSUED/OVERDUE):
  pilih metode {CASH, TRANSFER, QRIS*} (*QRIS hanya bila tenant.qrisImageUrl terisi)
  upload bukti OPSIONAL (actionUploadPaymentProof → S3) 
  → actionMarkPaid → markInvoicePaid:
     tolak bila docType=PROFORMA / sudah PAID / CANCELLED
     updateMany atomik guard status (ISSUED|OVERDUE → PAID) — anti double-mark (B4)
  → invoice PAID → tautan Kwitansi (/app/kwitansi/[id], /t/kwitansi/[id])
     Kwitansi: nomor KW/ dari nomor invoice, terbilangRupiah, cetak + Kirim WA
```

### 1.3 TEMPO (proforma → invoice → tagih)
```
Teknisi closing → PROFORMA (ISSUED) — TIDAK bisa ditandai lunas (guard di service)
Admin (OWNER/ADMIN) di /app/faktur/[id]:
  ProformaConvert → actionInvoiceFromProforma
    → createInvoiceFromProforma: salin items, diskon per-invoice (default 0;
      UI tampilkan input diskon HANYA bila customer.customerType=BADAN),
      hitung ulang total (pajak SETELAH diskon), nomor INV baru,
      proforma → CANCELLED (cegah dobel) — ATOMIK
  invoice resmi (ISSUED, dueDate ikut proforma) → Kirim WA → tunggu bayar →
  actionMarkPaid → PAID → kwitansi
```

### 1.4 Pengiriman (InvoiceActions — admin & teknisi)
```
"Cetak / Simpan PDF" → window.print()
"Kirim via WA" → gatewaySend(tenantId, kontak, teks ringkasan):
  tujuan = resolveBillingContact (PIC keuangan → kontak utama)
  pesan = buildInvoiceMessage / buildReceiptMessage (teks, TANPA lampiran PDF)
  4 aksi: actionSendInvoiceWa / actionSendReceiptWa (admin),
          actionTechSendInvoiceWa / actionTechSendReceiptWa (teknisi)
```

### 1.5 Aturan paket (live DB — diverifikasi 2026-10-14)
```
Tenant.plan        : TRIAL (4 tenant: AC Depok, ADI TEKNIK, Buana, Jassa)
                     PROFESSIONAL (Jaya Mandiri, PT ASE)
PlanConfig         : TRIAL autoReminder=false (displayName "Basic");
                     PROFESSIONAL/BUSINESS autoReminder=true
Keputusan pemilik TERKUNCI: TRIAL/BASIC TIDAK punya fasilitas menautkan nomor WA
  ke Gateway dan TIDAK boleh mengirim lewat Gateway.
Guard A1 (waAutomationEligibility) melindungi: sesi WA, cron pengingat, dunning,
  masuk-teknisi, inactivity — TAPI TIDAK melindungi 4 aksi faktur/kwitansi (lihat B-1).
```

---

## BAGIAN 2 — TEMUAN (gap & bug) dengan BUKTI KODE

| # | Temuan | Bukti | Tingkat |
|---|---|---|---|
| **B-1** | 4 aksi kirim WA faktur/kwitansi **TIDAK dicegat guard plan** — TRIAL/BASIC bisa lewat ke Gateway bila diklik | `src/app/app/faktur/actions.ts` & `src/app/t/faktur/actions.ts`: nol pemanggilan `waAutomationEligibility` (grep 0/3 file) | KRITIS (pelanggaran keputusan pemilik) |
| **B-2** | Aksi teknisi **tanpa role guard eksplisit** — cukup `getServerContext()` valid (TECHNICIAN lolos) | `actionTechSendInvoiceWa`, `actionTechSendReceiptWa`, `actionMarkPaid`, `actionUploadPaymentProof` (t/faktur/actions.ts) | KRITIS (uang) |
| **B-3** | Teknisi bisa menandai lunas **invoice TEMPO mana pun** (bukan hanya cash miliknya) — `markInvoicePaid` tak membatasi scope | service: guard hanya docType/status, tak ada cek pembuat/job | KRITIS (uang) |
| **G-1** | Tombol FAB "Chat CS Aircon" + **sidebar** ikut tercetak di PDF/print invoice (bukan profesional) | `app/app/layout.tsx`: `CustomerServiceFab` (fixed) tanpa `print:hidden`; sidebar `hidden md:flex` tanpa `print:hidden`; globals.css @media print hanya reset body | TINGGI (profesionalisme) |
| **G-2** | Proses kirim kurang informatif: tombol hanya "Mengirim…" → toast singkat; tak tampilkan status sesi WA, tujuan (ke siapa), atau alternatif bila gagal | `invoice-actions.tsx` 50 baris | SEDANG |
| **G-3** | Tenant TRIAL tanpa sesi Gateway tetap melihat tombol "Kirim via WA" yang pasti gagal (dead-end) — seharusnya wa.me / pesan arahan | komponen tak tahu rencana; `sendInvoiceViaWa` cek `isGatewayConfigured` (global, bukan per-tenant) | SEDANG |
| **G-4** | "Kwitansi WA akan dikirim (fitur WA sedang tahap uji)" — teks basi & membingungkan | `payment-panel.tsx` baris kaki | RENDAH |
| **G-5** | Dokumen `Dokumen_Keuangan_Faktur_Kwitansi.md` **berpotensi menyesatkan** (billing Lumite, bukan tenant→pelanggan) tapi judulnya menyebut FAKTUR/KWITANSI generik | docs/ | RENDAH (dokumen) |

### Yang TIDAK ditemukan masalah (verifikasi, jangan diulang audit):
- Cash temp → INVOICE, tempo → PROFORMA: SESUAI arahan pemilik & kode.
- Teknisi TIDAK bisa konversi proforma (guard OWNER/ADMIN) ✓.
- Anti-double-mark PAID atomik (B4) ✓. Anti-double-close sesi atomik (B3-fix) ✓.
- Proforma→invoice atomik + proforma ditandai CANCELLED ✓.
- PPN hanya bila tenant PKP ✓. Diskon hanya B2B (UI) ✓. Harga snapshot ✓.
- Kwitansi terbilang + nomor KW urut ✓.

---

## BAGIAN 3 — RENCANA KERJA TOTAL SOLUTION (perbarui STATUS tiap progres)

**Prinsip: perbaiki JALUR YANG ADA; guard = pola `waAutomationEligibility` yang sudah mapan; TDD; deploy via SOP.**

### ATURAN JALUR (keputusan pemilik — WAJIB DIPATUHI SETIAP FASE)
```
1. HANYA mengembangkan/memperbaiki jalur yang SUDAH ADA.
2. JANGAN membuat jalur baru. Satu-satunya pengecualian: jalur baru dibuat HANYA
   bila (a) terbukti dibutuhkan, (b) repo BELUM punya jalur serupa, dan
   (c) dijelaskan di dokumen ini SEBELUM dibuat.
3. Kalau jalur lama harus diganti SEPENUHNYA, jalur lama WAJIB DIHAPUS pada
   perubahan yang sama — dilarang meninggalkan jalur fosil (fungsi tak terpakai,
   teks/label basi, komentar menyesatkan) yang membuat bingung saat deep dive.
4. Bila sebuah test/liter perlu diubah karena kontrak berubah, ubah DAN perbarui
   komentarnya — jangan diamkan komentar menyebut perilaku lama.
5. Setiap fase wajib memeriksa: "apakah ada jalur mati yang saya tinggalkan?"
   sebelum dinyatakan selesai.

### ATURAN PEMBARUAN DOKUMEN (keputusan pemilik — WAJIB)
```
1. SETIAP progres item rencana (F1..F5) → PERBARUI dokumen ini di sesi yang sama:
   - centang checklist [ ] → [x] yang sudah selesai & tervalidasi
   - tulis STATUS fase: BELUM → BERJALAN (sebut apa yang sudah & belum) → SELESAI
   - catat commit SHA, hasil deploy (live SHA), dan bukti (test count, verifikasi)
   Dokumen ini = SATU-SATUNYA sumber kebenaran antar-sesi; kalau sesi terputus,
   sesi berikutnya LANJUT dari STATUS di sini — bukan dari ingatan.
2. SETELAH seluruh rencana tuntas (atau ada perubahan perilaku yang ter-ship):
   UPDATE DOKUMEN SSOT TERKAIT jika diperlukan:
   - PROJECT_STATUS.md (jika ada perubahan runtime closing/invoice/kirim)
   - SSOT_Checklist_Servis.md (jika menyentuh alur closing/checklist)
   - help/content-owner.ts (jika label/perilaku tombol berubah — verbatim dgn UI)
   - Payment_Dunning_SSOT.md (jika menyentuh dunning/billing Lumite — TIDAK untuk
     alur tenant→pelanggan ini)
   KEBALIKANNYA juga berlaku: perubahan SSOT terkait harus disebut di laporan.
3. Sebelum commit tiap fase: pastikan dokumen rencana + SSOT ikut ter-commit
   (bukan tertinggal di working tree).
```

Titik penerapan spesifik rencana ini:
```
F1 → perluasan DI DALAM sendInvoiceViaWa / sendReceiptViaWa (jalur kirim yang
     sudah ada); TIDAK membuat fungsi kirim baru; jika fallback wa.me ditambah,
     itu JALUR BARU → wajib dijustifikasi & tercatat (G-3 sudah menyatakannya
     sebagai kebutuhan nyata: TRIAL punya kebijakan wa.me di menu Pengingat,
     jadi ini MENGEMBANGKAN pola yang sudah ada, bukan menemukan pola baru).
F2 → guard ditambah di action/service yang SUDAH ADA (t/faktur/actions.ts,
     invoice-service.ts); tidak membuat service pembayaran baru.
F3 → InvoiceActions (komponen yang sudah ada) dikembangkan; tidak membuat
     komponen kirim baru.
F4 → print:hidden ditambah di layout yang SUDAH ADA; tidak menambah komponen.
F5 → dokumen; nol kode.
```

### F1 — Guard plan di 4 aksi faktur/kwitansi (B-1, G-3)
- [ ] `waAutomationEligibility(tenantId)` dipanggil sebelum `gatewaySend` di
      `sendInvoiceViaWa` & `sendReceiptViaWa` (satu titik, terpakai 4 aksi).
- [ ] Bila plan-locked: pesan jelas → "Paket Anda belum memiliki WhatsApp terhubung.
      Gunakan 'Buka WhatsApp' untuk mengirim sendiri dari nomor Anda."
- [ ] Test: TRIAL ditolak; PROFESSIONAL lolos.
- STATUS: BELUM DIMULAI

### F2 — Guard role + scope pembayaran (B-2, B-3)
- [ ] `actionMarkPaid` / `actionUploadPaymentProof` / `actionTechSend*` → `assertRole`
      (teknisi boleh TANDAI LUNAS hanya invoice yang dibuatnya sendiri lewat closing
      `createdById == ctx.userId`; admin bebas). Service: `markInvoicePaid` menerima
      scope pembuat & divalidasi di sini (bukan di UI).
- [ ] Test: teknisi lain menolak; admin lolos; teknisi pemilik invoice cash lolos.
- STATUS: BELUM DIMULAI

### F3 — Kirim informatif + alternatif wa.me (G-2, G-3)
- [ ] `InvoiceActions`: status sesi WA (dari relai yang ada), tujuan (PIC keuangan/
      kontak), progress per-tahap, dan bila gagal/plan-locked → tombol
      **"Buka WhatsApp"** (wa.me, pesan terisi — pola menu Pengingat, jalur yang sudah ada).
- [ ] STATUS: BELUM DIMULAI

### F4 — Print/PDF profesional (G-1, G-4)
- [ ] `app/app/layout.tsx` & `app/t/layout.tsx`: sidebar + FAB `print:hidden`
      (elemen chrome, bukan dokumen).
- [ ] Uji print dari halaman faktur admin & teknisi + kwitansi: output = dokumen
      bersih (logo tenant, tanpa tombol/sidebar/FAB).
- [ ] Perbarui teks kaki payment-panel (G-4).
- [ ] STATUS: BELUM DIMULAI

### F5 — Dokumen (G-5)
- [ ] Tandai jelas di `Dokumen_Keuangan_Faktur_Kwitansi.md` bahwa dokumen itu = billing
      **Lumite**; alur tenant→pelanggan = dokumen ini.
- [ ] STATUS: BELUM DIMULAI

**Urutan pengerjaan: F1 → F2 → F3 → F4 → F5** (F1/F2 KRITIS uang & keputusan pemilik;
tiap fase: RED test → fix → tsc/eslint/test/build hijau → commit → deploy SOP → verifikasi live
→ update STATUS di sini).

---

## BAGIAN 4 — CATATAN PENTING (jangan hilang)
- Jaya Mandiri = PROFESSIONAL (boleh Gateway) — 4 tenant lain = TRIAL (wajib wa.me).
- `isGatewayConfigured()` = GLOBAL (URL+key ada), bukan "tenant punya sesi" —
  cek plan WAJIB di app, bukan mengandalkan gateway.
- Gateway enqueue auto-bikin sesi + antre (bukti `wa-manager.enqueue`), jadi tanpa guard
  app, kirim TRIAL = membuat sesi Gateway untuk tenant yang dilarang memilikinya.
- `CustomerServiceFab` juga dipasang di `app/page.tsx` (landing) — perbaikan print
  menyentuh layout; verifikasi landing tidak rusak.
