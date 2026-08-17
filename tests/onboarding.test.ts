import { describe, it, expect } from "vitest";
import {
  onboardingSchema,
  normalizeWhatsappPhone,
  MIN_BUSINESS_NAME_LEN,
  MAX_BUSINESS_NAME_LEN,
  MIN_CITY_LEN,
  MAX_CITY_LEN,
} from "../src/lib/validation/onboarding";

describe("normalizeWhatsappPhone", () => {
  it("membuang karakter non-digit", () => {
    expect(normalizeWhatsappPhone("0812-3456 7890")).toBe("6281234567890");
  });
  it("mengubah awalan 0 menjadi 62", () => {
    expect(normalizeWhatsappPhone("081234567890")).toBe("6281234567890");
  });
  it("merapikan awalan 620 menjadi 62", () => {
    expect(normalizeWhatsappPhone("6208123456")).toBe("628123456");
  });
  it("membiarkan nomor yang sudah 62", () => {
    expect(normalizeWhatsappPhone("6281234567890")).toBe("6281234567890");
  });
});

describe("onboardingSchema", () => {
  it("menerima input valid lengkap", () => {
    const r = onboardingSchema.safeParse({
      businessName: "AC Sejuk Jaya",
      city: "Bandung",
      whatsappPhone: "0812-3456-7890",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.businessName).toBe("AC Sejuk Jaya");
      expect(r.data.city).toBe("Bandung");
      expect(r.data.whatsappPhone).toBe("6281234567890"); // ternormalisasi
    }
  });

  it("memangkas spasi pada nama usaha & kota", () => {
    const r = onboardingSchema.safeParse({
      businessName: "  AC Sejuk  ",
      city: "  Bandung ",
      whatsappPhone: "081234567890",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.businessName).toBe("AC Sejuk");
      expect(r.data.city).toBe("Bandung");
    }
  });

  it("menolak nama usaha < 2 karakter", () => {
    const r = onboardingSchema.safeParse({
      businessName: "A",
      city: "Bandung",
      whatsappPhone: "081234567890",
    });
    expect(r.success).toBe(false);
  });

  it("menolak nama usaha kosong / hanya spasi", () => {
    const r = onboardingSchema.safeParse({
      businessName: "   ",
      city: "Bandung",
      whatsappPhone: "081234567890",
    });
    expect(r.success).toBe(false);
  });

  it("menolak nama usaha kepanjangan", () => {
    const r = onboardingSchema.safeParse({
      businessName: "x".repeat(MAX_BUSINESS_NAME_LEN + 1),
      city: "Bandung",
      whatsappPhone: "081234567890",
    });
    expect(r.success).toBe(false);
  });

  it("menolak kota kosong", () => {
    const r = onboardingSchema.safeParse({
      businessName: "AC Sejuk",
      city: "",
      whatsappPhone: "081234567890",
    });
    expect(r.success).toBe(false);
  });

  it("menolak kota < 2 karakter", () => {
    const r = onboardingSchema.safeParse({
      businessName: "AC Sejuk",
      city: "B",
      whatsappPhone: "081234567890",
    });
    expect(r.success).toBe(false);
  });

  it("menolak kota kepanjangan", () => {
    const r = onboardingSchema.safeParse({
      businessName: "AC Sejuk",
      city: "x".repeat(MAX_CITY_LEN + 1),
      whatsappPhone: "081234567890",
    });
    expect(r.success).toBe(false);
  });

  it("menolak whatsappPhone kosong", () => {
    const r = onboardingSchema.safeParse({
      businessName: "AC Sejuk",
      city: "Bandung",
      whatsappPhone: "",
    });
    expect(r.success).toBe(false);
  });

  it("menolak whatsappPhone tanpa digit cukup", () => {
    const r = onboardingSchema.safeParse({
      businessName: "AC Sejuk",
      city: "Bandung",
      whatsappPhone: "12",
    });
    expect(r.success).toBe(false);
  });

  it("mengekspos batas panjang sebagai konstanta", () => {
    expect(MIN_BUSINESS_NAME_LEN).toBe(2);
    expect(MAX_BUSINESS_NAME_LEN).toBe(60);
    expect(MIN_CITY_LEN).toBe(2);
    expect(MAX_CITY_LEN).toBe(60);
  });
});
