# Panduan: Branding OAuth Google "Aircon" (hilangkan kesan Supabase)

Tujuan: saat rekanan klik "Lanjutkan dengan Google", layar consent menampilkan **"Aircon"** + logo,
bukan nama proyek/Supabase. GRATIS, tanpa ubah kode. ~15-20 menit.

## Yang berubah vs tidak
- ✅ BERUBAH (gratis): Nama app "Aircon" + logo di layar consent Google ("Sign in to continue to **Aircon**").
- ❌ TIDAK hilang (kecuali bayar): teks domain `ksvdjtzfpictmwuksmuu.supabase.co` kecil di bawah — itu URL
  callback Supabase. Menghilangkannya butuh **Supabase Custom Domain add-on (~US$10/bln)** → tunda sampai ada revenue.

## Prasyarat
- Akses ke Google Cloud Console (akun: ryan.andrian.diputra@gmail.com atau pemilik proyek).
- Akses Supabase Dashboard proyek `ksvdjtzfpictmwuksmuu`.
- Logo Aircon (PNG, ideal 120x120px, latar putih/transparan).

## LANGKAH A — OAuth Consent Screen (nama + logo)
1. Buka https://console.cloud.google.com → pilih proyek (atau buat proyek baru "Aircon").
2. Menu **APIs & Services → OAuth consent screen**.
3. User Type: **External** → Create.
4. Isi:
   - App name: **Aircon**
   - User support email: email Anda
   - App logo: upload logo Aircon (opsional tapi disarankan — memicu verifikasi bila domain belum terverifikasi; untuk pilot boleh skip logo dulu agar tak perlu verifikasi).
   - App domain → Application home page: `https://app.airconet.id`
   - Authorized domains: `airconet.id`
   - Developer contact: email Anda
5. Scopes: cukup default (email, profile, openid) → Save.
6. Publishing status: untuk pilot, biarkan **Testing** (tambah email rekanan sbg test users) ATAU
   klik **Publish app** agar semua orang bisa login (tanpa logo → tak perlu verifikasi Google;
   dengan logo/domain sensitif → mungkin diminta verifikasi).

   > Rekomendasi pilot: Publish TANPA logo custom dulu → langsung bisa dipakai siapa saja, "Aircon" tampil, tanpa proses verifikasi.

## LANGKAH B — OAuth Client ID (hubungkan ke Supabase)
1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Application type: **Web application**. Name: "Aircon Web".
3. **Authorized redirect URIs** — tambahkan (WAJIB persis):
   ```
   https://ksvdjtzfpictmwuksmuu.supabase.co/auth/v1/callback
   ```
4. Create → salin **Client ID** + **Client Secret**.

## LANGKAH C — Pasang ke Supabase
1. Supabase Dashboard → proyek `ksvdjtzfpictmwuksmuu` → **Authentication → Providers → Google**.
2. Enable, tempel **Client ID** + **Client Secret** dari langkah B → Save.
3. **Authentication → URL Configuration** → pastikan:
   - Site URL: `https://app.airconet.id`
   - Redirect URLs berisi: `https://app.airconet.id/**` (JANGAN hapus yang sudah ada).

## LANGKAH D — Uji
1. Buka https://app.airconet.id (mode incognito) → "Lanjutkan dengan Google".
2. Layar consent harus tampil **"Aircon"** (bukan nama proyek lama).
3. Login → harus masuk /app atau /onboarding normal.

## Catatan
- Bila layar masih tampil nama lama: tunggu ~5 menit (propagasi) atau cek App name sudah "Aircon" & di-Save.
- Custom domain Supabase (auth.airconet.id, ~$10/bln): Supabase Dashboard → Settings → Custom Domains.
  Lakukan HANYA setelah ada revenue. Setelah aktif, redirect URI di Google Console ganti ke domain baru.
- SEMUA ini config eksternal (Google/Supabase), TIDAK menyentuh kode Aircon.
