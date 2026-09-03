/**
 * WaManager — pool sesi WhatsApp (whatsapp-web.js) multi-app + antrean + PROTEKSI ANTI-BAN.
 *
 * FOKUS: gateway NOTIFIKASI (transaksional/opt-in), BUKAN blasting promosi. Mekanisme:
 *  RINGAN (RAM):
 *   - Batas sesi Chromium hidup (maxLiveSessions) + evict sesi idle (idleEvictMs).
 *  AMAN (anti-ban):
 *   - Throttle laju (jeda acak manusiawi) + batas per-menit per nomor.
 *   - Plafon HARIAN per nomor + WARM-UP nomor baru (ramp bertahap).
 *   - Jam tenang (tunda kirim tengah malam).
 *   - Dedup pesan identik (cegah kirim ganda tak sengaja).
 *
 * Sesi di-namespace "{appId}:{externalId}". Status/inbound via webhook app.
 * Ganti mesin (Cloud API) cukup ganti kelas ini; kontrak publik tetap.
 */
import pkg from "whatsapp-web.js";
import qrcodeTerminal from "qrcode-terminal";
import QRCode from "qrcode";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { webhookOf } from "./auth.js";
import { policy, isQuietHour, dailyCap, dayKey } from "./policy.js";

const { Client, LocalAuth } = pkg;

const SESSION_DIR = process.env.WA_SESSION_DIR ?? "./.wwebjs_auth";
const TICK_MS = Number(process.env.WA_TICK_MS ?? 3000);
// Antrean di-PERSIST ke disk agar tahan restart (in-memory saja rawan hilang saat service di-restart).
const QUEUE_FILE = process.env.WA_QUEUE_FILE ?? path.join(SESSION_DIR, "queue.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => Math.floor(a + Math.random() * (b - a));
const chatId = (phone) => `${String(phone).replace(/[^0-9]/g, "")}@c.us`;

/**
 * Bungkus promise dengan timeout. KRUSIAL: getNumberId/sendMessage whatsapp-web bisa
 * MENGGANTUNG selamanya bila koneksi internal setengah-terbuka (mis. pasca-restart).
 * Karena _drain di-await di loop, satu panggilan menggantung MEMBEKUKAN seluruh pengirim.
 * Timeout mengubah "hang" jadi error yang tertangkap → loop tetap hidup.
 */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout ${label} (${ms}ms)`)), ms)),
  ]);
}
const SEND_TIMEOUT_MS = Number(process.env.WA_SEND_TIMEOUT_MS ?? 30000);

export class WaManager {
  constructor({ apps }) {
    this.apps = apps;
    this.sessions = new Map();      // sid -> state
    this.queue = [];                // { id, sid, appId, externalId, toPhone, message, hash }
    this.recentHashes = new Map();  // hash -> expiryMs (dedup)
    this._loadQueue();              // pulihkan antrean yang belum terkirim dari restart sebelumnya
  }

  sessionCount() { return this.sessions.size; }
  _sid(appId, externalId) { return `${appId}:${externalId}`; }

  /** Muat antrean dari disk (tahan restart). Aman bila file tak ada / rusak. */
  _loadQueue() {
    try {
      if (!fs.existsSync(QUEUE_FILE)) return;
      const arr = JSON.parse(fs.readFileSync(QUEUE_FILE, "utf8"));
      if (Array.isArray(arr)) {
        this.queue = arr;
        if (arr.length) console.log(`[gateway] antrean dipulihkan dari disk: ${arr.length} pesan`);
      }
    } catch (e) { console.error("[gateway] gagal muat antrean:", e.message); }
  }

  /** Simpan antrean ke disk (atomic via tmp+rename) supaya tak korup saat crash. */
  _saveQueue() {
    try {
      fs.mkdirSync(path.dirname(QUEUE_FILE), { recursive: true });
      const tmp = `${QUEUE_FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.queue));
      fs.renameSync(tmp, QUEUE_FILE);
    } catch (e) { console.error("[gateway] gagal simpan antrean:", e.message); }
  }

  /**
   * ANTISIPASI REBOOT MENDADAK — hapus file lock Chromium basi.
   * whatsapp-web.js memakai profil Chromium di SESSION_DIR/session-{clientId}. Saat mesin
   * mati mendadak (listrik/panel provider/crash), Chromium tak sempat shutdown bersih →
   * file SingletonLock/SingletonSocket/SingletonCookie tertinggal. Saat start berikutnya
   * Chromium menolak ("profile appears to be in use") dan sesi TAK PERNAH READY.
   * Aman dihapus: dipanggil TEPAT sebelum start sesi baru, saat tak ada proses yang memakainya.
   */
  _cleanStaleLocks(clientId) {
    const profileDir = path.join(SESSION_DIR, `session-${clientId}`);
    for (const name of ["SingletonLock", "SingletonSocket", "SingletonCookie"]) {
      try {
        const p = path.join(profileDir, name);
        if (fs.existsSync(p) || fs.lstatSync(p, { throwIfNoEntry: false })) {
          fs.rmSync(p, { force: true });
        }
      } catch { /* lock tak ada / sudah bersih — abaikan */ }
    }
  }

  /**
   * REHIDRASI PASCA-REBOOT — bangunkan kembali sesi yang auth-nya tersimpan di disk,
   * TANPA menunggu pemicu manual, supaya gateway "langsung ready" setelah restart.
   * Memindai SESSION_DIR untuk folder session-{appId}_{externalId}, lalu initSession tiap sesi
   * yang appId-nya terdaftar. whatsapp-web.js reconnect dari auth tersimpan (tanpa QR bila valid).
   */
  async rehydrate() {
    let dirs = [];
    try {
      dirs = fs.readdirSync(SESSION_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name.startsWith("session-"))
        .map((d) => d.name.slice("session-".length));
    } catch { return; }
    const appIds = new Set(this.apps.map((a) => a.id));
    let n = 0;
    for (const clientId of dirs) {
      // clientId = "{appId}_{externalId}" (khusus non-alnum di externalId sudah di-sanitize jadi "_").
      const us = clientId.indexOf("_");
      if (us <= 0) continue;
      const appId = clientId.slice(0, us);
      const externalId = clientId.slice(us + 1);
      if (!appIds.has(appId)) continue;         // app tak terdaftar → lewati
      if (this.sessions.has(this._sid(appId, externalId))) continue;
      try {
        await this.initSession(appId, externalId); // reconnect dari auth (bersih lock dulu di dalam)
        n += 1;
      } catch (e) { console.error(`[gateway] rehydrate ${clientId} gagal:`, e.message); }
    }
    if (n) console.log(`[gateway] rehidrasi sesi tersimpan: ${n} sesi dibangunkan pasca-restart`);
  }

  async _callback(appId, payload) {
    const url = webhookOf(this.apps, appId);
    if (!url) return;
    try {
      await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } catch (e) { console.error(`[gateway] webhook ${appId} gagal:`, e.message); }
  }

  async initSession(appId, externalId) {
    const sid = this._sid(appId, externalId);
    if (this.sessions.has(sid)) {
      const st = this.sessions.get(sid);
      st.lastUsed = Date.now();
      return { sessionId: sid, ready: st.ready, qr: st.qrDataUrl ?? null };
    }
    // HEMAT RAM: bila sudah di batas sesi hidup, evict yang paling lama idle & belum aktif kirim.
    this._evictIfNeeded();

    const clientId = sid.replace(/[^a-zA-Z0-9_-]/g, "_");
    // ANTISIPASI REBOOT MENDADAK: hapus lock Chromium basi sebelum start, jika tidak
    // Chromium menolak start ("profile appears to be in use") → sesi tak pernah READY.
    this._cleanStaleLocks(clientId);

    const client = new Client({
      authStrategy: new LocalAuth({ clientId, dataPath: SESSION_DIR }),
      puppeteer: {
        headless: true,
        args: [
          "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
          // Hemat RAM (penting untuk VPS kecil 4GB):
          "--disable-gpu", "--no-first-run", "--no-zygote",
          "--disable-extensions", "--disable-background-networking",
          "--disable-default-apps", "--disable-sync", "--mute-audio",
          "--js-flags=--max-old-space-size=256",
        ],
      },
    });
    const state = {
      client, ready: false, qr: null, qrDataUrl: null,
      sentTimestamps: [],                 // untuk throttle per-menit
      dayCount: 0, dayKey: dayKey(),      // untuk plafon harian
      firstSeenMs: null,                  // untuk warm-up (diisi saat ready pertama, persist via meta)
      lastUsed: Date.now(), appId, externalId, sid,
    };
    this.sessions.set(sid, state);

    client.on("qr", async (qr) => {
      state.qr = qr;
      try { state.qrDataUrl = await QRCode.toDataURL(qr); } catch { state.qrDataUrl = null; }
      qrcodeTerminal.generate(qr, { small: true });
      await this._callback(appId, { type: "qr", externalId, qr: state.qrDataUrl });
    });
    client.on("ready", async () => {
      state.ready = true; state.qr = null; state.qrDataUrl = null;
      if (!state.firstSeenMs) state.firstSeenMs = Date.now(); // mulai warm-up saat nomor pertama tertaut
      console.log(`[gateway] ${sid} READY`);
      await this._callback(appId, { type: "ready", externalId });
    });
    client.on("disconnected", async (r) => {
      state.ready = false;
      this.sessions.delete(sid);
      await this._callback(appId, { type: "disconnected", externalId, reason: String(r) });
    });
    client.on("message", async (msg) => {
      const from = String(msg.from).replace(/@c\.us$/, "");
      console.log(`[gateway] INBOUND ${from} → ${sid}`);
      await this._callback(appId, { type: "inbound", externalId, fromPhone: from, body: msg.body ?? "" });
    });

    await client.initialize();
    return { sessionId: sid, ready: false, qr: state.qrDataUrl ?? null };
  }

  /** Tutup sesi paling lama idle bila melebihi batas sesi hidup (hemat RAM). */
  _evictIfNeeded() {
    if (this.sessions.size < policy.maxLiveSessions) return;
    let victim = null;
    for (const st of this.sessions.values()) {
      if (Date.now() - st.lastUsed < policy.idleEvictMs) continue; // hanya yang benar-benar idle
      if (!victim || st.lastUsed < victim.lastUsed) victim = st;
    }
    if (victim) {
      console.log(`[gateway] evict sesi idle ${victim.sid} (hemat RAM)`);
      try { victim.client.destroy(); } catch { /* ignore */ }
      this.sessions.delete(victim.sid);
    }
  }

  sessionStatus(appId, externalId) {
    const st = this.sessions.get(this._sid(appId, externalId));
    if (!st) return { exists: false, ready: false, qr: null };
    return { exists: true, ready: st.ready, qr: st.qrDataUrl ?? null };
  }

  async destroySession(appId, externalId) {
    const sid = this._sid(appId, externalId);
    const st = this.sessions.get(sid);
    if (st) { try { await st.client.logout(); } catch { /* ignore */ } this.sessions.delete(sid); }
  }

  async enqueue(appId, externalId, toPhone, message) {
    const sid = this._sid(appId, externalId);
    // DEDUP: pesan identik ke nomor sama dalam jendela pendek → tolak (cegah kirim ganda).
    const hash = crypto.createHash("sha1").update(`${sid}|${toPhone}|${message}`).digest("hex");
    const now = Date.now();
    for (const [h, exp] of this.recentHashes) if (exp < now) this.recentHashes.delete(h);
    if (this.recentHashes.has(hash)) return { queued: false, duplicate: true };
    this.recentHashes.set(hash, now + 60_000);

    if (!this.sessions.has(sid)) await this.initSession(appId, externalId);
    const id = `${now}-${Math.random().toString(36).slice(2, 8)}`;
    this.queue.push({ id, sid, appId, externalId, toPhone, message, hash });
    this._saveQueue(); // persist agar tahan restart
    return { queued: true, messageId: id };
  }

  _underRate(st) {
    const now = Date.now();
    st.sentTimestamps = st.sentTimestamps.filter((t) => now - t < 60_000);
    return st.sentTimestamps.length < policy.maxPerMin;
  }

  /** Reset hitungan harian bila ganti hari. */
  _refreshDay(st) {
    const k = dayKey();
    if (st.dayKey !== k) { st.dayKey = k; st.dayCount = 0; }
  }

  start() {
    console.log(`[gateway] WA manager — throttle ${policy.maxPerMin}/mnt, harian ${policy.maxPerDay}/nomor, warmup ${policy.warmupDays}h, quiet ${policy.quietStartHour}-${policy.quietEndHour}, maxLive ${policy.maxLiveSessions}`);
    const loop = async () => {
      try { await this._drain(); } catch (e) { console.error("[gateway] drain error:", e.message); }
      setTimeout(loop, TICK_MS);
    };
    loop();
  }

  async _drain() {
    if (this.queue.length === 0) return;
    // JAM TENANG: tunda seluruh pengiriman (biarkan antre; kirim saat jam aktif).
    if (isQuietHour()) return;

    const remaining = [];
    const bySid = new Map();
    for (const m of this.queue) { if (!bySid.has(m.sid)) bySid.set(m.sid, []); bySid.get(m.sid).push(m); }

    for (const [sid, msgs] of bySid) {
      const st = this.sessions.get(sid);
      if (!st || !st.ready) { remaining.push(...msgs); continue; }
      this._refreshDay(st);
      const cap = dailyCap(st.firstSeenMs);

      for (const m of msgs) {
        if (st.dayCount >= cap) { remaining.push(m); continue; }      // plafon harian / warm-up
        if (!this._underRate(st)) { remaining.push(m); continue; }     // batas per-menit
        try {
          // Validasi nomor terdaftar di WhatsApp (cegah "SENT" palsu ke nomor non-WA / self).
          const numberId = await withTimeout(
            st.client.getNumberId(String(m.toPhone).replace(/[^0-9]/g, "")),
            SEND_TIMEOUT_MS, "getNumberId",
          );
          if (!numberId) {
            await this._callback(m.appId, { type: "failed", externalId: m.externalId, messageId: m.id, error: "Nomor tidak terdaftar di WhatsApp" });
            console.error(`[gateway] FAILED ${m.id}: nomor ${m.toPhone} tidak terdaftar di WhatsApp`);
            continue;
          }
          await withTimeout(
            st.client.sendMessage(numberId._serialized, m.message),
            SEND_TIMEOUT_MS, "sendMessage",
          );
          st.sentTimestamps.push(Date.now());
          st.dayCount += 1; st.lastUsed = Date.now();
          console.log(`[gateway] SENT ${m.id} → ${m.toPhone} (${sid})`);
          await this._callback(m.appId, { type: "sent", externalId: m.externalId, messageId: m.id, toPhone: m.toPhone });
        } catch (e) {
          await this._callback(m.appId, { type: "failed", externalId: m.externalId, messageId: m.id, error: e.message });
          console.error(`[gateway] FAILED ${m.id}:`, e.message);
        }
        await sleep(rand(policy.minGapMs, policy.maxGapMs)); // jeda manusiawi (anti-ban)
      }
    }
    this.queue = remaining;
    this._saveQueue(); // persist state antrean terkini (yang terkirim sudah keluar)
  }
}
