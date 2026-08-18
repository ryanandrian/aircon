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
import { webhookOf } from "./auth.js";
import { policy, isQuietHour, dailyCap, dayKey } from "./policy.js";

const { Client, LocalAuth } = pkg;

const SESSION_DIR = process.env.WA_SESSION_DIR ?? "./.wwebjs_auth";
const TICK_MS = Number(process.env.WA_TICK_MS ?? 3000);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => Math.floor(a + Math.random() * (b - a));
const chatId = (phone) => `${String(phone).replace(/[^0-9]/g, "")}@c.us`;

export class WaManager {
  constructor({ apps }) {
    this.apps = apps;
    this.sessions = new Map();      // sid -> state
    this.queue = [];                // { id, sid, appId, externalId, toPhone, message, hash }
    this.recentHashes = new Map();  // hash -> expiryMs (dedup)
  }

  sessionCount() { return this.sessions.size; }
  _sid(appId, externalId) { return `${appId}:${externalId}`; }

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

    const client = new Client({
      authStrategy: new LocalAuth({ clientId: sid.replace(/[^a-zA-Z0-9_-]/g, "_"), dataPath: SESSION_DIR }),
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
          await st.client.sendMessage(chatId(m.toPhone), m.message);
          st.sentTimestamps.push(Date.now());
          st.dayCount += 1; st.lastUsed = Date.now();
          await this._callback(m.appId, { type: "sent", externalId: m.externalId, messageId: m.id, toPhone: m.toPhone });
        } catch (e) {
          await this._callback(m.appId, { type: "failed", externalId: m.externalId, messageId: m.id, error: e.message });
          console.error(`[gateway] FAILED ${m.id}:`, e.message);
        }
        await sleep(rand(policy.minGapMs, policy.maxGapMs)); // jeda manusiawi (anti-ban)
      }
    }
    this.queue = remaining;
  }
}
