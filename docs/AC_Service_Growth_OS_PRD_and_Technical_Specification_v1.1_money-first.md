# AC SERVICE GROWTH OS

## PRD + Technical Specification — REFRAMED BY MONEY-PROXIMITY

### Version 1.1 — Build Baseline (menggantikan urutan modul di v1.0)

**Perubahan dari v1.0:** scope, requirement, dan spec teknis TIDAK berubah. Yang berubah adalah *cara mengorganisir dan mengurutkan*: dari "daftar modul A–J" menjadi "lapisan berdasarkan kedekatan ke uang". Tujuannya supaya tim membangun organ yang menghasilkan uang lebih dulu, dan setiap fitur sadar ia melayani loop mana. ID requirement (FR-xxx) dari v1.0 dipertahankan untuk traceability.

---

# 0. SATU IDE YANG MENGIKAT SEMUANYA

Produk ini bukan "software manajemen teknisi". Produk ini adalah **mesin uang untuk usaha AC**, dan sebagai perusahaan, ia adalah **bukti bahwa mesin produksi kami bekerja**.

Karena itu dokumen ini punya satu tulang punggung — **THE MONEY LOOP** — dan semua hal lain diposisikan berdasarkan seberapa dekat ia menyentuh loop ini.

```text
              ┌─────────────────── GET CUSTOMER ───────────────────┐
              │  (lead / referral / review / IoT alert)             │
              ▼                                                     │
         JOB ORDER  ──►  TECHNICIAN DOES JOB  ──►  CAPTURE          │
         (kerjaan)        (progress jujur)         asset+history    │
                                                        │           │
                                                        ▼           │
                                                 NEXT SERVICE DATE   │
                                                        │           │
                                                        ▼           │
                                                    REMINDER  ──►  REPEAT JOB ──┘
                                                  (via WhatsApp)   (uang bulan depan)

     IoT (add-on):  AC  ──►  anomali  ──►  ALERT  ──►  maintenance opportunity ──► masuk ke JOB ORDER
                    (AC menjual dirinya sendiri = sumber GET CUSTOMER ke-dua)
```

Aturan main untuk seluruh tim: **kalau sebuah fitur tidak memutar loop ini, ia bukan prioritas v1.0.** Loop yang berputar = tenant bayar bulan kedua = bukti ekonomi untuk investor.

---

# 1. LAPISAN PRODUK BERDASARKAN KEDEKATAN KE UANG

Bukan lagi Modul A–J. Lima lapisan, diurut dari yang paling dekat ke pendapatan. Urutan lapisan = urutan prioritas build & urutan yang harus "hidup" lebih dulu.

| Lapisan | Nama | Pertanyaan ekonomi yang dijawab | Kenapa di sini |
|---|---|---|---|
| **L0** | THE MONEY LOOP (Repeat Engine core) | "Apakah customer datang lagi tanpa saya kejar manual?" | Ini alasan tenant bayar bulan ke-2. Retensi = nyawa SaaS. |
| **L1** | GET THE JOB (Growth intake) | "Apakah saya dapat lebih banyak kerjaan?" | Mengisi loop dari depan. Tanpa ini loop kosong. |
| **L2** | DO THE JOB CREDIBLY (Ops trust) | "Apakah owner bisa berhenti jadi bottleneck & percaya lapangan?" | Bikin tenant sanggup menampung lebih banyak job tanpa kacau. |
| **L3** | AC SELLS ITSELF (IoT demand engine) | "Bisakah AC sendiri menghasilkan kerjaan?" | Differentiator + sumber demand ke-2 + cerita investor. |
| **L4** | KNOW THE NUMBERS (Proof layer) | "Apakah loop ini benar-benar menghasilkan uang?" | Angka yang meyakinkan owner DAN investor (validasi pilot). |
| **L5** | PLUMBING (Enabler) | (tidak menghasilkan uang, tapi tanpa ini tak jalan) | Auth, tenant, WA delivery, billing. Seminimal mungkin. |

---

## L0 — THE MONEY LOOP (paling dekat ke uang)

**Outcome ekonomi:** customer sekali → customer berulang. Ini yang membuat MRR bertahan.

**Loop:** `job selesai → asset + service history tersimpan → next_service_date → reminder → 1-tap repeat job`.

**Requirement inti (dari v1.0, disusun ulang sebagai satu organ):**
- FR-JOB-3 / FR-RPT-1: completion job otomatis menetapkan `next_service_date` (dari interval asset/jenis service). *Tanpa ini loop putus.*
- FR-AST-2/3: history & next_service_date hidup **di level asset**, bukan sekadar customer. (AC yang diservis, bukan orangnya.)
- FR-RPT-2: worker menghasilkan reminder queue menjelang due date (lead time diatur, mis. H-7).
- FR-RPT-3: dari reminder → **1-tap kirim WA** (template terisi) + **1-tap buat repeat job** (prefill dari job lama).
- FR-RPT-4: lacak konversi reminder → repeat job = metrik **repeat-order uplift** (bukti utama ke investor).

**Definisi "hidup":** seorang tenant menyelesaikan satu job hari ini, dan tanpa mengingat apa pun, sistem yang memunculkan pekerjaan berikutnya di waktu yang tepat. Kalau demo cuma bisa tunjukkan ini, tenant sudah paham kenapa harus bayar.

**Yang membuktikannya (feed ke L4):** repeat-rate, jumlah repeat job dari reminder, revenue dari repeat vs first-time.

---

## L1 — GET THE JOB (mengisi loop dari depan)

**Outcome ekonomi:** lebih banyak kerjaan masuk. Get Customers.

**Requirement (v1.0 Growth, difokuskan ke yang menghasilkan job):**
- FR-GRW-1: lead → status → **konversi lead→job** (bukan CRM cantik; yang dihitung: berapa lead jadi job).
- FR-GRW-3: referral (sumber termurah di usaha AC — mulut ke mulut) — tag customer hasil referral.
- FR-GRW-4: review request pasca-job via WA (referral engine berikutnya).
- FR-GRW-2: **customer source tracking** yang tersambung ke revenue → tahu channel mana menghasilkan uang (feed ke L4).
- FR-GRW-5: follow-up terjadwal supaya lead tidak jebol (penyebab #1 hilang uang di usaha kecil).
- FR-GRW-6: campaign sederhana ke segmen customer lama (v1.0 assisted, bukan blast otomatis).

**Prinsip:** setiap entitas di sini hanya berharga kalau ujungnya bisa jadi Job Order. Lead yang tidak bisa dikonversi jadi job = fitur mati.

---

## L2 — DO THE JOB CREDIBLY (bikin loop sanggup diskalakan)

**Outcome ekonomi:** owner berhenti jadi dispatcher; kapasitas job naik tanpa kekacauan; customer puas → repeat & referral naik.

Ini fondasi FSM + kejujuran operasional. Nilainya bukan "software rapi", tapi "owner berani menerima lebih banyak job".

**FSM inti (fondasi seluruh loop):**
- FR-CUS/AST/TEC: customer, asset AC, technician (identitas & skill).
- FR-JOB-1/2: job order + checklist + foto before/after + notes.
- FR-PRG-1..4: **progress state machine jujur** (DRAFT→ASSIGNED→ACCEPTED→EN_ROUTE→ARRIVED→IN_PROGRESS→(WAITING)→COMPLETED, +CANCELLED/RESCHEDULED), tiap transisi ber-timestamp, transisi ilegal ditolak, owner lihat real-time.
- Technician daily job **di HP** (FR-TEC-3, NFR-1/2): lihat kerjaan hari ini, navigasi, update status, foto, checklist, selesai — offline-tolerant.

**Kejujuran penjadwalan (differentiator, tapi melayani L0/L1):**
- FR-SCH-1..6: feasibility **FEASIBLE / RISK / CONFLICT / UNKNOWN** — sistem menilai kelayakan, bukan sekadar cek kalender kosong. Aturan wajib: `selesai(A)+travel+buffer ≤ mulai(B)`, kalau tidak → **tidak memaksakan assignment**.
- FR-REP-1..5: dynamic re-planning — progress berubah → recompute → conflict? → alternatif → **owner approve** → baru customer dinotifikasi.

**Benang merah "anti-bohong":** sistem tidak boleh mengklaim sesuatu mungkin padahal tidak (scheduling), sama seperti IoT nanti tidak boleh klaim AC nyala tanpa bukti (L3). Kejujuran inilah yang membuat owner percaya menyerahkan kendali → itulah yang dibeli.

---

## L3 — AC SELLS ITSELF (IoT sebagai DEMAND GENERATOR, bukan monitoring)

**Reframe paling penting:** IoT di dokumen v1.0 mudah terbaca sebagai "pantau AC dari HP". Itu salah arah. **Esensi IoT = mengubah unit AC customer menjadi generator Job Order.** Grafik telemetry hanya sarana; produknya adalah *pekerjaan baru yang muncul otomatis*.

**Loop IoT (nyambung balik ke L0):**
```text
AC → telemetry → anomali terdeteksi → ALERT → maintenance opportunity
   → 1-tap Job Order (source=iot) → masuk FSM (L2) → service → history (L0) → repeat
```

**Requirement, diurut dari yang menghasilkan uang:**
- FR-IOT-4/5: **alert → maintenance opportunity → 1-tap create job**. *Ini fitur IoT nomor satu.* Kalau hanya satu hal IoT yang jalan, ini dia.
- FR-IOT-2: telemetry (suhu/humidity/current/power/online/heartbeat/health) — bahan bakar deteksi anomali, bukan tujuan.
- FR-IOT-3: remote command dengan **Command → Verify** (COMMAND_SENT → ACKNOWLEDGED → STATE_CONFIRMED). UI tidak boleh bilang "berhasil" tanpa STATE_CONFIRMED. Ini "nilai tambah premium" yang bikin customer tenant mau bayar sewa device.
- FR-IOT-1/7: provisioning QR + model sewa (recurring device revenue — jalur monetisasi ke-2).
- FR-IOT-6: instalasi non-invasif (tenant pasang sendiri; IR; tidak buka refrigerant circuit).

**Kenapa ini penting untuk investor (L4):** IoT menciptakan sumber demand yang tidak bergantung pada usaha marketing tenant — AC yang rusak memanggil teknisi sendiri. Ini yang mengubah cerita dari "aplikasi jadwal" menjadi "mesin permintaan".

**Disiplin:** SaaS (L0–L2) harus jalan penuh **tanpa** IoT. IoT = optional add-on. 25 device = pilot pembuktian hardware/connectivity/IR/telemetry/command reliability, bukan mass production.

---

## L4 — KNOW THE NUMBERS (bukti bahwa loop menghasilkan uang)

**Dua audiens, satu sumber data:**
- **Owner tenant:** "apa yang terjadi & keputusan apa yang harus diambil" — job, selesai, revenue, produktivitas teknisi, repeat customer, retention, source breakdown.
- **Perusahaan/investor:** angka validasi pilot — **ARPA, CAC, churn, gross margin, LTV, CAC payback, repeat-order uplift, IoT adoption, contribution margin.**

**Requirement:**
- FR-PRF-1..4: semua metrik owner dihitung dari event/timestamp yang sudah dicatat L0–L3 (single source of truth — bukan input manual).
- FR-GRW-2 (source→revenue) & FR-RPT-4 (repeat uplift) memberi angka growth.
- **Instrumentasi cohort sejak hari 1 pilot** supaya Gate 5–6 (paying tenant + economic validation) bisa dihitung dari data nyata, bukan klaim.

**Prinsip dari business plan:** jangan palsukan kepastian ROI sebelum ada data. Layer ini ada supaya keputusan scale berbasis bukti, bukan janji.

---

## L5 — PLUMBING (perlu, tapi jauh dari uang → seminimal mungkin)

Dibangun cukup untuk menopang L0–L4, tidak lebih.
- FR-ONB-1..4: onboarding tenant via HP + OTP, invite teknisi via link WA, < 10 menit.
- Auth (OTP+JWT), RBAC per endpoint, multi-tenant isolation + Postgres RLS (NFR-4/5).
- FR-WA-1..4: **WhatsApp sebagai kanal pengiriman loop** — bukan modul terpisah. Setiap titik komunikasi (reminder L0, follow-up L1, notifikasi re-plan L2, alert L3, review) = "kirim via WA" template terisi (deep link), tercatat di timeline customer. v1.0 assisted; jalur Cloud API disiapkan tapi tidak wajib.
- FR-BIL-1..3: subscription + feature gating (Starter/Growth/Pro + IoT add-on). v1.0 penandaan paid manual/assisted; payment gateway otomatis out-of-scope.

**Catatan penting soal WhatsApp:** ia ada di L5 secara *teknis* (plumbing pengiriman), tapi *strategis* ia adalah urat nadi loop. Jangan lawan kebiasaan tenant — WA tetap raja komunikasi, aplikasi jadi otak di belakangnya. HP adalah satu-satunya perangkat pasti dimiliki. Melawan dua hal ini = mati sebelum pilot.

---

# 2. URUTAN BUILD BERBASIS UANG (menggantikan urutan modul)

Prinsip: bangun **tulang loop dulu sampai bisa berputar**, baru lebarkan. Setiap milestone diukur dari "loop berputar sejauh mana", bukan "berapa modul selesai".

| Fase | Tujuan (loop) | Isi | Selesai berarti |
|---|---|---|---|
| **B0 — Skeleton** | fondasi agar loop bisa dipasang | L5 minimal (auth, tenant, RBAC, DB) + entitas L2 (customer/asset/technician/job) | tenant bisa dibuat, job bisa dibuat |
| **B1 — Half loop** | pekerjaan bisa dikerjakan & tercatat jujur | L2: progress state machine + technician di HP + foto/checklist + owner real-time | satu job jalan end-to-end dari HP teknisi, owner melihat |
| **B2 — CLOSE THE LOOP** ★ | **customer datang lagi otomatis** | L0 penuh: completion→next_service_date→reminder→1-tap repeat job (+WA) | **loop uang berputar** — ini titik "produk punya alasan dibeli" |
| **B3 — Fill the front** | lebih banyak kerjaan masuk | L1: lead→job, referral, review, source tracking, follow-up | loop terisi dari depan, source→revenue terukur |
| **B4 — Trust at scale** | owner berani skalakan | L2 lanjutan: feasibility 4-status + dynamic re-planning + approval | scheduling jujur & re-plan jalan |
| **B5 — AC sells itself** | demand ke-2 dari IoT | L3: provisioning→telemetry→alert→1-tap job + Command→Verify + sewa | AC menghasilkan job order sendiri |
| **B6 — Prove it** | bukti untuk owner & investor | L4: metrics owner + instrumentasi cohort (ARPA/repeat-uplift/dll) | angka loop terbaca dari data nyata |
| **B7 — Harden & pilot** | siap dijual | QA critical-path (loop-first), security, WA delivery, billing manual, UAT | DoD terpenuhi, pilot siap |

★ **B2 adalah titik terpenting seluruh proyek.** Jika 25 hari meleset, urutan ini menjamin yang selamat adalah bagian yang menghasilkan uang & retensi, bukan fitur pinggiran.

**Pemetaan ke 25 hari (business plan §25) tetap kompatibel:** H1–3 = B0; H4–8 = B1 + mulai B2; H9–13 = selesaikan B2/B3 + mulai B4 (Gate 2 H10 = loop inti + telemetry hidup); H14–17 = B4 + B5 + B6; H18–20 = integrasi L3/L5 + dashboard (Gate 3 H20); H21–23 = B7 (QA loop-first + security); H24 UAT; H25 release + 25 device (Gate 4). Urutan uang di atas hanya mengubah *apa yang diprioritaskan bila waktu sempit*: selalu lindungi loop.

---

# 3. IMPLIKASI TEKNIS DARI REFRAME (yang berubah cara pandangnya)

Arsitektur, stack, data model, dan API dari v1.0 **tetap berlaku** (lihat dokumen v1.0 Bagian II). Yang dipertegas oleh reframe:

1. **Event/timestamp adalah aset, bukan sekadar log.** `job_progress_event` + completion + reminder + command_log + telemetry adalah bahan bakar L0 (next_service_date), L4 (semua metrik), dan moat (data menumpuk → makin sulit pindah). Rancang mereka sebagai first-class, immutable, dan ter-instrumentasi cohort sejak awal.

2. **`next_service_date` adalah engine, bukan kolom.** Ia pusat loop uang: dihasilkan saat completion, dikonsumsi worker reminder. Uji ini paling ketat (unit + integration).

3. **Satu prinsip anti-bohong di dua tempat.** Scheduling feasibility dan IoT Command→Verify berbagi filosofi: jangan tampilkan kepastian tanpa bukti. Terapkan konsisten (status eksplisit + reason + evidence).

4. **IoT ingest → rule engine → Job Order** adalah jalur utama, bukan telemetry→grafik. Prioritaskan pipeline alert-to-job; visualisasi telemetry menyusul.

5. **WhatsApp = adapter pengiriman, dipanggil oleh banyak loop.** Rancang sebagai satu layanan template+deep-link+message_log yang dipakai L0/L1/L2/L3, dengan port ke Cloud API. Jangan tersebar.

6. **Feature gating (billing) melingkupi lapisan, bukan fitur acak.** Paket menjual "seberapa banyak loop": Starter = loop inti (L0–L2), Growth = + L1/L4, Pro = + L3/otomasi. Ini menyelaraskan harga dengan nilai ekonomi yang diterima tenant.

---

# 4. DEFINITION OF DONE (diurut ulang: loop dulu)

Sebuah rilis v1.0 dianggap "menghasilkan uang & siap pilot" bila, berurutan:
1. **(L0) Loop uang berputar:** job selesai → history/asset → next_service_date → reminder → repeat job (via WA), konversi terlacak. ← wajib mutlak.
2. **(L2) Ops jujur:** technician workflow di HP, progress real-time, feasibility 4-status, dynamic re-plan + approval.
3. **(L1) Intake:** lead→job, referral, review, source→revenue.
4. **(L3) IoT demand:** provisioning, telemetry, alert→1-tap job, Command→Verify pada AC kompatibel.
5. **(L4) Bukti:** metrics owner + cohort economics ter-instrumentasi.
6. **(L5) Enabler:** onboarding, RBAC, multi-tenant isolation, WA delivery + timeline, billing manual/gating.
7. Critical-path tests lulus (loop-first), security dasar, pilot deploy siap, 25 device siap.

Jika sesuatu harus dikorbankan karena waktu, korbankan dari bawah daftar ini — **jangan pernah dari #1**.

---

## STATUS DOKUMEN

- Reframe ini **tidak mengubah scope/LOCK** business plan — hanya urutan & sudut pandang (money-first, IoT-as-demand).
- Detail requirement (FR-xxx), data model, API, algoritma: lihat v1.0 (`..._PRD_and_Technical_Specification_v1.0.md`) — masih berlaku penuh.
- Yang mengikat tim ke depan: **The Money Loop (§0)** + **urutan build berbasis uang (§2)** + **DoD loop-first (§4)**.

**Next operational artifact: 25-Day Production Pack berbasis loop (task harian yang selalu melindungi B2 lebih dulu) + cohort instrumentation plan.**
