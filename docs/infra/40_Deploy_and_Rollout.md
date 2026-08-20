# Deploy & Rollout VPS-INFRA (runbook)

## 1. Provision VPS (BiznetGio Ubuntu 22.04)
```bash
# sebagai root di VPS bersih
apt-get update -y && apt-get install -y docker.io docker-compose-plugin git ufw
systemctl enable --now docker
# firewall: buka 22 (SSH), 8080 (gateway; batasi ke IP app/nginx), 8883 (MQTT TLS)
ufw allow 22/tcp && ufw allow 8883/tcp && ufw enable
```

## 2. Ambil repo & konfigurasi
```bash
git clone <repo> /opt/aircon && cd /opt/aircon/infra/vps-infra
cp ../../apps/messaging-gateway/.env.example ../../apps/messaging-gateway/.env
# EDIT .env: isi GATEWAY_APPS (id/key/webhook tiap app). Buat key: openssl rand -hex 24
# Mosquitto: buat password
docker run --rm -v $PWD/mosquitto/config:/c eclipse-mosquitto:2 \
  mosquitto_passwd -b -c /c/passwd aircon_devices '<pass-kuat>'
```

## 3. Jalankan
```bash
# Cara termudah (idempoten, sekaligus swap+firewall+log-limit):
export REPO_URL=<git-url>
PROFILE=4gb bash provision.sh          # VPS 4GB (uji/pilot). Ganti PROFILE=8gb saat tumbuh.

# Atau manual:
docker compose --env-file infra.env.4gb up -d --build
curl http://localhost:8080/health      # {ok:true,...}
docker stats --no-stream               # pantau RAM aktual
```
Profil resource:
- **infra.env.4gb** — VPS 4GB (~Rp180rb/bln): gateway 2500m + mqtt 128m + bridge 192m ≈ 2,8GB
  + OS ~600MB, sisa ~700MB + swap 2GB. Muat ~5-6 sesi WhatsApp (set WA_MAX_LIVE_SESSIONS=6).
- **infra.env.8gb** — VPS 8GB (Rp269rb/bln): gateway 6g, muat ~15 sesi (WA_MAX_LIVE_SESSIONS=15).

## 3a. Naik dari 4GB → 8GB TANPA migrasi
1. Resize instance di panel BiznetGio (RAM 4→8GB) — reboot singkat, data volume tetap.
2. Set `WA_MAX_LIVE_SESSIONS=15` di `apps/messaging-gateway/.env`.
3. `docker compose --env-file infra.env.8gb up -d` — selesai. Tanpa pindah server, tanpa kehilangan sesi WA.

## 4. Tautkan sesi WA (per nomor/tenant)
- App memanggil `POST /v1/wa/sessions/{externalId}/init` → dapat QR → user scan.
- Atau lihat QR di log gateway saat pertama init.
- Sesi tersimpan di volume `wa_sessions` (tahan restart).

## 5. Produksi: nginx + TLS di depan gateway
Pasang nginx reverse-proxy `gw.<domain>` → `localhost:8080`, TLS via certbot (Let's Encrypt gratis).
Template: `infra/vps-infra/native/gw.conf`. Contoh live aircon (gw.lumite.biz.id):
```bash
# DNS: buat A record gw.<domain> -> <IP VPS> (di panel DNS domain, mis. idcloudhost)
sudo apt-get install -y certbot python3-certbot-nginx
sudo cp gw.conf /etc/nginx/sites-available/gw.conf
sudo ln -sf /etc/nginx/sites-available/gw.conf /etc/nginx/sites-enabled/gw.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d gw.<domain> --agree-tos -m info@<domain> --redirect  # SSL gratis + auto-renew
# Setelah HTTPS aktif, tutup akses langsung ke 8080 (hanya via nginx):
sudo ufw delete allow 8080/tcp
```
SSL sub-domain (gw.) TIDAK bentrok dengan cert domain utama (beda hostname, beda server).
Lalu set `WA_GATEWAY_URL=https://gw.<domain>` di ENV app + redeploy.

## 6. Monitoring & pemeliharaan
- Healthcheck compose sudah aktif (restart bila mati).
- Pantau RAM: `docker stats`. Bila mendekati limit → tambah RAM atau migrasi Cloud API.
- Rotasi log Docker (`/etc/docker/daemon.json` `log-opts` max-size).
- Snapshot VPS berkala (volume `wa_sessions` = aset berharga: sesi tertaut).

## 7. Menambah app baru ke gateway (tim developer)
1. Tambah entri ke `GATEWAY_APPS` di `.env` (id, key acak, webhook app).
2. `docker compose up -d` (reload). 3. Beri key ke developer app tsb.
4. Developer ikuti `docs/infra/10_WhatsApp_Gateway_Integration_Guide.md`.
