/**
 * Endpoint ingest telemetry IoT — dipanggil oleh iot-bridge (VPS/Mosquitto).
 * AUTH: header Authorization: Bearer IOT_BRIDGE_TOKEN (server-only, bukan NEXT_PUBLIC).
 * Terima satu sample atau array sample. Buka Alert bila anomali.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { ingestTelemetry, type IngestSample } from "@/lib/services/iot-ingest-service";

function authorized(req: NextRequest): boolean {
  const token = process.env.IOT_BRIDGE_TOKEN;
  if (!token) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${token}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const samples: IngestSample[] = Array.isArray(body) ? body : [body as IngestSample];
  if (samples.length === 0 || samples.length > 100) {
    return NextResponse.json({ error: "1..100 sample per request" }, { status: 400 });
  }

  try {
    const results = [];
    const alerts = [];
    for (const s of samples) {
      if (!s || typeof s !== "object" || typeof s.deviceId !== "string") continue;
      // Defense-in-depth: tolak angka di luar rentang fisik wajar (sensor rusak/spoof).
      const bad =
        (s.tempC != null && (typeof s.tempC !== "number" || s.tempC < -50 || s.tempC > 100)) ||
        (s.currentA != null && (typeof s.currentA !== "number" || s.currentA < 0 || s.currentA > 1000)) ||
        (s.humidity != null && (typeof s.humidity !== "number" || s.humidity < 0 || s.humidity > 100));
      if (bad) continue;
      const r = await ingestTelemetry(s);
      results.push(r.stored);
      if (r.alertOpened) alerts.push(r.alertOpened);
    }
    return NextResponse.json({ ok: true, stored: results.filter(Boolean).length, alerts });
  } catch (err) {
    console.error("[iot/ingest] gagal:", err);
    return NextResponse.json({ error: "Gagal memproses" }, { status: 500 });
  }
}
