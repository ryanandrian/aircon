# AC SERVICE GROWTH OS — BUILD SPEC PACK

## Part 3 of 3: BUSINESS RULES & DEFAULT VALUES (konkret)

**Tujuan:** mengubah semua "diatur nanti" menjadi nilai konkret yang bisa langsung dikode. Semua angka di sini adalah **default yang dapat dikonfigurasi tenant** dan **hipotesis yang dikalibrasi saat pilot** — tapi cukup pasti untuk membangun & mendemokan aplikasi yang jalan.

---

# 1. SCHEDULING & TRAVEL

| Parameter | Default | Catatan |
|---|---|---|
| Buffer antar-job | 15 menit | `tenant.bufferMinutes` |
| Jam kerja default | 08:00–17:00, Sen–Sab | `tenant.workingHoursDefault`; Minggu libur |
| Estimasi durasi per jenis service | Cleaning 45m · Refill freon 60m · Repair 90m · Install 120m · Dismantle 60m · Inspection 30m · Other 60m | default `estDurationMin`, bisa diubah per job |
| Sumber estimasi travel | OSRM (driving) bila tersedia | — |
| Fallback travel | Haversine × faktor kota **1.4**, kecepatan asumsi **25 km/jam** | dipakai bila OSRM gagal/offline |
| Ambang RISK | earliest_start ≤ windowEnd tapi > windowStart | job masih muat tapi mepet |
| Ambang CONFLICT (waktu) | earliest_start > windowEnd | tidak muat |
| UNKNOWN | lokasi job/prev tak ada, ATAU durasi prev tak diketahui | tandai field yang hilang |
| Skill mismatch | serviceType tak ada di technician.skills | → CONFLICT (alasan: skill). Jika technician.skills kosong → dianggap generalis (semua boleh) |

Rumus: `earliest_start_B = finish_prev + travel(prev→B) + buffer`; `finish_prev = actual_end ?? (start_prev + estDuration_prev)`.

---

# 2. REPEAT / MAINTENANCE (Money Loop)

| Parameter | Default | Catatan |
|---|---|---|
| Interval maintenance | **90 hari** | `asset.maintenanceIntervalDays ?? tenant.maintenanceIntervalDays` |
| Interval per jenis (saran awal) | Cleaning 90h · Refill freon 180h · Inspection 180h | dipakai bila diaktifkan per jenis |
| next_service_date | `completedAt + intervalDays` | dihitung saat COMPLETED |
| Reminder lead time | **H-7** sebelum due | `tenant.reminderLeadDays` |
| Worker reminder | jalan **harian 06:00 waktu tenant** | buat RepeatReminder utk asset yg due-lead ≤ today & belum ada reminder aktif |
| Anti-duplikat | unique (tenant, asset, dueDate) | 1 reminder per siklus |
| Reminder kadaluarsa | bila lewat due + 14 hari tanpa aksi → status EXPIRED | jaga daftar tetap bersih |

---

# 3. CHECKLIST LAYANAN & FINALISASI (aturan aktif 2026-10-03)

- Checklist bersifat opt-in per tenant/per layanan; tidak ada template default yang diseed.
- Teknisi/kernet mengisi item progresif di WorkSession per WorkItem (layanan×unit), termasuk upload/capture
  foto hasil kerja. Item photo bukan teks; foto diunggah ke S3.
- Item required harus valid di sisi server sebelum satu-satunya finalisasi `closeWorkSession` menutup sesi,
  mengubah JobOrder menjadi COMPLETED, menerbitkan Invoice/Proforma, dan membuat jadwal servis,
  RepeatReminder, ReviewRequest, serta JobProgressEvent dalam satu transaksi. Checklist optional tidak
  menghalangi.
- Field/checklist template lama per `serviceType`, hasil lama per `jobId`, seed checklist, serta jalur
  tombol status COMPLETED lama sudah dihapus. Tidak boleh dibangun ulang sebagai jalur paralel.
- Bukti lokal/live 2026-10-03: TSC/lint/build 0, 523 tests/58 files; deploy PASS commit
  `ff1aade4a335df7cc7a8ef43ca311f93b87aa78a`; DB migration up-to-date; `/` dan `/login` 200.
- BELUM DIVERIFIKASI: uji kamera fisik dan upload/akses objek foto nyata S3 belum dilakukan.

> Materi di bawah awalnya menyebut template seed/guard per jenis service. Itu **arsip spesifikasi historis**
> dan tidak berlaku sebagai alur produk aktif.

# 3. CHECKLIST TEMPLATE & GUARD (ARSIP HISTORIS — NON-AKTIF)

> Isi bagian ini dan subbagian lama sampai akhir dokumen adalah rancangan awal per `serviceType` yang
> sekarang tidak berlaku. Source, schema, dan DB live sudah memakai satu checklist per `serviceId` / `workItemId`.
> Lihat bagian “CHECKLIST LAYANAN & FINALISASI (aturan aktif 2026-10-03)” di atas.

Format item: `{key,label,type,required}`. Ini seed default; tenant boleh edit (S-O10).

**CLEANING**
- unit_off (bool, req) "Matikan unit sebelum bekerja"
- filter_clean (bool, req) "Cuci filter"
- coil_clean (bool, req) "Cuci evaporator/kondensor"
- drain_check (bool, req) "Cek & bersihkan saluran air"
- photo_before (photo, req) · photo_after (photo, req)
- temp_after (number, opt) "Suhu keluar setelah servis (°C)"

**REFILL_FREON**
- pressure_before (number, req) "Tekanan awal (psi)"
- leak_check (bool, req) "Cek kebocoran"
- freon_type (text, req) "Jenis freon (R32/R410/R22)"
- pressure_after (number, req) "Tekanan akhir (psi)"
- photo_after (photo, req)

**REPAIR**
- problem_found (text, req) "Kerusakan ditemukan"
- action_taken (text, req) "Tindakan"
- part_replaced (text, opt) "Sparepart diganti"
- photo_before (photo, req) · photo_after (photo, req)

**INSTALL**
- location_ok (bool, req) "Lokasi pemasangan sesuai"
- bracket_mounted (bool, req) "Bracket terpasang kuat"
- pipe_length_m (number, req) "Panjang pipa (m)"
- vacuum_done (bool, req) "Vakum dilakukan"
- test_run (bool, req) "Uji nyala OK"
- photo_after (photo, req)

**INSPECTION**
- visual_ok (bool, req) · temp_measured (number, req) "Suhu terukur" · current_measured (number, opt) "Arus (A)" · recommendation (text, opt)

**DISMANTLE / OTHER**: minimal photo_before, photo_after, notes.

> Guard COMPLETED lama (`422 GUARD_FAILED`) adalah perilaku historis, sudah diganti finalizer `closeWorkSession` — tidak berlaku di runtime sekarang.


  **SELURUH SUBBAGIAN DI BAWAH §3 ADALAH SPEC LAMA NON-AKTIF** (ditulis 2026-09). Daftar template seed, guard COMPLETED langsung, dan klaim API `GUARD_FAILED` tidak berlaku pada runtime sekarang. Keadaan aktif: lihat §3 di atas dan `docs/SSOT_Checklist_Servis.md`.

---

# 4. TEMPLATE WHATSAPP DEFAULT (Bahasa Indonesia, dgn placeholder)

Placeholder: `{{customer}} {{tanggal}} {{jam}} {{teknisi}} {{unit}} {{alamat}} {{usaha}} {{harga}}`.

- **reminder**: "Halo {{customer}}, AC {{unit}} Anda sudah waktunya servis rutin. Boleh kami jadwalkan kunjungan teknisi? — {{usaha}}"
- **reschedule**: "Halo {{customer}}, mohon maaf jadwal servis AC diubah ke {{tanggal}} pukul {{jam}}. Mohon konfirmasinya ya. — {{usaha}}"
- **on_the_way**: "Halo {{customer}}, teknisi {{teknisi}} sedang menuju lokasi Anda untuk servis AC {{unit}}. — {{usaha}}"
- **review**: "Terima kasih {{customer}} 🙏 Servis AC sudah selesai. Boleh bantu beri ulasan singkat pengalaman Anda? — {{usaha}}"
- **lead_followup**: "Halo {{customer}}, menindaklanjuti kebutuhan servis AC Anda. Apakah boleh kami bantu jadwalkan? — {{usaha}}"
- **campaign**: "Halo {{customer}}, promo servis AC dari {{usaha}}. Hubungi kami untuk jadwal ya!"
- **iot_alert_offer**: "Halo {{customer}}, sistem kami mendeteksi AC {{unit}} perlu pengecekan. Boleh kami kirim teknisi? — {{usaha}}"

---

# 5. IoT — THRESHOLD & COMMAND

## 5.1 Deteksi anomali → Alert (rule engine di ingest)
| AlertType | Kondisi default | Severity |
|---|---|---|
| OVERCURRENT | currentA > baseline × **1.3** selama > **5 menit** (baseline = rata-rata 7 hari) | WARNING; > ×1.6 → CRITICAL |
| NO_COOLING | mode cooling & tempC tidak turun ≥ **2°C** dalam **20 menit** setelah ON | WARNING |
| OFFLINE | tidak ada heartbeat > **2 jam** | INFO; > 24 jam → WARNING |
| SENSOR_FAULT | pembacaan di luar rentang wajar (mis. tempC < -10 atau > 60) | WARNING |

- Alert baru = upsert OPEN (tak duplikat per device+type yang masih OPEN).
- Alert → tampil di S-O9 → [Buat Job dari Alert] (source=IOT).

## 5.2 Telemetry
- Interval kirim default: **60 detik** (heartbeat), telemetry penuh tiap **5 menit**; buffer saat offline, kirim ulang saat online.
- Retensi: raw **90 hari**, agregat harian lebih lama (ops).

## 5.3 Command → Verify (timeout)
- COMMAND_SENT → tunggu ACK maks **10 detik**; tak ada → FAILED.
- ACKNOWLEDGED → tunggu evidence (telemetry mencerminkan perubahan) maks **60 detik** → STATE_CONFIRMED; tak ada → tetap ACKNOWLEDGED dgn label "menunggu konfirmasi", auto-FAILED setelah 5 menit.
- Evidence rule per command: `set_temp` → tempC/target tercermin; `power on/off` → currentA naik/turun sesuai; `mode` → (bila tak terukur) cukup ACK + tandai "tidak dapat diverifikasi penuh".

---

# 6. FEATURE GATING PER PAKET (menjual "seberapa banyak loop")

| Kapabilitas | Starter (Rp199k) | Growth (Rp399k) | Pro (Rp699k) |
|---|---|---|---|
| Max teknisi | 3 | 8 | tak terbatas (wajar) |
| FSM + progress + technician app (L2) | ✅ | ✅ | ✅ |
| Money loop: reminder + repeat (L0) | ✅ | ✅ | ✅ |
| Smart scheduling feasibility (L2) | dasar | ✅ | ✅ |
| Dynamic re-planning | ❌ | ✅ | ✅ |
| Growth engine (L1: lead/referral/review/campaign) | lead saja | ✅ | ✅ |
| Performance + cohort metrics (L4) | ringkas | ✅ | ✅ lengkap |
| IoT add-on (L3) | opsi | opsi | opsi |
| IoT device add-on | ±Rp75–125k/device/bln (semua paket) | | |

Gating ditegakkan di backend (per endpoint/limit), bukan hanya UI. Angka pricing = hipotesis, subject to pilot.

---

# 7. OTP, SECURITY, LIMITS

| Parameter | Default |
|---|---|
| Kode OTP | 4 digit, kadaluarsa 5 menit |
| Rate limit OTP | 1 req / 60 dtk / phone; 5 / jam |
| Access token | 15 menit; refresh 30 hari |
| PIN teknisi | 6 digit, argon2 |
| Upload foto | maks 5 MB, auto-kompres ke ~1280px, format jpg/webp |
| Pagination limit | default 20, maks 100 |
| Timezone | per-tenant; default Asia/Makassar (WITA) — bisa diubah |
| Bahasa | id-ID default |

---

# 8. METRIK — DEFINISI PERHITUNGAN (agar konsisten)

- **completion rate** = COMPLETED / (semua job non-DRAFT non-CANCELLED) dalam periode.
- **on-time %** = job yang IN_PROGRESS dimulai ≤ windowEnd / total job dimulai.
- **repeat customer** = customer dengan ≥2 job COMPLETED.
- **repeat-order uplift %** = (repeat job dari reminder yang CONVERTED / reminder terkirim) × 100.
- **revenue** = Σ price job COMPLETED dalam periode.
- **ARPA** = MRR / jumlah tenant aktif (level perusahaan, untuk investor).
- **source→revenue** = Σ price COMPLETED dikelompokkan customer.source.
Semua dihitung dari event/timestamp (JobProgressEvent, completedAt) — tidak ada input manual.

---

# 9. RINGKASAN: APAKAH SEKARANG CUKUP UNTUK MEMBANGUN LENGKAP?

Dengan tiga part Build Spec Pack ini + PRD v1.0/v1.1, gap utama tertutup:
- ✅ Skema data implementasi (tipe, constraint, index, enum) — Part 1
- ✅ State machine lengkap dgn guard & efek — Part 1 §3
- ✅ Kontrak API (req/res, error, MQTT) — Part 1 §4
- ✅ Screen spec per persona + alur — Part 2
- ✅ Business rules & default konkret — Part 3

Yang tetap harus dilakukan saat build (normal, bukan gap spec): setup infra nyata, desain visual/branding final, kalibrasi angka saat pilot, dan keputusan low-risk yang aman diserahkan ke dev/AI (Part 1 §5).

**Kesimpulan: ya — dengan pack ini, spesifikasi sudah cukup untuk 1 developer + Agentic AI membangun aplikasi lengkap v1.0 tanpa menebak keputusan yang menular ke seluruh kodebase.**
