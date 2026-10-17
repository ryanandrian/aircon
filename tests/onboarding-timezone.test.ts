import { describe, it, expect } from "vitest";
// L1 bagian onboarding (keputusan K7, 2026-10-17) — zona waktu tenant DIPILIH saat
// onboarding, default WIB, divalidasi di skema murni (tanpa DB, tanpa mock).
import {
  onboardingSchema,
  DEFAULT_TENANT_TZ,
  TENANT_TIMEZONE_OPTIONS,
} from "@/lib/validation/onboarding";
import { tenantTimeZone } from "@/lib/domain/tenant-timezone";

const base = {
  businessName: "AC Sejuk Jaya",
  city: "Bandung",
  whatsappPhone: "081234567890",
};

describe("onboarding + zona waktu tenant (K7)", () => {
  it("UI menyediakan WIB / WITA / WIT, dengan WIB sebagai bawaan", () => {
    const values = TENANT_TIMEZONE_OPTIONS.map((o) => o.value);
    expect(values).toEqual(["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"]);
    expect(DEFAULT_TENANT_TZ).toBe("Asia/Jakarta");
    // Bawaan UI harus benar-benar opsi yang ada.
    expect(values).toContain(DEFAULT_TENANT_TZ);
  });

  it("form TANPA field zona (versi lama) tetap lolos & bawaan WIB", () => {
    const r = onboardingSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(tenantTimeZone(r.data.timezone)).toBe("Asia/Jakarta");
  });

  it("field kosong → WIB (bukan error)", () => {
    const r = onboardingSchema.safeParse({ ...base, timezone: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(tenantTimeZone(r.data.timezone)).toBe("Asia/Jakarta");
  });

  it("pilihan WITA/WIT diterima utuh", () => {
    for (const tz of ["Asia/Makassar", "Asia/Jayapura"]) {
      const r = onboardingSchema.safeParse({ ...base, timezone: tz });
      expect(r.success).toBe(true);
      if (r.success) expect(tenantTimeZone(r.data.timezone)).toBe(tz);
    }
  });

  it("zona tak dikenal DITOLAK (tidak diam-diam jadi WIB — owner harus tahu inputnya salah)", () => {
    const r = onboardingSchema.safeParse({ ...base, timezone: "Bukan/Zona" });
    expect(r.success).toBe(false);
  });
});