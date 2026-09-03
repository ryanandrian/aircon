import { describe, it, expect } from "vitest";
import { blockedSendReason, normalizePhone } from "../src/lib/wa/gateway";

describe("blockedSendReason — guard anti-spam WA", () => {
  it("default (tanpa flag): izinkan nomor valid 62xxx", () => {
    expect(blockedSendReason("6281234567890")).toBeNull();
    expect(blockedSendReason("62899000100")).toBeNull();
  });

  it("default: tolak nomor jelas-invalid (bukan 62 / terlalu pendek)", () => {
    expect(blockedSendReason("12345")).not.toBeNull();
    expect(blockedSendReason("081234")).not.toBeNull(); // jadi 6281234 (<10) → blok
  });

  it("SAFE_MODE: hanya nomor demo 62899000xxx yang boleh", () => {
    expect(blockedSendReason("62899000123", { safeMode: true })).toBeNull();
    // nomor menyerupai asli (insiden 62812) HARUS diblokir di safe mode
    expect(blockedSendReason("628121023331", { safeMode: true })).not.toBeNull();
    expect(blockedSendReason("6281234567890", { safeMode: true })).not.toBeNull();
  });

  it("ALLOWLIST: hanya nomor dalam daftar (menang atas safeMode)", () => {
    const allowlist = "6281284848901, 62899000100";
    expect(blockedSendReason("6281284848901", { allowlist })).toBeNull();
    expect(blockedSendReason("628121023331", { allowlist })).not.toBeNull();
    // allowlist menormalkan input (0812.. → 62812..)
    expect(blockedSendReason("081284848901", { allowlist })).toBeNull();
  });

  it("normalizePhone konsisten dengan guard", () => {
    expect(normalizePhone("0812-3456 7890")).toBe("6281234567890");
    expect(normalizePhone("+62 899 000 100")).toBe("62899000100");
  });
});
