"use server";

import { redirect } from "next/navigation";
import {
  loginAgent, loginReseller, activatePartner, registerReseller,
  approveReseller, rejectReseller, PartnerPortalError,
} from "@/lib/partner/partner-portal-service";
import { setPartnerSession, clearPartnerSession, getPartnerSession } from "@/lib/partner/partner-session";
import { revalidatePath } from "next/cache";

export type PortalResult = { ok: true } | { ok: false; error: string };
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Login agen (email+PIN) → set cookie → redirect dasbor. */
export async function actionAgentLogin(_p: unknown, fd: FormData): Promise<PortalResult> {
  try {
    const { id } = await loginAgent(s(fd, "email"), s(fd, "pin"));
    await setPartnerSession("agent", id);
  } catch (err) {
    return { ok: false, error: err instanceof PartnerPortalError ? err.message : "Gagal masuk" };
  }
  redirect("/agen");
}

export async function actionResellerLogin(_p: unknown, fd: FormData): Promise<PortalResult> {
  try {
    const { id } = await loginReseller(s(fd, "email"), s(fd, "pin"));
    await setPartnerSession("reseller", id);
  } catch (err) {
    return { ok: false, error: err instanceof PartnerPortalError ? err.message : "Gagal masuk" };
  }
  redirect("/reseller");
}

/** Aktivasi (set PIN via token). */
export async function actionActivate(kind: "agent" | "reseller", token: string, _p: unknown, fd: FormData): Promise<PortalResult> {
  const pin = s(fd, "pin");
  const pin2 = s(fd, "pin2");
  if (pin !== pin2) return { ok: false, error: "PIN tidak sama" };
  try {
    const { id } = await activatePartner(kind, token, pin);
    await setPartnerSession(kind, id);
  } catch (err) {
    return { ok: false, error: err instanceof PartnerPortalError ? err.message : "Gagal aktivasi" };
  }
  redirect(kind === "agent" ? "/agen" : "/reseller");
}

/** Pendaftaran reseller publik via joinCode. */
export async function actionRegisterReseller(joinCode: string, _p: unknown, fd: FormData): Promise<PortalResult> {
  try {
    if (!s(fd, "name") || !s(fd, "email")) return { ok: false, error: "Nama & email wajib" };
    await registerReseller(joinCode, {
      name: s(fd, "name"), email: s(fd, "email"), phone: s(fd, "phone"),
      bankName: s(fd, "bankName"), bankAccount: s(fd, "bankAccount"), bankHolder: s(fd, "bankHolder"),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof PartnerPortalError ? err.message : "Gagal mendaftar" };
  }
}

/** AGEN setujui/tolak reseller. */
export async function actionApproveReseller(resellerId: string, fd: FormData): Promise<PortalResult> {
  try {
    const sess = await getPartnerSession();
    if (sess?.kind !== "agent") return { ok: false, error: "Tidak berwenang" };
    await approveReseller(sess.id, resellerId, {
      type: (s(fd, "commissionType") || "FLAT_IDR") as "FLAT_IDR" | "PERCENT",
      value: Number(fd.get("commissionValue") ?? 0),
    });
    revalidatePath("/agen/reseller");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof PartnerPortalError ? err.message : "Gagal menyetujui" };
  }
}

export async function actionRejectReseller(resellerId: string): Promise<PortalResult> {
  try {
    const sess = await getPartnerSession();
    if (sess?.kind !== "agent") return { ok: false, error: "Tidak berwenang" };
    await rejectReseller(sess.id, resellerId);
    revalidatePath("/agen/reseller");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof PartnerPortalError ? err.message : "Gagal menolak" };
  }
}

export async function actionPartnerLogout(): Promise<void> {
  await clearPartnerSession();
  redirect("/agen/login");
}
