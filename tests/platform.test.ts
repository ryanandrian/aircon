import { describe, it, expect } from "vitest";
import {
  formatTenantStatus,
  tenantHealth,
  formatPaymentStatus,
} from "../src/lib/services/platform-format";

describe("formatTenantStatus", () => {
  it("memberi label Indonesia untuk tiap status", () => {
    expect(formatTenantStatus("TRIAL")).toBe("Masa Coba");
    expect(formatTenantStatus("ACTIVE")).toBe("Aktif");
    expect(formatTenantStatus("PAST_DUE")).toBe("Menunggak");
    expect(formatTenantStatus("SUSPENDED")).toBe("Ditangguhkan");
    expect(formatTenantStatus("CANCELLED")).toBe("Berhenti");
  });
});

describe("formatPaymentStatus", () => {
  it("memberi label Indonesia untuk tiap status pembayaran", () => {
    expect(formatPaymentStatus("PENDING")).toBe("Menunggu");
    expect(formatPaymentStatus("PAID")).toBe("Lunas");
    expect(formatPaymentStatus("FAILED")).toBe("Gagal");
    expect(formatPaymentStatus("EXPIRED")).toBe("Kedaluwarsa");
    expect(formatPaymentStatus("REFUNDED")).toBe("Dikembalikan");
  });
});

describe("tenantHealth", () => {
  const now = new Date("2026-08-17T00:00:00.000Z");

  it("ACTIVE selalu sehat", () => {
    expect(tenantHealth("ACTIVE", null, now)).toBe("sehat");
  });

  it("PAST_DUE = perhatian", () => {
    expect(tenantHealth("PAST_DUE", null, now)).toBe("perhatian");
  });

  it("SUSPENDED & CANCELLED = bermasalah", () => {
    expect(tenantHealth("SUSPENDED", null, now)).toBe("bermasalah");
    expect(tenantHealth("CANCELLED", null, now)).toBe("bermasalah");
  });

  it("TRIAL dengan masa coba masih jauh = sehat", () => {
    const future = new Date("2026-08-30T00:00:00.000Z");
    expect(tenantHealth("TRIAL", future, now)).toBe("sehat");
  });

  it("TRIAL yang hampir/sudah berakhir (<=3 hari) = perhatian", () => {
    const soon = new Date("2026-08-19T00:00:00.000Z");
    expect(tenantHealth("TRIAL", soon, now)).toBe("perhatian");
    const past = new Date("2026-08-15T00:00:00.000Z");
    expect(tenantHealth("TRIAL", past, now)).toBe("perhatian");
  });

  it("TRIAL tanpa tanggal berakhir = perhatian (data tidak lengkap)", () => {
    expect(tenantHealth("TRIAL", null, now)).toBe("perhatian");
  });
});
