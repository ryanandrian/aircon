/**
 * WaManager — pool sesi WhatsApp (whatsapp-web.js) multi-app + antrean kirim + throttle.
 * Sesi di-namespace "{appId}:{externalId}" → isolasi antar-app. Status & pesan masuk
 * dikirim balik ke webhook app (callback). Pengganti mesin (Cloud API) cukup ganti
 * implementasi kelas ini — kontrak publik (initSession/enqueue/status) tetap.
 */
import pkg from "whatsapp-web.js";
import qrcodeTerminal from "qrcode-terminal";
import QRCode from "qrcode";
import { webhookOf } from "./auth.js";

const { Client, LocalAuth } = pkg;

const MIN_GAP = Number(process.env.WA_MIN_GAP_MS ?? 4000);
const MAX_GAP = Number(process.env.WA_MAX_GAP_MS ?? 9000);
const MAX_PER_MIN = Number(process.env.WA_MAX_PER_MIN ?? 12);
const SESSION_DIR = process.env.WA_SESSION_DIR ?? "./.wwebjs_auth";
const TICK_MS = Number(process.env.WA_TICK_MS ?? 3000);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => Math.floor(a + Math.random() * (b - a));
const chatId = (phone) => `${String(phone).replace(/[^0-9]/g, "")}@c.us`;

export class WaManager {
  constructor({ apps }) {
    this.apps = apps;
    /** key = "appId:externalId" → session state */
    this.sessions = new Map();
    /** antrean kirim: array of { sid, appId, externalId, toPhone, message, id } */
    this.queue = [];
  }

  sessionCount() { return this.sessions.size; }
  _sid(appId, externalId) { return `${appId}:${externalId}`; }

  async _callback(appId, payload) {
    const url = webhookOf(this.apps, appId);
    if (!url) return;
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.error(`[gateway] webhook ${appId} gagal:`, e.message);
    }
  }

  async initSession(appId, externalId) {
    const sid = this._sid(appId, externalId);
    if (this.sessions.has(sid)) {
      const st = this.sessions.get(sid);
      return { sessionId: sid, ready: st.ready, qr: st.qrDataUrl ?? null };
    }
    const client = new Client({
      authStrategy: new LocalAuth({ clientId: sid.replace(/[^a-zA-Z0-9_-]/g, "_"), dataPath: SESSION_DIR }),
      puppeteer: { headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] },
    });
    const state = { client, ready: false, qr: null, qrDataUrl: null, sentTimestamps: [], appId, externalId };
    this.sessions.set(sid, state);

    client.on("qr", async (qr) => {
      state.qr = qr;
      try { state.qrDataUrl = await QRCode.toDataURL(qr); } catch { state.qrDataUrl = null; }
      qrcodeTerminal.generate(qr, { small: true });
      console.log(`[gateway] QR untuk ${sid} (scan di WhatsApp > Perangkat Tertaut)`);
      await this._callback(appId, { type: "qr", externalId, qr: state.qrDataUrl });
    });
    client.on("ready", async () => {
      state.ready = true; state.qr = null; state.qrDataUrl = null;
      console.log(`[gateway] ${sid} READY`);
      await this._callback(appId, { type: "ready", externalId });
    });
    client.on("disconnected", async (r) => {
      state.ready = false;
      console.warn(`[gateway] ${sid} disconnected: ${r}`);
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

  /** Antre pesan keluar. Sesi di-init otomatis bila belum ada. */
  async enqueue(appId, externalId, toPhone, message) {
    const sid = this._sid(appId, externalId);
    if (!this.sessions.has(sid)) await this.initSession(appId, externalId);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.queue.push({ id, sid, appId, externalId, toPhone, message });
    return { queued: true, messageId: id };
  }

  _underRate(st) {
    const now = Date.now();
    st.sentTimestamps = st.sentTimestamps.filter((t) => now - t < 60_000);
    return st.sentTimestamps.length < MAX_PER_MIN;
  }

  start() {
    console.log(`[gateway] WA manager start — tick ${TICK_MS}ms, throttle ${MAX_PER_MIN}/min/sesi`);
    const loop = async () => {
      try { await this._drain(); } catch (e) { console.error("[gateway] drain error:", e.message); }
      setTimeout(loop, TICK_MS);
    };
    loop();
  }

  async _drain() {
    if (this.queue.length === 0) return;
    const remaining = [];
    // Kelompokkan per sesi utk hormati throttle per nomor.
    const bySid = new Map();
    for (const m of this.queue) {
      if (!bySid.has(m.sid)) bySid.set(m.sid, []);
      bySid.get(m.sid).push(m);
    }
    for (const [sid, msgs] of bySid) {
      const st = this.sessions.get(sid);
      if (!st || !st.ready) { remaining.push(...msgs); continue; }
      for (const m of msgs) {
        if (!this._underRate(st)) { remaining.push(m); continue; }
        try {
          await st.client.sendMessage(chatId(m.toPhone), m.message);
          st.sentTimestamps.push(Date.now());
          await this._callback(m.appId, { type: "sent", externalId: m.externalId, messageId: m.id, toPhone: m.toPhone });
          console.log(`[gateway] SENT ${m.id} → ${m.toPhone} (${sid})`);
        } catch (e) {
          await this._callback(m.appId, { type: "failed", externalId: m.externalId, messageId: m.id, error: e.message });
          console.error(`[gateway] FAILED ${m.id}:`, e.message);
        }
        await sleep(rand(MIN_GAP, MAX_GAP)); // jeda manusiawi (anti-ban)
      }
    }
    this.queue = remaining;
  }
}
