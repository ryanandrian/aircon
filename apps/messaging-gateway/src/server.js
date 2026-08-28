/**
 * Shared Messaging Gateway — WhatsApp (whatsapp-web.js) sebagai REST service multi-app.
 *
 * KENAPA ADA: satu gateway melayani BANYAK aplikasi (portofolio 12 SaaS). App tak lagi
 * memuat whatsapp-web.js sendiri — cukup POST /v1/wa/send. Mesin WA (waweb.js) bisa
 * ditukar ke WhatsApp Cloud API kelak TANPA app berubah (kontrak API tetap).
 *
 * MODEL:
 *  - "app" = aplikasi klien (aircon, app#2, ...). Tiap app punya API key.
 *  - "session" = satu nomor WhatsApp (1 QR). Untuk aircon: 1 session per tenant.
 *    sessionId di-namespace per app: "{appId}:{externalId}" → isolasi antar-app.
 *  - App kirim pesan → gateway antre & kirim (throttle anti-ban) → callback webhook
 *    app untuk status (SENT/FAILED) & pesan masuk (INBOUND).
 *
 * ENDPOINTS (semua butuh header `X-Api-Key`):
 *   GET  /health                         → status gateway (tanpa auth)
 *   POST /v1/wa/sessions/:externalId/init→ mulai/siapkan sesi (balikkan status/QR)
 *   GET  /v1/wa/sessions/:externalId     → status sesi + QR (bila belum tertaut)
 *   POST /v1/wa/send                     → { externalId, toPhone, message } antre kirim
 *   DELETE /v1/wa/sessions/:externalId   → logout & hapus sesi
 *
 * ENV: lihat .env.example. Rahasia (API keys) TIDAK di-hardcode.
 */
import express from "express";
import { WaManager } from "./wa-manager.js";
import { loadApps, authMiddleware } from "./auth.js";
import { applyPolicyOverride, policy } from "./policy.js";

const PORT = Number(process.env.PORT ?? 8080);
const apps = loadApps(); // registry app + API key + webhook + policyUrl
const wa = new WaManager({ apps });

/**
 * Sinkron policy anti-ban dari admin app (di-pull berkala) → perubahan admin di panel
 * aplikasi berlaku di gateway TANPA redeploy. Tiap app boleh punya policyUrl sendiri.
 */
const POLICY_SYNC_MS = Number(process.env.WA_POLICY_SYNC_MS ?? 60000);
let _lastPolicySig = "";
async function syncPolicies() {
  for (const a of apps) {
    if (!a.policyUrl) continue;
    try {
      const r = await fetch(a.policyUrl, { headers: { "X-Api-Key": a.key } });
      if (!r.ok) continue;
      const data = await r.json();
      if (data?.policy) applyPolicyOverride(data.policy);
    } catch (e) { console.error(`[gateway] sync policy ${a.id} gagal:`, e.message); }
  }
  // Log policy EFEKTIF hanya saat berubah — supaya override DB (mis. quiet-hour) TIDAK pernah "senyap".
  // Ini yang dulu bikin bingung: .env server ditimpa InfraConfig DB tanpa jejak.
  const sig = `${policy.quietStartHour}-${policy.quietEndHour}|${policy.maxPerMin}/${policy.maxPerDay}|warmup=${policy.warmupEnabled}`;
  if (sig !== _lastPolicySig) {
    console.log(`[gateway] POLICY EFEKTIF (sumber: InfraConfig DB via policyUrl → menimpa .env): quiet=${policy.quietStartHour}-${policy.quietEndHour} throttle=${policy.maxPerMin}/mnt harian=${policy.maxPerDay} warmup=${policy.warmupEnabled}`);
    _lastPolicySig = sig;
  }
}

const server = express();
server.use(express.json({ limit: "1mb" }));

server.get("/health", (_req, res) => {
  res.json({ ok: true, service: "messaging-gateway", sessions: wa.sessionCount(), uptime: process.uptime() });
});

// Semua route /v1 butuh API key valid → req.app_id terisi.
server.use("/v1", authMiddleware(apps));

server.post("/v1/wa/sessions/:externalId/init", async (req, res) => {
  try {
    const s = await wa.initSession(req.app_id, req.params.externalId);
    res.json({ ok: true, ...s });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

server.get("/v1/wa/sessions/:externalId", async (req, res) => {
  const s = wa.sessionStatus(req.app_id, req.params.externalId);
  res.json({ ok: true, ...s });
});

server.post("/v1/wa/send", async (req, res) => {
  const { externalId, toPhone, message } = req.body ?? {};
  if (!externalId || !toPhone || !message) {
    return res.status(400).json({ ok: false, error: "externalId, toPhone, message wajib" });
  }
  try {
    const r = await wa.enqueue(req.app_id, String(externalId), String(toPhone), String(message));
    if (r.duplicate) return res.status(409).json({ ok: false, error: "pesan identik baru saja diantre (dedup)", duplicate: true });
    res.json({ ok: true, ...r });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

server.delete("/v1/wa/sessions/:externalId", async (req, res) => {
  try {
    await wa.destroySession(req.app_id, req.params.externalId);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

server.listen(PORT, () => {
  console.log(`[gateway] listening :${PORT} — ${apps.length} app terdaftar`);
  wa.start();
  // Sinkron policy admin di awal + berkala.
  syncPolicies();
  setInterval(syncPolicies, POLICY_SYNC_MS);
});
