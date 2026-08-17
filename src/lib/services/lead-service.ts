/**
 * Lead Service — sisi input money loop ("Get Customers").
 *
 * Booking dari halaman publik OTOMATIS jadi Lead(source=WEBSITE, status=NEW)
 * di sistem tenant → masuk mesin uang. Nilainya bukan "punya website" tapi
 * "mengirim customer baru ke mesin uang".
 *
 * SEMUA query WAJIB tenant-scoped (multi-tenant). Lihat komentar // SECURITY.
 */
import { prisma } from "@/lib/prisma";
import type { LeadStatus } from "@prisma/client";
import type { PublicBookingInput } from "@/lib/validation/booking";

export class LeadServiceError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "LeadServiceError";
  }
}

/**
 * Buat Lead dari booking publik. source=WEBSITE, status=NEW.
 * serviceType & preferredDate disematkan ke notes (Lead tak punya kolom itu).
 */
export async function createLeadFromBooking(
  tenantId: string,
  input: PublicBookingInput,
) {
  if (!tenantId) throw new LeadServiceError("NO_TENANT", "tenantId wajib");

  const noteParts: string[] = [];
  if (input.serviceType) noteParts.push(`Layanan: ${input.serviceType}`);
  if (input.preferredDate) noteParts.push(`Preferensi tanggal: ${input.preferredDate}`);
  if (input.note) noteParts.push(input.note);
  const notes = noteParts.join(" | ") || null;

  // SECURITY: tenant-scoped — Lead melekat pada tenantId dari slug terverifikasi.
  return prisma.lead.create({
    data: {
      tenantId,
      name: input.name,
      phone: input.phone,
      source: "WEBSITE",
      status: "NEW",
      notes,
    },
  });
}

/** Daftar lead milik tenant, opsional difilter status. Terbaru dulu. */
export async function listLeads(
  tenantId: string,
  opts: { status?: LeadStatus } = {},
) {
  if (!tenantId) throw new LeadServiceError("NO_TENANT", "tenantId wajib");

  // SECURITY: tenant-scoped — where selalu menyertakan tenantId.
  return prisma.lead.findMany({
    where: {
      tenantId,
      ...(opts.status ? { status: opts.status } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Konversi Lead → Customer. Membuat Customer(source=WEBSITE) dari data lead,
 * lalu menandai lead.convertedCustomerId + status WON. Idempoten: jika lead
 * sudah terkonversi, kembalikan customer yang ada.
 */
export async function convertLeadToCustomer(tenantId: string, leadId: string) {
  if (!tenantId) throw new LeadServiceError("NO_TENANT", "tenantId wajib");
  if (!leadId) throw new LeadServiceError("NO_LEAD", "leadId wajib");

  // SECURITY: tenant-scoped — findFirst dengan tenantId, bukan findUnique(id).
  const lead = await prisma.lead.findFirst({ where: { id: leadId, tenantId } });
  if (!lead) throw new LeadServiceError("NOT_FOUND", "Lead tidak ditemukan");

  // Idempotensi: sudah pernah dikonversi.
  if (lead.convertedCustomerId) {
    const existing = await prisma.customer.findFirst({
      where: { id: lead.convertedCustomerId, tenantId }, // SECURITY: tenant-scoped
    });
    if (existing) return { customer: existing, lead };
  }

  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: {
        tenantId, // SECURITY: tenant-scoped
        name: lead.name,
        phone: lead.phone,
        source: "WEBSITE",
        notes: lead.notes,
      },
    });
    // SECURITY: tenant-scoped — updateMany dgn tenantId agar tak bisa lintas tenant.
    await tx.lead.updateMany({
      where: { id: lead.id, tenantId },
      data: { convertedCustomerId: customer.id, status: "WON" },
    });
    const updated = await tx.lead.findFirst({ where: { id: lead.id, tenantId } });
    return { customer, lead: updated ?? lead };
  });
}
