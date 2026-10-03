import { describe, it, expect } from "vitest";
import { planQuotaLines } from "../src/lib/billing/plan-display";

const quotas = { maxTechnicians: 2, maxAdmins: 0, maxCustomers: 5, maxAcUnits: 10 };

const manualReminder =
  "Pengingat Jatuh Tempo Perawatan AC manual dikirim via Whatsapp kepada Pelanggan Anda";
const automaticReminder =
  "Pengingat Jatuh Tempo Perawatan AC otomatis terkirim via Whatsapp kepada Pelanggan Anda";

describe("planQuotaLines — format kuota & fitur paket seragam (1 sumber)", () => {
  it("paket non-gateway: Booking Online dan pengingat manual menjadi dua baris fitur", () => {
    const lines = planQuotaLines({ ...quotas, autoReminder: false });
    expect(lines).toEqual([
      "2 teknisi (termasuk helper)",
      "Dijalankan pemilik sendiri",
      "5 pelanggan",
      "10 unit AC",
      "Booking Online",
      manualReminder,
    ]);
  });

  it("paket gateway (autoReminder): reminder ditampilkan sebagai otomatis", () => {
    const lines = planQuotaLines({ ...quotas, autoReminder: true });
    expect(lines.slice(-2)).toEqual(["Booking Online", automaticReminder]);
  });

  it("Pro: kuota admin dan pelanggan benar", () => {
    const lines = planQuotaLines({
      maxTechnicians: 5, maxAdmins: 1, maxCustomers: 200, maxAcUnits: 500, autoReminder: true,
    });
    expect(lines[0]).toBe("5 teknisi (termasuk helper)");
    expect(lines[1]).toBe("1 admin");
    expect(lines[2]).toBe("200 pelanggan");
  });

  it("Business: semua kuota tanpa batas (null), tetap dua fitur terpisah", () => {
    const lines = planQuotaLines({
      maxTechnicians: null, maxAdmins: null, maxCustomers: null, maxAcUnits: null, autoReminder: true,
    });
    expect(lines.slice(0, 4)).toEqual([
      "Teknisi tanpa batas", "Admin tanpa batas", "Pelanggan tanpa batas", "Unit AC tanpa batas",
    ]);
    expect(lines.slice(-2)).toEqual(["Booking Online", automaticReminder]);
  });
});
