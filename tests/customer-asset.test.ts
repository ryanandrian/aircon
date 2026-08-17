import { describe, it, expect } from "vitest";
import {
  createCustomerSchema,
  updateCustomerSchema,
} from "../src/lib/validation/customer";
import {
  createAssetSchema,
  updateAssetSchema,
} from "../src/lib/validation/asset";

describe("createCustomerSchema", () => {
  it("menerima input valid lengkap", () => {
    const r = createCustomerSchema.safeParse({
      name: "Budi Santoso",
      phone: "081234567890",
      source: "WHATSAPP",
      geoLat: -6.2,
      geoLng: 106.8,
      address: "Jl. Merdeka 1",
      notes: "pelanggan tetap",
    });
    expect(r.success).toBe(true);
  });

  it("menerima input minimal (hanya name & phone)", () => {
    const r = createCustomerSchema.safeParse({
      name: "Ani",
      phone: "0812",
    });
    expect(r.success).toBe(true);
  });

  it("menolak nama kosong", () => {
    const r = createCustomerSchema.safeParse({ name: "", phone: "0812" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.map(String).includes("name"))).toBe(true);
    }
  });

  it("menolak nama hanya spasi", () => {
    const r = createCustomerSchema.safeParse({ name: "   ", phone: "0812" });
    expect(r.success).toBe(false);
  });

  it("menolak phone kosong", () => {
    const r = createCustomerSchema.safeParse({ name: "Budi", phone: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.map(String).includes("phone"))).toBe(true);
    }
  });

  it("menolak phone tanpa digit sama sekali", () => {
    const r = createCustomerSchema.safeParse({ name: "Budi", phone: "abc-()" });
    expect(r.success).toBe(false);
  });

  it("menolak source enum yang salah", () => {
    const r = createCustomerSchema.safeParse({
      name: "Budi",
      phone: "0812",
      source: "TIKTOK",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.map(String).includes("source"))).toBe(true);
    }
  });

  it("menolak geoLat non-number", () => {
    const r = createCustomerSchema.safeParse({
      name: "Budi",
      phone: "0812",
      geoLat: "bukan angka",
    });
    expect(r.success).toBe(false);
  });

  describe("normalisasi phone", () => {
    it("0812... -> 62812...", () => {
      const r = createCustomerSchema.safeParse({
        name: "Budi",
        phone: "081234567890",
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.phone).toBe("6281234567890");
    });

    it("format dengan spasi & tanda hubung dibersihkan", () => {
      const r = createCustomerSchema.safeParse({
        name: "Budi",
        phone: "0812-3456 7890",
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.phone).toBe("6281234567890");
    });

    it("format +62 dinormalisasi ke digit tanpa plus", () => {
      const r = createCustomerSchema.safeParse({
        name: "Budi",
        phone: "+6281234567890",
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.phone).toBe("6281234567890");
    });

    it("leading 620 dikoreksi menjadi 62", () => {
      const r = createCustomerSchema.safeParse({
        name: "Budi",
        phone: "6208123456789",
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.phone).toBe("628123456789");
    });
  });
});

describe("updateCustomerSchema", () => {
  it("menerima objek kosong (partial, tak ada field wajib)", () => {
    const r = updateCustomerSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("menormalisasi phone saat disertakan", () => {
    const r = updateCustomerSchema.safeParse({ phone: "081234567890" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phone).toBe("6281234567890");
  });

  it("menolak name kosong saat disertakan", () => {
    const r = updateCustomerSchema.safeParse({ name: "" });
    expect(r.success).toBe(false);
  });

  it("menolak source invalid saat disertakan", () => {
    const r = updateCustomerSchema.safeParse({ source: "FOO" });
    expect(r.success).toBe(false);
  });
});

describe("createAssetSchema", () => {
  it("menerima input valid lengkap", () => {
    const r = createAssetSchema.safeParse({
      customerId: "cus_123",
      type: "SPLIT",
      brand: "Daikin",
      model: "FTKC",
      capacityPk: 1.5,
      roomLocation: "Kamar utama",
      serial: "SN-001",
      maintenanceIntervalDays: 90,
    });
    expect(r.success).toBe(true);
  });

  it("menerima input minimal (customerId & type)", () => {
    const r = createAssetSchema.safeParse({
      customerId: "cus_123",
      type: "CASSETTE",
    });
    expect(r.success).toBe(true);
  });

  it("menolak customerId kosong", () => {
    const r = createAssetSchema.safeParse({ customerId: "", type: "SPLIT" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.map(String).includes("customerId"))).toBe(true);
    }
  });

  it("menolak type enum yang salah", () => {
    const r = createAssetSchema.safeParse({
      customerId: "cus_123",
      type: "PORTABLE",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.map(String).includes("type"))).toBe(true);
    }
  });

  it("menolak capacityPk negatif", () => {
    const r = createAssetSchema.safeParse({
      customerId: "cus_123",
      type: "SPLIT",
      capacityPk: -1,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.map(String).includes("capacityPk"))).toBe(true);
    }
  });

  it("menolak capacityPk nol (harus positif)", () => {
    const r = createAssetSchema.safeParse({
      customerId: "cus_123",
      type: "SPLIT",
      capacityPk: 0,
    });
    expect(r.success).toBe(false);
  });

  it("menolak maintenanceIntervalDays nol atau negatif", () => {
    expect(
      createAssetSchema.safeParse({
        customerId: "cus_123",
        type: "SPLIT",
        maintenanceIntervalDays: 0,
      }).success,
    ).toBe(false);
    expect(
      createAssetSchema.safeParse({
        customerId: "cus_123",
        type: "SPLIT",
        maintenanceIntervalDays: -5,
      }).success,
    ).toBe(false);
  });

  it("menolak maintenanceIntervalDays non-integer", () => {
    const r = createAssetSchema.safeParse({
      customerId: "cus_123",
      type: "SPLIT",
      maintenanceIntervalDays: 30.5,
    });
    expect(r.success).toBe(false);
  });

  it("menerima installedAt sebagai tanggal ISO (coerced)", () => {
    const r = createAssetSchema.safeParse({
      customerId: "cus_123",
      type: "SPLIT",
      installedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.installedAt).toBeInstanceOf(Date);
  });
});

describe("updateAssetSchema", () => {
  it("menerima objek kosong (partial)", () => {
    expect(updateAssetSchema.safeParse({}).success).toBe(true);
  });

  it("menolak customerId kosong saat disertakan", () => {
    expect(updateAssetSchema.safeParse({ customerId: "" }).success).toBe(false);
  });

  it("menolak capacityPk negatif saat disertakan", () => {
    expect(updateAssetSchema.safeParse({ capacityPk: -2 }).success).toBe(false);
  });

  it("menolak type invalid saat disertakan", () => {
    expect(updateAssetSchema.safeParse({ type: "XYZ" }).success).toBe(false);
  });
});
