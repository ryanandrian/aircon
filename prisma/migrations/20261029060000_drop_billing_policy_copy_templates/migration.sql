-- G23 — retire kolom copy pesan di `BillingPolicy`.
--
-- DASAR: copy tenant→pelanggan (dunning reminder/warning + inactivity 1/2)
-- sekarang HANYA ADA di katalog platform `PlatformTemplate` (diedit admin di
-- Admin → Notifikasi → Template). Kolom BillingPolicy adalah SALINAN warisan:
-- dua sumber kebenaran untuk isi yang sama — bisa berbeda isi tanpa jejak.
--
-- SAFETY (preadaan terverifikasi, read-only ke DB produksi 2026-10-29):
--  - Baris `BillingPolicy` singleton: ke-4 kolom copy PERSIS sama dengan
--    default schema (tak ada suntingan admin yang hilang).
--  - `PlatformTemplate` punya 4 baris `tenant_*` v1 dengan body identik
--    (hanya `{}` → `{{}}`), `updatedBy: migrate:billing-policy->katalog`.
--  - Kode produksi (release R1) tak lagi membaca/menulis kolom ini:
--    `resolveTenantCopy(key)` membaca katalog saja; `billingPolicySchema`
--    tak punya field copy; `updateBillingPolicy` menulis `...data` tanpa kolom itu.
--  - Admin → Kebijakan hanya menampilkan tautan ke Admin → Notifikasi.
--
-- ROLLBACK (nilai tak bisa dipulihkan otomatis — sudah di-backup logis sebelum
-- migrasi; default kolom juga mengarahkan ke kalimat yang sama):
--   ALTER TABLE "BillingPolicy"
--     ADD COLUMN "dunningReminderTemplate" TEXT NOT NULL DEFAULT 'Halo {nama}, langganan Aircon Anda jatuh tempo dan menunggak {telat} hari. Mohon segera perpanjang agar layanan tidak terputus.',
--     ADD COLUMN "dunningWarningTemplate" TEXT NOT NULL DEFAULT 'Halo {nama}, langganan Aircon Anda menunggak {telat} hari. PERINGATAN: bila tidak dibayar dalam {sisa} hari lagi, data usaha Anda akan dihapus permanen. Segera perpanjang untuk menghindari kehilangan data.',
--     ADD COLUMN "inactivityReminder1Template" TEXT NOT NULL DEFAULT 'Halo {nama}, akun Aircon Anda belum ada aktivitas selama {hari} hari. Kami menantikan Anda kembali — buka aplikasi kapan saja untuk melanjutkan.',
--     ADD COLUMN "inactivityReminder2Template" TEXT NOT NULL DEFAULT 'Halo {nama}, akun Aircon Anda sudah {hari} hari tanpa aktivitas. PERINGATAN: bila tetap tidak digunakan, akun beserta seluruh data akan DIHAPUS PERMANEN dalam {sisa} hari. Buka aplikasi untuk membatalkan penghapusan.';
--
-- Setara semantik dengan `prisma migrate diff --from-schema <schema-lama>
-- --to-schema prisma/schema.prisma --script` (output: 1 × ALTER TABLE DROP COLUMN ×4).
ALTER TABLE "BillingPolicy"
  DROP COLUMN IF EXISTS "dunningReminderTemplate",
  DROP COLUMN IF EXISTS "dunningWarningTemplate",
  DROP COLUMN IF EXISTS "inactivityReminder1Template",
  DROP COLUMN IF EXISTS "inactivityReminder2Template";
