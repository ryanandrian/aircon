# AC SERVICE GROWTH OS — BUILD SPEC PACK

## Part 1 of 3: DATA SCHEMA + API CONTRACT (implementation-level)

**Tujuan:** menghapus ambiguitas teknis. Ini "gambar kerja" — presisi tipe, constraint, enum, index, dan kontrak request/response per endpoint. Developer/Agentic AI tidak perlu menebak.

`docs/SSOT_Checklist_Servis.md` adalah pointer ringkas kondisi aktif Checklist Servis yang ditelusuri ke source,
schema, migrasi dan bukti release. Dokumen dengan tanggal/snapshot lebih lama (termasuk arsip dual-read) bukan
pengganti audit source dan tidak boleh dikutip sebagai runtime terkini.

---

# 1. ENUMS (nilai pasti — tidak boleh ditebak)

```prisma
enum Role            { OWNER ADMIN TECHNICIAN }
enum TenantPlan      { STARTER GROWTH PRO }
enum TenantStatus    { TRIAL ACTIVE SUSPENDED CANCELLED }
enum UserStatus      { INVITED ACTIVE DISABLED }

enum CustomerSource  { REFERRAL WHATSAPP WALK_IN MARKETING IOT_ALERT REPEAT OTHER }

enum AssetType       { SPLIT CASSETTE STANDING WINDOW CENTRAL OTHER }

enum ServiceType     { CLEANING REFILL_FREON REPAIR INSTALL DISMANTLE INSPECTION OTHER }

enum JobStatus       { DRAFT ASSIGNED ACCEPTED EN_ROUTE ARRIVED IN_PROGRESS WAITING COMPLETED CANCELLED RESCHEDULED }
enum JobSource       { MANUAL REPEAT IOT LEAD }

enum FeasibilityStatus { FEASIBLE RISK CONFLICT UNKNOWN }

enum LeadStatus      { NEW CONTACTED QUOTED WON LOST }
enum ReminderStatus  { QUEUED SENT CONVERTED DISMISSED EXPIRED }
enum ReviewStatus    { REQUESTED SENT RECEIVED DECLINED }
enum CampaignStatus  { DRAFT ACTIVE DONE }
enum RecipientStatus { PENDING SENT FAILED }

enum MessageChannel  { WA PUSH }
enum MessageDir      { OUTBOUND INBOUND }
enum MessageStatus   { QUEUED SENT DELIVERED FAILED LOGGED }

enum DeviceProvision { UNPROVISIONED PROVISIONED }
enum RentalStatus    { NONE ACTIVE RETURNED }
enum CommandState    { COMMAND_SENT ACKNOWLEDGED STATE_CONFIRMED FAILED }
enum AlertType       { OVERCURRENT NO_COOLING OFFLINE SENSOR_FAULT }
enum AlertSeverity   { INFO WARNING CRITICAL }
enum AlertStatus     { OPEN ACK RESOLVED DISMISSED }
```

---

# 2. PRISMA SCHEMA (level implementasi)

```prisma
model Tenant {
  id                String        @id @default(cuid())
  name              String
  phone             String        @unique
  workingHoursDefault Json        // {mon:{start:"08:00",end:"17:00"},...} 24h WITA/local
  serviceArea       Json          // {cities:[],districts:[]}
  bufferMinutes     Int           @default(15)
  maintenanceIntervalDays Int     @default(90)   // default next-service interval
  reminderLeadDays  Int           @default(7)
  plan              TenantPlan    @default(STARTER)
  status            TenantStatus  @default(TRIAL)
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
}

model User {
  id           String     @id @default(cuid())
  tenantId     String
  name         String
  phone        String
  role         Role
  pinHash      String?    // argon2; teknisi pakai PIN, owner/admin bisa password
  status       UserStatus @default(INVITED)
  lastLoginAt  DateTime?
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  @@unique([tenantId, phone])
  @@index([tenantId, role])
}

model Customer {
  id           String   @id @default(cuid())
  tenantId     String
  name         String
  phone        String
  address      String?
  geoLat       Float?
  geoLng       Float?
  source       CustomerSource @default(OTHER)
  referredById String?  // Customer.id
  notes        String?
  deletedAt    DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@index([tenantId, phone])
  @@index([tenantId, source])
}

model Asset {
  id                    String   @id @default(cuid())
  tenantId              String
  customerId            String
  brand                 String?
  model                 String?
  type                  AssetType @default(SPLIT)
  capacityPk            Float?    // 0.5,0.75,1,1.5,2...
  roomLocation          String?
  serial                String?
  installedAt           DateTime?
  maintenanceIntervalDays Int?    // null => pakai tenant default
  nextServiceDate       DateTime?
  deviceId              String?   @unique  // 1:1 dgn Device
  deletedAt             DateTime?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  @@index([tenantId, customerId])
  @@index([tenantId, nextServiceDate])
}

model Technician {
  id           String   @id @default(cuid())
  tenantId     String
  userId       String   @unique
  skills       String[] // subset ServiceType sbg string / tag bebas
  workingHours Json?    // override tenant default; null => pakai default
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@index([tenantId, active])
}

model JobOrder {
  id             String    @id @default(cuid())
  tenantId       String
  customerId     String
  assetId        String?
  technicianId   String?
  serviceType    ServiceType
  status         JobStatus @default(DRAFT)
  source         JobSource @default(MANUAL)
  scheduledDate  DateTime?          // tanggal (date bagian dipakai)
  windowStart    DateTime?          // awal time-window
  windowEnd      DateTime?          // akhir time-window
  estDurationMin Int       @default(60)
  addressSnapshot String?           // salinan alamat saat dibuat
  geoLat         Float?
  geoLng         Float?
  price          Decimal?  @db.Decimal(12,2)  // nilai job utk revenue metric
  notes          String?
  nextServiceDate DateTime?         // diisi saat COMPLETED
  parentJobId    String?            // asal repeat job
  createdById    String
  completedAt    DateTime?
  deletedAt      DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  @@index([tenantId, status])
  @@index([tenantId, technicianId, scheduledDate])
  @@index([tenantId, customerId])
}

model JobProgressEvent {
  id          String   @id @default(cuid())
  tenantId    String
  jobId       String
  fromStatus  JobStatus?
  toStatus    JobStatus
  actorId     String
  at          DateTime @default(now())
  clientEventId String?  // idempotency utk offline sync (unique per tenant)
  meta        Json?      // {lat,lng,reason,...}
  @@unique([tenantId, clientEventId])
  @@index([tenantId, jobId, at])
}

// ── MODEL CHECKLIST — runtime aktif 2026-10-03 (default kosong; tanpa anchor serviceType/jobId;
//    migrasi legacy-drop sudah berjalan di DB; otoritatif = prisma/schema.prisma) ──
model ChecklistTemplate {
  id        String @id @default(cuid())
  tenantId  String
  serviceId String // required FK ServiceCatalog; unique per tenant/service
  items     Json
  service   ServiceCatalog @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  @@unique([tenantId, serviceId])
}
model ChecklistResult {
  id         String @id @default(cuid())
  tenantId   String
  workItemId String // required FK WorkItem; 1 layanan × 1 unit
  itemKey    String
  checked    Boolean @default(false)
  value      String?
  workItem   WorkItem @relation(fields: [workItemId], references: [id], onDelete: Cascade)
  @@unique([tenantId, workItemId, itemKey])
}

model JobPhoto {
  id       String   @id @default(cuid())
  tenantId String
  jobId    String
  kind     String   // "before"|"after"|"other"
  url      String
  at       DateTime @default(now())
  @@index([tenantId, jobId])
}

model Lead {
  id                 String     @id @default(cuid())
  tenantId           String
  name               String
  phone              String
  source             CustomerSource @default(OTHER)
  status             LeadStatus @default(NEW)
  notes              String?
  followUpAt         DateTime?
  convertedCustomerId String?
  convertedJobId     String?
  createdAt          DateTime   @default(now())
  updatedAt          DateTime   @updatedAt
  @@index([tenantId, status])
  @@index([tenantId, followUpAt])
}

model Referral {
  id                 String   @id @default(cuid())
  tenantId           String
  referrerCustomerId String
  referredCustomerId String
  at                 DateTime @default(now())
}

model ReviewRequest {
  id       String   @id @default(cuid())
  tenantId String
  jobId    String
  channel  MessageChannel @default(WA)
  status   ReviewStatus   @default(REQUESTED)
  at       DateTime @default(now())
}

model RepeatReminder {
  id           String   @id @default(cuid())
  tenantId     String
  assetId      String
  dueDate      DateTime
  leadTimeDays Int
  status       ReminderStatus @default(QUEUED)
  jobId        String?  // repeat job hasil konversi
  sentAt       DateTime?
  @@unique([tenantId, assetId, dueDate])   // cegah duplikat reminder
  @@index([tenantId, status, dueDate])
}

model Campaign {
  id         String   @id @default(cuid())
  tenantId   String
  name       String
  segment    Json     // {source?,lastServiceBefore?,assetType?}
  templateId String
  status     CampaignStatus @default(DRAFT)
  createdAt  DateTime @default(now())
}

model CampaignRecipient {
  id         String   @id @default(cuid())
  tenantId   String
  campaignId String
  customerId String
  status     RecipientStatus @default(PENDING)
  sentAt     DateTime?
  @@unique([tenantId, campaignId, customerId])
}

model MessageTemplate {
  id       String   @id @default(cuid())
  tenantId String
  key      String   // "reminder"|"reschedule"|"review"|"lead_followup"|"campaign"|...
  body     String   // dgn {{var}} placeholder
  @@unique([tenantId, key])
}

model MessageLog {
  id         String   @id @default(cuid())
  tenantId   String
  customerId String?
  jobId      String?
  channel    MessageChannel
  templateKey String?
  direction  MessageDir  @default(OUTBOUND)
  status     MessageStatus @default(LOGGED)
  body       String?
  at         DateTime @default(now())
  @@index([tenantId, customerId, at])
}

model Device {
  id              String   @id            // = DeviceID fisik
  tenantId        String?
  assetId         String?  @unique
  provisionStatus DeviceProvision @default(UNPROVISIONED)
  rentalStatus    RentalStatus    @default(NONE)
  fwVersion       String?
  lastSeenAt      DateTime?
  health          Json?    // {rssi,uptime,errors}
  createdAt       DateTime @default(now())
  @@index([tenantId, provisionStatus])
}

model Telemetry {
  id        BigInt   @id @default(autoincrement())
  deviceId  String
  tenantId  String?
  ts        DateTime
  tempC     Float?
  humidity  Float?
  currentA  Float?
  powerW    Float?
  online    Boolean  @default(true)
  @@index([deviceId, ts])   // time-series; retensi & partisi diatur ops
}

model CommandLog {
  id          String   @id @default(cuid())
  tenantId    String
  deviceId    String
  command     Json     // {type:"set_temp",params:{...},cmdId}
  state       CommandState @default(COMMAND_SENT)
  evidence    Json?
  sentAt      DateTime @default(now())
  ackAt       DateTime?
  confirmedAt DateTime?
  @@index([tenantId, deviceId, sentAt])
}

model Alert {
  id            String   @id @default(cuid())
  tenantId      String
  deviceId      String
  assetId       String?
  type          AlertType
  severity      AlertSeverity @default(WARNING)
  status        AlertStatus   @default(OPEN)
  createdJobId  String?
  at            DateTime @default(now())
  @@index([tenantId, status])
}

model Subscription {
  id           String   @id @default(cuid())
  tenantId     String   @unique
  plan         TenantPlan
  iotDevices   Int      @default(0)
  status       TenantStatus @default(TRIAL)
  validUntil   DateTime?
  notes        String?
}
```

---

# JOB STATUS & TRANSISI — arsip historis; finalisasi aktual tercatat di atas

> **JANGAN gunakan `IN_PROGRESS→COMPLETED` atau model checklist per-job pada tabel/contoh di bawah sebagai kontrak runtime.**
> Source aktif menolak `transitionJob(COMPLETED)`. Finalisasi JobOrder hanya melalui `closeWorkSession`.
> Schema aktif checklist adalah `ChecklistTemplate.serviceId` dan `ChecklistResult.workItemId` (required).
> Tabel/model lama yang tersisa di Part1 ini semata provenance historis 2026, bukan panduan implementasi.



# JOB STATUS & TRANSISI — arsip historis; tabel berikut BUKAN transisi runtime aktif

> **JANGAN gunakan `IN_PROGRESS→COMPLETED` di tabel ini sebagai kontrak runtime.** Source sekarang tidak
> mendaftarkan atau menerima transisi umum tersebut. Finalisasi job hanya melalui `closeWorkSession`.
> Tabel berikut dipertahankan untuk provenance versi lama; ringkasan finalizer/checklist aktif ada di
> status di atas dan BuildSpec Part2 §S-T3.

| Dari | Ke | Siapa boleh | Guard/syarat | Efek samping |
|---|---|---|---|---|
| DRAFT | ASSIGNED | owner, admin | technicianId + scheduledDate + window terisi; feasibility ≠ CONFLICT (atau override sadar) | catat event |
| DRAFT | CANCELLED | owner, admin | — | — |
| ASSIGNED | ACCEPTED | technician (pemilik) | — | catat waktu terima |
| ASSIGNED | RESCHEDULED | owner, admin | window baru | trigger re-plan; notif customer via approval |
| ASSIGNED | CANCELLED | owner, admin | — | — |
| ACCEPTED | EN_ROUTE | technician | — | mulai hitung travel aktual |
| EN_ROUTE | ARRIVED | technician | (opsional geo-check) | hentikan travel; mulai on-site |
| ARRIVED | IN_PROGRESS | technician | — | mulai durasi kerja aktual → trigger re-plan job berikutnya |
| IN_PROGRESS | WAITING | technician | reason wajib (mis. tunggu sparepart) | pause; trigger re-plan |
| WAITING | IN_PROGRESS | technician | — | resume |
| IN_PROGRESS | COMPLETED | ⛔ TRANSISI SUDAH DIHAPUS — finalisasi lewat Catat Pekerjaan / `closeWorkSession` (bukan API transition) | checklist WorkItem required + finalizer mengatur completedAt/nextServiceDate, reminder, review, event + Invoice/Proforma atomik |
| ACCEPTED/EN_ROUTE/ARRIVED/IN_PROGRESS/WAITING | RESCHEDULED | owner, admin | window baru | re-plan + approval + notif |
| (semua sebelum COMPLETED) | CANCELLED | owner, admin | reason | batalkan reminder terkait bila ada |

Aturan keras (runtime aktif):
- `transitionJob` tidak mendaftarkan/menerima COMPLETED. Satu-satunya finalizer adalah `closeWorkSession`.
- Checklist required per WorkItem + Invoice/Proforma + efek job selesai terjadi dalam finalizer itu.
- Setiap transisi NONFINAL menulis `JobProgressEvent` (idempotent dengan `clientEventId` bila dikirim).
- Tabel transisi di atas selain baris COMPLETED mencatat status historis/spesifikasi umum dan bukan definisi
  lengkap semua behavior UI aktif. Untuk jalur final saat ini lihat Part2 §S-T3 dan schema `prisma/schema.prisma`.


---

# 4. API CONTRACT (endpoint v1 di bawah = kontrak historis, bukan seluruh implementasi runtime sekarang)

> **Catatan checklist/finalisasi aktif (2026-10-03):** endpoint transition umum tetap dipakai hanya untuk status
> nonfinal. Request `toStatus=COMPLETED` ditolak. Penyelesaian sekarang adalah server action
> `actionCloseWorkSession` (bukan endpoint `/jobs/:id/transition`), yang gate checklist DB dan secara atomik
> membuat Invoice/Proforma + JobOrder COMPLETED + efek servis/reminder/review. Jangan implementasikan ulang
> kontrak lama di bawah tanpa merujuk Part2 §S-T3 dan schema/source aktif.

> **Infra auth (lihat TechStack v2.1):** OTP/JWT tidak dibuat sendiri — pakai **Supabase Auth**. Endpoint `/auth/otp/*` di bawah = kontrak logis; implementasinya lewat Supabase client + (opsi) SMS provider untuk OTP, atau email+password owner / PIN teknisi. Realtime progress pakai **Supabase Realtime** (subscribe `JobProgressEvent`), foto pakai **Supabase Storage**. Kontrak endpoint domain (jobs, schedule, repeat, dst.) tetap seperti di bawah.
>
> **UPDATE (2026-09-05):** Auth owner/admin kini **Google OAuth SELF-HOST** (bukan Supabase Auth). SSOT terkini = `docs/Security_Model.md`. Catatan di atas = konteks historis.

Konvensi global:
- Base: `/api/v1`. Auth: `Authorization: Bearer <access>`. Tenant & role dari JWT claim (Supabase session).
- Error: `{ "error": { "code": "STRING_CODE", "message": "...", "details": {...} } }`.
- Kode error umum: `UNAUTHORIZED(401)`, `FORBIDDEN(403)`, `NOT_FOUND(404)`, `VALIDATION(422)`, `ILLEGAL_TRANSITION(409)`, `CONFLICT(409)`, `RATE_LIMITED(429)`.
- Pagination: `?cursor=<id>&limit=<=100` → response `{ data:[...], nextCursor:string|null }`.
- Semua timestamp ISO-8601 dengan offset.

Contoh kontrak endpoint kritikal (sisanya mengikuti pola CRUD yang sama):

### POST /auth/otp/request
```json
req:  { "phone": "+62812..." }
res:  { "ok": true, "expiresInSec": 300 }        // 429 bila rate-limited
```
### POST /auth/otp/verify
```json
req:  { "phone": "+62812...", "code": "1234" }
res:  { "access":"jwt", "refresh":"jwt",
        "user": { "id","name","role","tenantId" } }
```
### POST /jobs
```json
req:  { "customerId","assetId?","serviceType","technicianId?",
        "scheduledDate?","windowStart?","windowEnd?","estDurationMin?","price?","notes?" }
res:  { "id","status":"DRAFT", ...jobFields }     // 422 bila field invalid
```
### POST /jobs/:id/transition
```json
req:  { "toStatus":"IN_PROGRESS", "clientEventId":"uuid",
        "meta": { "lat?,lng?,reason?" } }
res:  { "id","status":"IN_PROGRESS","completedAt?":null, "nextServiceDate?":null }
      // 409 ILLEGAL_TRANSITION | 422 GUARD_FAILED {missing:["photo_after"]}
```
### POST /schedule/feasibility
```json
req:  { "technicianId","assetId?","serviceType",
        "windowStart","windowEnd","estDurationMin", "geoLat?","geoLng?" }
res:  { "status":"RISK",
        "reasons":[{"code":"TIGHT_TRAVEL","message":"...","slackMin":-5}],
        "missing":[] }                            // status: FEASIBLE|RISK|CONFLICT|UNKNOWN
```
### POST /replan/recompute
```json
req:  { "technicianId","date","trigger":"PROGRESS_DELAY" }
res:  { "impactedJobs":[{"jobId","newEta","status"}],
        "proposals":[{"id","type":"RESCHEDULE|REASSIGN|SHIFT","jobId","detail"}] }
```
### POST /replan/apply
```json
req:  { "proposalId" }                            // owner/admin only
res:  { "applied":true, "jobId","customerNotificationQueued":true }
```
### GET /repeat/reminders?status=QUEUED
```json
res:  { "data":[{ "id","assetId","customer":{...},"dueDate","status" }], "nextCursor":null }
```
### POST /repeat/reminders/:id/send
```json
res:  { "waUrl":"https://wa.me/62...?text=...", "messageLogId":"..." }  // status→SENT
```
### POST /repeat/reminders/:id/create-job
```json
res:  { "jobId","prefilledFrom":"<parentJobId>", "status":"DRAFT" }     // status→CONVERTED
```
### POST /devices/:id/command
```json
req:  { "type":"set_temp", "params":{"tempC":24}, "cmdId":"uuid" }
res:  { "commandLogId","state":"COMMAND_SENT" }
```
### GET /devices/:id/command/:cmdLogId
```json
res:  { "state":"STATE_CONFIRMED","evidence":{"tempC":24},"confirmedAt":"..." }
```
### POST /alerts/:id/create-job
```json
res:  { "jobId","source":"IOT","status":"DRAFT" }
```
### GET /metrics/overview?from=&to=&technicianId=
```json
res:  { "jobs":120,"completed":110,"revenue":15400000,
        "repeatCustomers":42,"repeatUpliftPct":18.5,
        "onTimePct":91.2,"completionRatePct":91.6,
        "bySource":{"REFERRAL":30,"WHATSAPP":20,...} }
```

### IoT device protocol (MQTT over TLS)
```
device→broker  d/<deviceId>/telemetry  {ts,tempC,humidity,currentA,powerW,online,fw}
device→broker  d/<deviceId>/ack        {cmdId,ackAt,evidence?}
broker→device  d/<deviceId>/cmd        {cmdId,type,params}
HTTPS fallback: POST /iot/telemetry , POST /iot/ack (auth: device token)
```
> **Infra (lihat TechStack_v2_Supabase_Reconsidered.md §3):** broker = **EMQX Serverless (free tier)**, bukan self-host. Telemetry/ack diteruskan ke Postgres via **jembatan MQTT→Supabase** (EMQX Data Integration → Edge Function). Command dipublish ke `d/<id>/cmd` via EMQX HTTP API dari Edge Function. Anomali→Alert dievaluasi di jalur ingest ini. Command→Verify (COMMAND_SENT→ACKNOWLEDGED→STATE_CONFIRMED) tetap real-time.

---

# 5. YANG MASIH BOLEH DIPUTUSKAN AI/DEV (aman untuk diserahkan)
Hal-hal berikut sengaja tidak dikunci karena low-risk & mudah diubah: penamaan variabel internal, struktur folder, styling detail, pilihan library util, format log persis, isi seed demo. Semua KECUALI ini harus ikut spec di atas.

---

**Lanjut ke Part 2: Screen-by-Screen UX Spec, dan Part 3: Business Rules & Default Values.**
