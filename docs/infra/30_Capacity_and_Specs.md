# Kapasitas & Spek VPS-INFRA / VPS-APP (referensi cepat)

## Ringkas sizing (dari docs/Capacity_Planning.md + Infra_Decision)
Pendorong RAM VPS-INFRA = **TOTAL sesi WhatsApp lintas SEMUA app** (~400MB/sesi Chromium).
MQTT & app hampir tak berkontribusi.

`RAM VPS-INFRA ≈ 2GB (tetap) + (Σ sesi WA semua app × 0,4GB)`

| Total sesi WA (semua app) | RAM INFRA | Spek BiznetGio | Perkiraan |
|---|---|---|---|
| ≤ 15 (pilot) | ~8GB | **4C/8GB/60GB (MM 8.4)** | **Rp269rb/bln ← BELI SEKARANG** |
| ~30 | ~14GB | 8C/16GB | ~Rp500–600rb/bln |
| ~100 (waweb.js) | ~42GB | 16C/48–64GB | ~Rp1,5–2,5jt/bln (hindari) |
| ~100 (Cloud API) | ~4–6GB | **8GB cukup** | **Rp269rb/bln** |

**VPS-APP** (Next.js stateless, data di Supabase/S3): kecil.
| Isi | Spek | Perkiraan |
|---|---|---|
| aircon saja | 2C/4GB | ~Rp150–200rb |
| aircon + beberapa app | 4C/8GB (MM 8.4) | ~Rp269rb |

## Rencana pembelian
- **Sekarang:** 1× VPS-INFRA **MM 8.4 (8GB) Rp269rb/bln**. aircon-app tetap Vercel (gratis).
- **Go-komersial:** + 1× VPS-APP (mulai 4GB, naik ke 8GB saat multi-app). Total ~Rp420–540rb/bln
  untuk SELURUH portofolio.
- **Gerbang skala:** sebelum Σ sesi WA > ~25–30, tukar mesin gateway ke **WhatsApp Cloud API**
  (sekali, semua app ikut) → INFRA balik ke 8GB untuk 100+ tenant.

## Storage
- VPS-INFRA: OS ~8GB + sesi WA (~50–150MB/sesi, volume `wa_sessions`) + log. 60GB cukup lama;
  rotasi log + bersihkan cache Chromium berkala.
- VPS-APP: OS + build artifact. 40–60GB cukup. **Data besar (DB, foto) TIDAK di VPS**
  (Supabase Tokyo + S3 BiznetGio).

## Batas & sinyal upgrade
- RAM INFRA > 80% ATAU sesi WA sering OOM → naikkan RAM atau percepat migrasi Cloud API.
- CPU INFRA tinggi saat banyak QR/reconnect → normal sesaat; persisten → tambah core.
