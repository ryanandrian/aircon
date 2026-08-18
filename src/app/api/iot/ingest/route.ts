/**
 * Endpoint ingest telemetry IoT — dipanggil oleh iot-bridge (VPS/Mosquitto).
 * AUTH: header Authorization: Bearer IOT_BRIDGE_TOKEN (server-only, bukan NEXT_PUBLIC).
 * Terima satu sample atau array sample. Buka Alert bila anomali.
 */
import { NextRequest, NextResponse } from "next/server";
import { ingestTelemetry, type IngestSample } from "@/lib/services/iot-ingest-service";

function authorized(req: NextRequest): boolean {
  const token = process.env.IOT_BRIDGE_TOKEN;
  if (!token) return false;
  return req.headers.get("authorization") === `Bearer ${token}`;
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
      if (!s || typeof s.deviceId !== "string") continue;
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
