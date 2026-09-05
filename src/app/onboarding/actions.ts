"use server";

/**
 * Server Action untuk wizard setup usaha (onboarding owner baru).
 *
 * Alur:
 *  1. Ambil user Supabase dari sesi terverifikasi (bukan input klien).
 *  2. Validasi Zod (nama usaha, kota, nomor WhatsApp).
 *  3. createTenantForOwner → buat Usaha + owner + defaults.
 *  4. redirect ke /app.
 *
 * SECURITY: identitas owner (email/phone) berasal dari sesi Supabase, bukan
 * FormData. Data usaha berasal dari input tervalidasi. Teknisi tidak boleh
 * lewat sini — mereka hanya masuk lewat undangan (Invite).
 */
import { redirect } from "next/navigation";
import { getAuthIdentity } from "@/lib/auth/auth-identity";
import { onboardingSchema } from "@/lib/validation/onboarding";
import {
  findDomainUser,
  createTenantForOwner,
} from "@/lib/services/onboarding-service";

export type OnboardingActionState =
  | { ok: null } // state awal
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Baca field form dengan aman (bisa null / File). */
function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

export async function completeOnboarding(
  _prev: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  // 1) Sesi terverifikasi.
  const identity = await getAuthIdentity();

  if (!identity || (!identity.email && !identity.phone)) {
    return { ok: false, error: "Sesi berakhir. Silakan masuk kembali." };
  }

  const email = identity.email;
  const phone = identity.phone;
  // Nama lengkap: tak selalu tersedia dari sesi self-host; fallback dari email.
  const fullName = email ? email.split("@")[0] : null;

  // 2) Validasi input wizard.
  const parsed = onboardingSchema.safeParse({
    businessName: str(formData, "businessName"),
    city: str(formData, "city"),
    whatsappPhone: str(formData, "whatsappPhone"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      ok: false,
      error: "Mohon periksa kembali isian Anda.",
      fieldErrors,
    };
  }

  // 3) Buat usaha. Guard: bila sudah punya usaha, jangan buat dua kali.
  try {
    const existing = await findDomainUser({ email, phone });
    if (!existing) {
      await createTenantForOwner({
        email,
        phone,
        fullName,
        businessName: parsed.data.businessName,
        city: parsed.data.city,
        whatsappPhone: parsed.data.whatsappPhone,
        referralCode: str(formData, "referralCode") || null,
      });
    }
  } catch (err) {
    console.error("[completeOnboarding] gagal membuat usaha:", err);
    return {
      ok: false,
      error: "Maaf, terjadi kendala saat menyiapkan usaha Anda. Silakan coba lagi.",
    };
  }

  // 4) Sukses → arahkan LANGSUNG ke Pengaturan (WaConnect tampil paling atas) agar tenant baru
  //    segera menghubungkan WhatsApp. redirect() melempar, jadi taruh di luar try/catch.
  redirect("/app/pengaturan?baru=1");
}
