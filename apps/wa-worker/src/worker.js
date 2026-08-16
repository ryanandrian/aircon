/**
 * AC Service Growth OS — WhatsApp Worker (whatsapp-web.js)
 * -------------------------------------------------------------------
 * Service long-running (BUKAN serverless). Tugas:
 *  1) Kelola SATU sesi WhatsApp per tenant (nomor WA tenant sendiri).
 *  2) Poll antrean pesan keluar dari Supabase: message_log(status=QUEUED, driver=WEB).
 *  3) Kirim via whatsapp-web.js, throttle manusiawi (anti-ban), update status SENT/FAILED.
 *  4) Tangkap balasan customer (INBOUND) → simpan ke message_log.
 *
 * Sesi disimpan lokal (LocalAuth) → tahan restart. Antrean di DB → tahan worker mati.
 * Lihat docs/WhatsApp_Strategy_Gateway.md
 *
 * ENV yang dibutuhkan:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   WA_POLL_MS (default 5000)
 *   WA_MIN_GAP_MS / WA_MAX_GAP_MS (jeda acak antar kirim, default 4000/9000)
 *   WA_MAX_PER_MIN (batas kirim per tenant/menit, default 12)
 *   WA_SESSION_DIR (default ./.wwebjs_auth)
 */
import { createClient } from "@supabase/supabase-js";
import pkg from "whatsapp-web.js";
import qrcode from "qrcode-terminal";

const { Client, LocalAuth } = pkg;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const POLL_MS = Number(process.env.WA_POLL_MS ?? 5000);
const MIN_GAP = Number(process.env.WA_MIN_GAP_MS ?? 4000);
const MAX_GAP = Number(process.env.WA_MAX_GAP_MS ?? 9000);
const MAX_PER_MIN = Number(process.env.WA_MAX_PER_MIN ?? 12);
const SESSION_DIR = process.env.WA_SESSION_DIR ?? "./.wwebjs_auth";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("[wa-worker] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY wajib diisi.");
  process.exit(1);
}

const supa = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

/** sessions: tenantId -> { client, ready, sentTimestamps: number[] } */
const sessions = new Map();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.floor(min + Math.random() * (max - min));

function chatId(phone) {
  return `${String(phone).replace(/[^0-9]/g, "")}@c.us`;
}

/** Buat / ambil sesi WA untuk sebuah tenant. QR ditampilkan di console saat pertama. */
async function getSession(tenantId) {
  if (sessions.has(tenantId)) return sessions.get(tenantId);

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: tenantId, dataPath: SESSION_DIR }),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    },
  });

  const state = { client, ready: false, sentTimestamps: [] };
  sessions.set(tenantId, state);

  client.on("qr", (qr) => {
    console.log(`\n[wa-worker] SCAN QR untuk tenant ${tenantId} (WhatsApp > Perangkat Tertaut):`);
    qrcode.generate(qr, { small: true });
  });
  client.on("ready", () => {
    state.ready = true;
    console.log(`[wa-worker] tenant ${tenantId} READY.`);
  });
  client.on("disconnected", (r) => {
    state.ready = false;
    console.warn(`[wa-worker] tenant ${tenantId} disconnected: ${r}. Akan re-init pada siklus berikutnya.`);
    sessions.delete(tenantId);
  });
  // Balasan customer → simpan sebagai INBOUND
  client.on("message", async (msg) => {
    try {
      const from = msg.from.replace(/@c\.us$/, "");
      await supa.from("message_log").insert({
        tenantId,
        channel: "WA",
        driver: "WEB",
        direction: "INBOUND",
        status: "DELIVERED",
        toPhone: from,
        body: msg.body ?? "",
      });
    } catch (e) {
      console.error("[wa-worker] gagal simpan inbound:", e.message);
    }
  });

  await client.initialize();
  return state;
}

/** Throttle: batasi MAX_PER_MIN per tenant. */
function underRateLimit(state) {
  const now = Date.now();
  state.sentTimestamps = state.sentTimestamps.filter((t) => now - t < 60_000);
  return state.sentTimestamps.length < MAX_PER_MIN;
}

async function processQueue() {
  // Ambil antrean pesan keluar driver WEB
  const { data: rows, error } = await supa
    .from("message_log")
    .select("id, tenantId, toPhone, body")
    .eq("driver", "WEB")
    .eq("direction", "OUTBOUND")
    .eq("status", "QUEUED")
    .order("at", { ascending: true })
    .limit(50);

  if (error) {
    console.error("[wa-worker] query error:", error.message);
    return;
  }
  if (!rows?.length) return;

  // Kelompokkan per tenant agar sesi & throttle terkelola
  const byTenant = new Map();
  for (const r of rows) {
    if (!byTenant.has(r.tenantId)) byTenant.set(r.tenantId, []);
    byTenant.get(r.tenantId).push(r);
  }

  for (const [tenantId, msgs] of byTenant) {
    let state;
    try {
      state = await getSession(tenantId);
    } catch (e) {
      console.error(`[wa-worker] init sesi ${tenantId} gagal:`, e.message);
      continue;
    }
    if (!state.ready) continue; // tunggu QR/ready; pesan tetap QUEUED

    for (const m of msgs) {
      if (!underRateLimit(state)) break; // lanjut siklus berikutnya
      if (!m.toPhone || !m.body) {
        await supa.from("message_log").update({ status: "FAILED" }).eq("id", m.id);
        continue;
      }
      try {
        await state.client.sendMessage(chatId(m.toPhone), m.body);
        state.sentTimestamps.push(Date.now());
        await supa.from("message_log").update({ status: "SENT" }).eq("id", m.id);
        console.log(`[wa-worker] SENT ${m.id} → ${m.toPhone} (tenant ${tenantId})`);
      } catch (e) {
        await supa.from("message_log").update({ status: "FAILED" }).eq("id", m.id);
        console.error(`[wa-worker] FAILED ${m.id}:`, e.message);
      }
      await sleep(rand(MIN_GAP, MAX_GAP)); // jeda manusiawi (anti-ban)
    }
  }
}

async function main() {
  console.log("[wa-worker] start. Poll tiap", POLL_MS, "ms. Sesi:", SESSION_DIR);
  // loop utama
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await processQueue();
    } catch (e) {
      console.error("[wa-worker] loop error:", e.message);
    }
    await sleep(POLL_MS);
  }
}

main();
