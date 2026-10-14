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
| **G-6** | **Format cetak/PDF kurang profesional**: (a) badge status aplikasi ("Terbit"/"Lunas") ikut tercetak — label UI, bukan dokumen; (b) TANPA tanda tangan/pengesahan ("Hormat kami, …"); (c) Card+shadow/rounded tanpa varian print (bisa tak rapi di PDF) | `invoice-view.tsx` baris 66 (Badge), seluruh file tanpa blok tanda tangan | TINGGI (kualitas dokumen) |
| **G-7** | **Format pesan WA non-attachment**: sudah memuat no dokumen/pelanggan/tanggal/jatuh tempo/total/bank, tapi TANPA rincian item & tanpa tanda pengirim (nama/jabatan pengirim atau kontak) | `buildInvoiceMessage` (invoice-service.ts:334) | SEDANG |
| **B-4** | Status **OVERDUE hanya sinkron saat admin membuka /app/laporan** (`refreshOverdueStatus` dipanggil di page.tsx:24) — bukan saat daftar faktur dibuka/dicari; badge "Jatuh Tempo" & daftar invoice bisa telat | ar-service.ts:76 hanya dipanggil laporan/page.tsx | SEDANG (jujur: bucket PIUTANG tetap benar karena memakai ISSUED\|OVERDUE — dampak = label/daftar terlambat, bukan salah hitung) |

### STATUS ATTACHMENT (fakta — dijawab dari kode, bukan perkiraan)
```
Saat ini: TIDAK ADA lampiran/attachment apa pun saat "Kirim via WA".
  gateway-relay.ts:52 → body { externalId, toPhone, message } — TEKS SAJA
  (tak ada mediaBase64/mimetype; gateway v1 memang teks-only)
Sebab: keputusan DITUNDA tercatat (RENCANA_INVOICING_KIRIM_DAN_BILLTO):
  "lampiran PDF via WA butuh endpoint media di gateway VPS (repo lumite-gateway)"
Dokumen utuh (dengan rincian item/QRIS) baru terkirim bila admin MENGGUNAKAN
  "Cetak / Simpan PDF" lalu mengirim manual dari WhatsApp.
```

### KEPUTUSAN PEMILIK (2026-10-14): **A + C** — WAJIB DITINDAKLANJUTI
```
DIPUTUSKAN: A (pesan WA berisi rincian ringkas + tautan dokumen)
          + C (halaman dokumen publik bertoken — pelanggan bisa print sendiri
              dari link; admin tetap bisa Cetak/PDF lalu kirim manual via
              WhatsApp Apps/Web miliknya bila perlu)
DITOLAK  : B (attachment PDF via gateway) — membebani wa-gateway; di luar syarat.

ATURAN UI/UX (perintah pemilik): tombol/UX WAJIB user-friendly.
  - Pesan WA + tautan = 1 langkah bagi pelanggan (klik link → dokumen → print).
  - Admin: tetap ada "Cetak / Simpan PDF" yang sudah ada + opsi kirim manual
    yang memudahkan (salin link / buka WhatsApp web) — tanpa menghilangkan
    yang lama.
  - TRIAL/BASIC: tautan disertakan lewat wa.me (tetap tanpa gateway).

IMPLIKASI TEKNIS (field additive, jalur yang sudah ada):
  - kolom baru Invoice.docToken (String? @unique, nullable) — token acak tinggi
    entropi (pola UnitCode yang sudah ada), dibuat saat dokumen terbit.
  - halaman publik /d/{token} — REUSE pola /riwayat/{token} yang sudah teruji
    (kolektor: InvoiceView tanpa chrome + print:true + identitas tenant);
    token acak → anti-enumeration; invoice CANCELLED → tampil jujur "Dibatalkan".
  - buildInvoiceMessage/buildReceiptMessage: tambah baris tautan dokumen +
    rincian ringkas (item teratas/total).
  - Konsisten utk 3 dokumen: INVOICE, PROFORMA, KWITANSI.
```

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

### F1 — Guard plan di 4 aksi faktur/kwitansi (B-1, G-3) ← **SELESAI (kode + test, 2026-10-15)**
- [x] `waAutomationEligibility(tenantId)` dipanggil **di service** (`sendInvoiceViaWa`
      & `sendReceiptViaWa`) SEBELUM `isGatewayConfigured`/`gatewaySend` — satu titik,
      terpakai 4 aksi (admin + teknisi), dynamic-import (pola file: resolveBillingContact).
      urutan guard: dokumen ada → status valid → **guard plan** → gateway → kontak.
- [x] Bila plan-locked: `"Paket Anda belum memiliki WhatsApp otomatis. Bagikan
      dokumen/kwitansi melalui aplikasi WhatsApp Anda."` (konteks dokumen — bukan
      pesan cron Pengingat).
- [x] Test RED→GREEN: tests/invoice-wa-plan-guard.test.ts (6/6) — TRIAL ditolak +
      gatewaySend TIDAK dipanggil (tak ada sesi gateway dibuat utk TRIAL);
      PROFESSIONAL lolos + dipanggil; guard di 2 fungsi; urutan cek dokumen dulu.
- [x] Verifikasi: tsc=0 · eslint=0 · suite **84 files / 757 tests** · build=0.
- STATUS: SELESAI — deploy live `eb9bffd` (2026-10-15):
      scripts/deploy-vps.sh PASS · release aktif eb9bffd · `/` 200 · `/login` 200 ·
      guard (`waAutomationEligibility` + pesan plan-locked) TERKONFIRMASI di
      server bundle live · VAPID 3 var utuh.
      Verifikasi fungsional TRIAL: menunggu uji pemilik pada tenant TRIAL
      (AC Depok / ADI TEKNIK / Buana / Jassa) — "Kirim via WA" harus menolak
      dengan pesan paket, TANPA membuat sesi gateway.

### F2 — Guard role + scope pembayaran (B-2, B-3) ← **SELESAI (kode + test, 2026-10-15)**
- [x] **B-3** `markInvoicePaid` kini param `actor` WAJIB (InvoiceActor):
      tanpa actor → UNEXPECTED (tak ada jalur "tanpa peran");
      TEKNISI → hanya INVOICE `createdById == dirinya` (invoice cash hasil closing
      sesi sendiri; proforma & invoice admin/teknisi lain → CONFLICT);
      OWNER/ADMIN → bebas; guard atomik B4 TETAP (race count=0 → CONFLICT).
- [x] **B-2** `actionUploadPaymentProof` → `assertRole(OWNER|ADMIN)` (teknisi
      menandai lunas di lapangan TANPA upload — tanpa kehilangan fungsinya).
- [x] Caller `actionMarkPaid` meneruskan `{userId, role}` dari sesi.
- [x] Test RED→GREEN: tests/invoice-payment-guard.test.ts (10/10) — 4 gagal di
      RED (titik B-2/B-3 yang terbukti belum terjaga), 6 lulus = hak admin & urutan
      guard tetap; invoice-flow lama disesuaikan ke kontrak wajib-actor (+4 pemakaian).
- [x] Verifikasi: tsc=0 · eslint=0 · suite **85 files / 767 tests** · build=0.
- STATUS: SELESAI (kode) — deploy + verifikasi live menyusul batch berikutnya

### Hasil Deploy Batch F2+F3 — LIVE `0d697f7` (2026-10-15)
```
deploy : scripts/deploy-vps.sh PASS · release aktif 0d697f7 · `/` 200 · `/login` 200
penanda: "Hanya invoice hasil penutupan pekerjaan Anda" (F2/B-3) ADA ·
         "Buka WhatsApp Anda untuk mengirim" (F3 fallback) ADA ·
         "Konteks aktor wajib" (F2 default-aman) ADA · tombol Buka WhatsApp ADA
log   : error runtime 5 menit bersih
```

### F3 — Kirim informatif + alternatif WA aplikasi teknisi/admin (G-2, G-3) ← **SELESAI (kode + test, 2026-10-15)**
- [x] **Fallback di titik terendah** (`sendInvoiceViaWa`/`sendReceiptViaWa`):
      plan-locked → payload pesan yang SAMA dipakai bersama jalur gateway &
      fallback `waMe:{url,message}` (url wa.me dgn pesan terisi — pola menu
      Pengingat) — gatewaySend TIDAK dipanggil utk TRIAL (F1 tetap dijaga;
      urutan diperbaiki: kontak dulu → guard → gateway, supaya fallback punya
      nomor tujuan).
- [x] **4 action** (admin: actionSendInvoiceWa/actionSendReceiptWa + teknisi:
      actionTechSendInvoiceWa/actionTechSendReceiptWa) meneruskan `waMe` balik ke UI.
- [x] **UI `InvoiceActions`** (jalur yang sudah ada): bila server balas plan-locked
      dengan waMe → tombol **"Buka WhatsApp"** muncul (link prefilled), toast
      mengarahkan; nol komponen baru.
- [x] Test RED→GREEN: tests/invoice-wa-fallback.test.ts (6/6) — TRIAL+nomor →
      url memuat nomor tujuan + pesan memuat nomor dokumen & total; TRIAL tanpa
      nomor → error jelas; PROFESSIONAL → gateway (ok:true, tanpa waMe);
      fallback aktif di 2 fungsi; gatewaySend TIDAK dipanggil utk TRIAL.
- [x] Verifikasi: tsc=0 · eslint=0 · suite **86 files / 773 tests** · build=0.
- STATUS: SELESAI (kode) — status sesi WA & progress per-tahap (opsional G-2 lanjutan)
      BELUM dikerjakan di fase ini (butuh polling relai; dicatat jujur — bukan bagian
      "fallback", jadi tidak diklaim selesai di sini).

### F4 — Chrome cetak bersih (G-1, G-4) ← **SELESAI (kode + test, 2026-10-15)**
- [x] `app/app/layout.tsx` aside (sidebar) → `print:hidden` — FAB
      `CustomerServiceFab` → `print:hidden` di COMPONENT (satu tempat, terpakai
      layout app & landing — tanpa duplikasi). Verifikasi: `/t/layout.tsx` TIDAK
      merender sidebar/FAB (sudah bersih, jangan ditambah apa pun).
- [x] Perbarui teks kaki payment-panel (G-4): basi "fitur WA tahap uji" →
      "Setelah lunas, tombol kirim kwitansi WhatsApp muncul di halaman ini."
      (JUJUR — sesuai perilaku nyata setelah F1/F3).
- [x] Test RED→GREEN: tests/print-clean-chrome.test.ts (3/3) — sidebar print:hidden;
      FAB print:hidden; /t tanpa sidebar/FAB. (Pola source-level repo — tanpa RTL,
      + gate tsc/lint/build; sama seperti job-cancel-placement.)
- [x] Verifikasi: tsc=0 · eslint=0 · suite **87 files / 776 tests** · build=0.
- STATUS: SELESAI (kode) — uji print visual manual di browser (preview → PDF)
      tetap perlu dilakukan pemilik setelah deploy (bukti layar, bukan klaim kode).

### F5 — Dokumen (G-5) ← **SELESAI (2026-10-14, tanpa kode)**
- [x] Tandai jelas di `Dokumen_Keuangan_Faktur_Kwitansi.md` bahwa dokumen itu = billing
      **Lumite**; alur tenant→pelanggan = dokumen ini. (KOREKSI RUANG LINGKUP ditambahkan.)
- [x] `RENCANA_INVOICING_KIRIM_DAN_BILLTO.md` diberi label ARSIP HASIL + pointer ke
      SSOT_Alar_Invoicing.md.
- [x] `PROJECT_STATUS.md` (dokumen aktif utama) diberi SSOT POINTER ke
      `docs/SSOT_Alar_Invoicing.md` + penanda HISTORIS di BuildSpecPack_Part2.
- [x] `scripts/ssot-status.sh` DIBUAT (jalur baru yang dijustifikasi: 9 dokumen aktif
      merujuknya tapi tidak pernah ada — tautan mati; read-only; laporan lokal).
- [x] `ssot-status.sh` divalikasi jalan: HEAD==origin, penanda aktif/HISTORIS per
      dokumen, pemisahan billing Lumite vs tenant→pelanggan, jumlah model/migrasi.
- [x] STATUS: SELESAI — commit & push menyusul bersama fase lain.

### F6 — Format invoice & proforma cetak/PDF profesional (G-6)
- [ ] `invoice-view.tsx`: sembunyikan badge status UI saat print
      (label aplikasi "Terbit/Lunas" tidak boleh jadi bagian dokumen; bila status
      perlu ditampilkan, tampilkan sebagai teks dokumen yang pantas).
- [ ] Tambah blok pengesahan dokumen: "Hormat kami," + ruang tanda tangan/pengesahan
      penerbit (nama tenant; format identik utk INVOICE, PROFORMA, dan Kwitansi
      `KwitansiView` — satu pola, bukan dua gaya).
- [ ] Varian print (tanpa shadow/rounded berlebih, `print:` konsisten) + halaman
      rapi (hindari pemotongan blok total/tanda tangan di akhir halaman).
- [ ] Uji cetak nyata (print preview → PDF) dari halaman invoice, proforma, kwitansi;
      verifikasi label "PROFORMA INVOICE" vs "INVOICE" tetap benar (2 jenis dokumen,
      jangan disamakan).
- [ ] STATUS: BELUM DIMULAI

### F7 — Pesan WA profesional + tautan dokumen publik (A+C) (G-7, keputusan pemilik)
**Konsesi penting:** keputusan pemilik menggabungkan pesan (A) + tautan dokumen (C).
- [ ] **7a. Field token** — `Invoice.docToken String? @unique` (nullable, additive;
      migration manual + `prisma generate` — pola migrasi yang sudah mapan).
      Token dibuat saat dokumen terbit (closeWorkSession & createInvoiceFromProforma);
      acak tinggi entropi (pola UnitCode). Kwitansi memakai token invoice yang sama
      (satu-satu anchor, tanpa token duplikat — anti-redundan).
- [ ] **7b. Halaman publik `/d/{token}`** — REUSE pola `/riwayat/{token}` yang sudah
      teruji: server resolve token → InvoiceView (kolektor, tanpa chrome) + print:
      rapi; tenant scoping via token (bukan id); token acak = anti-enumeration;
      invoice CANCELLED → tampil jujur "Dibatalkan"; header/branding tenant.
- [ ] **7c. Pesan WA** — `buildInvoiceMessage`/`buildReceiptMessage`: rapikan
      struktur (kop usaha, identitas dokumen, ringkasan item ringkas, total,
      info bayar) + TAMBAH baris tautan dokumen (`{APP_URL}/d/{token}`).
      Kontrak teks-only TIDAK berubah — gateway TIDAK tersentuh.
- [ ] **7d. UI/UX (user-friendly — perintah pemilik)**: di `InvoiceActions`
      (jalur yang sudah ada) tambah aksi **"Salin link dokumen"** (untuk admin
      kirim manual via WhatsApp Apps/Web miliknya) + tetap pertahankan
      "Cetak / Simpan PDF". Untuk TRIAL/BASIC: tautan ikut wa.me.
- [ ] **7e. Uji** — 3 dokumen (INVOICE/PROFORMA/KWITANSI) konsisten; token
      unik & anti-duplikat; token salah/tak dikenal → 404 aman; pesan WA
      berisi tautan & rincian; TRIAL→wa.me + link; PRO→gateway + link.
- [ ] STATUS: BELUM DIMULAI

### F8 — Status OVERDUE sinkron di titik yang tepat (B-4)
- [ ] `refreshOverdueStatus(tenantId)` dipanggil di jalur yang SUDAH ADA untuk
      invoice list (page/admin invoice — sama dengan pola `/app/laporan`), supaya
      badge "Jatuh Tempo" & daftar akurat kapan pun admin membuka, bukan hanya
      saat membuka laporan. (Jangan tambah cron baru — pola sinkron di-request-time
      sudah ada & cukup.)
- [ ] Test: invoice lewat dueDate → bucket "unpaid" & label akurat setelah dibuka;
      PAID/CANCELLED tidak tersentuh.
- [ ] STATUS: BELUM DIMULAI

### TUNTAS DEFINISI (dokumen ini = jaminan)
```
Setelah F1..F8 SELESAI + deploy live + terverifikasi, jalur closing → pembayaran
dianggap TUNTAS bila seluruh temuan B-1..B-4, G-1..G-7 berstatus TERTUTUP
(ada commit + bukti deploy + update STATUS di sini), dan:
  - TIDAK ADA aksi/kirim yang menyentuh Gateway untuk tenant TRIAL/BASIC
    (termasuk dari halaman TEKNISI) — terbukti guard test;
  - pembayaran & penomoran & kalkulasi uang teruji anti-race;
  - cetak/PDF = dokumen profesional (bersih, pengesahan, konsisten kwitansi);
  - pesan WA non-attachment rapi & informatif.
Bila ada temuan BARU ditemukan saat eksekusi → CATAT sebagai B-5, G-8, dst.
di tabel ini + tambahkan fase (F9, dst.) SEBELUM melanjutkan — jangan ditambal diam-diam.
```

**Urutan pengerjaan: F1 → F2 → F3 → F4 → F5 → F6 → F7 → F8**
(F1/F2 KRITIS uang & keputusan pemilik; tiap fase: RED test → fix →
tsc/eslint/test/build hijau → commit → deploy SOP → verifikasi live
→ update STATUS di sini. F5 mungkin dimajukan bila cepat — dokumen tanpa risiko
kode, asalkan statusnya jujur sesuai fase yang benar-benar sudah ter-ship.)

---

## BAGIAN 4 — CATATAN PENTING (jangan hilang)
- Jaya Mandiri = PROFESSIONAL (boleh Gateway) — 4 tenant lain = TRIAL (wajib wa.me).
- `isGatewayConfigured()` = GLOBAL (URL+key ada), bukan "tenant punya sesi" —
  cek plan WAJIB di app, bukan mengandalkan gateway.
- Gateway enqueue auto-bikin sesi + antre (bukti `wa-manager.enqueue`), jadi tanpa guard
  app, kirim TRIAL = membuat sesi Gateway untuk tenant yang dilarang memilikinya.
- `CustomerServiceFab` juga dipasang di `app/page.tsx` (landing) — perbaikan print
  menyentuh layout; verifikasi landing tidak rusak.
