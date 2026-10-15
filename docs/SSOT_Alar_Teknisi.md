# SSOT ALUR TEKNISI (lapangan) — Daftar Kerja → Closing → Arsip/Pantauan

**Status: DOKUMEN AKTIF** (dibuat 2026-10-15, dari bukti DB live + git; di-update per progress)
Sumber kebenaran = kode source + bukti DB live. Alur FAKTUR/invoice = `SSOT_Alar_Invoicing.md`.

---

## BAGIAN 0 — ATURAN (KEPUTUSAN PEMILIK, 2026-10-15 — terverifikasi kode)

### 0.1 Pembagian halaman (menutup "pekerjaan terlewat")
```
BERANDA (/t) = DAFTAR KERJA — semua yang BELUM TUNTAS, apa pun jadwalnya.
               Teknisi harus selalu tahu apa yang harus ditindaklanjuti.
RIWAYAT (/t/riwayat) = ARSIP + PANTAUAN — hanya pekerjaan yang sudah TUNTAS
               bagi teknisi; status tagihan tetap terlihat (insentif).
```

### 0.2 Batas "TUNTAS" — menyesuaikan siapa memegang uang (DIKUNCI PEMILIK 2026-10-15)
```
CASH   → tugas teknisi tuntas saat LUNAS. Uang dipegang teknisi
         (cashRemitStatus=HELD_BY_TECH; payment panel di halaman teknisi).
         Closing tapi BELUM lunas → MASIH di beranda (wajib ditindaklanjuti).
         Setelah LUNAS → keluar dari beranda/masuk riwayat; admin melihat
         piutang kas teknisi di /app/laporan → menandai REMITTED saat uang
         tunai disetor (owner/admin only). Uang tetap tercatat sebagai kas
         di tangan teknisi sampai disetor — status LUNAS ≠ uang sudah masuk
         kantor.
TEMPO  → tugas teknisi tuntas saat PROFORMA TERBIT (hasil closing
         closeWorkSession). Setelah itu tagihan = urusan ADMIN kantor
         (konversi proforma→invoice guard OWNER/ADMIN; status ini terpantau
         di halaman riwayat teknisi karena berpengaruh pada insentif).
         Pekerjaan tempo keluar dari beranda setelah proforma terbit; teknisi
         TIDAK menagih, hanya MEMANTAU status invoice/lunas.
```

### 0.3 Bukti kode (fakta, bukan asumsi)
```
F4. Proforma MEMANG dihasilkan di CLOSING:
    worksession-service.ts:260 (job COMPLETED atomik) + create Invoice
    (docType=CASH?INVOICE:PROFORMA, status ISSUED) — jadi "tugas teknisi
    s/d proforma" = konsisten dengan guard existing.
F5. Cash dipegang teknisi: worksession-service.ts:323 cashRemitStatus=
    "HELD_BY_TECH" utk INVOICE; panel tandai-lunas (payment-panel) dipakai
    halaman teknisi → teknisi menandai LUNAS sendiri.
F6. Riwayat SUDAH memuat status invoice per pekerjaan di dalam query
    (invoicesByWs → dipakai gate insentif, technician-service.ts:381-389)
    → data pantauan SUDAH di tangan, belum ditampilkan (belum disajikan).
F7. "Selesai dikerjakan" (status COMPLETED) ditulis HANYA di
    closeWorkSession (job-service menolak COMPLETED — tak ada jalan pintas).
F8. Riwayat kini membatasi PER BULAN (bukan status) → inilah sebab job
    belum-jalan (Wati ASSIGNED 14 Okt, Effi ACCEPTED 13 Okt) terlihat di
    riwayat tapi tak bisa ditindaklanjuti (kartu tanpa tautan).
```

---

## BAGIAN 1 — FAKTA DIAGNOSIS AWAL (tetap berlaku)

### 1.1 "Stuck loading" (laporan pemilik 2026-10-15)
```
SERVER SEHAT (bukti): nginx 349 request /t semua 200; RSC 1,5–4 KB;
  query DB 87–170 ms + index lengkap; node 295 MB, CPU 0,3%.
SISI KLIEN (bukti): HP WiFi 19,3 KB/s; pemilik: paket data lebih lancar;
  4x nginx 499 tepat di jendela keluhan; token _rsc identik berulang
  = router cache Next utk rute dinamis 0 (default) → refetch penuh tiap
  klik A↔B → di jaringan lambat MENUNGGU → loading.tsx (4 skeleton generik
  tanpa label) menutupi seluruh segment /t → terasa STUCK di semua halaman.
```

### 1.2b "Cash Ryan tak muncul di laporan" — TERVERIFIKASI BUKAN BUG (2026-10-15)
```
Laporan pemilik: job Ibu Hesti (cash, teknisi Ryan, closing via aplikasi
teknisi) tidak muncul di laporan keuangan.
Bukti DB: INV/2026/0032 (Ibu Hesti, Ryan, Rp75.000) — job COMPLETED, tapi
invoice = ISSUED, payMethod=null, paidAt=null → BELUM pernah ditandai LUNAS.
Report K17 filter PAID+CASH+HELD_BY_TECH → benar TIDAK memuatnya.
→ SESUAI aturan terkunci (0.2): cash dianggap "di tangan teknisi" hanya
  setelah teknisi MENANDAI LUNAS. Status sekarang = tindak lanjut teknisi
  (persis yang diangkat F9d), BUKAN kas disetor.
→ Tindakan operasional: teknisi tekan "Tandai LUNAS" utk INV/2026/0032 →
  otomatis masuk "Kas Belum Disetor per Teknisi".
Pembanding (alur SEHAT): 5 invoice cash tenant tsb yg PAID → 4 HELD_BY_TECH
masuk report, REMITTED keluar.
CONTOH NYATA D1 (di data sama): INV/2026/0013 payMethod=TRANSFER tapi
cashRemitStatus=HELD_BY_TECH → uang di bank, tidak pernah di tangan teknisi
(terbukti defect stale → F9f).
```

### 1.3 Validasi alur K17 "Kas Belum Disetor" (permintaan pemilik, 2026-10-15)
```
Diuji langsung terhadap kode + data LIVE (probe read-only):
✓ BENAR: report filter payMethod='CASH' + status='PAID' + HELD_BY_TECH
         (ar-service.ts:94) → TRANSFER/QRIS TIDAK ikut dihitung.
✓ BENAR: actionMarkCashRemitted guard OWNER/ADMIN (laporan/actions.ts:14).
✓ BENAR: 0 invoice PAID+CASH tanpa cashRemitStatus (tak ada yang lolos).
✓ BENAR: REMITTED pernah dipakai (24 baris) → alur setor nyata jalan.
DEFECT D1 (data stale — live): 12 invoice ber-'cashRemitStatus=HELD_BY_TECH'
         padahal payMethod TRANSFER(8)/QRIS(4) → uang masuk BANK, tidak
         pernah di tangan teknisi; report aman (filter CASH) tetapi kolom
         menyesatkan utk query lain. AKAR: markInvoicePaid tidak meng-clear
         cashRemitStatus saat payMethod != CASH (closing sudah tulis
         HELD_BY_TECH utk semua INVOICE).
DEFECT D2 (coverage): NOL test menyentuh K17 (getUnremittedCashByTech /
         markCashRemitted) — alur keuangan tanpa jaring pengaman.
D3 (label, benar tapi menyempit): judul "per Teknisi" juga memuat pembuat
         non-teknisi (Pak Budi, 15) — data benar (pembuat sesi = pemegang
         uang), hanya judulnya.
Status data stale D1: TIDAK dirawat via DB (larangan mutasi data) —
         perbaikan kode agar ke depan tak terulang + catatan terbuka.
```

### 1.2 Kesenjangan riwayat↔beranda (Bukti DB Ryan 2026-10-15)
```
Ryan (tech cmv7ldlzx000qjeiu8h8vi0q1) punya 2 job AKTIF:
  Effi     ACCEPTED  jadwal 13 Okt — teknisiId = RYAN ✓ + assignment Ryan ✓
  Ibu Wati ASSIGNED  jadwal 14 Okt — teknisiId = RYAN ✓ + assignment Ryan ✓
  (Ibu Wati awalnya bukan Ryan; SESUDAH fitur "Atur Jadwal & Tim" diganti
   ke Ryan — keduanya MILIK RYAN, BUKAN bocor.)
C1. beranda filter jadwal HARI INI (fitur lama 444793e) → 2 job kemarin
    hilang dari beranda ("0 job hari ini").
C2. riwayat tampil semua status (fitur lama c9ce9a4/1420d61) tapi kartu
    TANPA tautan → terlihat, tak bisa ditindaklanjuti.
C3. [DITARIK] klaim "guard detail blokir anggota tim" TIDAK terbukti —
    verifikasi presisi technicianId+assignment: kedua job = Ryan → guard
    LOLOS. Kesimpulan lama berasal dari probe yang salah (teknisi keliru).
    Inkonsistensi vs beranda/riwayat (OR assignment) dicatat TERBUKA;
    guard keamanan TIDAK disentuh tanpa reproduksi nyata.
G-A5 (sesi ini) hanya menambah notifikasi push — TIDAK menyentuh
filter/riwayat/guard (git log = bukti).
```

---

## BAGIAN 2 — RENCANA F9 (per item + HASIL yang dicapai)

**Aturan jalur (keputusan pemilik): perbaiki jalur yang ada; jalur baru hanya
bila dibutuhkan & belum ada; nol fosil; TDD RED→GREEN; deploy SOP; update
dokumen ini per progress.**

- [ ] **F9a. Anti-"stuck": indikator memuat + kurangi refetch**
  - Isi: `/t/loading.tsx` → label jujur "⟳ Memuat…" + spinner (skeleton 4 kartu
    tetap); `next.config.ts` → `experimental.staleTimes.dynamic: 30` (router
    cache in-memory utk navigasi bolak-balik; mutasi tetap segar via
    revalidatePath/router.refresh yang sudah ada).
  - HASIL: bolak-balik beranda↔riwayat tampil dari cache (tanpa nunggu jaringan);
    kalau masih menunggu, layar jelas menunjukkan "Memuat…" — tak lagi terasa
    macet. Bukti validasi: nginx tak lagi memuat request `_rsc` identik berulang.
  - STATUS: **KODE SELESAI (belum commit/deploy)** — test nav-tech-stuck GREEN.

- [ ] **F9b. Kartu riwayat → PANTAUAN (bukan followup pengerjaan)**
  - Isi: row riwayat + `jobId`; kartu status NON-terminal (TEMPO proforma
    terbit / cash LUNAS berstatus jelas) → tautan ke detail
    `/t/pekerjaan/{jobId}`. Label tautan **"Lihat detail →"** (pantauan),
    BUKAN "lanjutkan" — pekerjaan tempo sudah tak lagi di beranda.
  - HASIL: teknisi bisa membuka pekerjaan dari riwayat utk memantau/mencetak
    tagihan; cash LUNAS tetap terlihat statusnya.
  - STATUS: **KODE SELESAI (belum commit/deploy)** — `jobId` disisipkan di
    `listTechnicianJobHistory` + tautan kartu riwayat utk status non-terminal.
    Label mengikuti kontrak: kartu pantauan (bukan "lanjutkan" pengerjaan).

- [ ] **F9c. Guard detail** — [DITUNDA — TIDAK dikerjakan] (lihat C3: terbukti
  lolos utk kasus nyata; guard keamanan tidak disentuh tanpa bukti kena).

- [ ] **F9c'. RIWAYAT = ARSIP + PANTAUAN (aturan 0.1/0.2)** [BARU]
  - Isi: `listTechnicianJobHistory` difilter TUNTAS: cash → hanya invoice LUNAS;
    tempo → sejak proforma terbit; Dibatalkan → arsip. Selain itu tampilkan
    **badge status tagihan** per pekerjaan (data invoicesByWs SUDAH ada di query):
    "Belum lunas cash" tdk muncul (masih di beranda) · tempo: "Invoice belum
    terbit" / "Menunggu pembayaran" / "Lunas" (berpengaruh ke insentif).
  - HASIL: riwayat bersih dari pekerjaan yang masih harus dikerjakan (tak ada
    kartu jalan buntu), SEKALIGUS teknisi tetap memantau: apakah tempo sudah
    di-invoice & sudah dibayar (insentifnya masuk saat LUNAS).

- [ ] **F9d. BERANDA = semua yang BELUM TUNTAS (tulang punggung aturan)**
  - Isi: `listTechnicianJobsToday` → daftar kerja TANPA batas "hari ini"
    (aktif DRAFT..WAITING apa pun jadwalnya; kelompok: "Hari ini" / "Perlu
    ditindaklanjuti") + kartu "Menunggu pelunasan" utk cash closing tapi belum
    ditandai lunas (uang di tangan teknisi).
  - HASIL: Effi (13 Okt) & Ibu Wati (14 Okt) MUNCUL di beranda Ryan; tak ada
    pekerjaan tertunda yang tersembunyi; cash belum lunas tak pernah lolos
    dari perhatian teknisi. Verifikasi: query DB Ryan (kini 0 utk hari ini) →
    2 job tampil via kelompok backlog.

- [ ] **F9f. Validasi alur kas K17 (D1 + D2)** [dari permintaan pemilik]
  - Isi: perbaiki `markInvoicePaid` → `cashRemitStatus` hanya `HELD_BY_TECH`
    utk `payMethod=CASH`, `null` utk TRANSFER/QRIS (uang masuk bank = tak
    pernah di tangan teknisi); tambah test K17 (`getUnremittedCashByTech`/
    `markCashRemitted`) — RED dulu (nol coverage → terbukti kosong).
  - HASIL: kolom "kas di tangan teknisi" 100% akurat di seluruh query
    (bukan cuma karena report kebetulan filter CASH); alur setoran admin
    punya jaring pengaman test.
  - STATUS: D1 & D2 terverifikasi dari data live; kode & test BELUM dikerjakan.

- [ ] **F9e. Uji, deploy SOP, update dokumen**
  - Isi: suite penuh hijau → deploy via `scripts/deploy-vps.sh` → verifikasi
    live → tandai tiap item SELESAI + perbarui pointer SSOT terkait
    (`PROJECT_STATUS.md`).
  - HASIL: F9a–F9d hidup di produksi (bukan hanya lokal); dokumen = posisi
    sebenarnya utk sesi berikutnya.

### KOREKSI PALING AKHIR (2026-10-15 malam — perintah pemilik: riwayat hanya tuntas)
```
KOREKSI KERJA SENDIRI (jujur): F9c' ("riwayat hanya berisi pekerjaan TUNTAS")
TERTUANG di rencana tapi TIDAK PERNAH dieksekusi — yang dieksekusi justru
F9b ke arah BERTENTANGAN (kartu non-terminal di riwayat ditautkan) →
Effi & Ibu Hesti muncul di DUA tempat (beranda + riwayat) — laporan pemilik
tepat. Pelajaran: eksekusi item rencana URUT sesuai aturan terkunci.
```
**Implementasi F9c' (TDD: RED test 5 asersi → GREEN):**
```
listTechnicianJobHistory:
  - query: hanya job status COMPLETED/CANCELLED (relasi job.status.in)
  - cash COMPLETED tanpa invoice PAID → dibuang (belum tuntas → beranda)
  - tempo (PROFORMA terbit, probe query TERPISAH — query insentif uang
    TIDAK disentuh) → tugas teknisi tuntas → tetap utk PANTAU
  - CANCELLED → arsip
history-view: SEMUA kartu = "Lihat detail →" (riwayat = arsip+pantauan);
  jalur "Tandai LUNAS" di riwayat DIHAPUS (bukan tempatnya — beranda).
  field row invoiceId/invoiceStatus dihapus (fosil; jobId cukup).
```
**Implementasi F9d+ (TDD: RED 9 test → GREEN; kelompok baru di beranda):**
```
listTechnicianUnpaidCashJobs: job COMPLETED cash BELUM lunas → kelompok
  "Menunggu pelunasan cash" (2-query utk klasifikasi — WorkSession.jobId
  opsional tanpa relasi balik; take:50 batas aman skala; scoping sama).
  Empty-state & angka ringkasan memperhitungkan ketiga kelompok.
  (Tanpa ini: setelah F9c', Ibu Hesti hilang dari DUA halaman — dicegah.)
```
**DEPLOY F9c'+F9d+ LIVE `ffee929` (2026-10-15 malam, PASS):**
```
/ & /login 200 · marker live: "Menunggu pelunasan cash" ADA · "Lihat detail"
ADA · staleTimes {dynamic:30} · log error 5 menit bersih.
Suite: 96 files / 832 tests · tsc=0 · eslint=0 · build=0.
UJI PEMILIK: riwayat Ryan = HANYA Ibu Hesti (tuntas, "Lihat detail");
beranda = "Perlu ditindaklanjuti" (Effi, Wati) + "Menunggu pelunasan cash"
(Ibu Hesti) — nol duplikasi.
```

**STATUS TOTAL F9 (update 2026-10-15 akhir):**
```
F9a  KODE SELESAI (staleTimes dynamic:30 + label "Memuat…")
F9b  KODE SELESAI (jobId di row riwayat; kartu NON-terminal → "Lihat detail";
     cash COMPLETED BELUM LUNAS → jalan "Tandai LUNAS" ke /t/faktur/{invoiceId})
     (tambahan dari laporan pemilik: card Ibu Hesti "Selesai" tapi belum lunas
      = tuntaskan via kartu riwayat → halaman invoice)
F9d  KODE SELESAI (listTechnicianBacklogJobs take:50 + count akurat terpisah;
     kelompok "Perlu ditindaklanjuti"/"Hari ini"; doneCount diperbaiki — dulu
     SELALU 0)
F9f  BELUM: fix markInvoicePaid clear cashRemitStatus utk TRANSFER/QRIS (D1)
     + test K17 (D2). Data stale 12 invoice: TERBUKA (larangan mutasi DB).
Verifikasi: tsc=0 · eslint=0 · suite 94 files/818 tests · build=0.
DEPLOY LIVE `8ca1415` (2026-10-15, PASS): penanda "Perlu ditindaklanjuti" +
"Tandai LUNAS" + "Memuat" ADA di server bundle; experimental.staleTimes
{'dynamic': 30} terbaca di required-server-files.json; log error bersih.
Insiden SOP: deploy pertama BLOCKED (working tree kotor — 2 dokumen F7
tertinggal) → commit → rerun PASS. Pelajaran: git status dulu SEBELUM
panggil SOP (gerbang tree-clean sudah benar; script TIDAK diubah).
BELUM (utk uji pemilik): buka /t Ryan → "Perlu ditindaklanjuti" (Effi+Wati);
riwayat Ibu Hesti → kartu "Tandai LUNAS →" → bayar → masuk Kas Belum Disetor.
Sisa rencana: F9f (clear cashRemitStatus TRANSFER/QRIS + test K17).
```

---

## BAGIAN 3 — BELUM DIVERIFIKASI / TERBUKA
- Penyebab WiFi 19,3 KB/s: di luar aplikasi (kondisi jaringan pemilik);
  yang bisa diaplikasi: kurangi refetch (F9a) + indikator jujur.
- C3 inkonsistensi guard (beranda/riwayat pakai OR assignment; detail hanya
  teknisi utama) — terbuka, tanpa reproduksi nyata.
- F9d memperluas daftar kerja beranda (semua belum tuntas) → perlu dipantau
  dampaknya utk tenant dgn banyak job tertunda (skala masih kecil saat ini).
