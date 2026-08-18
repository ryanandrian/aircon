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
docker compose up -d --build
curl http://localhost:8080/health     # {ok:true,...}
docker compose logs -f messaging-gateway
```

## 4. Tautkan sesi WA (per nomor/tenant)
- App memanggil `POST /v1/wa/sessions/{externalId}/init` → dapat QR → user scan.
- Atau lihat QR di log gateway saat pertama init.
- Sesi tersimpan di volume `wa_sessions` (tahan restart).

## 5. Produksi: nginx + TLS di depan gateway
Pasang nginx reverse-proxy `gateway.<domain>` → `localhost:8080`, TLS via certbot.
Batasi akses `/v1` ke IP VPS-APP / Vercel egress bila memungkinkan (defense in depth).

## 6. Monitoring & pemeliharaan
- Healthcheck compose sudah aktif (restart bila mati).
- Pantau RAM: `docker stats`. Bila mendekati limit → tambah RAM atau migrasi Cloud API.
- Rotasi log Docker (`/etc/docker/daemon.json` `log-opts` max-size).
- Snapshot VPS berkala (volume `wa_sessions` = aset berharga: sesi tertaut).

## 7. Menambah app baru ke gateway (tim developer)
1. Tambah entri ke `GATEWAY_APPS` di `.env` (id, key acak, webhook app).
2. `docker compose up -d` (reload). 3. Beri key ke developer app tsb.
4. Developer ikuti `docs/infra/10_WhatsApp_Gateway_Integration_Guide.md`.
