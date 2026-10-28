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
import { createTenantBookingNotification } from "@/lib/services/tenant-notification-service";
import { bookingReference, bookingConfirmationMessage } from "@/lib/domain/booking-reference";
import { normalizePhone } from "@/lib/wa/gateway";

export type BookingActionState =
  /** `reference` = kode booking pemesan (G13). `confirmationSent` = WA konfirmasi
   * berhasil diantre ke pemesan (bila sesi WA tenant tersambung). */
  | { ok: true; message: string; reference: string; confirmationSent: boolean }
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
      // Anti-spam: balasan sukses palsu — TANPA kode booking (tidak ada lead).
      return { ok: true, message: "Terima kasih, kami akan hubungi Anda.", reference: "—", confirmationSent: false };
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
      select: { id: true, name: true, waVerifiedPhone: true },
    });
    if (!tenant) {
      return { ok: false, error: "Halaman tidak ditemukan." };
    }

    // 4) Buat Lead(source=WEBSITE, status=NEW) → masuk mesin uang.
    //    Idempoten (G11): token per render form; submit ulang = lead yang sama.
    const requestId = str(formData, "requestId").trim() || undefined;
    const { lead, alreadyBooked } = await createLeadFromBooking(tenant.id, parsed.data, requestId);
    const reference = bookingReference(lead.id);

    // 5) Notifikasi in-app owner. GAGALNYA TIDAK menggagalkan booking: lead sudah
    //    tersimpan (fakta bisnis), jadi pemesan tetap diberi jawaban "terima kasih".
    //    Sebelumnya error di sini membuat pemesan mengulang → lead ganda.
    //    Kegagalan dicatat agar operator tahu (G21) dan notifikasi bisa dibuat ulang.
    try {
      await createTenantBookingNotification({ tenantId: tenant.id, leadId: lead.id, name: lead.name, service: parsed.data.serviceType });
    } catch (err) {
      console.error(`[submitBooking] lead tersimpan (${lead.id}) tapi notifikasi owner gagal:`, err);
    }

    // 6) Konfirmasi WA ke PEMESAN (G13): bukti + kode booking.
    //    HANYA saat lead baru dibuat (submit ulang tak mengulang) dan sesi WA
    //    tenant tersambung. Gagal/terskip TIDAK menggagalkan booking: pemesan
    //    tetap melihat kode di layar.
    let confirmationSent = false;
    const bookerPhone = normalizePhone(parsed.data.phone ?? "");
    if (!alreadyBooked && bookerPhone && tenant.waVerifiedPhone) {
      try {
        const message = bookingConfirmationMessage({
          tenantName: tenant.name,
          bookerName: parsed.data.name,
          reference,
          serviceName: parsed.data.serviceType ?? null,
          preferredDate: parsed.data.preferredDate ?? null,
        });
        // Antre via MessageLog (tenant -> pemesan). Idempoten: hanya lead baru.
        await prisma.messageLog.create({
          data: {
            tenantId: tenant.id,
            channel: "WA",
            direction: "OUTBOUND",
            status: "QUEUED",
            templateKey: "BOOKING_CONFIRM",
            toPhone: bookerPhone,
            body: message,
          },
        });
        confirmationSent = true;
      } catch (err) {
        // Gagal antre (mis. DB) tidak menggagalkan booking — kode tetap tampil.
        console.error(`[submitBooking] konfirmasi WA pemesan gagal (lead ${lead.id}):`, err);
      }
    }

    return { ok: true, message: "Terima kasih, kami akan hubungi Anda.", reference, confirmationSent };
  } catch (err) {
    // Jangan bocorkan error internal ke user; log untuk operator.
    console.error("[submitBooking] gagal:", err);
    return {
      ok: false,
      error: "Maaf, terjadi kendala saat mengirim. Silakan coba lagi.",
    };
  }
}
