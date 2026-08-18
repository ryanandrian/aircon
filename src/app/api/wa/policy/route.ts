/**
 * Policy anti-ban WA yang DI-PULL gateway (VPS-INFRA) untuk app ini.
 * Gateway memanggil endpoint ini berkala → policy admin (InfraConfig) berlaku di gateway
 * tanpa redeploy. AUTH: header X-Api-Key = gateway key app (sama dgn yg dipakai app→gateway).
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getInfraSecrets, getPolicyView } from "@/lib/services/infra-config-service";

async function authorized(req: NextRequest): Promise<boolean> {
  const { gatewayKey } = await getInfraSecrets();
  const secret = gatewayKey || process.env.WA_GATEWAY_KEY;
  if (!secret) return false;
  const got = req.headers.get("x-api-key") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const policy = await getPolicyView();
  return NextResponse.json({ ok: true, policy });
}
