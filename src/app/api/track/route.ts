import { NextResponse } from "next/server";
import { recordVisit, clientIpFromHeaders } from "@/lib/services/visit-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Beacon kunjungan landing. Dipanggil client (fetch) saat halaman publik dibuka. */
export async function POST(req: Request) {
  try {
    const ip = clientIpFromHeaders(req.headers);
    const ua = req.headers.get("user-agent");
    let path = "/";
    try {
      const body = (await req.json()) as { path?: string };
      if (body?.path) path = body.path;
    } catch {
      // body opsional
    }
    await recordVisit({ ip, userAgent: ua, path });
  } catch {
    // tracking best-effort; jangan pernah ganggu pengunjung
  }
  return NextResponse.json({ ok: true });
}
