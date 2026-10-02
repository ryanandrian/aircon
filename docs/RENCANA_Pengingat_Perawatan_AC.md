# RENCANA — Modul "Pengingat Perawatan AC" (Aircon)

> **STATUS FILE INI**: rencana kerja, BUKAN laporan audit. Dibuat 2026-10-03 atas perintah user.
> **ATURAN LANJUT KOMPaksi/SESI BARU**: baca file ini dulu. Setiap fase punya checklist
> `[ ]` / `[x]` — **penanda progres adalah satu-satunya sumber kebenaran**. Jangan mengulang
> fase yang sudah `[x]`, jangan menyusun ulang rencana. Jika pengerjaan menyimpang,
> perbarui file ini di saat itu juga.

---

## 0. ATURAN KERJA (mengikat)

1. **TDD** (`test-driven-development`): tes RED dulu → GREEN → REFACTOR. Lihat `tests/*.test.ts` pola yang ada.
2. **Gate setiap fase** wajib lulus sebelum tandai `[x]`:
   `pnpm exec tsc --noEmit` · `pnpm exec eslint` · `pnpm test` · `pnpm run build`
3. **Deploy** hanya lewat `bash scripts/deploy-vps.sh` (lihat `AGENTS.md`). Gate lulus → commit → push → deploy → pastikan `PASS`.
4. **Apa pun yang menyentuh database** = backup dulu (pola `backup-*.json`, di-gitignore) → ubah → verifikasi baca-balik.
5. **Tanpa asumsi**: klaim tanpa bukti = "BELUM DIVERIFIKASI". Verifikasi selalu lewat perintah nyata.
6. **Helicopter view**: sebelum mengubah satu modul, grep dulu pembaca/penulisnya (pola survei §2).

---

## 1. FAKTA DASAR (hasil deep dive 2026-10-02/03 — semua terverifikasi)

### 1.1 Alur produksi yang sudah jalan
```
job COMPLETED → nextServiceDate dihitung (Asset.maintenanceIntervalDays ?? Tenant.maintenanceIntervalDays ?? 90)
             → RepeatReminder(QUEUED, leadTimeDays = Tenant.reminderLeadDays = 3)  [job-service.ts:97,107]
cron harian   → listDueReminders: dueDate - leadTimeDays <= sekarang                [reminder-service.ts:11]
             → digabung per pelanggan → 1 pesan                                    [runDueRemindersAllTenants]
             → MessageLog(QUEUED) + RepeatReminder = SENT (transaksi atomik)       [reminder-service.ts:105-117]
flusher       → MessageLog QUEUED → gatewaySend → SENT/FAILED + gatewayMessageId   [message-dispatch-service.ts]
callback      → status naik monoton: QUEUED < SENT < DELIVERED < READ              [api/wa/callback/route.ts]
```

### 1.2 Angka produksi (2026-10-03, DB live)
- `UNIT_aktif=141` · `JATUH_TEMPO(<=hari ini)=94` · `JOB_terbuka=20` · `UNIT_tanpa_pengingat=85`
- `QUEUED (tenant ada)=4`, **sudah masuk rentang kirim = 0**
- `SENT (tenant ada)=55`, **17 di antaranya `sentAt=null`** (tidak bisa dikorelasi lewat waktu)
- Pesan pengingat: 39 (34 SENT, 5 FAILED). Pesan `FAILED` tetap membuat reminder `SENT` → **status pengingat tidak menggambarkan kegagalan**.
- `REPEAT_ALL=65`, **6 yatim** (tenant sudah dihapus — sisa sesi purge).

### 1.3 Sudah ada (jangan dibuat ulang)
| Hal | Bukti |
|---|---|
| Logika money-loop lengkap | `src/lib/domain/money-loop.ts`, `reminder-service.ts`, `job-service.ts` |
| Status kirim + callback monoton | `MessageLog.status`, `api/wa/callback/route.ts` |
| Korelasi reminder↔MessageLog **tanpa kolom baru** via `sentAt` ±5s (uji 10/10 cocok) | uji 2026-10-03 |
| Enum penutupan: `DISMISSED`, `EXPIRED`, `CONVERTED` | `prisma/schema.prisma` `ReminderStatus` |
| Fungsi `CONVERTED` (`createRepeatJob`) — tak pernah dipanggil | `reminder-service.ts:133` |
| `reminderExpireDays:14` — tak pernah dipakai | `money-loop.ts:10` |
| Guard plan `Tenant.plan` + UI edit `PlanConfig` admin | `schema.prisma`, `admin/config-actions.ts` |
| Template `reminder`/`reminder_multi` bisa diedit tenant | `message-template-service.ts` (EDITABLE_KEYS) |
| Pola link `wa.me` (8 pemakaian) | grep `wa.me src/app` = 8 |
| Kernet: `AssignmentRole.KERNET` + assignment service multi-role | `schema.prisma`, `assignment-service.ts` |
| Pola halaman inbox (rujukan desain user) | `src/app/app/leads/` = page.tsx(23) + inbox(69) + actions(36) |
| Test harness mock Prisma | `tests/reminder-batch.test.ts`, `message-dispatch.test.ts` |
| Deploy 1-perintah + rollback otomatis | `scripts/deploy-vps.sh` (terbukti PASS 6x) |

### 1.4 BELUM ada (perlu dibuat — sumber pekerjaan)
- Hitungan "jatuh tempo" untuk FE tenant (yang di `/app/laporan` = jatuh tempo **invoice**, beda).
- Layar riwayat pengiriman pengingat (siapa/unit/kapan/status) untuk tenant.
- Penyaring paket di runner pengingat (`runDueRemindersAllTenants` kini `select:{id:true}` saja).
- Flag `autoReminder` di `PlanConfig` (usulan desain — TIDAK ada di repo saat ini).
- Field kernet di form pekerjaan baru (form hanya punya teknisi).
- Tulisan status `DISMISSED`/`EXPIRED` (enum ada, penulis nol).

---

## 2. PETA AREA TERKAIT (survei helicopter-view — siapa menyentuh apa)

**DB:** `RepeatReminder` (dibuat job-service, dibaca dashboard+reminder, dihapus dunning-purge) · `MessageLog` (ditulis reminder/dunning/sweeper, dibaca flusher+callback) · `Asset.nextServiceDate` (ditulis job-service, dibaca dashboard/card pelanggan/kartu publik riwayat) · `Tenant` (lead+maintenance, dipakai runner) · `PlanConfig` (admin-only) · `JobOrder`+`JobAssignment` (konversi) · `Customer` (tujuan WA).

**BE (jalur tak langsung):**
- `flushQueuedMessages` dipanggil **2 endpoint**: `cron/reminders` DAN `cron/dunning` → perubahan antrean memengaruhi dunning & sweeper.
- `dunning-service` menulis `MessageLog(QUEUED)` dengan `templateKey` berbeda → query status perlu menyaring `templateKey` pengingat.
- `purgeTenantData` menghapus `repeatReminder` (terbukti belum lengkap — lihat risiko R1).

**FE:**
- Menu: `app-nav.tsx` (satu sumber, sidebar desktop + drawer mobile).
- Terdampak langsung: `/app/page.tsx` (metrik), halaman baru `/app/pengingat/*`.
- Rujukan & terkait: `leads/*` (pola), `pelanggan/[id]/customer-hub.tsx` (tampil jadwal+riwayat), `pekerjaan/actions.ts#actionCreateJob` (target konversi), `panduan`+`help/content-owner.ts` (dokumentasi user), `riwayat/[token]` (kartu publik — indikator "jatuh tempo" sudah ada, jangan tercampur).

---

## 3. FASE KERJA

> Penanda: `[ ]` belum · `[x]` sudah. **Perbarui baris ini setiap selesai satu sub-item.**

### FASE 0 — PERSIAPAN & BERSIHKAN SISA DATA  `status: [ ]`
- [ ] 0.1 Backup `RepeatReminder` yatim → hapus **6 baris** yatim (tenant sudah tak ada). Verifikasi: `REPEAT_YATIM=0`.
- [ ] 0.2 Tentukan desain korelasi status pengiriman (KEPUTUSAN KRITIS — lihat risiko R2).
- [ ] 0.3 Gate lengkap lulus + commit + deploy. Tandai `[x]`.

### FASE 1 — SUMBER DATA: VIEW PENGINGAT PER UNIT  `status: [ ]`
> Tujuan: satu fungsi baca yang jadi **satu-satunya sumber** untuk metrik & halaman (hindari 2 query beda = angka beda).
- [ ] 1.1 TDD: `listReminderInbox(tenantId, filter)` — unit due (aturan jatuh tempo dikunci di tes) + pelanggan + status kirim dari `MessageLog` (korelasi sesuai hasil 0.2) + tanggal + `dueDate` + link `wa.me`.
- [ ] 1.2 GREEN + gate lulus. Tandai `[x]`.

### FASE 2 — HALAMAN BARU `/app/pengingat`  `status: [ ]`
> Pola `leads/` (page server + inbox client + actions), role OWNER/ADMIN, tenant-scoped.
- [ ] 2.1 TDD action: filter status, konversi→`CONVERTED`, tutup→`DISMISSED` (guard tenant id, tamper-proof).
- [ ] 2.2 `page.tsx` (guard + ambil data) → `inbox.tsx` (kartu: info unit+pelanggan, riwayat unit, badge status kirim, 4 tombol aksi, filter chip, empty state, mobile-first, aksesibilitas).
- [ ] 2.3 Menu baru di `app-nav.tsx` **di antara Pelanggan & Pekerjaan**.
- [ ] 2.4 Gate + deploy. Tandai `[x]`.

### FASE 3 — CARD RINGKASAN  `status: [ ]`
- [ ] 3.1 Ganti metrik "Pengingat Aktif" → **"Jatuh Tempo"** pakai fungsi FASE 1 (angka = isi daftar; keluar saat status ≠ QUEUED), `href` ke `/app/pengingat`.
- [ ] 3.2 Gate + deploy + verifikasi live. Tandai `[x]`.

### FASE 4 — GATE PAKET (Trial tanpa kirim otomatis)  `status: [ ]`
- [ ] 4.1 TDD: runner melewati tenant dengan `autoReminder=false`.
- [ ] 4.2 Migrasi DB `PlanConfig.autoReminder` (default `true`) + flag UI di editor paket admin (sudah ada) + set Trial `false`.
- [ ] 4.3 Sesuai risiko R2: status awal benar (`Belum dikirim` ≠ `SENT`).
- [ ] 4.4 Gate + deploy + migrasi `prisma migrate deploy` (jalur aman, lihat R3). Tandai `[x]`.

### FASE 5 — KONVERSI & PENUTUPAN  `status: [ ]`
- [ ] 5.1 Tombol konversi → bawa ke form pekerjaan (tanggal + teknisi + kernet) → `createRepeatJob` (fungsi sudah ada, belum pernah terpanggil → uji end-to-end).
- [ ] 5.2 Tambah **field kernet** di `job-form.tsx` (pakai `JobAssignment.roleOnJob=KERNET` yang sudah ada; jangan buat mekanisme baru).
- [ ] 5.3 Aktifkan auto-`EXPIRED` setelah 14 hari (`reminderExpireDays` sudah ada) — hati-hati: risiko R5.
- [ ] 5.4 Gate + deploy. Tandai `[x]`.

### FASE 6 — PENUTUP: DOKUMEN PENGGUNA + VERIFIKASI LIVE  `status: [ ]`
- [ ] 6.1 Update `help/content-owner.ts` + `panduan` (penjelasan modul untuk tenant).
- [ ] 6.2 Uji end-to-end lokal: buat job → reminder muncul di `/app/pengingat` → status berubah → konversi → tutup.
- [ ] 6.3 Deploy final + uji live manual (login tenant → buka menu → cek angka kartu == isi daftar).
- [ ] 6.4 Catat bukti akhir di file ini (bagian Bukti). Tandai `[x]`.

**Progres ringkas: FASE 0 [ ] · 1 [ ] · 2 [ ] · 3 [ ] · 4 [ ] · 5 [ ] · 6 [ ]**

---

## 4. HAMBATAN YANG SUDAH DIANTISIPASI (RISIKO + MITIGASI)

| # | Risiko (dasar) | Dampak | Mitigasi (wajib) |
|---|---|---|---|
| **R1** | `purgeTenantData` tak menghapus `TenantAttribution` & `RepeatReminder` yatim → webhook/cron gagal (FK RESTRICT) | cron dunning 500 → flusher ikut batal | Selesaikan FASE 0.1 dulu; pertimbangkan lengkapi daftar hapus di purge (tapi = perubahan BE terpisah, minta izin) |
| **R2** | 17 dari 55 `SENT` punya `sentAt=null`; `FAILED` tetap membuat reminder `SENT` | status di UI bisa menyesatkan (poin user!) | Keputusan 0.3. Opsi A: korelasi lewat waktu (terbukti 10/10 utk tenant ada). Opsi B: tambah kolom `messageLogId` di `RepeatReminder` (migrasi ADD COLUMN, tapi jalur tulis harus disentuh di `sendCustomerReminderWa`) |
| **R3** | `prisma migrate dev` menolak di DB ini (minta reset = **hapus semua data**) | BENCANA | Selalu `migrate deploy` saja, atau SQL manual terarah + verifikasi (pola `20261002230000_reminder_lead_default_3` yang sudah terbukti aman) |
| **R4** | `flushQueuedMessages` dipanggil cron dunning juga → perubahan status mengganggu billing | pesan tunggakan gagal kirim | Gate: `tests/dunning.test.ts` + `message-dispatch.test.ts` harus tetap lulus; jangan ubah kontrak `MessageLog` |
| **R5** | Auto-`EXPIRED` mengubah hitungan metrik mendadak (reminder hilang sendiri dari daftar) | user bingung angka turun tanpa aksi | Jalankan setelah FASE 3; tampilkan riwayat "Kedaluwarsa" di filter, bukan menghapus data |
| **R6** | Perubahan metrik Ringkasan mengubah angka yang mungkin dipakai/dikutip | inkonsistensi UI | Bandingkan angka lama-vs-baru sebelum deploy (logikanya beda: `QUEUED semua` vs `sudah masuk rentang`) |
| **R7** | `PlanConfig.autoReminder` = kolom baru → Prisma client harus di-generate | build gagal | `pnpm run build` sudah termasuk `prisma generate` — jalankan gate penuh sebelum commit |
| **R8** | Modul inti → regresi money-loop (pengingat tak terkirim = nol revenue) | kerugian bisnis langsung | Gate 410+ tes wajib hijau; `reminder-batch.test.ts` & `money-loop` tak boleh diubah kecuali ada alasan berbukti |
| **R9** | Mengubah `ReminderStatus`/`sendCustomerReminderWa` merusak batching & idempoten | kirim ganda / gagal | Jangan sentuh fungsi tulis kecuali fase terkait; tes `reminder-batch` lulus |
| **R10** | User melihat angka beda antara kartu Ringkasan & isi daftar (dual query) | hilang kepercayaan | FASE 1 memaksa SEMUA (kartu + halaman) memakai **satu** fungsi `listReminderInbox` |
| **R11** | Cron `reminders` di produksi **belum diverifikasi** dari VPS | angka tidak pernah bergerak otomatis | Saat FASE 6: verifikasi di VPS (systemd timer / eksternal), jangan asumsi dari keberhasilan 13 pesan historis |

---

## 5. PRINSIP DESAIN (dari permintaan user, 2026-10-03)

1. Kartu **"Pengingat Aktif" dihapus** dari Ringkasan → diganti **"Jatuh Tempo"** dan tautan ke daftar.
2. Halaman baru = **daftar unit jatuh tempo** (rentang: `Tenant.reminderLeadDays` hari sebelum jadwal servis — kini 3).
3. Menu **di antara Pelanggan dan Pekerjaan**; bisa juga dibuka dari card Ringkasan.
4. Tiap kartu: info unit **+ pelanggan** → riwayat unit → **status kirim WA** → aksi: Kirim Pengingat (Trial, `wa.me` + template), Buka WhatsApp (follow-up), Jadikan Pekerjaan, Tutup Pengingat.
5. **Trial = tanpa kirim otomatis** (paket `autoReminder=false`), status `Belum dikirim`, tenant kirim manual lewat tombol.
6. Status terus bergerak mengikuti follow-up; pengingat bisa **dikonversi** ATAU **ditutup** → tidak pernah menumpuk selamanya.
7. Rancangan selaras dengan pola Booking Online (pola `leads/`) — modul ini **inti produk**, kerja teliti & tuntas.

---

## 6. BUKTI / LOG (isi saat mengerjakan — jangan hapus)

> _(kosong; diisi saat fase dijalankan: SHA commit, hasil gate, angka sebelum-sesudah, bukti deploy PASS)_
