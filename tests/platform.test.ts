import { describe, it, expect } from "vitest";
import {
  formatTenantStatus,
  tenantHealth,
  formatPaymentStatus,
} from "../src/lib/services/platform-format";

describe("formatTenantStatus", () => {
  it("memberi label Indonesia untuk tiap status", () => {
    expect(formatTenantStatus("TRIAL")).toBe("Basic (Gratis)");
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

  it("ACTIVE selalu sehat", () => {
    expect(tenantHealth("ACTIVE")).toBe("sehat");
  });

  it("PAST_DUE = perhatian", () => {
    expect(tenantHealth("PAST_DUE")).toBe("perhatian");
  });

  it("SUSPENDED & CANCELLED = bermasalah", () => {
    expect(tenantHealth("SUSPENDED")).toBe("bermasalah");
    expect(tenantHealth("CANCELLED")).toBe("bermasalah");
  });

  it("Basic (autoReminder=false) tidak ditampilkan sebagai trial berakhir", () => {
    expect(tenantHealth("TRIAL")).toBe("sehat");
  });
});
