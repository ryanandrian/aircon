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
D3 (label): judul "Kas Belum Disetor per Teknisi" mengelompokkan createdById
(pembuat sesi); perlu pastikan bahasa UI sesuai kasus admin/teknisi — bukan
anomali data tanpa provenance.
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
  (getUnremittedCashByTech / markCashRemitted tetap pola lama; guard
  OWNER/ADMIN tetap).
  D2 tertutup: `tests/ar-cash-remittance.test.ts` (4) — filter K17 exact;
  TRANSFER/QRIS tak terhitung; guard remit tenant/status/type; input kosong.
  + `invoice-flow`: CASH→HELD, TRANSFER/QRIS→null (RED 2 gagal → GREEN).
  Verifikasi: tsc=0 · eslint=0 · suite **102 files / 858 tests** · build=0.
  PROVENANCE (koreksi pemilik): 12 row TRANSFER/QRIS HELD di DB demo Jaya
  Mandiri = seed backend, provenance TIDAK terverifikasi → TIDAK diklaim
  defect produksi & TIDAK dimutasi; invariant ini menutup jalur di MASA DEPAN.

- [x] **F9e. Gate kode + deploy F9a–F13** — **LIVE terakhir `ab2baad`**
  Suite F13: 101 files / 851 tests · tsc=0 · eslint=0 · build=0;
  SOP deploy PASS · `/` & `/login` 200 · service active · tree bersih.
  F12 multi-session (badge/insentif Ibu Hesti) live c32ab31; F13 detail live ab2baad.

**KESIMPULAN STATUS (terakhir diperbarui 2026-10-15):** item F9a–F9f
sudah memiliki implementasi/test lokal sesuai status di atas; F12/F13 live
sebelumnya. **F9f belum LIVE** sampai full gate + commit + deploy SOP berikutnya.
F9a/F9b/F9c'/F9d/F9d++/F10/F11/F12/F13 sudah dideploy dan mendapat bukti
produksi yang tercatat per item. Uji pemilik yang sudah diterima: cash Ibu
Hesti lunas + invoice/kwitansi PDF terang. Jangan simpulkan seluruh pekerjaan
100% live sebelum F9f deploy PASS dan dokumen mencatat release-nya.

### Rencana historis awal — SUPERSEDED
Item F9a–F9f di bawah pada draf historis ini sudah digantikan oleh checklist
status terbaru di Bagian 2. Jangan gunakan status lama "belum commit/deploy";
catatan ini dipertahankan sebagai audit trail, bukan rencana aktif. Checkbox
historis yang tampak kosong bukan status aktif.


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

## BAGIAN 3 — BELUM DIVERIFIKASI / TERBUKA (AKTIF)
- F9f: implementasi+test lokal; commit/deploy belum. Harus jalankan full gate + SOP.
- PT Ase Dwimitra Mandiri (tenant real): 1 invoice PAID TRANSFER dengan
  HELD_BY_TECH Rp85.000; provenance tidak diketahui. Jangan ubah data via DB.
  Fix kode F9f memastikan transaksi baru TRANSFER/QRIS tidak terhitung kas.
- 11 row pada 2 tenant demo (Jaya Mandiri, AC Depok Jaya) tidak boleh dianggap
  semuanya seed atau semuanya transaksi frontend; provenance per-row belum ada.
- Hasil pasca-refresh pengguna: badge riwayat Ibu Hesti = "Selesai - Lunas"
  + insentif 20.000 dan detail read-only F13 — deploy sudah ada, konfirmasi
  pengguna setelah refresh masih belum tercatat.
- WiFi: dampak cache setelah deploy belum diukur; indikator + cache sudah live.
- C3 inkonsistensi guard OR assignment vs detail teknisi utama masih terbuka,
  tanpa reproduksi nyata; jangan ubah guard keamanan tanpa bukti.
- Kinerja query backlog pada tenant REAL skala besar belum diukur; list dibatasi
  50, count terpisah.

