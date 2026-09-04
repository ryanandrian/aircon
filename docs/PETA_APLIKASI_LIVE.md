# Peta Aplikasi Aircon — LIVE (Domain Baru airconet.id)

> Revisi per migrasi VPS. Domain lama Vercel (`aircon-peach.vercel.app`) MASIH jalan paralel
> (DB Supabase sama) sebagai cadangan/rollback — tapi domain resmi mulai sekarang di bawah.

## Base URL
- **Marketing / Landing:** `https://airconet.id`
- **Aplikasi (semua login + panel):** `https://app.airconet.id`

Pemisahan ini disengaja: root = halaman jualan publik; `app.` = seluruh aplikasi ber-sesi
(owner, teknisi, admin, agen, reseller). Pola ini dipakai ulang untuk SaaS berikutnya.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🌐 PUBLIK — bisa langsung dibuka siapa saja
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
| Halaman | URL |
|---|---|
| Landing (jual outcome + ROI) | https://airconet.id/ |
| Demo produk (pratinjau/showcase) | https://app.airconet.id/pratinjau |
| Login owner (Google) | https://app.airconet.id/login |
| Login teknisi (phone+PIN) | https://app.airconet.id/masuk-teknisi |
| Login portal agen | https://app.airconet.id/agen/login |
| Login portal reseller | https://app.airconet.id/reseller/login |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 👔 OWNER TENANT (login Google dulu)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
| Halaman | Path |
|---|---|
| Dashboard utama | https://app.airconet.id/app |
| Pekerjaan (job) | /app/pekerjaan |
| Buat pekerjaan | /app/pekerjaan/baru |
| Kelola teknisi | /app/teknisi |
| Pemantauan AC (IoT) | /app/perangkat |
| Langganan & bayar | /app/langganan |
| Template pesan WA ⭐ | /app/pesan |
| Checklist servis ⭐ | /app/checklist |
| Pengaturan + Hubungkan WhatsApp ⭐ | /app/pengaturan |
| Onboarding (setup usaha) | /onboarding |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔧 TEKNISI (login phone+PIN)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
| Halaman | Path |
|---|---|
| Pekerjaan hari ini | https://app.airconet.id/t |
| Detail + checklist + foto | /t/pekerjaan/[id] |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🛡️ PLATFORM ADMIN (Lumite — akun ryan.andrian.diputra@gmail.com)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
| Halaman | Path |
|---|---|
| Ringkasan admin | https://app.airconet.id/admin |
| Kelola tenant | /admin/tenants |
| Notifikasi Platform ⭐ (autopilot + Hubungkan WA Lumite) | /admin/notifikasi |
| Paket & harga | /admin/paket |
| Kebijakan billing + dunning | /admin/kebijakan |
| Profil perusahaan (Lumite) | /admin/perusahaan |
| Produk & pesanan IoT | /admin/iot |
| Program keagenan | /admin/keagenan |
| Konfigurasi Infra (WA/MQTT) ⭐ | /admin/infra |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🤝 PORTAL AGEN / RESELLER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
| Halaman | Path |
|---|---|
| Dashboard agen | https://app.airconet.id/agen |
| Kelola reseller | /agen/reseller |
| Dashboard reseller | https://app.airconet.id/reseller |
| Daftar reseller (publik) | /reseller/daftar/[joinCode] |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🏪 HALAMAN USAHA TENANT (publik, per tenant)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Etalase booking pelanggan:
`https://app.airconet.id/p/[slug-usaha]`
(contoh nyata muncul setelah ada tenant terdaftar)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ⚙️ INFRASTRUKTUR (bukan halaman, tapi live)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
| Komponen | URL / Detail |
|---|---|
| Aplikasi (VPS BiznetGio) | https://app.airconet.id — 103.127.135.132, Node 22, systemd `aircon-app`, TLS Let's Encrypt |
| Gateway WhatsApp+MQTT (HTTPS) | https://gw.lumite.biz.id/health — VPS 103.127.138.16 (`wa-mqtt-gateway`) |
| Database | Supabase Postgres (bersama Vercel & VPS) |
| Media / foto | S3 BiznetGio (`nos.jkt-1.neo.id/aircon`) |
| Email platform | SMTP admin@lumite.biz.id (notifikasi Lumite→tenant) |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## Catatan Login (multi-peran)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- **Owner & Platform Admin:** login Google (beda tabel: owner→tenant, admin→PlatformAdmin).
- **Teknisi:** phone + PIN (bukan Google) — `/masuk-teknisi`.
- **Agen / Reseller:** login portal sendiri (cookie partner, bukan Supabase).
- Cookie login terikat per-domain: sesi lama di `aircon-peach.vercel.app` TIDAK terbawa ke
  `app.airconet.id`. Tiap domain login sendiri, keduanya valid (DB sama).

_Domain lama `aircon-peach.vercel.app` tetap aktif sementara sebagai rollback. Setelah masa
pemantauan stabil, bisa dinonaktifkan._
