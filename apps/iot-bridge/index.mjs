import mqtt from "mqtt";
const MQTT_URL = process.env.MQTT_URL ?? "mqtt://127.0.0.1:1883";
const INGEST_URL = process.env.AIRCON_INGEST_URL ?? "";
const TOKEN = process.env.IOT_BRIDGE_TOKEN ?? "";
const BATCH_MS = Number(process.env.BATCH_MS ?? 2e3);
if (!INGEST_URL || !TOKEN) {
  console.error("[bridge] AIRCON_INGEST_URL & IOT_BRIDGE_TOKEN wajib diisi");
  process.exit(1);
}
const queue = [];
const client = mqtt.connect(MQTT_URL, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  reconnectPeriod: 3e3
});
client.on("connect", () => {
  console.log("[bridge] terhubung ke Mosquitto:", MQTT_URL);
  client.subscribe("aircon/+/telemetry", (err) => {
    if (err) console.error("[bridge] subscribe gagal:", err.message);
    else console.log("[bridge] subscribe aircon/+/telemetry");
  });
});
client.on("message", (topic, payload) => {
  const parts = topic.split("/");
  const deviceId = parts[1];
  if (!deviceId) return;
  try {
    const data = JSON.parse(payload.toString());
    queue.push({
      deviceId,
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      tempC: num(data.tempC),
      humidity: num(data.humidity),
      currentA: num(data.currentA),
      powerW: num(data.powerW),
      online: data.online !== false
    });
  } catch {
    console.warn("[bridge] payload bukan JSON dari", topic);
  }
});
client.on("error", (e) => console.error("[bridge] MQTT error:", e.message));
function num(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
async function flush() {
  if (queue.length === 0) return;
  const batch = queue.splice(0, 100);
  try {
    const res = await fetch(INGEST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify(batch)
    });
    if (!res.ok) {
      console.error("[bridge] ingest gagal", res.status);
      queue.unshift(...batch);
    } else {
      const j = await res.json().catch(() => ({}));
      if (j.alerts?.length) console.log("[bridge] alert dibuka:", j.alerts.length);
    }
  } catch (e) {
    console.error("[bridge] koneksi ingest gagal:", e.message);
    queue.unshift(...batch);
  }
}
setInterval(flush, BATCH_MS);
console.log("[bridge] jalan. Batch tiap", BATCH_MS, "ms");
