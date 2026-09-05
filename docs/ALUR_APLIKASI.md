# Aircon — Diagram Alur Aplikasi (A–Z)

> Peta lengkap seluruh proses & fungsi, ditarik dari kode nyata (route, service, state machine).
> Diagram memakai **Mermaid** — dirender otomatis di GitHub, VS Code (ekstensi Mermaid), Obsidian, dll.
> Terakhir diperbarui: 28 Agu 2026.

---

## 0. Peta Aktor & Area

| Aktor | Cara masuk | Area |
|---|---|---|
| **Pemilik usaha (OWNER)** | Google SSO → `/login` | `/app/*` (dashboard tenant) |
| **Teknisi (TECHNICIAN)** | Phone + PIN → `/masuk-teknisi` | `/t/*` (mode lapangan) |
| **Admin Platform (Lumite)** | Google SSO + tabel PlatformAdmin | `/admin/*` |
| **Agen / Reseller** | Email/kode + PIN (cookie partner) | `/agen/*`, `/reseller/*` |
| **Pelanggan akhir** | Tanpa login (link/QR) | `/p/[slug]`, `/u/[code]`, `/riwayat/[token]` |

---

## 1. Peta Situs (semua route)

```mermaid
flowchart TD
  ROOT["/ (landing)"] --> LOGIN["/login (owner SSO)"]
  ROOT --> DEMO["/demo (simulasi)"]
  ROOT --> PUB["/p/[slug] (booking publik)"]

  LOGIN --> ONB["/onboarding (buat usaha)"]
  ONB --> APP

  subgraph APP["/app/* — OWNER"]
    A0["/app (dashboard)"]
    A1["/app/pelanggan (CRUD pelanggan)"]
    A2["/app/unit (unit AC + QR + kartu)"]
    A3["/app/pekerjaan (job list)"]
    A3b["/app/pekerjaan/baru"]
    A3c["/app/pekerjaan/[id]"]
    A4["/app/teknisi (undang/kelola)"]
    A5["/app/perangkat (IoT monitor)"]
    A5b["/app/perangkat/pesan + /pesanan"]
    A6["/app/langganan (paket + bayar)"]
    A6b["/app/langganan/faktur/[id]"]
    A7["/app/pesan (template WA)"]
    A8["/app/checklist (template servis)"]
  end

  subgraph TEK["/t/* — TEKNISI"]
    T0["/t (job hari ini)"]
    T1["/t/pekerjaan/[id] (kerjakan)"]
  end

  subgraph ADM["/admin/* — PLATFORM ADMIN"]
    D0["/admin (ringkasan)"]
    D1["/admin/tenants + /[id]"]
    D2["/admin/paket (PlanConfig+kuota)"]
    D3["/admin/kebijakan (billing/dunning)"]
    D4["/admin/perusahaan (profil Lumite)"]
    D5["/admin/keagenan (agen/reseller)"]
    D6["/admin/iot (produk+pesanan)"]
    D7["/admin/landing (CMS+testimoni)"]
    D8["/admin/infra (status)"]
  end

  subgraph PARTNER["Portal Partner"]
    P0["/agen/* (dasbor agen)"]
    P1["/reseller/* (dasbor reseller)"]
  end

  subgraph PELANGGAN["Publik (tanpa login)"]
    C0["/u/[code] (kartu unit via QR)"]
    C1["/riwayat/[token] (semua unit pelanggan)"]
  end

  MASUK["/masuk-teknisi"] --> TEK
  UND["/undangan/[token] (set PIN teknisi)"] --> MASUK
```

---

## 2. THE MONEY LOOP (proses inti — jantung produk)

> "Dapat pelanggan → kerjakan → selesai → otomatis mengingatkan → pelanggan datang lagi → berulang."

```mermaid
flowchart LR
  subgraph GET["1. DAPAT PELANGGAN"]
    B1["Booking publik /p/slug"] --> LEAD["Lead (WEBSITE, NEW)"]
    IOT["Alert IoT"] --> LEAD
    MAN["Input manual owner"] --> CUST
    LEAD -->|"owner konversi"| CUST["Customer"]
  end

  subgraph WORK["2. KERJAKAN"]
    CUST --> JOB["JobOrder (DRAFT)"]
    JOB --> ASSIGN["Assign teknisi"]
    ASSIGN --> FIELD["Teknisi kerjakan (FSM)"]
    FIELD --> DONE["COMPLETED"]
  end

  subgraph REPEAT["3. ULANG OTOMATIS"]
    DONE -->|"efek"| NSD["hitung nextServiceDate"]
    NSD --> RR["RepeatReminder (QUEUED)"]
    RR -->|"cron harian, jatuh tempo"| WA["Kirim WA reminder (batch/pelanggan)"]
    WA -->|"pelanggan balas"| JOB
  end

  DONE -.->|"footer link"| CARD["Kartu perawatan /riwayat/token"]
```

**Detail teknis money loop:**
- Booking → `createLeadFromBooking` (source=WEBSITE, status=NEW)
- COMPLETED → efek: `set_completed_at` + `compute_next_service_date` + `create_repeat_reminder` (+trigger review)
- Cron `/api/cron/reminders` (harian) → `runDueReminders` → **batch per pelanggan** (1 WA untuk banyak unit due) → `MessageLog` QUEUED → flusher → gateway WA VPS
- Interval servis default 90 hari (dari InfraConfig/tenant, editable)

---

## 3. Onboarding Tenant (daftar usaha baru)

```mermaid
flowchart TD
  L["/login"] -->|"Google SSO"| CB["auth/callback"]
  CB --> FIND{"findDomainUser?"}
  FIND -->|"sudah ada usaha"| APP["/app"]
  FIND -->|"belum"| ONB["/onboarding (wizard)"]
  ONB --> FORM["Isi: nama usaha, kota, no WA (+kode agen opsional)"]
  FORM --> CREATE["createTenantForOwner"]
  CREATE --> T["Tenant: plan=TRIAL/Basic, status=ACTIVE, nextDueDate=NULL (GRATIS PERMANEN)"]
  CREATE --> U["User OWNER"]
  CREATE --> SEED["Seed default: checklist + template WA"]
  CREATE -.->|"bila ada kode"| ATTR["Atribusi keagenan (permanen)"]
  T --> SET["/app/pengaturan?baru=1 (banner: Satu langkah lagi)"]
  SET --> WA["Hubungkan WhatsApp (scan QR) → gateway"]
  SET -.->|"lewati"| APP["/app (banner WA di beranda sampai tersambung)"]
```

**Kunci:** tenant baru = **Basic gratis selamanya** (ACTIVE, tanpa jatuh tempo → dunning tak menyentuh). Kuota (pelanggan/unit/teknisi) dari **PlanConfig** yang membatasi, diatur admin.

**Setelah daftar → hubungkan WhatsApp:** nomor WA di wizard hanya DISIMPAN (identitas usaha). Penautan asli ke gateway lewat **scan QR** di `/app/pengaturan`. Onboarding meng-redirect ke `/app/pengaturan?baru=1` (WaConnect tampil paling atas + banner sambutan). Bila dilewati, **banner beranda** (`WaConnectBanner`) mengingatkan sampai `gatewaySessionStatus().ready===true`. Bantuan in-app: topik help `onboarding` + `wa-connect`.

---

## 4. Job State Machine (FSM — alur kerja teknisi)

```mermaid
stateDiagram-v2
  [*] --> DRAFT
  DRAFT --> ASSIGNED: owner assign (teknisi+jadwal)
  DRAFT --> CANCELLED: owner batal
  ASSIGNED --> ACCEPTED: teknisi terima
  ASSIGNED --> RESCHEDULED: owner jadwal ulang
  ASSIGNED --> CANCELLED
  ACCEPTED --> EN_ROUTE: teknisi berangkat
  EN_ROUTE --> ARRIVED: teknisi tiba
  ARRIVED --> IN_PROGRESS: mulai kerja
  IN_PROGRESS --> WAITING: tunda (wajib alasan)
  WAITING --> IN_PROGRESS: lanjut
  IN_PROGRESS --> COMPLETED: selesai (guard: checklist + foto)
  ACCEPTED --> RESCHEDULED
  EN_ROUTE --> RESCHEDULED
  ARRIVED --> RESCHEDULED
  IN_PROGRESS --> RESCHEDULED
  WAITING --> RESCHEDULED
  ACCEPTED --> CANCELLED
  EN_ROUTE --> CANCELLED
  ARRIVED --> CANCELLED
  IN_PROGRESS --> CANCELLED
  WAITING --> CANCELLED
  COMPLETED --> [*]
```

- **Guard COMPLETED:** semua item checklist required terisi + foto "after" (bila template minta).
- **Efek COMPLETED:** set completed_at, hitung next service date, buat RepeatReminder, picu permintaan ulasan.
- **Transisi tak terdaftar = ilegal (ditolak).** Role diperiksa tiap transisi (OWNER/ADMIN vs TECHNICIAN).

---

## 5. Identitas Unit AC + QR + Kartu Perawatan

```mermaid
flowchart TD
  subgraph DAFTAR["Daftar unit (owner/teknisi)"]
    ADD["Form tambah unit"] --> LOC["Lokasi = combobox saran dari data"]
    ADD --> DUP["Cek duplikat lunak (peringatan)"]
    ADD --> BULK["Buat-massal N unit kembar (masjid 8 AC → #1..#8)"]
  end

  subgraph QR["Kode QR sticker (opsional)"]
    GEN["Generate batch kode (unik global, acak)"] --> POOL["UnitCode POOL"]
    POOL --> EXPORT["Export CSV (cetak sendiri)"]
    POOL --> BIND["Scan/pilih → BIND ke unit"]
  end

  subgraph SCAN["Scan (kamera HP, jsQR)"]
    S1["Scan QR"] --> S2{"kode dikenal & milik tenant?"}
    S2 -->|"POOL"| BIND
    S2 -->|"BOUND (tenant ini)"| OPEN["Buka detail unit"]
    S2 -->|"format asing"| WARN["Pesan: bukan kode Aircon"]
  end

  subgraph LIHAT["Lihat riwayat (publik, tanpa login)"]
    U["/u/[code] — 1 unit: identitas mesin + riwayat (STRIP tenant/teknisi/biaya/PII)"]
    RW["/riwayat/[token] — SEMUA unit pelanggan: ringkasan + cari + sort"]
  end

  BIND --> U
  DAFTAR --> RW
```

- **Kode unik GLOBAL lintas tenant** (jangkar portabilitas atas-izin masa depan).
- **Halaman publik STRIP data sensitif** (tenant/teknisi/biaya/identitas pelanggan disembunyikan).
- **Kartu /riwayat/{token}** link statis-permanen; **otomatis tersisip di footer tiap WA reminder**.

---

## 6. Billing, Langganan & Dunning

```mermaid
flowchart TD
  subgraph UPGRADE["Upgrade (owner)"]
    LG["/app/langganan"] --> PICK["Pilih paket Pro/Business"]
    PICK --> SNAP["createSnapTransaction → Midtrans"]
    SNAP --> PAY["Pelanggan bayar (Snap)"]
    PAY --> WH["Webhook /api/billing/midtrans-webhook (verif sha512)"]
    WH --> ACT["Subscription aktif + nextDueDate diset"]
  end

  subgraph JAGA["Penjamin (bila webhook meleset)"]
    CRON["/api/cron/reconcile (harian)"] --> PULL["getTransactionStatus (PULL Midtrans)"]
    PULL --> ACT
  end

  subgraph DUN["Dunning (tenant BERBAYAR yang menunggak)"]
    CRD["/api/cron/dunning (harian)"] --> LATE{"nextDueDate lewat?"}
    LATE -->|"grace"| PD["PAST_DUE (masih bisa login) + WA pengingat"]
    LATE -->|"lewat batas"| SUS["SUSPENDED + tandai hapus"]
    SUS -->|"grace purge 24j, tetap nunggak"| PURGE["Purge data permanen"]
    SUS -->|"bayar"| ACT
  end

  NOTE["Basic gratis: nextDueDate NULL → TAK PERNAH masuk dunning"]
```

- **Midtrans env-driven** (sandbox↔production 1 saklar `MIDTRANS_ENV`; PRODUCTION aktif).
- **Webhook + reconciler** = dua lapis penjamin (push + pull) karena akun Midtrans dipakai bersama beberapa app (X-Override-Notification).
- **Purge bertahap & reversible**: mark → grace 24 jam → purge (jendela bayar sebelum data hilang).

---

## 7. IoT (jual-putus + demand generator)

```mermaid
flowchart LR
  ORDER["Owner pesan perangkat /app/perangkat/pesan"] --> IOTORD["IotOrder"]
  IOTORD --> IWH["/api/billing/iot-webhook (bayar)"]
  IWH --> SHIP["Admin proses & kirim (/admin/iot)"]
  SHIP --> INSTALL["Terpasang di unit AC"]
  INSTALL --> INGEST["/api/iot/ingest (token) → telemetry"]
  INGEST --> DETECT["Deteksi anomali (threshold)"]
  DETECT --> ALERT["Alert → Peluang Servis"]
  ALERT --> LEAD["Jadi lead → money loop"]
```

---

## 8. Keagenan (F1/F2/F3 — pertumbuhan)

```mermaid
flowchart TD
  ADMK["/admin/keagenan: buat Agen"] --> AG["Agen (kode referral)"]
  AG --> RESJOIN["Reseller daftar (joinCode)"]
  RESJOIN --> RES["Reseller (di bawah agen)"]
  AG -->|"referralCode saat onboarding"| ATTR["Atribusi tenant (PERMANEN)"]
  RES --> ATTR
  ATTR --> COMM["Komisi dihitung (PPh prefill, admin koreksi)"]
  COMM --> PAYOUT["Pencairan (dasbor agen/reseller)"]
```

---

## 9. Endpoint Terjadwal & Webhook (ringkas)

| Endpoint | Pemicu | Fungsi | Proteksi |
|---|---|---|---|
| `/api/cron/reminders` | Cron harian | Kirim WA reminder due (batch/pelanggan) | `CRON_SECRET` |
| `/api/cron/dunning` | Cron harian | Siklus tunggakan + purge | `CRON_SECRET` |
| `/api/cron/reconcile` | Cron harian | PULL status Midtrans (penjamin) | `CRON_SECRET` |
| `/api/billing/midtrans-webhook` | Midtrans | Aktifkan langganan | sha512 signature |
| `/api/billing/iot-webhook` | Midtrans | Bayar perangkat IoT | signature |
| `/api/iot/ingest` | Perangkat IoT | Telemetry masuk | `IOT_BRIDGE_TOKEN` |
| `/api/wa/callback` `/api/wa/policy` | Gateway WA | Status/kebijakan WA | secret header |
| `/api/customers`, `/api/assets` (+`/[id]`) | App | CRUD (REST) | `requireApiContext` (sesi) |

> Cron di Vercel Hobby = **harian** (sub-harian merusak semua auto-deploy).

---

## 10. Konfigurasi Admin = 1 Sumber Kebenaran (no-hardcode)

```mermaid
flowchart LR
  subgraph DB["DB (editable admin)"]
    PC["PlanConfig (harga + kuota pelanggan/unit/teknisi)"]
    BP["BillingPolicy (pajak, trial, dunning)"]
    CP["CompanyProfile (Lumite, faktur)"]
    IC["InfraConfig (interval servis, threshold)"]
    LC["LandingContent + Testimonial (CMS)"]
    MT["MessageTemplate (WA per tenant)"]
    CT["ChecklistTemplate"]
  end
  PC --> LAND["Landing page (tampilan harga+kuota)"]
  PC --> OPS["Operasional (checkQuota tegakkan batas)"]
  BP --> BILL["Billing/dunning runtime"]
  LC --> LAND
```

**Prinsip:** angka/aturan bisnis TIDAK hardcode. Admin ubah di panel → berlaku serempak di **landing** DAN **operasional** (contoh: kuota pelanggan/unit tampil di landing = yang ditegakkan sistem).

---

## 11. Model Data Inti (relasi ringkas)

```mermaid
erDiagram
  Tenant ||--o{ User : "punya"
  Tenant ||--o{ Customer : "punya"
  Customer ||--o{ Asset : "punya unit AC"
  Asset ||--o| UnitCode : "kode QR (opsional)"
  Asset ||--o{ JobOrder : "riwayat servis"
  Asset ||--o{ RepeatReminder : "pengingat per-unit"
  Customer ||--o| Customer : "cardToken (kartu perawatan)"
  JobOrder ||--o{ JobProgressEvent : "jejak FSM"
  Tenant ||--o{ Lead : "booking masuk"
  Tenant ||--o{ Subscription : "langganan"
  Tenant ||--o{ Payment : "pembayaran"
  Asset ||--o| Device : "perangkat IoT (opsional)"
  Device ||--o{ "Telemetry/Alert" : "data sensor"
```

---

## Ringkas satu kalimat

**Pelanggan masuk** (booking/IoT/manual) → **jadi job** → **teknisi kerjakan lewat FSM** → **selesai memicu pengingat otomatis** → **WhatsApp menarik pelanggan kembali** → **berulang**; sementara **admin mengatur semua aturan** dari panel (satu sumber kebenaran), **billing** menagih tier berbayar (Basic gratis selamanya), dan **IoT + keagenan** menambah aliran pelanggan.
