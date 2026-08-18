/**
 * Auth & registry app untuk gateway. Multi-app: tiap app punya API key + webhook URL.
 * Registry dari ENV GATEWAY_APPS (JSON) agar tanpa hardcode & mudah tambah app baru:
 *   GATEWAY_APPS='[{"id":"aircon","key":"sk_live_xxx","webhook":"https://aircon-peach.vercel.app/api/wa/callback"}]'
 * API key dibandingkan timing-safe. App tak dikenal / key salah → 401.
 */
import crypto from "crypto";

export function loadApps() {
  const raw = process.env.GATEWAY_APPS;
  if (!raw) {
    console.warn("[gateway] GATEWAY_APPS kosong — tak ada app terdaftar. Set di .env.");
    return [];
  }
  try {
    const arr = JSON.parse(raw);
    return arr.map((a) => ({ id: String(a.id), key: String(a.key), webhook: a.webhook ? String(a.webhook) : null, policyUrl: a.policyUrl ? String(a.policyUrl) : null }));
  } catch (e) {
    console.error("[gateway] GATEWAY_APPS bukan JSON valid:", e.message);
    return [];
  }
}

function timingSafeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Middleware: validasi X-Api-Key → set req.app_id. */
export function authMiddleware(apps) {
  return (req, res, next) => {
    const key = req.header("X-Api-Key") ?? "";
    const app = apps.find((a) => timingSafeEqual(a.key, key));
    if (!app) return res.status(401).json({ ok: false, error: "API key tidak valid" });
    req.app_id = app.id;
    next();
  };
}

/** Cari webhook URL sebuah app (untuk callback status/inbound). */
export function webhookOf(apps, appId) {
  return apps.find((a) => a.id === appId)?.webhook ?? null;
}
