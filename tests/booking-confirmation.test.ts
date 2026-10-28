import { describe, it, expect, vi, beforeEach } from "vitest";

// REGRESSION (G13 — booking butuh bukti untuk pemesan).
//
//  - Kode booking deterministik dari Lead.id (idempoten: submit ulang = kode sama).
//  - Server action mengantre WA konfirmasi ke pemesan HANYA saat lead baru & sesi
//    WA tenant tersambung; gagal antre TIDAK menggagalkan booking.
//  - Submit ulang (token sama) TIDAK mengulang konfirmasi WA (anti-dobel).

vi.mock("server-only", () => ({}));

const {
  leadFindUnique, leadCreate, tenantFindUnique, notificationCreate, messageLogCreate, templateFindUnique,
} = vi.hoisted(() => ({
  leadFindUnique: vi.fn(), leadCreate: vi.fn(), tenantFindUnique: vi.fn(),
  notificationCreate: vi.fn(), messageLogCreate: vi.fn(), templateFindUnique: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { findUnique: leadFindUnique, create: leadCreate },
    tenant: { findUnique: tenantFindUnique },
    tenantNotification: { create: notificationCreate },
    messageLog: { create: messageLogCreate },
    platformTemplate: { findUnique: templateFindUnique },
  },
}));
vi.mock("@/lib/services/tenant-notification-service", () => ({
  createTenantBookingNotification: vi.fn(async () => ({})),
}));

import { bookingReference, bookingConfirmationMessage } from "../src/lib/domain/booking-reference";
import { createLeadFromBooking } from "../src/lib/services/lead-service";
import { submitBooking } from "../src/app/p/[slug]/actions";

/** Bangun FormData untuk form booking publik. */
function form(vals: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(vals)) fd.set(k, v);
  return fd;
}

describe("kode booking & pesan konfirmasi (G13)", () => {
  it("deterministik: lead sama → kode sama; kode huruf-angka", () => {
    const a = bookingReference("cmuabc123xyz");
    const b = bookingReference("cmuabc123xyz");
    expect(a).toBe(b);
    expect(a).toMatch(/^[A-Z0-9]{6}$/);
    expect(bookingReference("cmuabc123xyz")).not.toBe(bookingReference("cmuabc999zzz"));
  });

  it("pesan konfirmasi memuat kode, nama pemesan & layanan", () => {
    const msg = bookingConfirmationMessage({
      tenantName: "ABC Teknik", bookerName: "Budi", reference: "3XYZ9C",
      serviceName: "CLEANING", preferredDate: "2026-11-01",
    });
    expect(msg).toContain("3XYZ9C");
    expect(msg).toContain("Budi");
    expect(msg).toContain("ABC Teknik");
    expect(msg).toContain("CLEANING");
    expect(msg).toContain("2026-11-01");
  });

  it("tanpa layanan/tanggal → pesan tetap rapi", () => {
    const msg = bookingConfirmationMessage({
      tenantName: "ABC", bookerName: "Sari", reference: "ABC123",
    });
    expect(msg).toContain("ABC123");
    expect(msg).not.toMatch(/Layanan:\s*$/m);
  });
});

describe("server action booking → konfirmasi WA pemesan (G13)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    leadFindUnique.mockResolvedValue(null);
    leadCreate.mockResolvedValue({ id: "lead-1", tenantId: "t1", name: "Budi", phone: "628123456789" });
    notificationCreate.mockResolvedValue({});
    messageLogCreate.mockResolvedValue({ id: "ml1" });
    tenantFindUnique.mockResolvedValue({
      id: "t1", name: "ABC Teknik", waVerifiedPhone: "628990000111",
    });
  });

  it("lead baru + sesi WA tersambung → konfirmasi diantre ke nomor PEMESAN", async () => {
    const res = await submitBooking("abc-teknik", form({
      name: "Budi", phone: "08123456789", serviceType: "CLEANING", requestId: "req-1",
    }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // Kode booking dikembalikan ke pemesan (bukti).
    expect(res.reference).toBe(bookingReference("lead-1"));
    expect(res.confirmationSent).toBe(true);
    const d = messageLogCreate.mock.calls[0][0].data;
    expect(d.toPhone).toBe("628123456789"); // nomor pemesan, bukan tenant
    expect(d.status).toBe("QUEUED");
    expect(d.templateKey).toBe("BOOKING_CONFIRM");
    expect(d.body).toContain(res.reference);
  });

  it("submit ulang (token sama) → lead sama, konfirmasi TIDAK diantre dua kali", async () => {
    leadFindUnique.mockResolvedValue({ id: "lead-1", tenantId: "t1", name: "Budi", phone: "628123456789" });
    const res = await submitBooking("abc-teknik", form({
      name: "Budi", phone: "08123456789", serviceType: "CLEANING", requestId: "req-1",
    }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.confirmationSent).toBe(false);
    expect(messageLogCreate).not.toHaveBeenCalled();
    expect(leadCreate).not.toHaveBeenCalled();
  });

  it("sesi WA tenant BELUM tersambung → tak ada WA, tapi booking tetap sukses + kode tampil", async () => {
    tenantFindUnique.mockResolvedValue({ id: "t1", name: "ABC Teknik", waVerifiedPhone: null });
    const res = await submitBooking("abc-teknik", form({
      name: "Budi", phone: "08123456789", serviceType: "CLEANING", requestId: "req-2",
    }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.confirmationSent).toBe(false);
    expect(res.reference).toBe(bookingReference("lead-1"));
    expect(messageLogCreate).not.toHaveBeenCalled();
  });

  it("gagal antre konfirmasi → booking TIDAK gagal (kode tetap dikembalikan)", async () => {
    messageLogCreate.mockRejectedValue(new Error("db down"));
    const res = await submitBooking("abc-teknik", form({
      name: "Budi", phone: "08123456789", serviceType: "CLEANING", requestId: "req-3",
    }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.reference).toBe(bookingReference("lead-1"));
    expect(res.confirmationSent).toBe(false);
  });
});
