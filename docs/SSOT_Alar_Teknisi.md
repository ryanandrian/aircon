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
  otomatis masuk "Kas Belum Disetor per Pemegang Uang".
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
CATATAN KUALITAS DATA (koreksi pemilik 2026-10-15): HANYA Jaya Mandiri
& AC Depok Jaya tenant demo; tenant lain real. Probe read-only saat ini:
11 row non-CASH HELD pada tenant demo (Jaya Mandiri: 9; AC Depok Jaya: 2).
Ada juga 1 row TRANSFER Rp85.000 pada tenant REAL PT Ase Dwimitra Mandiri.
Provenance tiap row (seed vs frontend) tidak tersedia; JANGAN anggap semua row
pada tenant demo berasal dari seed atau semua row non-CASH sebagai bug nyata.
Tidak ada data DB yang diubah. Perbaikan F9f adalah invariant kode ke depan:
hanya CASH boleh HELD_BY_TECH; TRANSFER/QRIS harus null, plus tes K17.
Row tenant real tetap perlu ditinjau lewat sumber/audit transaksi yang sah
sebelum tindakan data; tidak termasuk perubahan kode ini.
D2 (coverage): test service K17 ditambahkan pada F9f.
D3 (label): judul "Kas Belum Disetor per Pemegang Uang" mengelompokkan createdById
(pembuat sesi). **DITUTUP 2026-10-18 (M9):** nama baris kini ikut peran asli
pemegang dari `User.role` — kasus admin/teknisi/pemilik tampil apa adanya
(7 dari 8 baris Jaya Mandiri = pemilik) — bukan anomali data tanpa provenance.
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

- [x] **F9a. Anti-"stuck": indikator memuat + kurangi refetch** — **LIVE**
  `/t/loading.tsx` label "Memuat…" + `staleTimes.dynamic:30`.
  Deploy 8ca1415; terverifikasi `required-server-files.json` live.
  Catatan: belum ada pengukuran jaringan WiFi sesudah deploy; indikator & cache aktif.

- [x] **F9b. Riwayat → pantauan** — **LIVE, lalu disempurnakan F9c'**
  row jobId; kartu tuntas → "Lihat detail". Kartu cash-belum-lunas bukan di
  riwayat, melainkan beranda (aturan 0.2). Commit ffee929; E2E cash lulus.

- [x] **F9c'. Riwayat hanya pekerjaan tuntas** — **LIVE** `ffee929`
  Query hanya COMPLETED/CANCELLED; cash COMPLETED belum PAID keluar; tempo
  proforma tetap utk pantauan; CANCELLED arsip. Dual status F11 + multi-sesi
  F12 membetulkan badge/insentif. E2E Ibu Hesti: cash lunas → riwayat.

- [x] **F9d. Beranda = semua yang BELUM TUNTAS** — **LIVE** `ffee929`
  Hari ini + backlog (take 50 + count) + cash COMPLETED belum lunas.
  Empty-state & ringkasan menghitung semua kelompok. DoneCount dibetulkan.

- [x] **F9d++/F13. Detail cash-belum-lunas** — **LIVE** `ab2baad`
  Detail COMPLETED cash belum lunas punya kartu tagihan + tautan Tandai LUNAS;
  detail COMPLETED punya ringkasan & foto arsip read-only.

- [x] **F9f. Validasi alur kas K17 (D1 + D2)** — **SELESAI (kode + test, 2026-10-15)**
  Invariant KODE (bukan mutasi data): `markInvoicePaid` kini SET eksplisit
  `cashRemitStatus` — CASH → `HELD_BY_TECH` (fisik dipegang pembuat sampai
  setor); TRANSFER/QRIS → `null` (dana bank/kanal, tak pernah "kas teknisi") —
  membersihkan nilai stale bila ada. Jalur K17 EXISTING tidak diubah
  (getUnremittedCashByHolder / markCashRemitted tetap pola lama; guard
  OWNER/ADMIN tetap). Nama fungsi K17 diganti 2026-10-18 (M9) — pemegang
  uang BUKAN selalu teknisi, jadi label lama menyesatkan.
  K14 (2026-10-18, izin pemilik): markCashRemitted dapat mode "legacy" utk
  MELENGKAPI jejak setoran lama (baris REMITTED remittedAt=null) — tombol
  "Lengkapi Bukti" di Riwayat Setoran. Guard: hanya baris itu yg disentuh;
  jejak lama tidak ditimpa; baris HELD_BY_TECH tetap urusan mode biasa;
  wajib foto + penerima (K5) berlaku sama utk kedua mode.
  D2 tertutup: `tests/ar-cash-remittance.test.ts` (4) — filter K17 exact;
  TRANSFER/QRIS tak terhitung; guard remit tenant/status/type; input kosong.
  + `invoice-flow`: CASH→HELD, TRANSFER/QRIS→null (RED 2 gagal → GREEN).
  Verifikasi: tsc=0 · eslint=0 · suite **102 files / 858 tests** · build=0.
  PROVENANCE (koreksi pemilik): 11 row non-CASH HELD pada 2 tenant demo;
  1 row TRANSFER Rp85.000 tenant REAL PT Ase Dwimitra Mandiri. Per-row
  provenance tidak diketahui; tidak dimutasi, tidak diklaim defect nyata.
  Deploy SOP PASS `f1a0724`: source-sha exact, service active, `/`=200,
  `/login`=200, runtime errors 0; HEAD == origin/main, tree bersih.

- [x] **F9e. Gate kode + deploy F9a–F13** — **LIVE terakhir `ab2baad`**
  Suite F13: 101 files / 851 tests · tsc=0 · eslint=0 · build=0;
  SOP deploy PASS · `/` & `/login` 200 · service active · tree bersih.
  F12 multi-session (badge/insentif Ibu Hesti) live c32ab31; F13 detail live ab2baad.

**KESIMPULAN STATUS (terakhir diperbarui 2026-10-15 malam):** SELURUH ITEM
RENCANA F9a–F9f SELESAI — kode + test + deploy SOP LIVE. Release terakhir
`f1a0724` (F9f invariant kas K17), sebelumnya: F13 `ab2baad`, F12 `c32ab31`,
F11 `01379e1`, F10 `f9b41a3`, F9c'/F9d `ffee929`, F9a/F9b `8ca1415`.
Gate terakhir: 102 files / 858 tests · tsc=0 · eslint=0 · build=0;
`source-sha` == commit live, `/` & `/login` 200, service active, errors 0,
HEAD == origin/main, tree bersih.
Sisa bukan pekerjaan rencana, melainkan item TERBUKA (Bagian 3): uji manual
pengguna pasca-refresh, provenance row kas demo/real, dan C3 guard.

### PETA COMMIT F9 (audit trail — SATU kebenaran status = KESIMPULAN STATUS di atas)
Checklist implementasi rencana F9 lama ber-KOTAK KOSONG `[ ]` sudah DIHAPUS
2026-10-16 (dua status hidup di satu file = fosil yang menyesatkan sesi
berikut). Yang tersisa di dokumen ini HANYA dua jenis status, jangan tertukar:
  1. STATUS IMPLEMENTASI F9 → HANYA di blok "KESIMPULAN STATUS" (atas).
  2. KOTAK `[ ]` di BAGIAN 3B → SEMATA uji/konfirmasi pasca-refresh OLEH
     PEMILIK yang belum masuk — TIDAK mengubah status implementasi.
Isi bagian ini diganti peta commit saja (bukti `git log`, release = SHA yang live):
```
F9 beranda/riwayat inti : kode 7fab535 · release live 8ca1415
F9c'/F9d/F9d+           : ffee929
F9d++ (detail cash)     : f2cf589
F10 (PDF terang)        : f9b41a3
F11 (dual status)       : 01379e1
F12 (multi-session)     : c32ab31
F13 (detail COMPLETED)  : ab2baad
F9f (invariant kas K17) : f1a0724
```
Verifikasi kode 2026-10-16: F9f benar ada — `markInvoicePaid` menulis
`cashRemitStatus: payMethod === "CASH" ? "HELD_BY_TECH" : null`
(src/lib/services/invoice-service.ts:345-353) + `tests/ar-cash-remittance.test.ts`
(4 test) dan `tests/invoice-flow.test.ts`. F9c (guard detail) TIDAK dikerjakan
(sudah ditutup alasan C3 — lihat Bagian 1.2).

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
Suite 99 files / 844 tests · tsc=0 · eslint=0 · build=0.
Deploy live `01379e1` PASS (/ + /login 200; marker dual status ADA; service
active). Log 1 error = Server Reference ID stale tab (pola lama, bukan F11);
tidak ada error aplikasi baru.
UJI PEMILIK: riwayat Ryan = HANYA Ibu Hesti (tuntas, "Lihat detail");
beranda = "Perlu ditindaklanjuti" (Effi, Wati) + "Menunggu pelunasan cash"
(Ibu Hesti) — nol duplikasi.
```

### F9d++ — Detail job COMPLETED cash-belum-lunas BUNTU (laporan pemilik, screenshot 15:19)
```
DEPLOY LIVE `f2cf589` (PASS; / + /login 200; marker "Menunggu pelunasan cash"
ada di server bundle src_0w5y5y8; error runtime 3 menit = 0).
GEJALA: kartu "Menunggu pelunasan cash" (beranda) → halaman detail Ibu Hesti
  hanya menampilkan "Pekerjaan selesai" + pengingat — TANPA tombol tagihan.
AKAR (bukti kode): blok tagihan detail hanya utk ARRIVED/IN_PROGRESS/WAITING
  (page.tsx:79-86); setelah COMPLETED TIDAK ADA tautan invoice → teknisi
  buntu ("dimana closingnya?").
PERBAIKAN (jalur ada, TDD): utk job COMPLETED + invoice CASH belum PAID +
createdById == teknisi (guard F2 selaras — teknisi tak lihat invoice admin)
  → kartu amber "Menunggu pelunasan cash · INV/xxx · Rp…" + tombol
  "Tandai LUNAS →" ke /t/faktur/{invoiceId} (PaymentPanel & sudah ada).
  Tempo (proforma) TIDAK ditampilkan — tagihan urusan admin.
Test: tests/tech-detail-unpaid-cash.test.ts (RED 3/3→GREEN).
Deploy live `f2cf589` (PASS; / + /login 200; marker "Menunggu pelunasan cash"
ada di server bundle; error runtime 3 menit = 0).
```

### F10 — PDF "Cetak/Simpan" keluar background HITAM saat mode dark (laporan pemilik)
```
GEJALA: di aplikasi teknisi mode malam → cetak Ibu Hesti → PDF hitam.
AKAR (bukti globals.css): @media print hanya reset body{}; token .dark
  (kelas di html) TERUS aktif → semua elemen (--background/--card/--muted)
  gelap → PDF hitam. print:bg-white hanya utk <main> rute faktur/kwitansi.
PERBAIKAN (jalur globals.css, TDD RED 2/3→GREEN): di @media print,
  reset token surface html.dark/* ke nilai TERANG (salinan :root; dirawat
  dua tempat — dikomentari) + html,body putih. Konsekuensi: cetak SELALU
  terang walau mode gelap (benar utk dokumen cetak).
Test: tests/print-dark-mode.test.ts (3/3).
Deploy live `f9b41a3` (PASS; / + /login 200; css global `22-xq2w92m0fi.css`
berisi `html.dark` di media print + `@media print`; service active; suite
98 files / 838 tests · eslint 0 · build 0).
```

### UJI PEMILIK END-TO-END ALUR CASH (konfirmasi 2026-10-15 16:20)
```
Kasus nyata Ibu Hesti (INV/2026/0032, Ryan, Rp75.000, cash):
  ✓ kartu "Menunggu pelunasan cash" di beranda (F9d+)
  ✓ detail job COMPLETED → kartu tagihan + "Tandai LUNAS →" (F9d++)
  ✓ pemilik TANDAI LUNAS di HP teknisi (F9d++ → /t/faktur/{id})
  ✓ download INVOICE + KWITANSI — PDF TERANG walau mode dark (F10)
  ✓ kartu hilang dari beranda; pekerjaan masuk riwayat (F9c'/F9d)
→ alur cash penuh (closing → lunas → cetak) PRODUCTION-ACCEPTED.
```

### F11 — Dual status "Selesai - Belum dibayar / Selesai - Lunas" (tawaran pemilik → dieksekusi)
```
STATUS AWAL: ditawarkan saat diskusi, TIDAK sempat dieksekusi → pemilik
  tak melihatnya di aplikasi (laporan 2026-10-15). Kini dikerjakan (TDD).
Perubahan (jalur yang sudah ada — 0 komponen baru):
  riwayat : row + paid:boolean (dihitung dari invoicesByWs — data sudah di
            query, tanpa query tambahan); statusLabel(): CANCELLED→"Batal";
            COMPLETED+lunas→"Selesai - Lunas"; COMPLETED+belum→"Selesai -
            Belum dibayar" (tempo menanti admin). Badge lunas = secondary.
  beranda : JobCard prop unpaidCash → kelompok "Menunggu pelunasan cash"
            label "Selesai - Belum dibayar" (sifat kelompok = belum lunas,
            tanpa query tambahan); kelompok lain label biasa.
Test: tests/dual-status-label.test.ts (RED 4/6 → GREEN 6/6).
```

### F12 — REGRESI RIWAYAT: badge "Belum dibayar" SALAH + insentif 0 (uang SUDAH lunas & disetor)
```
LAPORAN PEMILIK (15 Okt malam): invoice INV/2026/0032 = PAID/CASH/REMITTED
  (verifikasi DB: paidAt 15 Okt 10:23 WIB, cashRemitStatus=REMITTED, uang
  disetor via admin panel) — TAPI di riwayat Ryan badge tetap "Selesai -
  Belum dibayar" + insentif 0 (beranda 20.000).
AKAR TERBUKTI (probe DB + kode):
  job Ibu Hesti = 2 WorkSession:
    ws-closing (14 Okt, items + invoice INV/2026/0032)   ← sumber kebenaran
    ws-empty   (15 Okt, kosong, tanpa invoice)           ← sesi kembar
  kode lama technician-service: sessionByJob.set(jobId, s) = LAST-WRITE WINS
  (asumsi 1 sesi/job) → sesi KOSONG terpilih → wsInvoices=[] → paid=false
  (badge salah) & qualifies=false (insentif 0 — beranda benar, tak lewat peta).
  (Bukan asumsi: query persis service di-replay against live DB → 2 sesi,
  invoice hanya di sesi pertama.)
PERBAIKAN (jalur YANG SAMA — sessionByJob diganti penuh, nol modul/fungsi baru):
  sessionsByJob (multi per job, orderBy createdAt asc deterministik)
  - kelunasan = AGREGAT lintas sesi (any PAID) → paid=true dari sesi closing
  - sesi insentif = sesi CLOSING (yang punya invoice; fallback: sesi awal;
    terakhir: sesi pertama dgn item) → konsisten dgn kartu beranda
  - wsInvoices agregat → F9c' filter & badge baca data benar
  anti-fosil: grep sessionByJob = hanya di komentar penjelasan bug.
Test: tests/tech-history-multi-session.test.ts (RED 3/4 → GREEN 4/4) +
  15/15 lintas suite utk behavior ini.
DEPLOY LIVE `c32ab31` (PASS; / + /login 200; service active; errors 0;
  release source-sha = commit perbaikan; marker dual status ADA; nama
  variabel minify → cek via source-sha, bukan grep string).
UJI PEMILIK: riwayat Ibu Hesti kini "Selesai - Lunas" + insentif 20.000
  (sama dgn beranda) — menunggu konfirmasi refresh tab.
```

### F13 — "Lihat Detail" job COMPLETED terbuka tapi KOSONG (laporan pemilik)
```
GEJALA: sentuh kartu riwayat → detail hanya kartu pelanggan + "Pekerjaan
  selesai" — tak ada foto, ringkasan, atau tagihan.
AKAR TERBUKTI (work.tsx): showWork = [ARRIVED, IN_PROGRESS, WAITING]
  → kartu "Foto Bukti" disembunyikan utk COMPLETED padahal page.tsx SELALU
  mengirim job.photos (data di tangan, gate UI salah); tak ada blok ringkasan.
PERBAIKAN (jalur yang SUDAH ADA — work.tsx & page.tsx, nol komponen baru):
  showPhotos = showWork || COMPLETED (foto sbg ARSIP, read-only);
  showUpload = showWork (tombol "+ Ambil Foto" hanya status berjalan —
  pekerjaan selesai TIDAK BISA diubah; konsisten dgn guard closing);
  card ringkasan "Ringkasan Pekerjaan" utk COMPLETED (layanan/unit/tanggal,
  field yg sudah dimuat getJob); copy empty-photo jujur utk arsip.
Test: tests/tech-detail-completed-content.test.ts (RED 3/3 → GREEN 3/3).
DEPLOY LIVE `ab2baad` (PASS; / + /login 200; marker "Ringkasan Pekerjaan" +
"Belum ada foto bukti…" ADA; service active; errors 0; suite 101 files / 851
tests · tsc=0 · eslint=0 · build=0).
```

**L11 (2026-10-18, laporan pemilik) — isi kartu "Ringkasan Pekerjaan" DIKOREKSI:**
```
MASALAH: kartu hanya menampilkan job.serviceType (1 nilai jenis = "INSTALL"),
padahal job Ibu Wati (cmtebahnp009lnn723gte607n) punya 3 item — Cuci AC ¾–1 PK +
Cuci AC 1,5–2 PK + Isi Freon R32 = Rp325.000 (INV/2026/0034). Pemilik: "ringkasan
hanya 1 pekerjaan, padahal 3". Baris itu juga membawa ternary fosil (kedua cabang
sama-sama job.serviceType).
PERBAIKAN (jalur existing, nol query & nol komponen baru):
  getJobCost (jalur biaya resmi, sudah dipakai /app/pekerjaan/[id]) DIPERLUAS —
  ikut mengembalikan items {descSnapshot, qty, unit, lineTotal} dari kolom DB
  (nilai TIDAK dikarang); halaman /t/pekerjaan/[id] memanggilnya dan merender
  daftar item + "Jumlah pekerjaan (N)".
  Baris "Layanan" (job.serviceType) tetap sbg CADANGAN bila belum ada item tercatat.
  Ternary fosil DIHAPUS; helper rp disatukan (baris "Menunggu pelunasan" ikut rp).
Test: tests/job-cost.test.ts (+4 RED→GREEN; akurasi 3 item = Rp325.000) +
      tests/tech-detail-completed-content.test.ts (+4 kontrak halaman).
Gate: suite 109 files / 974 tests · tsc=0 · eslint=0 error · build=0.
```

**DEPLOY LIVE 8ca1415 (F9a/F9b/F9d) — catatan historis, status final = KESIMPULAN STATUS Bagian 2:**
```
Verifikasi saat itu: tsc=0 · eslint=0 · suite 94 files/818 tests · build=0.
DEPLOY LIVE `8ca1415` (2026-10-15, PASS): penanda "Perlu ditindaklanjuti" +
"Tandai LUNAS" + "Memuat" ADA di server bundle; experimental.staleTimes
{'dynamic': 30} terbaca di required-server-files.json; log error bersih.
Insiden SOP: deploy pertama BLOCKED (working tree kotor — 2 dokumen F7
tertinggal) → commit → rerun PASS. Pelajaran: git status dulu SEBELUM
panggil SOP (gerbang tree-clean sudah benar; script TIDAK diubah).
Uji pemilik saat itu: buka /t Ryan → "Perlu ditindaklanjuti" (Effi+Wati);
riwayat Ibu Hesti → kartu "Tandai LUNAS →" → bayar → masuk Kas Belum Disetor
(sudah dikonfirmasi pemilik — lihat Bagian 3B).
Catatan: "Sisa rencana: F9f" pada catatan lama SUDAH SELESAI (release f1a0724).
```

---

## BAGIAN 2B — RENCANA PERBAIKAN PEMBAYARAN & PENERIMAAN (AKTIF — DOKUMEN TUNGGAL)
Lihat **`docs/RENCANA_Keuangan_Kas_Tuntas.md`** — dokumen rencana PERBAIKAN TUNTAS
closing pembayaran pelanggan cash (tunai/transfer/QRIS), disusun ulang penuh
2026-10-17 (versi lama dibuang total — tambal sulam & penomoran lama).
Isinya, sesuai urutan proses: lingkup · masalah M1-M6 · **keputusan final K1-K8**
· aturan kerja · langkah **L1-L7** · bukti "selesai" · **tabel progres BAGIAN 7**
(satu-satunya tempat membaca status; `[x]` wajib ber-bukti) · daftar SSOT yang
wajib ikut diperbarui.
DOKUMEN LAMA `RENCANA_Kas_Tunai_Tampilan_Keuangan.md` sudah **DIHAPUS**, dan
seluruh penomoran lama (`G1-G6`, `D1-D5`, `F-01..F-17`, `DOM-*`, `C1..C6`,
`WP0..WP7`) **SUDAH MATI** — hanya pemetaan di BAGIAN 9 dokumen baru.
**Jangan pakai ID lama lagi; jangan menyebut WP0/C1 di mana pun.**
SEMUA item beranda/riwayat teknisi (F9a-F9f, F10-F13) SELESAI (kode + test +
deploy SOP LIVE, lihat KESIMPULAN STATUS) — status F9 = SATU kebenaran di blok
tersebut; peta commit = audit trail, bukan status.
Pekerjaan berikutnya = `docs/RENCANA_Keuangan_Kas_Tuntas.md` — mulai dari
**BAGIAN 7, baris `[ ]` pertama**.
CATATAN fakta live (2026-10-16): release live = `c5973c1` (memuat kode F9f
`f1a0724`); klaim "release terakhir f1a0724" di blok lama
di atas = usang, jangan dikutip ulang.

DAMPAK L1 (zona waktu tenant, 2026-10-17) ke alur teknisi: **periode insentif
bulan-berjalan di `/t`** kini dihitung menurut zona waktu tenant
(`monthRangeInZone`, `src/lib/domain/tenant-timezone.ts`) — bukan zona server.
Semua tenant saat ini = WIB (`Asia/Jakarta`), jadi perilaku tampilan tidak berubah;
perbedaan hanya muncul bila ada tenant WITA/WIT (tenant baru memilih saat onboarding).
Jalur lama `new Date(y,m,1)` di `src/app/t/page.tsx` sudah DIHAPUS (anti-fosil:
grep jalur lama di 2 halaman = KOSONG).

PERUBAHAN L2 + K9 (2026-10-18) pada alur teknisi:
- **K9 (keputusan pemilik): invoice/proforma terbit TANPA label posisi uang.**
  Dulu `closeWorkSession` menempel `cashRemitStatus=HELD_BY_TECH` sejak terbit
  (tebakan tanpa cek pembayaran). Stempel di `worksession-service.ts` DIHAPUS —
  anti-fosil: grep `cashRemitStatus` di file itu = KOSONG. Label kini HANYA ditulis
  `markInvoicePaid` saat pembayaran nyata (CASH → HELD_BY_TECH; TRANSFER/QRIS → null).
  Dampak ke teknisi: TIDAK ADA perubahan tombol/layar — teknisi tetap "Tandai LUNAS"
  seperti biasa (K3); yang berubah hanya label datangnya, dan hanya saat benar-benar lunas.
- **L2: setoran kas kini wajib bukti foto (S3) + waktu + admin penerima** — tombol
  "Tandai Disetor" di /app/laporan membuka Dialog (pustaka UI) dengan unggah wajib;
  setoran tanpa foto/penerima DITOLAK di service. Migrasi kolom jejak
  `20261018000000_cash_remit_trace` sudah dijalankan (data lama tidak disentuh).
- **L3: transfer/QRIS kini punya TAHAP VERIFIKASI.** Penandaan lunas oleh TEKNISI
  = "menunggu verifikasi" (belum dihitung penerimaan); oleh ADMIN/OWNER = langsung
  terverifikasi (mereka yang menandai artinya sudah lihat dana masuk). Tombol
  "Verifikasi" muncul di halaman faktur ADMIN BILA yang menandai lunas teknisi.
  CASH tidak terpengaruh (verifikasinya = setoran berfoto, L2). Kolom verifikasi
  `20261018010000_invoice_verification` sudah dijalankan — transfer/QRIS lama = null
  (belum pernah diverifikasi), angka penerimaan LAMA tetap apa adanya sampai diverifikasi.
- **L4: kartu laporan pecah 3 posisi uang** — Penerimaan (sudah masuk) · Menunggu
  Setoran (di teknisi) · Menunggu Verifikasi (transfer/QRIS) · **bukti pembayaran
  kini TAMPIL** di halaman detail (termasuk halaman teknisi — satu komponen dipakai
  dua peran), lengkap dengan badge status posisi uangnya.
- **L6: SATU sumber label posisi uang** (`src/lib/copy/money-position.ts`) dipakai oleh
  daftar faktur admin DAN halaman detail — dua halaman tidak pernah lagi memberi label
  berbeda. Daftar faktur admin kini memperlihatkan posisi uang per invoice, termasuk
  "menunggu dicek" untuk transfer/QRIS yang ditandai lunas oleh teknisi (antrean L3).
- **K11 (2026-10-18, laporan pemilik): kartu & tabel posisi uang SEKARANG SEJUJUR.**
  Dulu kartu "Menunggu Setoran" berperiode bulan (Rp225.000) sedangkan tabel "Kas
  Belum Disetor per Teknisi" seluruh waktu (Rp2.855.000) — satu layar dua angka.
  Kini: `menungguSetoran` & `menungguVerifikasi` = **KEADAAN seluruh waktu** (sama
  dengan tabelnya), `penerimaan` = **ARUS bulan ini menurut waktu diterima**
  (setoran/verifikasi dicatat di rentang). Sub-label kartu menyebut sifat angkanya.
- **K12 (2026-10-18, PERINTAH PEMILIK): teknisi DIPERBOLEHKAN mengunggah bukti** —
  tunai/transfer/QRIS, khususnya pelanggan TOP CASH. Guard B-2 lama (`assertRole
  OWNER/ADMIN`) DIBUKA utk `TECHNICIAN`; kolom bukti tampil semua peran. K10
  (menyembunyikan kolom dari teknisi) DIBATALKAN — itu keputusan saya tanpa izin
  dan sudah dibatalkan. prop `role` di panel dihapus bersih (anti-fosil).
- **K10 (2026-10-18, laporan pemilik): PaymentPanel SADAR PERAN.** Panel dipakai SAMA
  oleh teknisi & admin (F-05) tapi unggah bukti diguard OWNER/ADMIN (F-06) → teknisi
  dulu melihat kolom bukti, pilih foto, upload DITOLAK senyap, tombol LUNAS membeku
  tanpa indikator. Kini: `role` diteruskan dari halaman → teknisi TIDAK melihat kolom
  bukti (alur lapangan tak berubah), admin tetap; tombol menampilkan "Mengunggah…".

## BAGIAN 3A — FORENSIK: INV/2026/0003 PT ASE DWIMITRA MANDIRI (tenant REAL)
```
TANGGAL: 2026-10-15 malam. Sumber: probe read-only live DB + kode + git log.
FAKTA RECORD (diverifikasi langsung, nol asumsi):
  invoice cmv1xtu9i00x92aiuh6dljenk · Rp85.000 · PAID · payMethod=TRANSFER
  cashRemitStatus=HELD_BY_TECH (STALE) · paymentProofUrl=null
  dibuat 2026-10-09 22:12:28Z · lunas 22:13:17Z (49 detik setelah closing)
  item TUNGGAL: "Cuci AC (Jatijajar, Azalea)" MAINTENANCE 1 × Rp85.000
  pelanggan: Bapak Hendra · teknisi/pembuat: Ujang (6288905726131)
BUKTI TRANSAKSI NYATA (bukan seed) — JobProgressEvent lewat FRONTEND:
  ASSIGNED 19:16 (actor ase.dwimitra.mandiri) → ACCEPTED 19:19 (Ujang)
  → EN_ROUTE 19:54 → ARRIVED 20:15 → IN_PROGRESS 20:30
  → COMPLETED 22:12:28 (meta source=WORK_SESSION_CLOSE)
  Sesi dibuka 20:53Z, ditutup 22:12:27Z — SATU dokumen, tanpa duplikat.
AKAR MASALAH = KODE BUKAN KESALAHAN PETUGAS:
  worksession-service.ts:323 (sejak commit 80ba5a5): closing menulis
  cashRemitStatus=HELD_BY_TECH utk SEMUA INVOICE tanpa cek payMethod.
  markInvoicePaid LAMA tidak mengubah kolom ini → nilai tetap STALE
  setelah lunas TRANSFER. (F9f memperbaiki jalur ini — live.)
DAMPAK — TIDAK ADA ANGKA SALAH YG TERLIHAT OLEH PELANGGAN:
  Laporan "Kas Belum Disetor per Pemegang Uang" filter payMethod=CASH
  (ar-service.ts:94) → invoice INI TIDAK MUNCUL → Rp85.000 TIDAK dihitung
  kas teknisi. Total/item/status PAID = benar.
  Konsumen cashRemitStatus HANYA K17 (getUnremittedCashByHolder +
  markCashRemitted) — tidak ada laporan lain yg membaca kolom ini.
  (Nama fungsi K17 diganti 2026-10-18 sesuai M9: pemegang bisa pemilik.)
KEPUTUSAN PEMILIK (satu-satunya baris stale di tenant REAL):
  Opsi A: biarkan — laporan sudah benar; kolom salah hanya utk query mentah.
  Opsi B: koreksi 1 baris (cashRemitStatus→null) via SQL sekali — BUTUH
    IJIN EKSPLISIT pemilik; agen TIDAK menyentuh DB.
Sisa stale serupa: 11 baris HANYA di 2 tenant DEMO (Jaya Mandiri 9, AC
Depok Jaya 2); provenance per-baris tak terverifikasi.
```

## BAGIAN 3B — LOG KONFIRMASI UJI PEMILIK (update SETIAP laporan uji masuk)
```
SELAMATKAN STATUS DULU: kotak [ ] di sini = UJI PEMILIK pasca-deploy yang
BELUM masuk — BUKAN status implementasi. Status kode/test/deploy SEMUA item
di bawah sudah SELESAI (lihat "KESIMPULAN STATUS" Bagian 2). Jangan menandai
ulang item yang sudah TERVERIFIKASI tanpa uji baru.
TERVERIFIKASI (ucapan pemilik — jangan ditandai ulang tanpa uji baru):
  [✓] F9d/F9d+ — "sudah saya check dan kartu di berandan sudah muncul"
      (kartu "Perlu ditindaklanjuti" Effi + Ibu Wati hidup).
  [✓] F9d++ + F10 — "Ibu Hesti sudah saya tandai lunas, sudah download
      invoice dan kwitansi, sudah tidak ada latar hitamnya" (alur lunas
      dari detail → /t/faktur jalan; PDF mode dark terang).
  [✓] Provenance: hanya Jaya Mandiri + AC Depok Jaya = tenant demo.
BELUM DIKONFIRMASI PEMILIK (deploy ADA, uji pasca-refresh belum masuk):
  [ ] F9a  — navigasi beranda↔riwayat dari cache; label "⟳ Memuat…".
  [ ] F9c' — riwayat Ryan HANYA tuntas (Effi & Wati tidak ada di riwayat).
  [ ] F11  — label dual status "Selesai - Lunas / Selesai - Belum dibayar".
  [ ] F12  — badge riwayat Ibu Hesti = "Selesai - Lunas" + insentif 20.000
             (cocok beranda) setelah refresh.
  [ ] F13  — detail COMPLETED = ringkasan + foto arsip read-only + status.
  [ ] F9f  — transaksi CASH/TRANSFER BARU → perilaku Kas Belum Disetor.
             (Implementasi F9f SENDIRI sudah SELESAI & LIVE f1a0724 — yang
             belum dikonfirmasi hanya uji transaksi baru oleh pemilik.)
```

## BAGIAN 3 — BELUM DIVERIFIKASI / TERBUKA (AKTIF)
- PT Ase INV/2026/0003 → TELUSUR SELESAI, lihat BAGIAN 3A (akar = kode lama,
  laporan keuangan tidak salah; sisa = keputusan pemilik Opsi A/B; mutasi DB
  memerlukan izin eksplisit).
- 11 row non-CASH HELD di dua tenant demo (Jaya Mandiri, AC Depok Jaya)
  tidak boleh dianggap semuanya seed atau transaksi frontend; provenance
  per-row belum terverifikasi.
- Uji manual pengguna pasca-refresh: badge riwayat Ibu Hesti = "Selesai - Lunas"
  + insentif 20.000 setelah F12; detail readonly F13 — deploy ada, tetapi
  konfirmasi pasca-refresh belum tercatat.
- WiFi: dampak cache F9a pasca-deploy belum diukur pengguna.
- C3 inkonsistensi guard OR assignment vs detail teknisi utama tetap terbuka;
  jangan ubah guard keamanan tanpa reproduksi nyata.
- Kinerja backlog pada tenant real skala besar belum diukur (daftar dibatasi 50,
  count query terpisah).

