# VPS-INFRA — Deploy NATIVE (systemd, TANPA Docker)

> Dipakai untuk aircon (VPS BiznetGio 103.127.138.16, Ubuntu 22.04, 4GB). Dipilih karena
> lebih hemat RAM daripada Docker (~200MB overhead dihindari) & lebih sederhana untuk
> 2-3 service di VPS kecil. Alternatif Docker ada di `../docker-compose.yml`.

## Status terpasang (per deploy pertama)
3 service systemd, semua `enabled` (auto-start reboot):
- `mosquitto` — MQTT broker (auth wajib, anonymous off, listener 127.0.0.1:1883)
- `aircon-gateway` — WhatsApp gateway :8080 (MemoryMax 2500M, profil 4GB)
- `aircon-bridge` — IoT bridge MQTT->ingest (MemoryMax 256M)
RAM idle: ~275MB / 3.8GB. Swap 2GB aktif.

## Isi folder
- `provision-native.sh` — provisioning idempoten dari VPS bersih (swap, Node, Mosquitto,
  Chromium deps, firewall, npm install, transpile bridge, pasang service). `PROFILE=4gb|8gb`.
- `aircon-gateway.service`, `aircon-bridge.service` — template unit systemd (sumber kebenaran).
- `redeploy.sh` — kirim update kode dari repo -> VPS + restart (jalankan dari mesin dev).

## Deploy dari nol (VPS baru)
```bash
# 1) Dari mesin dev: kirim kode + folder native
scp -i ~/.ssh/aircon-ssh.pem -r apps/messaging-gateway apps/iot-bridge rad4ssh@IP:~/infra/
scp -i ~/.ssh/aircon-ssh.pem -r infra/vps-infra/native rad4ssh@IP:~/infra/
# 2) Isi .env (lihat apps/*/.env.example) — GATEWAY_APPS, IOT_BRIDGE_TOKEN, dst.
# 3) Di VPS: buat user MQTT lalu provision
ssh -i ~/.ssh/aircon-ssh.pem rad4ssh@IP
sudo mosquitto_passwd -b -c /etc/mosquitto/passwd aircon_devices '<PASSWORD>'
PROFILE=4gb bash ~/infra/native/provision-native.sh
```

## Operasi harian
```bash
sudo systemctl status aircon-gateway          # status
sudo journalctl -u aircon-gateway -f          # log realtime
sudo systemctl restart aircon-gateway         # restart
free -h ; systemctl show aircon-gateway -p MemoryCurrent --value  # RAM
```

## Naik profil 4GB -> 8GB (tanpa migrasi)
1. Resize VPS di panel BiznetGio (RAM 4->8GB).
2. Edit `/etc/systemd/system/aircon-gateway.service`: `MemoryMax=6G`, `MemoryHigh=5500M`.
3. Edit `~/infra/messaging-gateway/.env`: `WA_MAX_LIVE_SESSIONS=15`.
4. `sudo systemctl daemon-reload && sudo systemctl restart aircon-gateway`.

## Tautkan nomor WhatsApp (per tenant)
App memanggil `POST /v1/wa/sessions/{tenantId}/init` (X-Api-Key) → QR → scan di HP.
Lihat `docs/infra/10_WhatsApp_Gateway_Integration_Guide.md`.

## Catatan keamanan
- Gateway saat pilot = HTTP di IP publik, dilindungi API key (401 tanpa key).
- Produksi: pasang domain + nginx + TLS (Let's Encrypt) di depan :8080, ganti WA_GATEWAY_URL ke https://.
- Kredensial lokal: `.secrets/vps-infra-credentials.txt` (gitignored).
