import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret, maskAccount } from "@/lib/partner/vault-crypto";

const ID = "singleton";
const reveal = (value: string | null) => { try { return value ? decryptSecret(value) : ""; } catch { return ""; } };
export type IpaymuEnv = "SANDBOX" | "PRODUCTION";

export async function getIpaymuConfigView() {
  const c = await prisma.ipaymuConfig.upsert({ where: { id: ID }, create: { id: ID }, update: {} });
  const sandboxVa = reveal(c.sandboxVaEnc);
  const sandboxApiKey = reveal(c.sandboxApiKeyEnc);
  const productionVa = reveal(c.productionVaEnc);
  const productionApiKey = reveal(c.productionApiKeyEnc);
  return { activeEnvironment: c.activeEnvironment, sandboxConfigured: Boolean(sandboxVa && sandboxApiKey), productionConfigured: Boolean(productionVa && productionApiKey), sandboxVa: sandboxVa ? maskAccount(sandboxVa) : "Belum diisi", productionVa: productionVa ? maskAccount(productionVa) : "Belum diisi", sandboxApiKey: sandboxApiKey ? maskAccount(sandboxApiKey) : "Belum diisi", productionApiKey: productionApiKey ? maskAccount(productionApiKey) : "Belum diisi", updatedBy: c.updatedBy, updatedAt: c.updatedAt };
}

export async function getActiveIpaymuCredentials() {
  const c = await prisma.ipaymuConfig.findUnique({ where: { id: ID } });
  if (!c) return null;
  const production = c.activeEnvironment === "PRODUCTION";
  return { environment: production ? "production" as const : "sandbox" as const, va: reveal(production ? c.productionVaEnc : c.sandboxVaEnc), apiKey: reveal(production ? c.productionApiKeyEnc : c.sandboxApiKeyEnc) };
}

export async function saveIpaymuConfig(input: { sandboxVa?: string; sandboxApiKey?: string; productionVa?: string; productionApiKey?: string; activeEnvironment: IpaymuEnv }, actor: string) {
  const current = await prisma.ipaymuConfig.upsert({ where: { id: ID }, create: { id: ID }, update: {} });
  const data: Record<string, unknown> = { activeEnvironment: input.activeEnvironment, updatedBy: actor };
  for (const [field, value] of [["sandboxVaEnc", input.sandboxVa], ["sandboxApiKeyEnc", input.sandboxApiKey], ["productionVaEnc", input.productionVa], ["productionApiKeyEnc", input.productionApiKey]] as const) if (value?.trim()) data[field] = encryptSecret(value.trim());
  const next = await prisma.ipaymuConfig.update({ where: { id: ID }, data });
  if (current.activeEnvironment !== next.activeEnvironment) await prisma.platformAuditLog.create({ data: { actor, action: "IPAYMU_ENVIRONMENT_SWITCH", target: "ipaymu", metadata: { from: current.activeEnvironment, to: next.activeEnvironment } } });
}

export async function validateIpaymuConfig(environment: IpaymuEnv) {
  const c = await prisma.ipaymuConfig.findUnique({ where: { id: ID } });
  if (!c) return { ok: false as const, error: "Konfigurasi iPaymu belum ada." };
  const production = environment === "PRODUCTION";
  const va = reveal(production ? c.productionVaEnc : c.sandboxVaEnc);
  const apiKey = reveal(production ? c.productionApiKeyEnc : c.sandboxApiKeyEnc);
  return va && apiKey ? { ok: true as const } : { ok: false as const, error: `VA dan API Key ${environment === "PRODUCTION" ? "production" : "sandbox"} wajib diisi.` };
}
