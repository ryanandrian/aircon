"use server";

/**
 * Server Action untuk booking publik.
 * Alur: honeypot/anti-spam → validasi Zod → ambil tenant by slug (tenant-scoped)
 * → createLeadFromBooking. Progressive enhancement: form tetap bekerja tanpa JS
 * karena action dipanggil langsung dari <form action={...}>.
 *
 * Kontrak return sederhana agar aman untuk useActionState & non-JS.
 */
import { prisma } from "@/lib/prisma";
import {
  publicBookingSchema,
  looksLikeSpam,
  HONEYPOT_FIELD,
} from "@/lib/validation/booking";
import { createLeadFromBooking } from "@/lib/services/lead-service";

export type BookingActionState =
  | { ok: true; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
  | { ok: null }; // state awal

/** Baca field form dengan aman (bisa null / File). */
function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

export async function submitBooking(
  slug: string,
  formData: FormData,
): Promise<BookingActionState> {
  try {
    // 1) Anti-spam murni sebelum apa pun (hemat DB).
    const rawForSpam = {
      name: str(formData, "name"),
      note: str(formData, "note"),
      [HONEYPOT_FIELD]: str(formData, HONEYPOT_FIELD),
    };
    if (looksLikeSpam(rawForSpam)) {
      // Balas sukses "diam-diam" agar bot tak belajar. Tak menulis Lead.
      return { ok: true, message: "Terima kasih, kami akan hubungi Anda." };
    }

    // 2) Validasi Zod (normalisasi phone, batasi panjang, dsb).
    const parsed = publicBookingSchema.safeParse({
      name: str(formData, "name"),
      phone: str(formData, "phone"),
      serviceType: str(formData, "serviceType") || undefined,
      note: str(formData, "note"),
      preferredDate: str(formData, "preferredDate"),
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return {
        ok: false,
        error: "Mohon periksa kembali data Anda.",
        fieldErrors,
      };
    }

    // 3) Ambil tenant by slug. SECURITY: tenant-scoped — tenantId berasal dari
    //    slug terverifikasi, bukan dari input user.
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!tenant) {
      return { ok: false, error: "Halaman tidak ditemukan." };
    }

    // 4) Buat Lead(source=WEBSITE, status=NEW) → masuk mesin uang.
    await createLeadFromBooking(tenant.id, parsed.data);

    return { ok: true, message: "Terima kasih, kami akan hubungi Anda." };
  } catch (err) {
    // Jangan bocorkan error internal ke user; log untuk operator.
    console.error("[submitBooking] gagal:", err);
    return {
      ok: false,
      error: "Maaf, terjadi kendala saat mengirim. Silakan coba lagi.",
    };
  }
}
