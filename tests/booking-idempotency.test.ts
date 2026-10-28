import { describe, it, expect, vi, beforeEach } from "vitest";

// REGRESSION (F3 / G11): booking publik harus idempoten & failure-safe.
//  - Submit ulang dengan token sama → lead SAMA (tak ada lead ganda).
//  - Notifikasi owner GAGAL → booking tetap dianggap berhasil (lead sudah
//    tersimpan); pemesan tak mengulang → tak ada lead ganda.

vi.mock("server-only", () => ({}));

const { leadFindUnique, leadCreate, tenantFindUnique, notificationCreate } = vi.hoisted(() => ({
  leadFindUnique: vi.fn(),
  leadCreate: vi.fn(),
  tenantFindUnique: vi.fn(),
  notificationCreate: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { findUnique: leadFindUnique, create: leadCreate },
    tenant: { findUnique: tenantFindUnique },
    tenantNotification: { create: notificationCreate },
  },
}));
vi.mock("@/lib/validation/booking", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/validation/booking")>("../src/lib/validation/booking");
  return { ...actual, looksLikeSpam: () => false };
});

import { createLeadFromBooking } from "../src/lib/services/lead-service";

const INPUT = { name: "Budi", phone: "628123456789", note: undefined, preferredDate: undefined, serviceType: "CLEANING" as const };

describe("booking idempoten (G11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    leadFindUnique.mockResolvedValue(null);
    leadCreate.mockResolvedValue({ id: "lead-1", tenantId: "t1", name: "Budi", phone: "628123456789" });
  });

  it("token baru → lead dibuat dengan requestId, alreadyBooked=false (konfirmasi WA layak dikirim)", async () => {
    const { lead, alreadyBooked } = await createLeadFromBooking("t1", INPUT, "req-1");
    expect(lead.id).toBe("lead-1");
    expect(alreadyBooked).toBe(false);
    expect(leadCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ requestId: "req-1", tenantId: "t1" }),
    }));
  });

  it("token yang sudah dipakai → lead yang sama + alreadyBooked=true (konfirmasi TAK diulang)", async () => {
    leadFindUnique.mockResolvedValue({ id: "lead-1", tenantId: "t1", name: "Budi", phone: "628123456789" });
    const { lead, alreadyBooked } = await createLeadFromBooking("t1", INPUT, "req-1");
    expect(lead.id).toBe("lead-1");
    expect(alreadyBooked).toBe(true);
    expect(leadCreate).not.toHaveBeenCalled();
  });

  it("balapan dua submit dengan token sama (P2002) → lead yang sama + alreadyBooked=true", async () => {
    leadFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "lead-existing", tenantId: "t1" });
    leadCreate.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));
    const { lead, alreadyBooked } = await createLeadFromBooking("t1", INPUT, "req-2");
    expect(lead.id).toBe("lead-existing");
    expect(alreadyBooked).toBe(true);
  });

  it("tanpa token (booking legacy) → tetap buat lead, requestId null", async () => {
    await createLeadFromBooking("t1", INPUT);
    expect(leadCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ requestId: null }),
    }));
  });

  it("P2002 tanpa token → error diteruskan (bukan ditelan diam-diam)", async () => {
    leadCreate.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));
    await expect(createLeadFromBooking("t1", INPUT)).rejects.toThrow("unique");
  });
});
