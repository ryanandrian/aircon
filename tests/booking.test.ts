import { describe, it, expect } from "vitest";
import {
  publicBookingSchema,
  normalizeBookingPhone,
  MAX_NAME_LEN,
  MAX_NOTE_LEN,
  HONEYPOT_FIELD,
  looksLikeSpam,
} from "../src/lib/validation/booking";

describe("normalizeBookingPhone", () => {
  it("membuang karakter non-digit", () => {
    expect(normalizeBookingPhone("0812-3456 7890")).toBe("6281234567890");
  });
  it("mengubah awalan 0 menjadi 62", () => {
    expect(normalizeBookingPhone("081234567890")).toBe("6281234567890");
  });
  it("merapikan awalan 620 menjadi 62", () => {
    expect(normalizeBookingPhone("6208123456")).toBe("628123456");
  });
  it("membiarkan nomor yang sudah 62", () => {
    expect(normalizeBookingPhone("6281234567890")).toBe("6281234567890");
  });
});

describe("publicBookingSchema", () => {
  it("menerima input valid lengkap", () => {
    const r = publicBookingSchema.safeParse({
      name: "Budi Santoso",
      phone: "0812-3456-7890",
      serviceType: "CLEANING",
      note: "AC kamar bocor",
      preferredDate: "2026-09-01",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("Budi Santoso");
      expect(r.data.phone).toBe("6281234567890"); // ternormalisasi
      expect(r.data.serviceType).toBe("CLEANING");
    }
  });

  it("menerima input minimal (hanya name + phone)", () => {
    const r = publicBookingSchema.safeParse({
      name: "Ani",
      phone: "081200001111",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.serviceType).toBeUndefined();
      expect(r.data.note).toBeUndefined();
    }
  });

  it("menolak nama kosong", () => {
    const r = publicBookingSchema.safeParse({ name: "", phone: "081234567890" });
    expect(r.success).toBe(false);
  });

  it("menolak nama hanya spasi", () => {
    const r = publicBookingSchema.safeParse({ name: "   ", phone: "081234567890" });
    expect(r.success).toBe(false);
  });

  it("menolak phone kosong", () => {
    const r = publicBookingSchema.safeParse({ name: "Budi", phone: "" });
    expect(r.success).toBe(false);
  });

  it("menolak phone tanpa digit cukup", () => {
    const r = publicBookingSchema.safeParse({ name: "Budi", phone: "12" });
    expect(r.success).toBe(false);
  });

  it("menolak serviceType yang tidak dikenal", () => {
    const r = publicBookingSchema.safeParse({
      name: "Budi",
      phone: "081234567890",
      serviceType: "NUKLIR",
    });
    expect(r.success).toBe(false);
  });

  it("menerima semua serviceType yang valid", () => {
    for (const st of [
      "CLEANING",
      "REFILL_FREON",
      "REPAIR",
      "INSTALL",
      "DISMANTLE",
      "INSPECTION",
      "OTHER",
    ]) {
      const r = publicBookingSchema.safeParse({
        name: "Budi",
        phone: "081234567890",
        serviceType: st,
      });
      expect(r.success).toBe(true);
    }
  });

  it("menolak nama kepanjangan (anti-spam)", () => {
    const r = publicBookingSchema.safeParse({
      name: "x".repeat(MAX_NAME_LEN + 1),
      phone: "081234567890",
    });
    expect(r.success).toBe(false);
  });

  it("menolak note kepanjangan (anti-spam)", () => {
    const r = publicBookingSchema.safeParse({
      name: "Budi",
      phone: "081234567890",
      note: "x".repeat(MAX_NOTE_LEN + 1),
    });
    expect(r.success).toBe(false);
  });

  it("membuang string kosong opsional menjadi undefined", () => {
    const r = publicBookingSchema.safeParse({
      name: "Budi",
      phone: "081234567890",
      note: "",
      preferredDate: "",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.note).toBeUndefined();
      expect(r.data.preferredDate).toBeUndefined();
    }
  });

  it("memangkas spasi pada nama", () => {
    const r = publicBookingSchema.safeParse({
      name: "  Budi  ",
      phone: "081234567890",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe("Budi");
  });
});

describe("anti-spam: honeypot", () => {
  it("mengekspos nama field honeypot", () => {
    expect(typeof HONEYPOT_FIELD).toBe("string");
    expect(HONEYPOT_FIELD.length).toBeGreaterThan(0);
  });

  it("looksLikeSpam true bila honeypot terisi", () => {
    expect(looksLikeSpam({ name: "Budi", note: "halo", [HONEYPOT_FIELD]: "bot" })).toBe(true);
  });

  it("looksLikeSpam false bila honeypot kosong/absen", () => {
    expect(looksLikeSpam({ name: "Budi", note: "AC bocor" })).toBe(false);
    expect(looksLikeSpam({ name: "Budi", note: "AC bocor", [HONEYPOT_FIELD]: "" })).toBe(false);
  });
});

describe("anti-spam: URL berlebih", () => {
  it("looksLikeSpam true bila note punya banyak URL", () => {
    const note = "cek http://a.com http://b.com https://c.net www.d.io";
    expect(looksLikeSpam({ name: "Budi", note })).toBe(true);
  });

  it("looksLikeSpam false untuk note wajar dengan satu tautan", () => {
    expect(looksLikeSpam({ name: "Budi", note: "lokasi maps.app/abc" })).toBe(false);
  });

  it("looksLikeSpam true bila nama mengandung URL", () => {
    expect(looksLikeSpam({ name: "beli murah http://spam.ru", note: "" })).toBe(true);
  });
});
