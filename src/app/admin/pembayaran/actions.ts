"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { saveIpaymuConfig, validateIpaymuConfig, type IpaymuEnv } from "@/lib/services/ipaymu-config-service";

type Result = { ok: boolean; error?: string; info?: string };

export async function actionSaveIpaymuConfig(fd: FormData): Promise<Result> {
  try {
    const admin = await requirePlatformAdmin();
    const activeEnvironment = String(fd.get("activeEnvironment") ?? "SANDBOX").toUpperCase() as IpaymuEnv;
    if (!(["SANDBOX", "PRODUCTION"] as string[]).includes(activeEnvironment)) return { ok: false, error: "Environment tidak valid." };
    const input = {
      sandboxVa: String(fd.get("sandboxVa") ?? "").replace(/\D/g, "").trim() || undefined,
      sandboxApiKey: String(fd.get("sandboxApiKey") ?? "").trim() || undefined,
      productionVa: String(fd.get("productionVa") ?? "").replace(/\D/g, "").trim() || undefined,
      productionApiKey: String(fd.get("productionApiKey") ?? "").trim() || undefined,
      activeEnvironment,
    };
    const selected = await validateIpaymuConfig(activeEnvironment);
    const selectedVa = activeEnvironment === "SANDBOX" ? input.sandboxVa : input.productionVa;
    const selectedKey = activeEnvironment === "SANDBOX" ? input.sandboxApiKey : input.productionApiKey;
    if (!selected.ok && (!selectedVa || !selectedKey)) return selected;
    await saveIpaymuConfig(input, admin.email);
    revalidatePath("/admin/pembayaran");
    return { ok: true, info: `iPaymu ${activeEnvironment === "PRODUCTION" ? "Production" : "Sandbox"} aktif dan konfigurasi tersimpan.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menyimpan konfigurasi." };
  }
}
