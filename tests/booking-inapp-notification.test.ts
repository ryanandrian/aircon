import { describe, it, expect, vi, beforeEach } from "vitest";

// REGRESSION (F3/F5 / G18): teks notifikasi in-app booking dulu hardcode
// di `createTenantBookingNotification`. Sekarang dibaca dari katalog template
// platform (editable admin), fallback default render dari template yang sama —
// SATU sumber copy, bukan string terpisah.

vi.mock("server-only", () => ({}));

const { platformTemplateFindUnique, tenantNotificationCreate } = vi.hoisted(() => ({
  platformTemplateFindUnique: vi.fn(),
  tenantNotificationCreate: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    platformTemplate: { findUnique: platformTemplateFindUnique },
    tenantNotification: { create: tenantNotificationCreate },
  },
}));

import { createTenantBookingNotification } from "../src/lib/services/tenant-notification-service";

describe("notifikasi in-app booking — copy dari katalog (G18)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    platformTemplateFindUnique.mockResolvedValue(null); // belum ada override → default
    tenantNotificationCreate.mockResolvedValue({ id: "n1" });
  });

  it("default: judul & isi dibuat dari template, tanpa string terpisah", async () => {
    await createTenantBookingNotification({ tenantId: "t1", leadId: "l1", name: "Budi", service: "CLEANING" });
    const data = tenantNotificationCreate.mock.calls[0][0].data;
    expect(data.title).toBe("Booking online baru");
    expect(data.body).toContain("Budi");
    expect(data.body).toContain(" · CLEANING");
    expect(data.body).not.toContain("{{");
    expect(data.dedupeKey).toBe("new-lead:l1");
  });

  it("tanpa layanan → kalimat tetap rapi (tak ada separator menggantung)", async () => {
    await createTenantBookingNotification({ tenantId: "t1", leadId: "l1", name: "Budi" });
    const body = tenantNotificationCreate.mock.calls[0][0].data.body;
    expect(body).toContain("permintaan booking.");
    expect(body).not.toMatch(/booking\s+\./);
  });

  it("override admin (baris PlatformTemplate) yang dipakai", async () => {
    platformTemplateFindUnique.mockResolvedValue({
      key: "booking_inapp",
      subject: "Prospek baru masuk",
      body: "Ada yang daftar: {{nama}}{{layanan}}",
      version: 3,
      updatedBy: "admin@x.id",
    });
    await createTenantBookingNotification({ tenantId: "t1", leadId: "l1", name: "Sari", service: "REPAIR" });
    const data = tenantNotificationCreate.mock.calls[0][0].data;
    expect(data.title).toBe("Prospek baru masuk");
    expect(data.body).toBe("Ada yang daftar: Sari · REPAIR");
    expect(data.body).not.toContain("{{");
  });

  it("notifikasi sudah ada (P2002) → null, tanpa error", async () => {
    tenantNotificationCreate.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));
    const r = await createTenantBookingNotification({ tenantId: "t1", leadId: "l1", name: "Budi" });
    expect(r).toBeNull();
  });
});
