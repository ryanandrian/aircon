# AC SERVICE GROWTH OS

## Product Requirements Document (PRD) + Technical Specification

### Version 1.0 — Build Baseline

**Status: Operational artifact. Turunan langsung dari "Master Business Plan — Evaluated v1.0". Business thesis, product scope, 25-day constraint, dan 25-device target = LOCK. Dokumen ini menerjemahkan scope yang di-LOCK menjadi requirement dan desain teknis yang siap dibangun.**

---

# BAGIAN I — PRODUCT REQUIREMENTS DOCUMENT (PRD)

---

## 0. TUJUAN & CARA MEMBACA DOKUMEN

Dokumen ini adalah kontrak antara business plan dan produksi. Ia memecah scope bisnis menjadi:

- **PRD (Bagian I):** apa yang dibangun, untuk siapa, dan kapan dianggap benar (requirement + acceptance criteria).
- **Technical Specification (Bagian II):** bagaimana dibangun (arsitektur, data model, API, algoritma, IoT).
- **Mapping ke 25-Day Plan (Bagian III):** urutan eksekusi.

Prinsip yang diwarisi dari business plan:

1. **Tidak ada pengurangan scope bisnis.** Yang diatur adalah metode & kedalaman v1.0 tiap modul.
2. **Mobile-first, HP adalah perangkat kerja utama.**
3. **WhatsApp tidak digantikan** — ia channel komunikasi; aplikasi adalah operating system di belakangnya.
4. **IoT = optional add-on.** SaaS harus jalan penuh tanpa IoT.
5. **Command → Verify** untuk semua remote control.
6. Semua angka (pricing, ARPA, CAC, LTV) adalah hipotesis sampai divalidasi pilot.

---

## 1. PRODUCT OVERVIEW

**One-liner:** Operating system mobile-first untuk usaha jasa AC/HVAC kecil-menengah (1–5 teknisi) yang membantu mereka mendapatkan customer, mengatur teknisi & pekerjaan, meningkatkan repeat order, mengontrol performa bisnis, dan menawarkan Smart HVAC IoT.

**Lima outcome produk:**

| # | Outcome | Modul pendukung |
|---|---------|-----------------|
| 1 | Get Customers | Customer Growth Engine |
| 2 | Do More Jobs | FSM + Smart Scheduling + Dynamic Re-planning |
| 3 | Get Customers Back | Repeat Order Engine |
| 4 | Know & Control the Business | Performance Management |
| 5 | Know & Control the AC | Smart HVAC IoT (add-on) |

**Bentuk produk v1.0:** Progressive Web App (PWA) responsif, dioptimalkan untuk HP, mendukung penggunaan owner/admin di laptop/PC. (Alasan pemilihan PWA vs native ada di Bagian II.)

---

## 2. PERSONAS & ROLES

### 2.1 Personas

**P1 — Owner (merangkap sales/dispatcher/admin/manager).** Perangkat: HP. Tech maturity rendah–menengah. Butuh kontrol, visibility, dan cara dapat/pertahankan customer. Pengambil keputusan pembelian.

**P2 — Admin/Dispatcher (opsional, di tenant lebih maju).** Perangkat: HP + kadang laptop. Mengelola jadwal, input job, follow-up customer.

**P3 — Technician.** Perangkat: HP (sering RAM kecil, koneksi tidak stabil). Butuh: tahu kerjaan hari ini, navigasi, update status, foto, checklist, selesaikan job. Enggan aplikasi rumit.

**P4 — Customer akhir (end-customer tenant).** Tidak login. Berinteraksi via WhatsApp (konfirmasi, reminder, notifikasi). Kadang menerima link status/review.

**P5 — Platform Operator (tim kita).** Mengelola tenant, provisioning device IoT, monitoring platform. Super-admin.

### 2.2 Role & Permission Matrix (dalam satu tenant)

| Kapabilitas | Owner | Admin | Technician |
|---|---|---|---|
| Kelola user & role | ✅ | ➖ (opsional) | ❌ |
| Kelola customer & asset | ✅ | ✅ | 👁 (job miliknya) |
| Buat/assign job order | ✅ | ✅ | ❌ |
| Update progress job | ✅ | ✅ | ✅ (job miliknya) |
| Foto/checklist/notes job | ✅ | ✅ | ✅ (job miliknya) |
| Smart scheduling & re-plan | ✅ | ✅ | 👁 |
| Growth & repeat engine | ✅ | ✅ | ❌ |
| Performance dashboard | ✅ | 👁 (subset) | ❌ |
| Billing/subscription tenant | ✅ | ❌ | ❌ |
| IoT: pairing & control | ✅ | ✅ | ✅ (job miliknya) |

Legenda: ✅ full, 👁 read-only, ➖ configurable, ❌ none.

---

## 3. FUNCTIONAL REQUIREMENTS

Format: setiap modul → tujuan, user stories, acceptance criteria (AC). ID requirement: `FR-<modul>-<n>`.

### 3.1 Modul A — Onboarding & Tenant Setup

**Tujuan:** owner bisa mulai pakai dari HP dalam < 10 menit tanpa bantuan.

User stories:
- Sebagai owner, saya daftar dengan nomor HP + nama usaha, lalu langsung bisa input customer & teknisi.
- Sebagai owner, saya undang teknisi via link WhatsApp.

Acceptance Criteria:
- FR-ONB-1: Registrasi tenant via nomor HP + OTP; membuat tenant + user Owner otomatis.
- FR-ONB-2: Wizard setup singkat: nama usaha, jam kerja default, area layanan (kota/kecamatan), tambah teknisi pertama.
- FR-ONB-3: Undang teknisi via link (deep link) — teknisi set password/PIN saat pertama buka.
- FR-ONB-4: Data seed contoh (1 customer, 1 job) opsional untuk demo, dapat dihapus 1 klik.

### 3.2 Modul B — Field Service Management (Core)

Scope B mengikuti business plan §7 tanpa pengurangan.

**B1 — Customer**
- FR-CUS-1: CRUD customer: nama, kontak (HP/WA), alamat + geolocation (map picker / manual), **customer source** (referral/WA/walk-in/marketing/IoT-alert/lainnya).
- FR-CUS-2: Tiap customer punya riwayat service otomatis (timeline job).
- FR-CUS-3: Pencarian & filter customer (nama/HP/area/source).

**B2 — AC Asset**
- FR-AST-1: CRUD unit AC per customer: brand/model, tipe (split/cassette/standing/central), kapasitas (PK), lokasi ruangan, serial/asset identifier, tanggal instalasi.
- FR-AST-2: Riwayat service & maintenance per asset (bukan per customer saja).
- FR-AST-3: Field `next_service_date` (dihitung dari interval maintenance yg dapat diatur, mis. 3 bulan).
- FR-AST-4: Asosiasi opsional ke device IoT (kolom nullable; tidak wajib).

**B3 — Technician**
- FR-TEC-1: Profil teknisi: nama, kontak, skill/tag (mis. cuci, isi freon, bongkar-pasang, listrik), status aktif.
- FR-TEC-2: Availability: jam kerja & hari kerja per teknisi (default dari tenant, dapat di-override).
- FR-TEC-3: Daftar job harian per teknisi + ringkasan performa dasar.

**B4 — Job Order**
- FR-JOB-1: Buat job: customer, lokasi (auto dari customer/asset), unit AC (opsional multi-unit), jenis service, teknisi, jadwal (tanggal + time window), catatan.
- FR-JOB-2: Job memiliki checklist template per jenis service (dapat dikustom tenant) + foto (before/after) + notes hasil + tanda selesai.
- FR-JOB-3: Job dapat menghasilkan **next_service_date** otomatis saat completion (feed ke Repeat Engine).
- FR-JOB-4: Satu job → satu teknisi utama (v1.0); multi-teknisi = out of scope v1.0 (lihat §5).

**B5 — Progress State Machine**
- FR-PRG-1: Status job mengikuti state machine tetap:
  `DRAFT → ASSIGNED → ACCEPTED → EN_ROUTE → ARRIVED → IN_PROGRESS → (WAITING) → COMPLETED`
  plus cabang `CANCELLED` dan `RESCHEDULED` dari state manapun sebelum COMPLETED.
- FR-PRG-2: Setiap transisi mencatat timestamp + actor (untuk ETA & performa).
- FR-PRG-3: Transisi ilegal ditolak (mis. tidak boleh COMPLETED tanpa IN_PROGRESS).
- FR-PRG-4: Owner melihat progress semua job **real-time** (push/poll).

### 3.3 Modul C — Smart Scheduling (Differentiator)

**Tujuan:** sistem menilai kelayakan assignment, bukan sekadar cek kalender kosong (business plan §9).

- FR-SCH-1: Saat assign/menjadwalkan job, engine menghitung status feasibility: **FEASIBLE / RISK / CONFLICT / UNKNOWN**.
- FR-SCH-2: Faktor yang dipertimbangkan: lokasi, waktu selesai job sebelumnya, estimasi travel, durasi pekerjaan, buffer, working hours, skill teknisi, customer time window, status teknisi, progress aktual.
- FR-SCH-3: Aturan inti:
  `selesai(Job A) + travel(A→B) + buffer ≤ mulai(Job B)` → jika tidak terpenuhi, sistem **tidak boleh memaksakan** assignment (tampilkan CONFLICT + alasan).
- FR-SCH-4: UNKNOWN muncul saat data kurang (mis. lokasi customer belum ada) — sistem menandai apa yang kurang, bukan menebak.
- FR-SCH-5: Tampilan harian per teknisi (timeline) dengan indikator warna feasibility.
- FR-SCH-6: Saran slot/teknisi alternatif saat CONFLICT/RISK (best-effort, tidak wajib optimal).

### 3.4 Modul D — Dynamic Re-planning

**Tujuan:** lapangan berubah; sistem menghitung ulang (business plan §10, operational moat).

- FR-REP-1: Perubahan progress (mis. teknisi terlambat/job lebih lama) memicu perhitungan ulang ETA job berikutnya milik teknisi tsb.
- FR-REP-2: Jika hasil recompute → CONFLICT, sistem mengusulkan aksi: reschedule, pindah teknisi, atau geser slot.
- FR-REP-3: Perubahan berdampak ke customer **wajib melewati approval owner/admin** sebelum notifikasi customer dikirim.
- FR-REP-4: Alur: `Progress berubah → ETA berubah → recompute job berikut → conflict? → alternatif → owner approve → customer notification`.
- FR-REP-5: Semua re-plan tercatat (audit) untuk analisis performa.

### 3.5 Modul E — Customer Growth Engine

**Tujuan:** membantu tenant **mendapatkan** pekerjaan, bukan hanya mengelola (business plan §11).

- FR-GRW-1: Lead management: buat lead, sumber lead, status (new/contacted/quoted/won/lost), konversi lead→customer→job.
- FR-GRW-2: Customer source tracking terhubung ke performa (source mana menghasilkan job/revenue).
- FR-GRW-3: Referral: catat siapa mereferensikan; tag customer hasil referral.
- FR-GRW-4: Review: generate link/permintaan review pasca-job (via WA), catat status.
- FR-GRW-5: Follow-up & reminder task manual + terjadwal (mis. follow up lead 3 hari).
- FR-GRW-6: Basic marketing/campaign: buat campaign sederhana (nama, target segmen customer, pesan template WA), lacak siapa dikirimi. (Pengiriman massal aktual = manual/assisted di v1.0; lihat §5 & spec WA.)

### 3.6 Modul F — Repeat Order Engine

**Tujuan:** ubah customer sekali menjadi berulang (business plan §12).

- FR-RPT-1: Saat service selesai → set `next_service_date` (dari interval asset/jenis service).
- FR-RPT-2: Sistem menghasilkan **reminder queue** menjelang next_service_date (lead time dapat diatur, mis. H-7).
- FR-RPT-3: Dari reminder, owner/admin 1-tap kirim pesan WA reminder (template) + 1-tap buat Repeat Job Order (prefill dari job sebelumnya).
- FR-RPT-4: Lacak respons customer & konversi reminder → repeat job (untuk mengukur repeat-order uplift).
- FR-RPT-5: Loop: `Service selesai → history → next date → reminder → response → repeat job`.

### 3.7 Modul G — Performance Management

**Tujuan:** owner tahu apa yang terjadi & bisa ambil keputusan (business plan §13). Bukan dashboard rumit.

- FR-PRF-1: Metrik owner: jumlah job, job selesai, revenue (dari nilai job), produktivitas teknisi (job selesai/hari, on-time %), repeat customer, retention sederhana, completion rate, customer activity.
- FR-PRF-2: Filter periode (hari/minggu/bulan) + per teknisi.
- FR-PRF-3: Growth metrics: leads, konversi, customer baru, source breakdown, repeat-order uplift.
- FR-PRF-4: Semua metrik dihitung dari event/timestamp yang sudah dicatat modul lain (single source of truth).

### 3.8 Modul H — WhatsApp Workflow Integration

**Tujuan:** WhatsApp tetap channel utama; aplikasi mengorkestrasi (business plan §6).

- FR-WA-1: Setiap titik komunikasi (konfirmasi jadwal, reminder, notifikasi perubahan, review, campaign) menyediakan aksi "Kirim via WhatsApp" dengan **pesan template terisi** (deep link `wa.me` / share intent) — tanpa perlu integrasi berbayar di v1.0.
- FR-WA-2: Template pesan dapat dikustom tenant (variabel: nama customer, jadwal, teknisi, alamat, dll).
- FR-WA-3: Jalur upgrade opsional ke WhatsApp Cloud API (kirim otomatis) didesain sejak awal tapi **tidak wajib** untuk v1.0 (lihat spec §II.11 & out-of-scope §5).
- FR-WA-4: Setiap pesan terkirim (assisted maupun otomatis) tercatat di timeline customer.

### 3.9 Modul I — Smart HVAC IoT (Optional Add-on)

**Tujuan:** monitoring + remote + generator demand service (business plan §14–19). SaaS harus tetap penuh tanpa modul ini.

- FR-IOT-1: Provisioning device via **QR** (Device ID unik) — pair ke asset AC milik tenant.
- FR-IOT-2: Telemetry: suhu, humidity, current/power, status online/offline, heartbeat, device health.
- FR-IOT-3: Remote command (AC kompatibel IR): on/off, mode, setpoint suhu, fan — dengan prinsip **Command → Verify** (state: COMMAND_SENT → ACKNOWLEDGED → STATE_CONFIRMED).
- FR-IOT-4: Alert dari kondisi abnormal (mis. current anomali, suhu tak turun) → memunculkan **maintenance opportunity** → 1-tap buat Job Order.
- FR-IOT-5: Business loop: `AC → telemetry → abnormal → alert → maintenance opportunity → job order → technician → service → history → repeat`.
- FR-IOT-6: Instalasi non-invasif (tidak buka refrigerant circuit; IR untuk kontrol; power monitoring sesuai desain final device) + panduan instalasi in-app.
- FR-IOT-7: Model sewa: device terikat tenant, status rental (active/returned), asosiasi ke asset.

### 3.10 Modul J — Billing/Subscription (Tenant-level)

- FR-BIL-1: Paket subscription per tenant: Starter / Growth / Pro (gating fitur sesuai paket) + IoT add-on per device.
- FR-BIL-2: v1.0: pencatatan paket & status pembayaran **manual/assisted** (operator menandai paid/aktif). Integrasi payment gateway otomatis = out-of-scope v1.0 (lihat §5).
- FR-BIL-3: Feature gating: modul/limit aktif sesuai paket (mis. jumlah teknisi, akses growth/performance lanjutan).

---

## 4. NON-FUNCTIONAL REQUIREMENTS (NFR)

- NFR-1 Mobile-first: fungsi teknisi & owner utama harus nyaman di HP layar kecil, 1 tangan.
- NFR-2 Offline-tolerant (teknisi): aksi kritis teknisi (update status, foto, checklist) harus **queue & sync** saat koneksi buruk; tidak boleh kehilangan data.
- NFR-3 Performa: waktu buka daftar job harian < 2 dtk pada koneksi 3G wajar; payload ringan.
- NFR-4 Multi-tenancy: isolasi data antar tenant wajib (row-level, lihat spec).
- NFR-5 Security: auth token, RBAC, enkripsi in-transit (TLS), password/PIN hashing, audit trail untuk aksi sensitif.
- NFR-6 Reliability IoT: telemetry & command idempoten; kehilangan koneksi device tidak merusak state; command tidak "menganggap sukses" tanpa verify.
- NFR-7 Observability: logging terstruktur, error tracking, health endpoint.
- NFR-8 Localizability: Bahasa Indonesia default; string terpusat.
- NFR-9 PWA installable + push notification (di platform yang mendukung).
- NFR-10 Skalabilitas awal: cukup untuk pilot (≤ puluhan tenant, ratusan teknisi, ribuan job/bln) tanpa re-arsitektur.

---

## 5. OUT OF SCOPE UNTUK v1.0 (eksplisit)

Bukan pengurangan scope bisnis — ini kedalaman fitur yang ditunda ke fase berikutnya agar 25 hari realistis, dan business plan sendiri menandai beberapa sebagai "Future":

- Payment gateway otomatis (Midtrans/Xendit) — v1.0 manual/assisted.
- WhatsApp Cloud API kirim otomatis massal — v1.0 assisted (deep link/template); jalur upgrade sudah disiapkan.
- Multi-teknisi per satu job.
- Predictive maintenance / AI recommendations / premium analytics (business plan §20 "Future").
- Route optimization multi-stop otomatis (v1.0: feasibility + saran, bukan optimizer global).
- Native app store apps (v1.0: PWA).
- Akuntansi/invoice pajak lengkap (v1.0: nilai job untuk revenue metric saja).
- OTA firmware penuh (v1.0: OTA *foundation* saja, sesuai business plan §16).

---

## 6. DEFINITION OF DONE (v1.0)

Diambil dari business plan §26, dipetakan ke requirement:

- Semua modul A–J tersedia; role & permission berjalan.
- Customer/technician/job workflow berjalan end-to-end.
- Daily schedule + feasibility (FEASIBLE/RISK/CONFLICT/UNKNOWN) berjalan.
- Dynamic re-planning berjalan (recompute + approval + notifikasi).
- Reminder + repeat order engine berjalan.
- Growth workflow (lead/source/referral/review/follow-up) berjalan.
- Performance metrics tersedia & konsisten dengan event.
- WhatsApp workflow (template + deep link + timeline log) tersedia.
- IoT: provisioning, telemetry, device health, remote command dengan command/state dibedakan (Command→Verify) berjalan pada AC kompatibel.
- Critical-path automated tests lulus; security dasar terpenuhi.
- Pilot deployment siap; 25 device siap pilot.

---

# BAGIAN II — TECHNICAL SPECIFICATION

---

## 7. ARCHITECTURE OVERVIEW

### 7.1 High-level

```text
[PWA Client - HP/Owner/Admin/Technician]
        | HTTPS (REST/JSON) + WebSocket/SSE (realtime)
        v
[API Backend (modular monolith)]
   ├─ Auth & RBAC / Multi-tenancy
   ├─ FSM (customer/asset/technician/job/progress)
   ├─ Scheduling Engine (feasibility)
   ├─ Re-planning Engine
   ├─ Growth + Repeat Engine
   ├─ Performance (read models / aggregation)
   ├─ Notification/WhatsApp Orchestrator
   └─ IoT Gateway API (provisioning/telemetry/command)
        |                         ^
        v                         |
[PostgreSQL]  [Object Storage (foto)]  [Cache/Queue (jobs, reminders, telemetry buffer)]
        ^
        | MQTT/HTTPS (device)
[IoT Devices x25 - ESP32 + cellular]
```

### 7.2 Keputusan arsitektur & alasan

- **Modular monolith, bukan microservices.** 1 developer + 25 hari → monolith modular jauh lebih cepat dibangun, dideploy, dan di-debug; batas modul dijaga rapi agar bisa dipecah nanti.
- **PWA, bukan native.** Satu codebase untuk owner/admin/technician, install-able, push notification, tanpa siklus review app store — kritikal untuk deadline. Trade-off (mis. background BLE) tidak dibutuhkan v1.0 karena IoT lewat cellular langsung ke cloud.
- **PostgreSQL tunggal, multi-tenant row-level** (`tenant_id` di setiap tabel) + Row-Level Security. Cukup untuk skala pilot, sederhana, kuat.
- **Realtime via WebSocket/SSE** untuk progress owner; fallback polling.
- **Queue/worker** untuk reminder scheduling, re-plan recompute async, telemetry ingest, notifikasi.

---

## 8. TECHNOLOGY STACK (rekomendasi, dioptimalkan untuk kecepatan + Agentic AI)

| Layer | Pilihan | Alasan |
|---|---|---|
| Frontend | Next.js (React) PWA + TypeScript, Tailwind, shadcn/ui | ekosistem besar → agentic AI sangat produktif; PWA + SSR; komponen cepat |
| State/data client | TanStack Query + IndexedDB (offline queue) | caching + offline-tolerant teknisi |
| Backend | Node.js + NestJS (TypeScript) **atau** Next.js API routes untuk v1.0 kecil | satu bahasa (TS) FE+BE → kecepatan 1 dev; NestJS memberi struktur modul |
| DB | PostgreSQL + Prisma ORM | RLS multi-tenant, migrasi cepat, tipe aman |
| Realtime | WebSocket (socket.io) / SSE | progress realtime |
| Queue/cache | Redis + BullMQ | reminder, recompute, telemetry buffer |
| Object storage | S3-compatible (mis. Cloudflare R2 / MinIO) | foto job |
| Auth | JWT access+refresh, OTP via SMS/WA gateway, argon2 hashing | mobile-friendly |
| IoT broker | MQTT (mis. EMQX/Mosquitto) + TLS | telemetry + command device |
| Maps/geo | OSM + OSRM (self-host/hosted) untuk travel estimate; Haversine fallback | hindari biaya besar; sesuai disiplin modal |
| Notif | Web Push (VAPID) + WhatsApp deep-link (v1.0), jalur Cloud API | assisted → otomatis |
| Infra | 1 VM/container host + managed Postgres + Redis + object storage | murah, cukup pilot |
| Observability | pino logs + Sentry + /health | debugging cepat |
| CI/CD | GitHub Actions → deploy container | otomatis, agentic-friendly |

Catatan: TypeScript end-to-end sengaja dipilih agar Agentic Coding AI menghasilkan kode FE+BE+shared types secara konsisten (schema tunggal → tipe dibagi), memaksimalkan output 1 developer.

---

## 9. DATA MODEL

### 9.1 Entitas inti (ERD ringkas)

```text
Tenant 1─* User
Tenant 1─* Customer 1─* Asset(AC)
Tenant 1─* Technician (User berrole technician)
Customer 1─* JobOrder *─1 Technician
Asset 0─* JobOrder
JobOrder 1─* JobProgressEvent
JobOrder 1─* JobPhoto / 1─* ChecklistItemResult
Asset 0─1 Device(IoT) 1─* Telemetry
Device 1─* CommandLog
Customer 1─* Lead / Referral / ReviewRequest
Asset 1─* RepeatReminder
Tenant 1─1 Subscription
```

### 9.2 Tabel utama (kolom kunci; semua tabel domain punya `tenant_id`, `created_at`, `updated_at`)

**tenant**(id, name, phone, working_hours_default jsonb, service_area jsonb, plan, status)

**user**(id, tenant_id, name, phone, role[owner|admin|technician], password_hash/pin_hash, status)

**customer**(id, tenant_id, name, phone, address, geo_lat, geo_lng, source, referred_by nullable, notes)

**asset**(id, tenant_id, customer_id, brand, model, type, capacity_pk, room_location, serial, installed_at, maintenance_interval_days, next_service_date, device_id nullable)

**technician**(id, tenant_id, user_id, skills text[], working_hours jsonb, active)

**job_order**(id, tenant_id, customer_id, asset_id nullable, technician_id nullable, service_type, status, scheduled_date, window_start, window_end, est_duration_min, address/geo (snapshot), price nullable, notes, next_service_date nullable, created_by, source[manual|repeat|iot|lead])

**job_progress_event**(id, tenant_id, job_id, from_status, to_status, actor_id, at, meta jsonb) — sumber ETA & performa.

**checklist_template**(id, tenant_id, service_type, items jsonb) / **checklist_result**(id, job_id, item_key, checked, value)

**job_photo**(id, job_id, kind[before|after|other], url, at)

**lead**(id, tenant_id, name, phone, source, status, notes, converted_customer_id nullable)

**referral**(id, tenant_id, referrer_customer_id, referred_customer_id, at)

**review_request**(id, tenant_id, job_id, channel, status, at)

**repeat_reminder**(id, tenant_id, asset_id, due_date, lead_time_days, status[queued|sent|converted|dismissed], job_id nullable)

**campaign**(id, tenant_id, name, segment jsonb, template_id, status) / **campaign_recipient**(campaign_id, customer_id, status, sent_at)

**message_log**(id, tenant_id, customer_id, job_id nullable, channel[wa|push], template_id, direction, status, at) — timeline komunikasi.

**device**(id=DeviceID, tenant_id nullable, asset_id nullable, provision_status, rental_status, fw_version, last_seen_at, health jsonb)

**telemetry**(id, device_id, tenant_id, ts, temp_c, humidity, current_a, power_w, online) — time-series (partisi/retensi diatur).

**command_log**(id, device_id, tenant_id, command jsonb, state[COMMAND_SENT|ACKNOWLEDGED|STATE_CONFIRMED|FAILED], sent_at, ack_at, confirmed_at, evidence jsonb)

**alert**(id, tenant_id, device_id, asset_id, type, severity, status, created_job_id nullable, at)

**subscription**(id, tenant_id, plan, iot_devices_count, status, valid_until, notes)

### 9.3 Multi-tenancy

- Setiap query di-scope `tenant_id` dari token.
- PostgreSQL Row-Level Security sebagai jaring pengaman (policy `tenant_id = current_setting('app.tenant_id')`).
- Object storage: prefix `tenant/<id>/...`.

---

## 10. API DESIGN (REST, JSON, versioned `/api/v1`)

Konvensi: auth `Authorization: Bearer <jwt>`; header/claim membawa `tenant_id` + `role`; error format `{error:{code,message,details}}`; pagination `?cursor=&limit=`.

### 10.1 Auth & Onboarding
```
POST /auth/otp/request        {phone}
POST /auth/otp/verify         {phone, code} -> {access, refresh, user}
POST /auth/refresh
POST /tenants                 (register tenant + owner)
POST /tenants/:id/invites     (invite technician) -> link
POST /invites/accept          {token, pin}
```

### 10.2 FSM
```
GET/POST/PATCH/DELETE  /customers      /customers/:id
GET/POST/PATCH/DELETE  /assets         /assets/:id
GET                    /customers/:id/history
GET/POST/PATCH         /technicians    /technicians/:id
GET/POST/PATCH         /jobs           /jobs/:id
POST                   /jobs/:id/transition   {to_status, meta}   (validated state machine)
POST                   /jobs/:id/photos       (multipart)
PUT                    /jobs/:id/checklist
GET                    /technicians/:id/today  (daily job list)
```

### 10.3 Scheduling & Re-planning
```
POST /schedule/feasibility   {technician_id, job draft} -> {status:FEASIBLE|RISK|CONFLICT|UNKNOWN, reasons[], missing[]}
GET  /schedule/day           ?date=&technician_id=      -> timeline + feasibility per job
POST /schedule/suggest       {job draft} -> {alternatives:[{technician_id, slot, status}]}
POST /replan/recompute       {technician_id, trigger}   -> {impacted_jobs[], proposals[]}
POST /replan/apply           {proposal_id}              -> requires owner/admin role -> queues customer notification
```

### 10.4 Growth & Repeat
```
GET/POST/PATCH /leads        /leads/:id/convert
POST /referrals
POST /reviews/request        {job_id}
GET  /repeat/reminders       ?status=due
POST /repeat/reminders/:id/send        -> returns WA deep-link + logs message
POST /repeat/reminders/:id/create-job  -> prefilled repeat job
GET/POST /campaigns          /campaigns/:id/recipients
```

### 10.5 Performance
```
GET /metrics/overview   ?from=&to=&technician_id=
GET /metrics/growth     ?from=&to=
GET /metrics/technician/:id
```

### 10.6 Notifications / WhatsApp
```
GET  /templates                          (per tenant)
POST /messages/wa-link   {template_id, customer_id, vars} -> {wa_url, message_log_id}
POST /messages/send      (jika WA Cloud API aktif; sama payload)  <- jalur upgrade
```

### 10.7 IoT
Device-facing (MQTT topics utama + HTTPS fallback):
```
MQTT topic (device->cloud):  d/<deviceId>/telemetry     (heartbeat, temp, hum, current, power, online)
MQTT topic (device->cloud):  d/<deviceId>/ack           (command acknowledgment + state evidence)
MQTT topic (cloud->device):  d/<deviceId>/cmd           (remote command)
HTTPS fallback:              POST /iot/telemetry, POST /iot/ack
```
App-facing:
```
POST /devices/provision        {qr_payload / device_id} -> pair to tenant+asset
GET  /devices/:id/telemetry     ?range=
GET  /devices/:id/health
POST /devices/:id/command       {type, params} -> command_log (state=COMMAND_SENT)
GET  /devices/:id/command/:cid  -> current verify state
GET  /alerts                    ?status=open
POST /alerts/:id/create-job     -> job order from maintenance opportunity
```

---

## 11. KEY ALGORITHMS & ENGINE LOGIC

### 11.1 Scheduling feasibility (FR-SCH)

Input untuk kandidat job B pada teknisi T:
```
prev = job terakhir T sebelum window B (yg belum COMPLETED dianggap est. selesai = ETA)
finish_prev = actual_end(prev) OR (start(prev)+est_duration(prev))
travel      = estimate_travel(loc(prev)->loc(B))   # OSRM; fallback Haversine * faktor kota
buffer      = tenant.buffer_min (default mis. 15)
earliest_start_B = finish_prev + travel + buffer
```
Keputusan:
```
if data kurang (loc(B)/loc(prev)/durasi tak ada)   -> UNKNOWN (+ list field yang hilang)
elif skill(T) tidak cocok service(B)               -> CONFLICT (reason: skill)
elif earliest_start_B <= window_start(B)           -> FEASIBLE
elif earliest_start_B <= window_end(B)             -> RISK (mepet, tampilkan selisih)
else                                               -> CONFLICT (reason: waktu)
```
Aturan wajib (FR-SCH-3): jika CONFLICT karena waktu, sistem **tidak auto-assign**; owner harus override sadar atau pilih alternatif.

Estimasi travel: cache matrix per (grid lokasi) untuk hemat panggilan OSRM; fallback Haversine×faktor (mis. 1.4) bila offline/kuota.

### 11.2 Dynamic re-planning (FR-REP)

Trigger: transisi progress yang mengubah `finish_prev` (delay, durasi lebih lama), atau perubahan manual.
```
on progress_event(T):
   recompute ETA rantai job T hari itu (urut waktu)
   for each downstream job:
       status = feasibility(job)
       if status in {RISK, CONFLICT}: buat proposal (reschedule / reassign / geser)
   simpan impacted_jobs + proposals (belum kirim ke customer)
owner/admin apply(proposal) -> update job -> enqueue customer notification (WA) -> audit
```
Idempoten & async (BullMQ). Customer TIDAK dinotifikasi sebelum approval (FR-REP-3).

### 11.3 Repeat reminder scheduler (FR-RPT)

Cron/worker harian:
```
for asset where next_service_date - lead_time_days <= today and no active reminder:
    create repeat_reminder(status=queued)
```
UI "Reminders due" → owner 1-tap kirim WA + 1-tap buat repeat job (prefill). Konversi dicatat untuk repeat-order uplift metric.

### 11.4 IoT Command → Verify (FR-IOT-3, business plan §18)

```
1. App POST /devices/:id/command  -> command_log(state=COMMAND_SENT), publish MQTT d/<id>/cmd
2. Device menerima, kirim ack     -> state=ACKNOWLEDGED (ack_at)
3. Device/telemetry memberi evidence (mis. suhu setpoint tercermin / status IR loop)
                                  -> state=STATE_CONFIRMED (confirmed_at, evidence)
   Jika timeout tanpa ack/evidence -> state=FAILED (UI tampilkan "belum terkonfirmasi")
```
UI **tidak boleh** menampilkan "berhasil" pada COMMAND_SENT/ACKNOWLEDGED saja — hanya pada STATE_CONFIRMED. Bila hanya ACK tanpa evidence, tampilkan "terkirim, menunggu konfirmasi".

### 11.5 IoT alert → demand loop (FR-IOT-4/5)

Rule engine sederhana (threshold + trend) pada telemetry ingest:
```
if current_a > baseline*k OR (mode cooling & temp tak turun > N menit) OR offline > M jam:
    upsert alert(open)
alert -> UI -> 1-tap create job (source=iot) -> normal FSM flow -> service -> history -> repeat
```

---

## 12. IoT DEVICE SPECIFICATION (V1) — untuk IoT engineer

Sesuai business plan §15–18.

**Hardware target:**
- MCU: ESP32-class.
- Konektivitas: cellular (mis. modul 4G/NB-IoT/2G sesuai ketersediaan area) — tidak bergantung WiFi customer.
- Sensor: suhu, humidity, current/power (metode sesuai desain final; non-invasif).
- IR: receiver (belajar kode remote) + transmitter (kontrol).
- Identitas: Device ID unik + QR untuk provisioning.

**Firmware capabilities:**
- Heartbeat + telemetry berkala (interval dapat diatur; buffer saat offline).
- Online/offline detection.
- Remote command handler + **ack + evidence** (mendukung Command→Verify).
- Device health report (RSSI, uptime, error).
- OTA **foundation** (mekanisme dasar, bukan OTA penuh v1.0).

**Protokol:** MQTT over TLS ke broker; HTTPS fallback. Payload JSON ringkas. Idempotent command id.

**Instalasi (FR-IOT-6):** non-invasif; tidak membuka refrigerant circuit; IR sebagai metode kontrol utama untuk AC kompatibel; panduan in-app; tenant pasang sendiri.

**Pilot batch:** 25 unit untuk membuktikan hardware, connectivity, sensor, IR, installation, provisioning, telemetry, remote command, reliability.

---

## 13. SECURITY & COMPLIANCE (dasar)

- Auth: OTP (phone) + JWT (access pendek + refresh), argon2 untuk PIN/password.
- RBAC ditegakkan di backend per endpoint (bukan hanya UI).
- Multi-tenant isolation: scoping + Postgres RLS.
- TLS di semua jalur (client, device MQTT, API).
- Secrets via env/secret manager; tidak di repo.
- Audit trail: transisi job, apply re-plan, command IoT, perubahan role.
- Rate limiting OTP & endpoint publik.
- Foto: URL ter-signature/terbatas tenant.
- Privasi data customer: hanya diakses dalam tenant; penghapusan tenant menghapus data terkait.

---

## 14. OFFLINE & MOBILE STRATEGY (NFR-1/2/3)

- Technician PWA: aksi kritis (transition, foto, checklist) ditulis ke **IndexedDB queue** → sync saat online → server idempoten (client-generated event id).
- Foto: kompres di client sebelum upload; upload resumable/berantre.
- Daftar job harian di-cache; UI menampilkan status sync (pending/synced).
- Konflik sync diselesaikan server-authoritative untuk state machine (transisi ilegal ditolak, client diberi tahu).

---

## 15. TESTING STRATEGY (untuk DoD & Gate)

- Unit tests: state machine job, scheduling feasibility (semua 4 status), reminder scheduler, command-verify state, RBAC guard.
- Integration tests (critical path): onboarding→customer→asset→job→assign(feasibility)→progress→complete→next_service→reminder→repeat job.
- IoT: simulator device (mock MQTT) untuk telemetry, ack/evidence, alert→job.
- E2E happy path per persona (owner, technician) via Playwright.
- Security checks: authz per role, tenant isolation (cross-tenant access harus gagal).
- Automated QA dijalankan di CI (Agentic AI membantu generate tests).

---

# BAGIAN III — MAPPING KE 25-DAY PRODUCTION PLAN

Menyelaraskan requirement dengan jadwal business plan §25 & decision gates §32.

| Hari | Software (deliverable requirement) | IoT | Gate |
|---|---|---|---|
| 1–3 | Spec final, arsitektur, skema DB (Prisma), auth+multi-tenant+RBAC (FR-ONB, NFR-4/5) | BOM + prototype | — |
| 4–8 | Core FSM: customer/asset/technician/job + progress state machine + foto/checklist (FR-CUS/AST/TEC/JOB/PRG) | Sensor bring-up | — |
| 9–13 | Smart scheduling (feasibility 4-status) + daily view + progress realtime + **replan foundation** (FR-SCH, FR-REP-1) | Cellular + telemetry | Gate 2 (H10): core software + telemetry jalan |
| 14–17 | Dynamic re-planning penuh + Growth engine + Repeat/reminder + Performance (FR-REP, FR-GRW, FR-RPT, FR-PRF) | IR + remote (Command→Verify) | — |
| 18–20 | Billing/subscription + WhatsApp workflow + dashboard + IoT integration (provision/telemetry/alert/command di app) (FR-BIL, FR-WA, FR-IOT) | Assembly | Gate 3 (H20): full integration candidate |
| 21–23 | Integration + automated QA + security hardening (Bagian 15, §13) | 25-unit QA | — |
| 24 | UAT + defect elimination (DoD §6) | Pilot validation | — |
| 25 | Production/pilot release | 25 device ready | Gate 4 (H25): full product + 25 device |

Setelah H25 → Gate 5 (≥5 paying tenant) → Gate 6 (economic validation: ARPA/CAC/churn/LTV/repeat-uplift/IoT adoption) → Gate 7 (scale). Jika tidak terbukti: STOP / PIVOT / REPOSITION.

**Prinsip eksekusi (business plan §27):** developer = Technical Owner + Reviewer + Orchestrator; Agentic AI menghasilkan kode/test/refactor/docs dari spec ini. Alur: PRD → Technical Spec (dokumen ini) → Agentic Build → Automated Test → Human Review → Fix → Deploy → UAT.

---

## STATUS DOKUMEN

- PRD scope: **turunan dari LOCK business plan** — tidak mengurangi scope bisnis.
- Kedalaman v1.0 & out-of-scope (§5): **keputusan implementasi**, dapat direview sebelum Gate 1.
- Tech stack (§8): **rekomendasi**, dapat diganti selama memenuhi NFR & deadline.
- Pricing/feature-gating (Modul J): **hipotesis**, subject to pilot.
- Angka teknis (buffer, interval, threshold): **default**, dikonfigurasi & dikalibrasi saat pilot.

**Next operational artifact: 25-Day Production Pack (breakdown task harian per modul + test plan + IoT build checklist).**
