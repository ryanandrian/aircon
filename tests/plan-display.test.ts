import { describe, it, expect } from "vitest";
import { planQuotaLines } from "../src/lib/billing/plan-display";

describe("planQuotaLines — format kuota paket seragam (1 sumber)", () => {
  it("Basic: teknisi terbatas, admin 0 → 'Dijalankan pemilik sendiri'", () => {
    const lines = planQuotaLines({ maxTechnicians: 2, maxAdmins: 0, maxCustomers: 5, maxAcUnits: 10 });
    expect(lines).toEqual([
      "2 teknisi (termasuk helper)",
      "Dijalankan pemilik sendiri",
      "5 pelanggan",
      "10 unit AC",
      "Booking online + pengingat WhatsApp",
    ]);
  });

  it("Pro: admin 1", () => {
    const lines = planQuotaLines({ maxTechnicians: 5, maxAdmins: 1, maxCustomers: 200, maxAcUnits: 500 });
    expect(lines[0]).toBe("5 teknisi (termasuk helper)");
    expect(lines[1]).toBe("1 admin");
    expect(lines[2]).toBe("200 pelanggan");
  });

  it("Business: semua tanpa batas (null)", () => {
    const lines = planQuotaLines({ maxTechnicians: null, maxAdmins: null, maxCustomers: null, maxAcUnits: null });
    expect(lines[0]).toBe("Teknisi tanpa batas");
    expect(lines[1]).toBe("Admin tanpa batas");
    expect(lines[2]).toBe("Pelanggan tanpa batas");
    expect(lines[3]).toBe("Unit AC tanpa batas");
  });

  it("Urutan resmi: Teknisi → Admin → Pelanggan → Unit → Booking (identik di marketing & in-app)", () => {
    const lines = planQuotaLines({ maxTechnicians: 3, maxAdmins: 2, maxCustomers: 100, maxAcUnits: 250 });
    expect(lines.length).toBe(5);
    expect(lines[4]).toBe("Booking online + pengingat WhatsApp");
  });
});
